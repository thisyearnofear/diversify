/**
 * Request Batching Service
 * Groups similar API requests to reduce the number of calls
 */

interface PendingRequest {
  params: any;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

interface BatchConfig {
  maxSize: number;
  maxDelay: number;
  endpoint: string;
}

export class BatchRequestService {
  private pendingBatches = new Map<string, Map<string, PendingRequest[]>>();
  private batchTimers = new Map<string, any>();
  private readonly DEFAULT_BATCH_SIZE = 10;
  private readonly DEFAULT_MAX_DELAY = 50; // milliseconds

  /**
   * Batch a request for execution
   */
  async batchRequest<T>(
    endpoint: string,
    params: any,
    config: Partial<BatchConfig> = {}
  ): Promise<T> {
    const batchKey = this.generateBatchKey(endpoint, params);
    const fullConfig: BatchConfig = {
      maxSize: config.maxSize || this.DEFAULT_BATCH_SIZE,
      maxDelay: config.maxDelay || this.DEFAULT_MAX_DELAY,
      endpoint
    };

    return new Promise((resolve, reject) => {
      // Initialize batch if it doesn't exist
      if (!this.pendingBatches.has(endpoint)) {
        this.pendingBatches.set(endpoint, new Map());
      }

      const endpointBatches = this.pendingBatches.get(endpoint)!;
      
      if (!endpointBatches.has(batchKey)) {
        endpointBatches.set(batchKey, []);
      }

      const batch = endpointBatches.get(batchKey)!;
      batch.push({
        params,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Check if batch is ready to execute
      if (batch.length >= fullConfig.maxSize) {
        this.executeBatch(endpoint, batchKey);
      } else {
        // Schedule batch execution after delay
        this.scheduleBatchExecution(endpoint, batchKey, fullConfig.maxDelay);
      }
    });
  }

  /**
   * Execute a specific batch
   */
  private async executeBatch(endpoint: string, batchKey: string): Promise<void> {
    const endpointBatches = this.pendingBatches.get(endpoint);
    if (!endpointBatches) return;

    const batch = endpointBatches.get(batchKey);
    if (!batch || batch.length === 0) return;

    // Clear timer for this batch
    const timerKey = `${endpoint}-${batchKey}`;
    if (this.batchTimers.has(timerKey)) {
      clearTimeout(this.batchTimers.get(timerKey)!);
      this.batchTimers.delete(timerKey);
    }

    // Remove batch from pending
    endpointBatches.delete(batchKey);

    try {
      // Group requests by similar parameters
      const groupedRequests = this.groupSimilarRequests(batch);
      
      // Execute each group
      const results = await Promise.all(
        groupedRequests.map(group => this.executeGroup(endpoint, group))
      );

      // Flatten results and resolve individual promises
      const flattenedResults = results.flat();
      flattenedResults.forEach((result, index) => {
        if (index < batch.length) {
          batch[index].resolve(result);
        }
      });

    } catch (error) {
      // Reject all pending requests in the batch
      batch.forEach(request => request.reject(error));
    }
  }

  /**
   * Execute a group of similar requests
   */
  private async executeGroup(endpoint: string, requests: PendingRequest[]): Promise<any[]> {
    if (requests.length === 1) {
      // Single request - execute normally
      return [await this.makeSingleRequest(endpoint, requests[0].params)];
    }

    // Multiple requests - try to batch them
    try {
      return await this.makeBatchRequest(endpoint, requests.map(r => r.params));
    } catch (error) {
      // Fallback to individual requests if batching fails
      console.warn(`Batch request failed, falling back to individual requests:`, error);
      return Promise.all(
        requests.map(request => this.makeSingleRequest(endpoint, request.params))
      );
    }
  }

  /**
   * Make a single API request
   */
  private async makeSingleRequest(endpoint: string, params: any): Promise<any> {
    const url = this.buildUrl(endpoint, params);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Make a batch API request
   */
  private async makeBatchRequest(endpoint: string, paramSets: any[]): Promise<any[]> {
    // This would depend on the specific API - some APIs support batch endpoints
    const batchEndpoint = `${endpoint}/batch`;
    const response = await fetch(batchEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: paramSets })
    });

    if (!response.ok) {
      throw new Error(`Batch API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Group requests by similarity to maximize batching efficiency
   */
  private groupSimilarRequests(requests: PendingRequest[]): PendingRequest[][] {
    const groups: PendingRequest[][] = [];
    const processed = new Set<number>();

    requests.forEach((request, index) => {
      if (processed.has(index)) return;

      const group: PendingRequest[] = [request];
      processed.add(index);

      // Find similar requests
      requests.forEach((otherRequest, otherIndex) => {
        if (index !== otherIndex && !processed.has(otherIndex)) {
          if (this.areRequestsSimilar(request.params, otherRequest.params)) {
            group.push(otherRequest);
            processed.add(otherIndex);
          }
        }
      });

      groups.push(group);
    });

    return groups;
  }

  /**
   * Check if two request parameters are similar enough to batch
   */
  private areRequestsSimilar(params1: any, params2: any): boolean {
    // Simple similarity check - can be enhanced based on API requirements
    const keys1 = Object.keys(params1);
    const keys2 = Object.keys(params2);
    
    // Same number of parameters
    if (keys1.length !== keys2.length) return false;
    
    // Check if key sets match
    const commonKeys = keys1.filter(key => keys2.includes(key));
    if (commonKeys.length !== keys1.length) return false;
    
    // Check if values are compatible for batching
    return commonKeys.every(key => {
      const val1 = params1[key];
      const val2 = params2[key];
      
      // Allow batching if values are the same or both are arrays of similar length
      return val1 === val2 || 
             (Array.isArray(val1) && Array.isArray(val2) && 
              Math.abs(val1.length - val2.length) <= 2);
    });
  }

  /**
   * Generate a key for grouping similar requests
   */
  private generateBatchKey(endpoint: string, params: any): string {
    // Create a normalized key based on parameter structure
    const paramKeys = Object.keys(params).sort();
    const paramStructure = paramKeys.join('|');
    
    // Include endpoint to separate different API calls
    return `${endpoint}:${paramStructure}`;
  }

  /**
   * Build URL from endpoint and parameters
   */
  private buildUrl(endpoint: string, params: any): string {
    const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
    
    return url.toString();
  }

  /**
   * Schedule batch execution with delay
   */
  private scheduleBatchExecution(endpoint: string, batchKey: string, delay: number): void {
    const timerKey = `${endpoint}-${batchKey}`;
    
    // Clear existing timer
    if (this.batchTimers.has(timerKey)) {
      clearTimeout(this.batchTimers.get(timerKey)!);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.executeBatch(endpoint, batchKey);
      this.batchTimers.delete(timerKey);
    }, delay);

    this.batchTimers.set(timerKey, timer);
  }

  /**
   * Get current batch statistics
   */
  getStats(): {
    pendingBatches: number;
    totalPendingRequests: number;
    endpoints: string[];
  } {
    let totalRequests = 0;
    const endpoints: string[] = [];

    this.pendingBatches.forEach((endpointBatches, endpoint) => {
      endpoints.push(endpoint);
      endpointBatches.forEach(batch => {
        totalRequests += batch.length;
      });
    });

    return {
      pendingBatches: this.pendingBatches.size,
      totalPendingRequests: totalRequests,
      endpoints
    };
  }

  /**
   * Clear all pending batches
   */
  clear(): void {
    // Clear all timers
    this.batchTimers.forEach(timer => clearTimeout(timer));
    this.batchTimers.clear();
    
    // Clear all pending requests
    this.pendingBatches.clear();
  }
}

// Export singleton instance
export const batchService = new BatchRequestService();