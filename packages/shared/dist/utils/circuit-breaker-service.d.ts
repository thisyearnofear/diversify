/**
 * Circuit Breaker Service
 * Prevents cascading failures and provides resilience for API calls
 */
export interface CircuitBreakerConfig {
    failureThreshold: number;
    timeout: number;
    successThreshold: number;
    halfOpenTimeout?: number;
}
export interface CircuitState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    totalCalls: number;
    totalFailures: number;
    totalSuccesses: number;
}
export declare class CircuitBreaker {
    private readonly config;
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private totalCalls;
    private totalFailures;
    private totalSuccesses;
    private halfOpenTimer;
    constructor(config: CircuitBreakerConfig);
    /**
     * Execute a function with circuit breaker protection
     */
    call<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Execute a function with fallback on circuit breaker rejection
     */
    callWithFallback<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T>;
    /**
     * Get current circuit state
     */
    getState(): CircuitState;
    /**
     * Reset circuit breaker to initial state
     */
    reset(): void;
    /**
     * Force circuit to open state
     */
    forceOpen(): void;
    /**
     * Force circuit to closed state
     */
    forceClose(): void;
    /**
     * Private methods
     */
    private shouldReject;
    private onSuccess;
    private onFailure;
    private openCircuit;
    private closeCircuit;
    private transitionToHalfOpen;
}
/**
 * Circuit Breaker Manager for multiple circuits
 */
export declare class CircuitBreakerManager {
    private circuits;
    private readonly defaultConfig;
    /**
     * Get or create circuit breaker for a specific service
     */
    getCircuit(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    /**
     * Get all circuit states
     */
    getAllStates(): Record<string, CircuitState>;
    /**
     * Reset all circuits
     */
    resetAll(): void;
    /**
     * Force open all circuits
     */
    forceOpenAll(): void;
    /**
     * Get circuit breaker statistics
     */
    getStats(): {
        totalCircuits: number;
        openCircuits: number;
        closedCircuits: number;
        halfOpenCircuits: number;
    };
}
export declare const circuitBreakerManager: CircuitBreakerManager;
//# sourceMappingURL=circuit-breaker-service.d.ts.map