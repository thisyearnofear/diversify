/**
 * Circuit Breaker Service
 * Prevents cascading failures and provides resilience for API calls
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  timeout: number;            // Time to wait before trying again (ms)
  successThreshold: number;   // Number of successes needed to close circuit
  halfOpenTimeout?: number;   // Timeout for half-open state (optional)
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

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private halfOpenTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: CircuitBreakerConfig) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
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
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute a function with fallback on circuit breaker rejection
   */
  async callWithFallback<T>(
    fn: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    try {
      return await this.call(fn);
    } catch (error) {
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
  getState(): CircuitState {
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
  reset(): void {
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
  forceOpen(): void {
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
  forceClose(): void {
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
  private shouldReject(): boolean {
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

  private onSuccess(): void {
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

  private onFailure(): void {
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

  private openCircuit(): void {
    console.warn(`Opening circuit breaker after ${this.failureCount} failures`);
    this.state = 'OPEN';
    this.successCount = 0;
  }

  private closeCircuit(): void {
    console.info(`Closing circuit breaker after ${this.successCount} successful calls`);
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }
  }

  private transitionToHalfOpen(): void {
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

/**
 * Circuit Breaker Manager for multiple circuits
 */
export class CircuitBreakerManager {
  private circuits = new Map<string, CircuitBreaker>();
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    timeout: 60000,        // 1 minute
    successThreshold: 3,
    halfOpenTimeout: 30000 // 30 seconds
  };

  /**
   * Get or create circuit breaker for a specific service
   */
  getCircuit(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuits.has(serviceName)) {
      const fullConfig = { ...this.defaultConfig, ...config };
      this.circuits.set(serviceName, new CircuitBreaker(fullConfig));
    }
    
    return this.circuits.get(serviceName)!;
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    
    this.circuits.forEach((circuit, serviceName) => {
      states[serviceName] = circuit.getState();
    });
    
    return states;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.circuits.forEach(circuit => circuit.reset());
  }

  /**
   * Force open all circuits
   */
  forceOpenAll(): void {
    this.circuits.forEach(circuit => circuit.forceOpen());
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    totalCircuits: number;
    openCircuits: number;
    closedCircuits: number;
    halfOpenCircuits: number;
  } {
    let open = 0, closed = 0, halfOpen = 0;
    
    this.circuits.forEach(circuit => {
      const state = circuit.getState().state;
      switch (state) {
        case 'OPEN': open++; break;
        case 'CLOSED': closed++; break;
        case 'HALF_OPEN': halfOpen++; break;
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

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();