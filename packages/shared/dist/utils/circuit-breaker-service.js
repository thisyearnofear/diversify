"use strict";
/**
 * Circuit Breaker Service
 * Prevents cascading failures and provides resilience for API calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreakerManager = exports.CircuitBreakerManager = exports.CircuitBreaker = void 0;
class CircuitBreaker {
    config;
    state = 'CLOSED';
    failureCount = 0;
    successCount = 0;
    lastFailureTime = 0;
    totalCalls = 0;
    totalFailures = 0;
    totalSuccesses = 0;
    halfOpenTimer = null;
    constructor(config) {
        this.config = config;
    }
    /**
     * Execute a function with circuit breaker protection
     */
    async call(fn) {
        this.totalCalls++;
        // Check circuit state
        if (this.shouldReject()) {
            this.totalFailures++;
            throw new Error(`Circuit breaker is ${this.state} - rejecting call`);
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Execute a function with fallback on circuit breaker rejection
     */
    async callWithFallback(fn, fallback) {
        try {
            return await this.call(fn);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Circuit breaker')) {
                console.warn('Using fallback due to circuit breaker');
                return await fallback();
            }
            throw error;
        }
    }
    /**
     * Get current circuit state
     */
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            totalCalls: this.totalCalls,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses
        };
    }
    /**
     * Reset circuit breaker to initial state
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        if (this.halfOpenTimer) {
            clearTimeout(this.halfOpenTimer);
            this.halfOpenTimer = null;
        }
    }
    /**
     * Force circuit to open state
     */
    forceOpen() {
        this.state = 'OPEN';
        this.lastFailureTime = Date.now();
        if (this.halfOpenTimer) {
            clearTimeout(this.halfOpenTimer);
            this.halfOpenTimer = null;
        }
    }
    /**
     * Force circuit to closed state
     */
    forceClose() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        if (this.halfOpenTimer) {
            clearTimeout(this.halfOpenTimer);
            this.halfOpenTimer = null;
        }
    }
    /**
     * Private methods
     */
    shouldReject() {
        const now = Date.now();
        switch (this.state) {
            case 'CLOSED':
                return false;
            case 'OPEN':
                // Check if timeout has elapsed
                if (now - this.lastFailureTime >= this.config.timeout) {
                    this.transitionToHalfOpen();
                    return false;
                }
                return true;
            case 'HALF_OPEN':
                // In half-open state, allow limited traffic
                return false;
            default:
                return false;
        }
    }
    onSuccess() {
        this.totalSuccesses++;
        switch (this.state) {
            case 'CLOSED':
                // Reset failure count on success
                this.failureCount = 0;
                break;
            case 'HALF_OPEN':
                this.successCount++;
                // Check if we should close the circuit
                if (this.successCount >= this.config.successThreshold) {
                    this.closeCircuit();
                }
                break;
            case 'OPEN':
                // Shouldn't happen, but if it does, treat as success
                this.reset();
                break;
        }
    }
    onFailure() {
        this.totalFailures++;
        this.failureCount++;
        this.lastFailureTime = Date.now();
        switch (this.state) {
            case 'CLOSED':
                if (this.failureCount >= this.config.failureThreshold) {
                    this.openCircuit();
                }
                break;
            case 'HALF_OPEN':
                // Any failure in half-open state opens the circuit again
                this.openCircuit();
                break;
            case 'OPEN':
                // Already open, just update failure time
                break;
        }
    }
    openCircuit() {
        console.warn(`Opening circuit breaker after ${this.failureCount} failures`);
        this.state = 'OPEN';
        this.successCount = 0;
    }
    closeCircuit() {
        console.info(`Closing circuit breaker after ${this.successCount} successful calls`);
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        if (this.halfOpenTimer) {
            clearTimeout(this.halfOpenTimer);
            this.halfOpenTimer = null;
        }
    }
    transitionToHalfOpen() {
        console.info('Transitioning circuit breaker to HALF_OPEN state');
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        // Set timer to automatically open if no successful calls
        const timeout = this.config.halfOpenTimeout || this.config.timeout;
        this.halfOpenTimer = setTimeout(() => {
            if (this.state === 'HALF_OPEN') {
                console.warn('Half-open timeout expired, opening circuit');
                this.openCircuit();
            }
        }, timeout);
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Circuit Breaker Manager for multiple circuits
 */
class CircuitBreakerManager {
    circuits = new Map();
    defaultConfig = {
        failureThreshold: 5,
        timeout: 60000, // 1 minute
        successThreshold: 3,
        halfOpenTimeout: 30000 // 30 seconds
    };
    /**
     * Get or create circuit breaker for a specific service
     */
    getCircuit(serviceName, config) {
        if (!this.circuits.has(serviceName)) {
            const fullConfig = { ...this.defaultConfig, ...config };
            this.circuits.set(serviceName, new CircuitBreaker(fullConfig));
        }
        return this.circuits.get(serviceName);
    }
    /**
     * Get all circuit states
     */
    getAllStates() {
        const states = {};
        this.circuits.forEach((circuit, serviceName) => {
            states[serviceName] = circuit.getState();
        });
        return states;
    }
    /**
     * Reset all circuits
     */
    resetAll() {
        this.circuits.forEach(circuit => circuit.reset());
    }
    /**
     * Force open all circuits
     */
    forceOpenAll() {
        this.circuits.forEach(circuit => circuit.forceOpen());
    }
    /**
     * Get circuit breaker statistics
     */
    getStats() {
        let open = 0, closed = 0, halfOpen = 0;
        this.circuits.forEach(circuit => {
            const state = circuit.getState().state;
            switch (state) {
                case 'OPEN':
                    open++;
                    break;
                case 'CLOSED':
                    closed++;
                    break;
                case 'HALF_OPEN':
                    halfOpen++;
                    break;
            }
        });
        return {
            totalCircuits: this.circuits.size,
            openCircuits: open,
            closedCircuits: closed,
            halfOpenCircuits: halfOpen
        };
    }
}
exports.CircuitBreakerManager = CircuitBreakerManager;
// Export singleton instance
exports.circuitBreakerManager = new CircuitBreakerManager();
//# sourceMappingURL=circuit-breaker-service.js.map