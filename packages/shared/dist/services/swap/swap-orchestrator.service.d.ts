/**
 * Swap Orchestrator Service
 * Main entry point for all swap operations
 * Routes swaps to appropriate strategy based on chain and token pair
 * Enhanced with smart strategy selection and user-friendly error handling
 */
import { SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './strategies/base-swap.strategy';
interface StrategyPerformance {
    successRate: number;
    averageTime: number;
    lastUpdated: number;
}
export declare class SwapOrchestratorService {
    private static strategies;
    private static performanceData;
    /**
     * Execute a swap using the appropriate strategy with automatic fallback
     */
    static executeSwap(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
    /**
     * Get swap estimate from the best available strategy
     */
    static getEstimate(params: SwapParams): Promise<SwapEstimate>;
    /**
     * Validate swap parameters
     */
    static validateSwap(params: SwapParams): Promise<boolean>;
    /**
     * Get strategies ranked by performance and context
     */
    private static getRankedStrategies;
    /**
     * Calculate strategy score for ranking
     */
    private static getStrategyScore;
    /**
     * Update strategy performance tracking
     */
    private static updatePerformance;
    /**
     * Convert technical errors to user-friendly messages
     */
    private static getUserFriendlyError;
    /**
     * Get descriptive error message when no strategy found
     */
    private static getNoStrategyError;
    /**
     * Get list of supported strategies
     */
    static getSupportedStrategies(): string[];
    /**
     * Check if a specific swap is supported
     */
    static isSwapSupported(params: SwapParams): boolean;
    /**
     * Get swap type description
     */
    static getSwapType(params: SwapParams): string;
    /**
     * Get performance statistics
     */
    static getPerformanceStats(): Map<string, StrategyPerformance>;
}
export {};
//# sourceMappingURL=swap-orchestrator.service.d.ts.map