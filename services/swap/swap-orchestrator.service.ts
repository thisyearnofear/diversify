/**
 * Swap Orchestrator Service
 * Main entry point for all swap operations
 * Routes swaps to appropriate strategy based on chain and token pair
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
import { ChainDetectionService } from './chain-detection.service';

export class SwapOrchestratorService {
    private static strategies: BaseSwapStrategy[] = [
        new MentoSwapStrategy(),      // Celo same-chain
        new LiFiSwapStrategy(),        // Arbitrum same-chain
        new LiFiBridgeStrategy(),      // Cross-chain
    ];

    /**
     * Execute a swap using the appropriate strategy
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

        // Find appropriate strategy
        const strategy = this.findStrategy(params);

        if (!strategy) {
            const error = this.getNoStrategyError(params);
            console.error('[SwapOrchestrator]', error);
            return {
                success: false,
                error,
            };
        }

        console.log(`[SwapOrchestrator] Using strategy: ${strategy.getName()}`);

        // Execute with selected strategy
        return strategy.execute(params, callbacks);
    }

    /**
     * Get swap estimate/quote
     */
    static async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        const strategy = this.findStrategy(params);

        if (!strategy) {
            throw new Error(this.getNoStrategyError(params));
        }

        return strategy.getEstimate(params);
    }

    /**
     * Validate swap parameters
     */
    static async validateSwap(params: SwapParams): Promise<boolean> {
        const strategy = this.findStrategy(params);

        if (!strategy) {
            throw new Error(this.getNoStrategyError(params));
        }

        return strategy.validate(params);
    }

    /**
     * Find appropriate strategy for swap parameters
     */
    private static findStrategy(params: SwapParams): BaseSwapStrategy | null {
        for (const strategy of this.strategies) {
            if (strategy.supports(params)) {
                return strategy;
            }
        }
        return null;
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

        if (ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            return `Cross-chain swap from ${fromChainName} to ${toChainName} is not yet supported`;
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
        return this.findStrategy(params) !== null;
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
}
