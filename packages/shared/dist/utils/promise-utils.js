"use strict";
/**
 * Utility functions for managing Promises
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTimeout = withTimeout;
/**
 * Wraps a promise with a timeout.
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message when timing out
 */
async function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
}
//# sourceMappingURL=promise-utils.js.map