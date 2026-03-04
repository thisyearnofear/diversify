"use strict";
/**
 * API Efficiency Monitor
 * Centralized monitoring and initialization for all efficiency improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiEfficiencyMonitor = exports.ApiEfficiencyMonitor = void 0;
const unified_cache_service_1 = require("./unified-cache-service");
const batch_request_service_1 = require("./batch-request-service");
const circuit_breaker_service_1 = require("./circuit-breaker-service");
class ApiEfficiencyMonitor {
    initialized = false;
    monitoringInterval = null;
    /**
     * Initialize all efficiency services
     */
    async initialize() {
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
        }
        catch (error) {
            console.error('Failed to initialize API efficiency services:', error);
            throw error;
        }
    }
    /**
     * Warm up cache with frequently requested data
     */
    async warmUpCache() {
        // Popular exchange rates
        await unified_cache_service_1.unifiedCache.getOrFetch('exchange-USD-EUR', () => this.mockApiCall('exchange', { from: 'USD', to: 'EUR' }), 'volatile');
        await unified_cache_service_1.unifiedCache.getOrFetch('exchange-USD-GBP', () => this.mockApiCall('exchange', { from: 'USD', to: 'GBP' }), 'volatile');
        // Major inflation data
        await unified_cache_service_1.unifiedCache.getOrFetch('inflation-major', () => this.mockApiCall('inflation', { countries: ['USA', 'DEU', 'GBR', 'JPN'] }), 'moderate');
        // Common currency pairs
        await unified_cache_service_1.unifiedCache.getOrFetch('exchange-EUR-USD', () => this.mockApiCall('exchange', { from: 'EUR', to: 'USD' }), 'volatile');
    }
    /**
     * Start periodic monitoring
     */
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.logPerformanceMetrics();
        }, 60000); // Log every minute
    }
    /**
     * Log performance metrics
     */
    logPerformanceMetrics() {
        if (!this.initialized)
            return;
        const cacheStats = unified_cache_service_1.unifiedCache.getStats();
        const batchStats = batch_request_service_1.batchService.getStats();
        const circuitStats = circuit_breaker_service_1.circuitBreakerManager.getStats();
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
    getEfficiencyReport() {
        const cacheStats = unified_cache_service_1.unifiedCache.getStats();
        const batchStats = batch_request_service_1.batchService.getStats();
        const circuitStats = circuit_breaker_service_1.circuitBreakerManager.getStats();
        // Calculate overall efficiency score (0-100)
        const cacheEfficiency = Math.min(100, (cacheStats.size / 1000) * 100);
        const batchingEfficiency = batchStats.pendingBatches > 0 ? 50 : 100;
        const circuitHealth = ((circuitStats.closedCircuits + circuitStats.halfOpenCircuits) /
            Math.max(1, circuitStats.totalCircuits)) * 100;
        const overallEfficiency = Math.round((cacheEfficiency * 0.4) +
            (batchingEfficiency * 0.3) +
            (circuitHealth * 0.3));
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
    reset() {
        console.log('Resetting API efficiency services...');
        unified_cache_service_1.unifiedCache.clear();
        batch_request_service_1.batchService.clear();
        circuit_breaker_service_1.circuitBreakerManager.resetAll();
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
    async mockApiCall(type, params) {
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
    forceOpenProblematicCircuits() {
        const states = circuit_breaker_service_1.circuitBreakerManager.getAllStates();
        Object.entries(states).forEach(([serviceName, state]) => {
            if (state.failureCount > state.totalCalls * 0.5) { // >50% failure rate
                console.warn(`Force opening circuit for ${serviceName} due to high failure rate`);
                circuit_breaker_service_1.circuitBreakerManager.getCircuit(serviceName).forceOpen();
            }
        });
    }
    /**
     * Get detailed circuit information
     */
    getCircuitDetails() {
        const states = circuit_breaker_service_1.circuitBreakerManager.getAllStates();
        const details = {};
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
exports.ApiEfficiencyMonitor = ApiEfficiencyMonitor;
// Export singleton instance
exports.apiEfficiencyMonitor = new ApiEfficiencyMonitor();
// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
    // Delay initialization to allow app to load
    setTimeout(() => {
        exports.apiEfficiencyMonitor.initialize().catch(console.error);
    }, 1000);
}
//# sourceMappingURL=api-efficiency-monitor.js.map