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
import { GmxGmDepositStrategy } from './strategies/gmx-gm-deposit.strategy';
import { MentoSwapStrategy } from './strategies/mento-swap.strategy';
import { LiFiSwapStrategy } from './strategies/lifi-swap.strategy';
import { LiFiBridgeStrategy } from './strategies/lifi-bridge.strategy';
import { LiFiEarnStrategy } from './strategies/lifi-earn.strategy';
import { OneInchSwapStrategy } from './strategies/oneinch-swap.strategy';
import { UniswapV3Strategy } from './strategies/uniswap-v3.strategy';
import { ArcTestnetStrategy } from './strategies/arc-testnet.strategy';
import { EmergingMarketsStrategy } from './strategies/emerging-markets.strategy';
import { CurveArcStrategy } from './strategies/curve-arc.strategy';
import { HyperliquidPerpStrategy } from './strategies/hyperliquid-perp.strategy';
import { ethers } from 'ethers';
import { ChainDetectionService } from './chain-detection.service';
import { SWAP_CONFIG } from '../../config';

interface StrategyPerformance {
    successRate: number;
    averageTime: number;
    lastUpdated: number;
}

// Islamic Finance strategy names — Hyperliquid perps are excluded for these
const ISLAMIC_FINANCE_EXCLUDED_STRATEGIES = new Set(['HyperliquidPerp']);

export class SwapOrchestratorService {
    private static strategies: BaseSwapStrategy[] = [
        new MentoSwapStrategy(),          // Celo same-chain (specialized)
        new EmergingMarketsStrategy(),    // Celo Sepolia fictional companies
        new CurveArcStrategy(),           // Curve Finance on Arc Testnet (direct integration)
        new ArcTestnetStrategy(),         // Arc Testnet fallback (guidance)
        new HyperliquidPerpStrategy(),    // Hyperliquid commodity perps (GOLD, SILVER, OIL, COPPER)
        new OneInchSwapStrategy(),        // Multi-chain same-chain (best rates)
        new UniswapV3Strategy(),          // Direct Uniswap V3 (reliable fallback)
        new GmxGmDepositStrategy(),       // GMX GM-pool deposits (gated: GMX_GM_DEPOSIT_ENABLED)
        new LiFiEarnStrategy(),           // LiFi Earn (vault deposits)
        new LiFiSwapStrategy(),           // LiFi same-chain (fallback)
        new LiFiBridgeStrategy(),         // Cross-chain bridging
    ];

    private static performanceData = new Map<string, StrategyPerformance>();

    /**
     * Execute a swap using the appropriate strategy with automatic fallback
     * @param islamicFinance - When true, excludes Hyperliquid perp strategies
     */
    static async executeSwap(
        params: SwapParams,
        callbacks?: SwapCallbacks,
        islamicFinance = false
    ): Promise<SwapResult> {
        console.log('[SwapOrchestrator] Executing swap', {
            from: `${params.fromToken} on chain ${params.fromChainId}`,
            to: `${params.toToken} on chain ${params.toChainId}`,
            amount: params.amount,
        });

        // Get ranked strategies for intelligent fallback
        const rankedStrategies = this.getRankedStrategies(params, islamicFinance);

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

            // Once a transaction (approval or swap) has been submitted, a
            // failure means gas was spent on-chain. Falling back would ask
            // the user to sign again with a different provider — likely
            // another approval and another chance to revert. Surface the
            // failure and let the user decide whether to retry.
            let txSubmitted = false;
            const guardedCallbacks: SwapCallbacks = {
                ...callbacks,
                onApprovalSubmitted: (hash: string) => {
                    txSubmitted = true;
                    callbacks?.onApprovalSubmitted?.(hash);
                },
                onSwapSubmitted: (hash: string) => {
                    txSubmitted = true;
                    callbacks?.onSwapSubmitted?.(hash);
                },
            };

            try {
                const result = await strategy.execute(params, guardedCallbacks);

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
                            const signer = params.signer || await require('./provider-factory.service').ProviderFactoryService.getSignerForChain(params.toChainId);
                            const { getTokenAddresses, ABIS } = require('../../config');
                            const toTokens = getTokenAddresses(params.toChainId);
                            const toTokenAddress = toTokens[params.toToken as keyof typeof toTokens];
                            
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
                        } catch (transferError) {
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

                if (txSubmitted) {
                    console.log(`[SwapOrchestrator] ${strategyName} failed after a transaction was submitted — not falling back`);
                    return {
                        success: false,
                        error: this.getUserFriendlyError(result.error || 'Transaction failed on-chain'),
                        errorClass: 'onchain-failed',
                    };
                }

                if (this.isUserRejection(result.error)) {
                    console.log(`[SwapOrchestrator] ${strategyName} cancelled by user — not falling back`);
                    return { success: false, error: 'Transaction was cancelled.', errorClass: 'cancelled' };
                }

                lastError = result.error;

            } catch (error: any) {
                const duration = (Date.now() - startTime) / 1000;
                this.updatePerformance(strategyName, false, duration);

                lastError = error.message;
                console.log(`[SwapOrchestrator] ${strategyName} failed:`, error.message);

                if (txSubmitted) {
                    console.log(`[SwapOrchestrator] ${strategyName} threw after a transaction was submitted — not falling back`);
                    return {
                        success: false,
                        error: this.getUserFriendlyError(error.message || 'Transaction failed on-chain'),
                        errorClass: 'onchain-failed',
                    };
                }

                if (this.isUserRejection(error.message)) {
                    console.log(`[SwapOrchestrator] ${strategyName} cancelled by user — not falling back`);
                    return { success: false, error: 'Transaction was cancelled.', errorClass: 'cancelled' };
                }
            }
        }

