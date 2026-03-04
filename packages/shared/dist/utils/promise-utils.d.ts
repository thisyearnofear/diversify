/**
 * Utility functions for managing Promises
 */
/**
 * Wraps a promise with a timeout.
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message when timing out
 */
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T>;
//# sourceMappingURL=promise-utils.d.ts.map