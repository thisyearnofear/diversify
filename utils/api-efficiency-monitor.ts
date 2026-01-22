/**
 * API Efficiency Monitor
 * Centralized monitoring and initialization for all efficiency improvements
 */

import { unifiedCache } from './unified-cache-service';
import { batchService } from './batch-request-service';
import { circuitBreakerManager } from './circuit-breaker-service';

export class ApiEfficiencyMonitor {
  private initialized = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize all efficiency services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('API efficiency services already initialized');
      return;
    }

    console.log('Initializing API efficiency services...');
    
    try {
      // Warm up cache with common requests
      await this.warmUpCache();
      
      // Start monitoring
      this.startMonitoring();
      
      this.initialized = true;
      console.log('✓ API efficiency services initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize API efficiency services:', error);
      throw error;
    }
  }

  /**
   * Warm up cache with frequently requested data
   */
  private async warmUpCache(): Promise<void> {
    const warmupFunctions = [
      // Popular exchange rates
      () => unifiedCache.getOrFetch(
        'exchange-USD-EUR',
        () => this.mockApiCall('exchange', { from: 'USD', to: 'EUR' }),
        'volatile'
      ),
      () => unifiedCache.getOrFetch(
        'exchange-USD-GBP',
        () => this.mockApiCall('exchange', { from: 'USD', to: 'GBP' }),
        'volatile'
      ),
      
      // Major inflation data
      () => unifiedCache.getOrFetch(
        'inflation-major',
        () => this.mockApiCall('inflation', { countries: ['USA', 'DEU', 'GBR', 'JPN'] }),
        'moderate'
      ),
      
      // Common currency pairs
      () => unifiedCache.getOrFetch(
        'exchange-EUR-USD',
        () => this.mockApiCall('exchange', { from: 'EUR', to: 'USD' }),
        'volatile'
      )
    ];

    await unifiedCache.warmCache(warmupFunctions);
  }

  /**
   * Start periodic monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.logPerformanceMetrics();
    }, 60000); // Log every minute
  }

  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(): void {
    if (!this.initialized) return;

    const cacheStats = unifiedCache.getStats();
    const batchStats = batchService.getStats();
    const circuitStats = circuitBreakerManager.getStats();

    console.table({
      'Cache Size': cacheStats.size,
      'Cache Volatile Entries': cacheStats.categories.volatile,
      'Cache Moderate Entries': cacheStats.categories.moderate,
      'Pending Batches': batchStats.pendingBatches,
      'Total Pending Requests': batchStats.totalPendingRequests,
      'Total Circuits': circuitStats.totalCircuits,
      'Open Circuits': circuitStats.openCircuits,
      'Closed Circuits': circuitStats.closedCircuits
    });
  }

  /**
   * Get comprehensive efficiency report
   */
  getEfficiencyReport(): {
    cache: ReturnType<typeof unifiedCache.getStats>;
    batching: ReturnType<typeof batchService.getStats>;
    circuits: ReturnType<typeof circuitBreakerManager.getStats>;
    overallEfficiency: number;
  } {
    const cacheStats = unifiedCache.getStats();
    const batchStats = batchService.getStats();
    const circuitStats = circuitBreakerManager.getStats();

    // Calculate overall efficiency score (0-100)
    const cacheEfficiency = Math.min(100, (cacheStats.size / 1000) * 100);
    const batchingEfficiency = batchStats.pendingBatches > 0 ? 50 : 100;
    const circuitHealth = ((circuitStats.closedCircuits + circuitStats.halfOpenCircuits) / 
                          Math.max(1, circuitStats.totalCircuits)) * 100;

    const overallEfficiency = Math.round(
      (cacheEfficiency * 0.4) + 
      (batchingEfficiency * 0.3) + 
      (circuitHealth * 0.3)
    );

    return {
      cache: cacheStats,
      batching: batchStats,
      circuits: circuitStats,
      overallEfficiency
    };
  }

  /**
   * Reset all efficiency services
   */
  reset(): void {
    console.log('Resetting API efficiency services...');
    
    unifiedCache.clear();
    batchService.clear();
    circuitBreakerManager.resetAll();
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.initialized = false;
    console.log('✓ API efficiency services reset');
  }

  /**
   * Mock API call for testing
   */
  private async mockApiCall(type: string, params: any): Promise<{ data: any; source: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    return {
      data: { 
        type, 
        params, 
        timestamp: Date.now(),
        mock: true 
      },
      source: 'mock'
    };
  }

  /**
   * Force open problematic circuits
   */
  forceOpenProblematicCircuits(): void {
    const states = circuitBreakerManager.getAllStates();
    
    Object.entries(states).forEach(([serviceName, state]) => {
      if (state.failureCount > state.totalCalls * 0.5) { // >50% failure rate
        console.warn(`Force opening circuit for ${serviceName} due to high failure rate`);
        circuitBreakerManager.getCircuit(serviceName).forceOpen();
      }
    });
  }

  /**
   * Get detailed circuit information
   */
  getCircuitDetails(): Record<string, any> {
    const states = circuitBreakerManager.getAllStates();
    const details: Record<string, any> = {};
    
    Object.entries(states).forEach(([serviceName, state]) => {
      details[serviceName] = {
        state: state.state,
        failureRate: state.totalCalls > 0 ? 
          Math.round((state.totalFailures / state.totalCalls) * 100) : 0,
        successRate: state.totalCalls > 0 ? 
          Math.round((state.totalSuccesses / state.totalCalls) * 100) : 0,
        totalCalls: state.totalCalls
      };
    });
    
    return details;
  }
}

// Export singleton instance
export const apiEfficiencyMonitor = new ApiEfficiencyMonitor();

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  // Delay initialization to allow app to load
  setTimeout(() => {
    apiEfficiencyMonitor.initialize().catch(console.error);
  }, 1000);
}