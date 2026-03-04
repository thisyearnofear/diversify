/**
 * API Efficiency Monitor
 * Centralized monitoring and initialization for all efficiency improvements
 */
import { unifiedCache } from './unified-cache-service';
import { batchService } from './batch-request-service';
import { circuitBreakerManager } from './circuit-breaker-service';
export declare class ApiEfficiencyMonitor {
    private initialized;
    private monitoringInterval;
    /**
     * Initialize all efficiency services
     */
    initialize(): Promise<void>;
    /**
     * Warm up cache with frequently requested data
     */
    private warmUpCache;
    /**
     * Start periodic monitoring
     */
    private startMonitoring;
    /**
     * Log performance metrics
     */
    private logPerformanceMetrics;
    /**
     * Get comprehensive efficiency report
     */
    getEfficiencyReport(): {
        cache: ReturnType<typeof unifiedCache.getStats>;
        batching: ReturnType<typeof batchService.getStats>;
        circuits: ReturnType<typeof circuitBreakerManager.getStats>;
        overallEfficiency: number;
    };
    /**
     * Reset all efficiency services
     */
    reset(): void;
    /**
     * Mock API call for testing
     */
    private mockApiCall;
    /**
     * Force open problematic circuits
     */
    forceOpenProblematicCircuits(): void;
    /**
     * Get detailed circuit information
     */
    getCircuitDetails(): Record<string, any>;
}
export declare const apiEfficiencyMonitor: ApiEfficiencyMonitor;
//# sourceMappingURL=api-efficiency-monitor.d.ts.map