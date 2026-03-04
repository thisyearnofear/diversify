"use strict";
/**
 * Swap Orchestrator Service
 * Main entry point for all swap operations
 * Routes swaps to appropriate strategy based on chain and token pair
 * Enhanced with smart strategy selection and user-friendly error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapOrchestratorService = void 0;
const mento_swap_strategy_1 = require("./strategies/mento-swap.strategy");
const lifi_swap_strategy_1 = require("./strategies/lifi-swap.strategy");
const lifi_bridge_strategy_1 = require("./strategies/lifi-bridge.strategy");
const oneinch_swap_strategy_1 = require("./strategies/oneinch-swap.strategy");
const uniswap_v3_strategy_1 = require("./strategies/uniswap-v3.strategy");
const direct_rwa_strategy_1 = require("./strategies/direct-rwa.strategy");
const arc_testnet_strategy_1 = require("./strategies/arc-testnet.strategy");
const robinhood_amm_strategy_1 = require("./strategies/robinhood-amm.strategy");
const emerging_markets_strategy_1 = require("./strategies/emerging-markets.strategy");
const curve_arc_strategy_1 = require("./strategies/curve-arc.strategy");
const chain_detection_service_1 = require("./chain-detection.service");
const config_1 = require("../../config");
class SwapOrchestratorService {
    static strategies = [
        new mento_swap_strategy_1.MentoSwapStrategy(), // Celo same-chain (specialized)
        new emerging_markets_strategy_1.EmergingMarketsStrategy(), // Celo Sepolia fictional companies
        new curve_arc_strategy_1.CurveArcStrategy(), // Curve Finance on Arc Testnet (direct integration)
        new arc_testnet_strategy_1.ArcTestnetStrategy(), // Arc Testnet fallback (guidance)
        new robinhood_amm_strategy_1.RobinhoodAMMStrategy(), // Robinhood Chain testnet (stock tokens)
        new oneinch_swap_strategy_1.OneInchSwapStrategy(), // Multi-chain same-chain (best rates)
        new uniswap_v3_strategy_1.UniswapV3Strategy(), // Direct Uniswap V3 (reliable fallback)
        new lifi_swap_strategy_1.LiFiSwapStrategy(), // LiFi same-chain (fallback)
        new lifi_bridge_strategy_1.LiFiBridgeStrategy(), // Cross-chain bridging
        new direct_rwa_strategy_1.DirectRWAStrategy(), // Direct RWA swaps (final fallback)
    ];
    static performanceData = new Map();
    /**
     * Execute a swap using the appropriate strategy with automatic fallback
     */
    static async executeSwap(params, callbacks) {
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
        let lastError;
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
                    // SOCIALCONNECT: If a recipientAddress is provided, transfer the swapped tokens
                    if (params.recipientAddress && result.txHash) {
                        console.log(`[SocialConnect] Transferring swapped tokens to recipient: ${params.recipientAddress}`);
                        // Small delay to ensure the swap is indexed/confirmed if needed
                        // Though strategy.execute should have already waited for confirmation
                        try {
                            const signer = strategy.signer || await require('./provider-factory.service').ProviderFactoryService.getSignerForChain(params.toChainId);
                            const { getTokenAddresses, ABIS } = require('../../config');
                            const toTokens = getTokenAddresses(params.toChainId);
                            const toTokenAddress = toTokens[params.toToken];
                            if (toTokenAddress) {
                                const { Contract, utils } = require('ethers');
                                const tokenContract = new Contract(toTokenAddress, ABIS.ERC20, signer);
                                // Get the balance of the token just swapped
                                const balance = await tokenContract.balanceOf(params.userAddress);
                                if (balance.gt(0)) {
                                    console.log(`[SocialConnect] Sending ${utils.formatUnits(balance, 18)} ${params.toToken} to ${params.recipientAddress}`);
                                    const transferTx = await tokenContract.transfer(params.recipientAddress, balance);
                                    await transferTx.wait();
                                    console.log(`[SocialConnect] Transfer successful: ${transferTx.hash}`);
                                    // Update result to include transfer hash
                                    result.txHash = transferTx.hash;
                                }
                            }
                        }
                        catch (transferError) {
                            console.error('[SocialConnect] Transfer to recipient failed:', transferError);
                            // We don't fail the whole swap because the user already has the funds
                            // But we should notify them.
                        }
                    }
                    return result;
                }
                // Special handling for Arc Testnet strategies - don't fall back to other strategies
                // These strategies provide comprehensive guidance that should be shown to users
                if (strategyName === 'ArcTestnetStrategy' || strategyName === 'CurveArcStrategy') {
                    console.log(`[SwapOrchestrator] Arc Testnet guidance provided by ${strategyName}`);
                    return result; // Return the guidance message directly
                }
                lastError = result.error;
            }
            catch (error) {
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
    static async getEstimate(params) {
        const rankedStrategies = this.getRankedStrategies(params);
        if (rankedStrategies.length === 0) {
            throw new Error(this.getUserFriendlyError(this.getNoStrategyError(params)));
        }
        // Try to get estimate from the best strategy
        for (const strategy of rankedStrategies) {
            try {
                return await strategy.getEstimate(params);
            }
            catch (error) {
                console.log(`[SwapOrchestrator] Estimate failed for ${strategy.getName()}:`, error.message);
                continue;
            }
        }
        throw new Error('Unable to get swap estimate. Please try again later.');
    }
    /**
     * Validate swap parameters
     */
    static async validateSwap(params) {
        const strategies = this.getRankedStrategies(params);
        if (strategies.length === 0) {
            throw new Error(this.getUserFriendlyError(this.getNoStrategyError(params)));
        }
        return strategies[0].validate(params);
    }
    /**
     * Get strategies ranked by performance and context
     */
    static getRankedStrategies(params) {
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
    static getStrategyScore(strategy, params) {
        const strategyName = strategy.getName();
        let score = 0;
        // Use configuration-based scoring
        const chainScores = config_1.SWAP_CONFIG.STRATEGY_SCORES[params.fromChainId];
        if (chainScores && chainScores[strategyName]) {
            score += chainScores[strategyName];
        }
        // Cross-chain preference
        if (chain_detection_service_1.ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            if (strategyName === 'LiFiBridgeStrategy')
                score += 90;
            else
                score += 10;
        }
        // Performance-based scoring
        if (config_1.SWAP_CONFIG.ENABLE_PERFORMANCE_TRACKING) {
            const performance = this.performanceData.get(strategyName);
            if (performance) {
                score += performance.successRate * 30;
                score += Math.max(0, 20 - (performance.averageTime / 5)); // Prefer faster
            }
        }
        // Token-specific optimization
        const tokenPrefs = config_1.SWAP_CONFIG.TOKEN_PREFERENCES[params.toToken] ||
            config_1.SWAP_CONFIG.TOKEN_PREFERENCES[params.fromToken];
        if (tokenPrefs && tokenPrefs[strategyName]) {
            score += tokenPrefs[strategyName];
        }
        return score;
    }
    /**
     * Update strategy performance tracking
     */
    static updatePerformance(strategyName, success, duration) {
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
    static getUserFriendlyError(technicalError) {
        const errorMappings = {
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
    static getNoStrategyError(params) {
        const fromChainName = chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId);
        const toChainName = chain_detection_service_1.ChainDetectionService.getNetworkName(params.toChainId);
        if (!chain_detection_service_1.ChainDetectionService.isSupported(params.fromChainId)) {
            return `Source chain ${fromChainName} (${params.fromChainId}) is not supported`;
        }
        if (!chain_detection_service_1.ChainDetectionService.isSupported(params.toChainId)) {
            return `Destination chain ${toChainName} (${params.toChainId}) is not supported`;
        }
        return `No swap strategy available for ${params.fromToken}/${params.toToken} on ${fromChainName}`;
    }
    /**
     * Get list of supported strategies
     */
    static getSupportedStrategies() {
        return this.strategies.map(s => s.getName());
    }
    /**
     * Check if a specific swap is supported
     */
    static isSwapSupported(params) {
        return this.getRankedStrategies(params).length > 0;
    }
    /**
     * Get swap type description
     */
    static getSwapType(params) {
        if (chain_detection_service_1.ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            return 'cross-chain';
        }
        const chainType = chain_detection_service_1.ChainDetectionService.getChainType(params.fromChainId);
        return `${chainType}-same-chain`;
    }
    /**
     * Get performance statistics
     */
    static getPerformanceStats() {
        return new Map(this.performanceData);
    }
}
exports.SwapOrchestratorService = SwapOrchestratorService;
//# sourceMappingURL=swap-orchestrator.service.js.map