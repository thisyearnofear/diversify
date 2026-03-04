"use strict";
/**
 * LiFi Bridge Strategy
 * Handles cross-chain swaps/bridges using LiFi SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiFiBridgeStrategy = void 0;
const ethers_1 = require("ethers");
const sdk_1 = require("@lifi/sdk");
const base_swap_strategy_1 = require("./base-swap.strategy");
const provider_factory_service_1 = require("../provider-factory.service");
const chain_detection_service_1 = require("../chain-detection.service");
const config_1 = require("../../../config");
const lifi_config_1 = require("../lifi-config");
const wallet_provider_1 = require("../../../utils/wallet-provider");
class LiFiBridgeStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    constructor() {
        super();
        // Ensure LiFi SDK is configured
        (0, lifi_config_1.initializeLiFiConfig)();
    }
    getName() {
        return 'LiFiBridgeStrategy';
    }
    supports(params) {
        // Supports cross-chain swaps
        return chain_detection_service_1.ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId);
    }
    async validate(params) {
        // Check if both chains are supported
        if (!chain_detection_service_1.ChainDetectionService.isSupported(params.fromChainId)) {
            throw new Error(`Source chain ${params.fromChainId} not supported`);
        }
        if (!chain_detection_service_1.ChainDetectionService.isSupported(params.toChainId)) {
            throw new Error(`Destination chain ${params.toChainId} not supported`);
        }
        // Check if tokens exist on respective chains
        const fromTokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const toTokens = (0, config_1.getTokenAddresses)(params.toChainId);
        const fromTokenAddress = fromTokens[params.fromToken];
        const toTokenAddress = toTokens[params.toToken];
        if (!fromTokenAddress) {
            throw new Error(`Token ${params.fromToken} not available on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId)}`);
        }
        if (!toTokenAddress) {
            throw new Error(`Token ${params.toToken} not available on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.toChainId)}`);
        }
        return true;
    }
    async getEstimate(params) {
        this.log('Getting cross-chain estimate via LiFi', {
            from: `${params.fromToken} on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId)}`,
            to: `${params.toToken} on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.toChainId)}`,
        });
        // Use quote-only initialization (no wallet needed)
        (0, lifi_config_1.initializeLiFiForQuotes)();
        const fromTokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const toTokens = (0, config_1.getTokenAddresses)(params.toChainId);
        const fromTokenAddress = fromTokens[params.fromToken];
        const toTokenAddress = toTokens[params.toToken];
        // Get token decimals
        const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = config_1.TOKEN_METADATA[params.toToken] || { decimals: 18 };
        const amountInWei = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
        // Get routes from LiFi
        const result = await (0, sdk_1.getRoutes)({
            fromChainId: params.fromChainId,
            fromTokenAddress,
            fromAmount: amountInWei.toString(),
            toChainId: params.toChainId,
            toTokenAddress,
            fromAddress: params.userAddress,
            options: {
                slippage: (params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE) / 100,
                order: 'CHEAPEST',
            },
        });
        if (!result.routes || result.routes.length === 0) {
            throw new Error('No bridge routes found');
        }
        const route = result.routes[0];
        const expectedOutput = ethers_1.ethers.BigNumber.from(route.toAmount);
        const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        // Estimate gas from route
        const gasCostEstimate = route.gasCostUSD
            ? ethers_1.ethers.utils.parseEther(route.gasCostUSD)
            : ethers_1.ethers.BigNumber.from(0);
        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: route.steps[0]?.estimate?.priceImpact || 0,
            gasCostEstimate,
        };
    }
    async execute(params, callbacks) {
        this.log('Executing cross-chain bridge via LiFi', {
            from: `${params.fromToken} on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId)}`,
            to: `${params.toToken} on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.toChainId)}`,
        });
        try {
            // Validate
            await this.validate(params);
            // Get signer - handle both UI (ProviderFactory) and Agent (Autonomous)
            // Use fallback logic: if a signer is passed in params, use it (for agents)
            // Otherwise use ProviderFactory (for UI)
            const signer = params.signer || await provider_factory_service_1.ProviderFactoryService.getSignerForChain(params.fromChainId);
            // Get configuration
            const fromTokens = (0, config_1.getTokenAddresses)(params.fromChainId);
            const toTokens = (0, config_1.getTokenAddresses)(params.toChainId);
            const fromTokenAddress = fromTokens[params.fromToken];
            const toTokenAddress = toTokens[params.toToken];
            // Get token metadata
            const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 18 };
            const amountInWei = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
            // Get route from LiFi
            this.log('Requesting cross-chain route from LiFi');
            // Use quote-only initialization first to get route
            (0, lifi_config_1.initializeLiFiForQuotes)();
            const result = await (0, sdk_1.getRoutes)({
                fromChainId: params.fromChainId,
                fromTokenAddress,
                fromAmount: amountInWei.toString(),
                toChainId: params.toChainId,
                toTokenAddress,
                fromAddress: params.userAddress,
                options: {
                    slippage: (params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE) / 100,
                    order: 'CHEAPEST',
                },
            });
            if (!result.routes || result.routes.length === 0) {
                throw new Error('No bridge routes found');
            }
            const route = result.routes[0];
            this.log('Route found', {
                steps: route.steps.length,
                tools: route.steps.map(s => s.tool).join(' -> ')
            });
            // Now initialize LiFi with wallet for execution
            (0, lifi_config_1.initializeLiFiConfig)();
            // Execute route via LiFi SDK with enhanced monitoring for Farcaster
            this.log('Executing cross-chain route');
            let completedSteps = 0;
            const totalSteps = route.steps.length;
            const executedRoute = await (0, sdk_1.executeRoute)(route, {
                updateRouteHook: (updatedRoute) => {
                    // Track execution progress across all steps
                    updatedRoute.steps.forEach((step, index) => {
                        if (step?.execution?.process && step.execution.process.length > 0) {
                            const latestProcess = step.execution.process[step.execution.process.length - 1];
                            // Add null check before accessing properties
                            if (latestProcess) {
                                if (latestProcess.type === 'TOKEN_ALLOWANCE' && latestProcess.txHash) {
                                    this.log(`Step ${index + 1}: Approval submitted`, { hash: latestProcess.txHash });
                                    callbacks?.onApprovalSubmitted?.(latestProcess.txHash);
                                }
                                else if (latestProcess.type === 'CROSS_CHAIN' && latestProcess.txHash) {
                                    this.log(`Step ${index + 1}: Bridge transaction submitted`, { hash: latestProcess.txHash });
                                    callbacks?.onSwapSubmitted?.(latestProcess.txHash);
                                    // For Farcaster, ensure we don't lose provider connection between steps
                                    if (index === 0 && totalSteps > 1) {
                                        this.log('Multi-step bridge detected, maintaining provider connection');
                                        // Re-initialize LiFi config to ensure provider stays active
                                        setTimeout(() => {
                                            (0, lifi_config_1.initializeLiFiConfig)();
                                        }, 1000);
                                    }
                                }
                                else if (latestProcess.type === 'SWAP' && latestProcess.txHash) {
                                    this.log(`Step ${index + 1}: Swap submitted`, { hash: latestProcess.txHash });
                                    callbacks?.onSwapSubmitted?.(latestProcess.txHash);
                                }
                                // Track completion
                                if (latestProcess.status === 'DONE' && index >= completedSteps) {
                                    completedSteps = index + 1;
                                    this.log(`Step ${index + 1}/${totalSteps} completed`);
                                    // If this isn't the last step, ensure provider is still active
                                    if (completedSteps < totalSteps) {
                                        this.log('Preparing for next bridge step...');
                                        // Small delay to ensure transaction is confirmed before next step
                                        setTimeout(async () => {
                                            try {
                                                const provider = await (0, wallet_provider_1.getWalletProvider)();
                                                if (!provider)
                                                    return;
                                                const accounts = await provider.request({ method: 'eth_accounts' });
                                                if (!accounts || accounts.length === 0) {
                                                    console.warn('[LiFi Bridge] Provider connection lost, attempting reconnect');
                                                    await provider.request({ method: 'eth_requestAccounts' });
                                                }
                                            }
                                            catch (err) {
                                                console.warn('[LiFi Bridge] Provider check failed:', err);
                                            }
                                        }, 2000);
                                    }
                                }
                            }
                        }
                    });
                },
                // Add execution timeout for Farcaster environments
                infiniteApproval: false, // Require explicit approvals for better UX
            });
            // Extract transaction hash from first step (source chain transaction)
            const txHash = executedRoute.steps?.[0]?.execution?.process?.find((p) => p.type === 'CROSS_CHAIN' || p.type === 'SWAP')?.txHash || executedRoute.steps?.[0]?.execution?.process?.[0]?.txHash;
            if (!txHash) {
                throw new Error('No transaction hash returned from LiFi');
            }
            this.log('Bridge completed', {
                txHash,
                steps: executedRoute.steps.length
            });
            return {
                success: true,
                txHash,
                steps: executedRoute.steps,
            };
        }
        catch (error) {
            this.logError('LiFi bridge failed', error);
            return {
                success: false,
                error: error.message || 'Cross-chain bridge execution failed',
            };
        }
    }
}
exports.LiFiBridgeStrategy = LiFiBridgeStrategy;
//# sourceMappingURL=lifi-bridge.strategy.js.map