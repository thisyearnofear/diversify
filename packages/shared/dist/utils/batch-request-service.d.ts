/**
 * Request Batching Service
 * Groups similar API requests to reduce the number of calls
 */
interface BatchConfig {
    maxSize: number;
    maxDelay: number;
    endpoint: string;
}
export declare class BatchRequestService {
    private pendingBatches;
    private batchTimers;
    private readonly DEFAULT_BATCH_SIZE;
    private readonly DEFAULT_MAX_DELAY;
    /**
     * Batch a request for execution
     */
    batchRequest<T>(endpoint: string, params: any, config?: Partial<BatchConfig>): Promise<T>;
    /**
     * Execute a specific batch
     */
    private executeBatch;
    /**
     * Execute a group of similar requests
     */
    private executeGroup;
    /**
     * Make a single API request
     */
    private makeSingleRequest;
    /**
     * Make a batch API request
     */
    private makeBatchRequest;
    /**
     * Group requests by similarity to maximize batching efficiency
     */
    private groupSimilarRequests;
    /**
     * Check if two request parameters are similar enough to batch
     */
    private areRequestsSimilar;
    /**
     * Generate a key for grouping similar requests
     */
    private generateBatchKey;
    /**
     * Build URL from endpoint and parameters
     */
    private buildUrl;
    /**
     * Schedule batch execution with delay
     */
    private scheduleBatchExecution;
    /**
     * Get current batch statistics
     */
    getStats(): {
        pendingBatches: number;
        totalPendingRequests: number;
        endpoints: string[];
    };
    /**
     * Clear all pending batches
     */
    clear(): void;
}
export declare const batchService: BatchRequestService;
export {};
//# sourceMappingURL=batch-request-service.d.ts.map