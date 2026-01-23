/**
 * Swap Orchestrator Service
 * Main entry point for all swap operations
 * Routes swaps to appropriate strategy based on chain and token pair
 * Enhanced with smart strategy selection and user-friendly error handling
 */

import {
    BaseSwapStrategy,
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './strategies/base-swap.strategy';
import { MentoSwapStrategy } from './strategies/mento-swap.strategy';
import { LiFiSwapStrategy } from './strategies/lifi-swap.strategy';
import { LiFiBridgeStrategy } from './strategies/lifi-bridge.strategy';
import { OneInchSwapStrategy } from './strategies/oneinch-swap.strategy';
import { UniswapV3Strategy } from './strategies/uniswap-v3.strategy';
import { ChainDetectionService } from './chain-detection.service';
import { SWAP_CONFIG } from '../../config';

interface StrategyPerformance {
    successRate: number;
    averageTime: number;
    lastUpdated: number;
}

export class SwapOrchestratorService {
    private static strategies: BaseSwapStrategy[] = [
        new MentoSwapStrategy(),      // Celo same-chain (specialized)
        new OneInchSwapStrategy(),    // Multi-chain same-chain (best rates)
        new UniswapV3Strategy(),      // Direct Uniswap V3 (reliable fallback)
        new LiFiSwapStrategy(),       // LiFi same-chain (fallback)
        new LiFiBridgeStrategy(),     // Cross-chain bridging
    ];

    private static performanceData = new Map<string, StrategyPerformance>();

    /**
     * Execute a swap using the appropriate strategy with automatic fallback
     */
    static async executeSwap(
        params: SwapParams,
        callbacks?: SwapCallbacks
    ): Promise<SwapResult> {
        console.log('[SwapOrchestrator] Executing swap', {
            from: `${params.fromToken} on chain ${params.fromChainId}`,
            to: `${params.toToken} on chain ${params.toChainId}`,
            amount: params.amount,
        });

        // Get ranked strategies for intelligent fallback
        const rankedStrategies = this.getRankedStrategies(params);

        if (rankedStrategies.length === 0) {
            const error = this.getNoStrategyError(params);
            console.error('[SwapOrchestrator]', error);
            return {
                success: false,
                error: this.getUserFriendlyError(error),
            };
        }

        // Try strategies in order with performance tracking
        let lastError: string | undefined;

        for (const strategy of rankedStrategies) {
            const strategyName = strategy.getName();
            const startTime = Date.now();

            console.log(`[SwapOrchestrator] Trying strategy: ${strategyName}`);

            try {
                const result = await strategy.execute(params, callbacks);

                if (result.success) {
                    // Update performance data
                    const duration = (Date.now() - startTime) / 1000;
                    this.updatePerformance(strategyName, true, duration);

                    console.log(`[SwapOrchestrator] Success with ${strategyName}`);
                    return result;
                }

                lastError = result.error;

            } catch (error: any) {
                const duration = (Date.now() - startTime) / 1000;
                this.updatePerformance(strategyName, false, duration);

                lastError = error.message;
                console.log(`[SwapOrchestrator] ${strategyName} failed:`, error.message);
            }
        }

        // All strategies failed
        return {
            success: false,
            error: this.getUserFriendlyError(lastError || 'All swap methods are currently unavailable'),
        };
    }

    /**
     * Get swap estimate from the best available strategy
     */
    static async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        const rankedStrategies = this.getRankedStrategies(params);

        if (rankedStrategies.length === 0) {
            throw new Error(this.getUserFriendlyError(this.getNoStrategyError(params)));
        }

        // Try to get estimate from the best strategy
        for (const strategy of rankedStrategies) {
            try {
                return await strategy.getEstimate(params);
            } catch (error: any) {
                console.log(`[SwapOrchestrator] Estimate failed for ${strategy.getName()}:`, error.message);
                continue;
            }
        }

        throw new Error('Unable to get swap estimate. Please try again later.');
    }

    /**
     * Validate swap parameters
     */
    static async validateSwap(params: SwapParams): Promise<boolean> {
        const strategies = this.getRankedStrategies(params);

        if (strategies.length === 0) {
            throw new Error(this.getUserFriendlyError(this.getNoStrategyError(params)));
        }

        return strategies[0].validate(params);
    }

    /**
     * Get strategies ranked by performance and context
     */
    private static getRankedStrategies(params: SwapParams): BaseSwapStrategy[] {
        // Filter supporting strategies
        const supportingStrategies = this.strategies.filter(s => s.supports(params));

        if (supportingStrategies.length === 0) {
            return [];
        }

        // Rank by context and performance
        return supportingStrategies.sort((a, b) => {
            const scoreA = this.getStrategyScore(a, params);
            const scoreB = this.getStrategyScore(b, params);
            return scoreB - scoreA; // Higher score first
        });
    }

    /**
     * Calculate strategy score for ranking
     */
    private static getStrategyScore(strategy: BaseSwapStrategy, params: SwapParams): number {
        const strategyName = strategy.getName();
        let score = 0;

        // Use configuration-based scoring
        const chainScores = SWAP_CONFIG.STRATEGY_SCORES[params.fromChainId];
        if (chainScores && chainScores[strategyName as keyof typeof chainScores]) {
            score += chainScores[strategyName as keyof typeof chainScores];
        }

        // Cross-chain preference
        if (ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            if (strategyName === 'LiFiBridgeStrategy') score += 90;
            else score += 10;
        }

        // Performance-based scoring
        if (SWAP_CONFIG.ENABLE_PERFORMANCE_TRACKING) {
            const performance = this.performanceData.get(strategyName);
            if (performance) {
                score += performance.successRate * 30;
                score += Math.max(0, 20 - (performance.averageTime / 5)); // Prefer faster
            }
        }

        // Token-specific optimization
        const tokenPrefs = SWAP_CONFIG.TOKEN_PREFERENCES[params.toToken as keyof typeof SWAP_CONFIG.TOKEN_PREFERENCES] ||
            SWAP_CONFIG.TOKEN_PREFERENCES[params.fromToken as keyof typeof SWAP_CONFIG.TOKEN_PREFERENCES];
        if (tokenPrefs && tokenPrefs[strategyName as keyof typeof tokenPrefs]) {
            score += tokenPrefs[strategyName as keyof typeof tokenPrefs];
        }

        return score;
    }

    /**
     * Update strategy performance tracking
     */
    private static updatePerformance(strategyName: string, success: boolean, duration: number): void {
        const existing = this.performanceData.get(strategyName) || {
            successRate: 0.9,
            averageTime: 30,
            lastUpdated: Date.now()
        };

        const alpha = 0.1; // Learning rate
        existing.successRate = existing.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
        existing.averageTime = existing.averageTime * (1 - alpha) + duration * alpha;
        existing.lastUpdated = Date.now();

        this.performanceData.set(strategyName, existing);
    }

    /**
     * Convert technical errors to user-friendly messages
     */
    private static getUserFriendlyError(technicalError: string): string {
        const errorMappings: Record<string, string> = {
            'Cannot read properties of undefined': 'Swap service temporarily unavailable. Please try again.',
            'Insufficient liquidity': 'Not enough liquidity for this amount. Try a smaller amount.',
            'Network congestion': 'Network is busy. This may take longer than usual.',
            'Token not supported': 'This token pair is not available on the current network.',
            'No routes found': 'No swap route available. Try a different amount or token pair.',
            'User rejected': 'Transaction was cancelled.',
            'Wrong network': 'Please switch to the correct network in your wallet.',
        };

        for (const [technical, friendly] of Object.entries(errorMappings)) {
            if (technicalError.toLowerCase().includes(technical.toLowerCase())) {
                return friendly;
            }
        }

        return technicalError.includes('revert')
            ? 'Transaction failed due to price changes. Please try again.'
            : 'Swap failed. Please try again or contact support.';
    }

    /**
     * Get descriptive error message when no strategy found
     */
    private static getNoStrategyError(params: SwapParams): string {
        const fromChainName = ChainDetectionService.getNetworkName(params.fromChainId);
        const toChainName = ChainDetectionService.getNetworkName(params.toChainId);

        if (!ChainDetectionService.isSupported(params.fromChainId)) {
            return `Source chain ${fromChainName} (${params.fromChainId}) is not supported`;
        }

        if (!ChainDetectionService.isSupported(params.toChainId)) {
            return `Destination chain ${toChainName} (${params.toChainId}) is not supported`;
        }

        return `No swap strategy available for ${params.fromToken}/${params.toToken} on ${fromChainName}`;
    }

    /**
     * Get list of supported strategies
     */
    static getSupportedStrategies(): string[] {
        return this.strategies.map(s => s.getName());
    }

    /**
     * Check if a specific swap is supported
     */
    static isSwapSupported(params: SwapParams): boolean {
        return this.getRankedStrategies(params).length > 0;
    }

    /**
     * Get swap type description
     */
    static getSwapType(params: SwapParams): string {
        if (ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            return 'cross-chain';
        }

        const chainType = ChainDetectionService.getChainType(params.fromChainId);
        return `${chainType}-same-chain`;
    }

    /**
     * Get performance statistics
     */
    static getPerformanceStats(): Map<string, StrategyPerformance> {
        return new Map(this.performanceData);
    }
}
