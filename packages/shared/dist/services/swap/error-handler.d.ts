/**
 * Swap error handler
 * Provides user-friendly error messages
 */
export declare class SwapErrorHandler {
    static handle(error: unknown, context?: string): string;
    static isTestnetError(error: unknown): boolean;
    static shouldSimulateSwap(error: unknown, chainId: number): boolean;
}
//# sourceMappingURL=error-handler.d.ts.map