        // All strategies failed
        const errorClass = this.classifyError(lastError);
        return {
            success: false,
            // A classified no-route keeps the specific reason (which pool /
            // which pair) — "contact support" would contradict the ticket's
            // "try a larger amount" copy.
            error: errorClass === 'no-route' && lastError
                ? lastError
                : this.getUserFriendlyError(lastError || 'All swap methods are currently unavailable'),
            errorClass,
        };
    }

    /**
     * Get swap estimate from the best available strategy
     * @param islamicFinance - When true, excludes Hyperliquid perp strategies
     */
    static async getEstimate(params: SwapParams, islamicFinance = false): Promise<SwapEstimate> {
        const rankedStrategies = this.getRankedStrategies(params, islamicFinance);

        if (rankedStrategies.length === 0) {
            throw new Error(this.getUserFriendlyError(this.getNoStrategyError(params)));
        }

        // Try to get estimate from the best strategy — stamp which provider
        // produced it so the ticket can say "via Mento" honestly.
        let lastError: string | undefined;
        // The most informative route-absence reason — a generic "no routes"
        // from a fallback provider shouldn't bury the top-ranked strategy's
        // specific one (e.g. "Not enough liquidity … at this size").
        let specificNoRouteError: string | undefined;
        for (const strategy of rankedStrategies) {
            try {
                const estimate = await strategy.getEstimate(params);
                estimate.provider = this.getProviderLabel(strategy.getName());
                return estimate;
            } catch (error: any) {
                lastError = error.message;
                if (
                    lastError &&
                    this.classifyError(lastError) === 'no-route' &&
                    !this.isGenericNoRoute(lastError)
                ) {
                    specificNoRouteError = lastError;
                }
                console.log(`[SwapOrchestrator] Estimate failed for ${strategy.getName()}:`, error.message);
                continue;
            }
        }

        // Keep the specific reason when it's a route-absence — the ticket
        // renders "no route at this size" and the via-hub recovery off it;
        // anything else stays generic. errorClass rides on the error so
        // callers can distinguish without string matching.
        const message = specificNoRouteError ?? lastError;
        const errorClass = this.classifyError(message);
        const err = new Error(
            errorClass === 'no-route' && message
                ? message
                : 'Unable to get swap estimate. Please try again later.'
        );
        (err as any).errorClass = errorClass;
        throw err;
    }

    /**
     * Which provider would execute this swap — the top-ranked supporting
     * strategy's display label, or null when nothing can route it. Cheap
     * and synchronous: the ticket shows provenance without a quote call.
     */
    static getRouteProvider(params: SwapParams, islamicFinance = false): string | null {
        const ranked = this.getRankedStrategies(params, islamicFinance);
        return ranked.length > 0 ? this.getProviderLabel(ranked[0].getName()) : null;
    }

    /**
     * Expected wallet confirmations for the top-ranked route: swap
     * transactions plus ERC20 approvals the user will be asked to sign.
     * Returns null when it can't be determined — the UI renders nothing
     * rather than guessing (absent > vague).
     */
    static async estimateConfirmations(params: SwapParams): Promise<number | null> {
        const ranked = this.getRankedStrategies(params);
        if (ranked.length === 0) return null;
        const strategy = ranked[0];
        const name = strategy.getName();

        try {
            if (name === 'MentoSwapStrategy') {
                return await this.estimateMentoConfirmations(params);
            }
            // Aggregator/direct-DEX routes: one swap, plus an approval when
            // the source isn't the chain's native asset. On Celo, CELO is an
            // ERC-20 (0x471E…) and DOES need approval to a DEX router — the
            // native exemption only applies off Celo.
            const nativeSymbol = this.getNativeSymbol(params.fromChainId);
            const approvals =
                params.fromToken === nativeSymbol && !ChainDetectionService.isCelo(params.fromChainId)
                    ? 0
                    : 1;
            return 1 + approvals;
        } catch {
            return null;
        }
    }

    private static async estimateMentoConfirmations(params: SwapParams): Promise<number | null> {
        const { getTokenAddresses, TOKEN_METADATA, TX_CONFIG } = require('../../config');
        const { buildMentoSwap } = require('./mento-sdk.service');

        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];
        if (!fromTokenAddress || !toTokenAddress) return null;

        const fromDecimals = (TOKEN_METADATA[params.fromToken as keyof typeof TOKEN_METADATA]?.decimals) || 18;
        const amountIn = ethers.utils.parseUnits(params.amount, fromDecimals);

        // One Router tx for any hop count; the SDK's approval field tells
        // us whether the wallet will also sign an approve.
        const built = await buildMentoSwap({
            chainId: params.fromChainId,
            tokenIn: fromTokenAddress,
            tokenOut: toTokenAddress,
            amountIn: BigInt(amountIn.toString()),
            recipient: params.userAddress,
            owner: params.userAddress,
            slippagePercent: params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE,
        });

        return 1 + (built.approval ? 1 : 0);
    }

    private static getProviderLabel(strategyName: string): string {
        const labels: Record<string, string> = {
            MentoSwapStrategy: 'Mento',
            LiFiSwapStrategy: 'LiFi',
            LiFiBridgeStrategy: 'LiFi bridge',
            LiFiEarnStrategy: 'LiFi',
            OneInchSwapStrategy: '1inch',
            UniswapV3Strategy: 'Uniswap V3',
            EmergingMarketsStrategy: 'DiversiFi markets',
            CurveArcStrategy: 'Curve',
            ArcTestnetStrategy: 'Arc',
            HyperliquidPerpStrategy: 'Hyperliquid',
            GmxGmDepositStrategy: 'GMX',
        };
        return labels[strategyName] || strategyName;
    }

    private static getNativeSymbol(chainId: number): string {
        if (ChainDetectionService.isCelo(chainId)) return 'CELO';
        if (ChainDetectionService.isArbitrum(chainId)) return 'ETH';
        if (ChainDetectionService.isArc(chainId)) return 'USDC';
        return 'ETH';
    }

    /**
     * Generic "no route anywhere" messages carry no reason — a size or
     * pause explanation is more useful to the ticket.
     */
    private static isGenericNoRoute(message: string): boolean {
        const m = message.toLowerCase();
        return (
            m.includes('no swap routes') || m.includes('no route found') ||
            m.includes('no exchange found') || m.includes('no available quotes') ||
            m.includes('unable to get swap estimate') || m.includes('no uniswap v3 pool') ||
            m.includes('not available on')
        );
    }

    /**
     * Classify a terminal error for the ticket: route-absence, wallet
     * session, and gas failures each get their own moment and copy.
     */
    private static classifyError(message?: string): SwapResult['errorClass'] {
        if (!message) return 'error';
        const m = message.toLowerCase();
        if (
            m.includes('no swap routes') || m.includes('no exchange found') ||
            m.includes('no available quotes') || m.includes('no route') ||
            m.includes('unable to get swap estimate') || m.includes('no uniswap v3 pool') ||
            m.includes('not enough liquidity') || m.includes('not available on') ||
            m.includes('trading is currently paused') || m.includes('no route found')
        ) {
            return 'no-route';
        }
        if (
            m.includes('exceeded max attempts') || m.includes('sdk execution provider') ||
            m.includes('no wallet provider') || m.includes('not authenticated') ||
            m.includes('session')
        ) {
            return 'session';
        }
        if (m.includes('insufficient funds') || m.includes('gas')) {
            return 'no-gas';
        }
        return 'error';
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
     * @param islamicFinance - When true, excludes Hyperliquid perp strategies (speculation/no underlying)
     */
    private static getRankedStrategies(params: SwapParams, islamicFinance = false): BaseSwapStrategy[] {
        // Filter supporting strategies, excluding Islamic Finance-incompatible ones if needed
        const supportingStrategies = this.strategies.filter(s => {
            if (!s.supports(params)) return false;
            if (islamicFinance && ISLAMIC_FINANCE_EXCLUDED_STRATEGIES.has(s.getName())) return false;
            return true;
        });

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
        const chainScores = SWAP_CONFIG.STRATEGY_SCORES[params.fromChainId as keyof typeof SWAP_CONFIG.STRATEGY_SCORES];
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
     * Detect wallet-level user rejection across provider error shapes
     * (MetaMask "denied", viem/LiFi "rejected the request", ethers
     * ACTION_REJECTED). A rejected signature must not trigger fallback —
     * the next strategy would just pop another signing prompt.
     */
    private static isUserRejection(message?: string): boolean {
        if (!message) return false;
        const m = message.toLowerCase();
        return m.includes('user rejected') ||
            m.includes('user denied') ||
            m.includes('rejected the request') ||
            m.includes('action_rejected');
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
