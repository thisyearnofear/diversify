"use strict";
/**
 * LiFi Swap Strategy
 * Handles same-chain swaps on Arbitrum using LiFi SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiFiSwapStrategy = void 0;
const ethers_1 = require("ethers");
const sdk_1 = require("@lifi/sdk");
const base_swap_strategy_1 = require("./base-swap.strategy");
const provider_factory_service_1 = require("../provider-factory.service");
const chain_detection_service_1 = require("../chain-detection.service");
const config_1 = require("../../../config");
const lifi_config_1 = require("../lifi-config");
class LiFiSwapStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    constructor() {
        super();
        // Ensure LiFi SDK is configured
        (0, lifi_config_1.initializeLiFiConfig)();
    }
    getName() {
        return 'LiFiSwapStrategy';
    }
    supports(params) {
        // Supports same-chain swaps on Arbitrum and Celo (not Arc Testnet)
        // LiFi aggregates DEXes on both chains (Uniswap V3, etc.)
        return ((chain_detection_service_1.ChainDetectionService.isArbitrum(params.fromChainId) ||
            chain_detection_service_1.ChainDetectionService.isCelo(params.fromChainId)) &&
            params.fromChainId === params.toChainId);
    }
    async validate(params) {
        // Check if tokens exist on this chain
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const toTokenAddress = tokens[params.toToken];
        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(`Token pair ${params.fromToken}/${params.toToken} not available on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId)}`);
        }
        return true;
    }
    async getEstimate(params) {
        this.log('Getting swap estimate via LiFi', { from: params.fromToken, to: params.toToken });
        // Use quote-only initialization (no wallet needed)
        (0, lifi_config_1.initializeLiFiForQuotes)();
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const toTokenAddress = tokens[params.toToken];
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
                // Add additional options for better compatibility
                integrator: 'diversifi-minipay',
                allowSwitchChain: false, // Prevent automatic chain switching
            },
        });
        if (!result.routes || result.routes.length === 0) {
            throw new Error('No swap routes found');
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
        this.log('Executing LiFi swap on Arbitrum', params);
        try {
            // Validate
            await this.validate(params);
            // Get signer
            const signer = await provider_factory_service_1.ProviderFactoryService.getSignerForChain(params.fromChainId);
            // Get configuration
            const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
            const fromTokenAddress = tokens[params.fromToken];
            const toTokenAddress = tokens[params.toToken];
            // Get token metadata
            const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 18 };
            const amountInWei = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
            // Get route from LiFi
            this.log('Requesting route from LiFi', {
                fromChainId: params.fromChainId,
                toChainId: params.toChainId,
                fromTokenAddress,
                toTokenAddress,
                amount: amountInWei.toString(),
                userAddress: params.userAddress
            });
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
                    // Add additional options for better compatibility
                    integrator: 'diversifi-minipay',
                    allowSwitchChain: false, // Prevent automatic chain switching
                },
            });
            if (!result.routes || result.routes.length === 0) {
                this.log('No routes found from LiFi', result);
                throw new Error('No swap routes found');
            }
            const route = result.routes[0];
            this.log('Route found', {
                tool: route.steps[0]?.tool,
                steps: route.steps.length,
                fromAmount: route.fromAmount,
                toAmount: route.toAmount
            });
            // Now initialize LiFi with wallet for execution
            (0, lifi_config_1.initializeLiFiConfig)();
            // Ensure wallet is connected and ready
            await (0, lifi_config_1.ensureWalletConnection)();
            // Validate wallet provider is available
            (0, lifi_config_1.validateWalletProvider)();
            // Check execution providers
            await (0, lifi_config_1.checkExecutionProviders)();
            // Execute route via LiFi SDK
            this.log('Executing route with LiFi SDK');
            const executedRoute = await (0, sdk_1.executeRoute)(route, {
                updateRouteHook: (updatedRoute) => {
                    // Track execution progress
                    const step = updatedRoute.steps[0];
                    if (step?.execution?.process && step.execution.process.length > 0) {
                        const latestProcess = step.execution.process[step.execution.process.length - 1];
                        // Add null check before accessing properties
                        if (latestProcess) {
                            this.log('Route execution progress', {
                                type: latestProcess.type,
                                status: latestProcess.status,
                                txHash: latestProcess.txHash
                            });
                            if (latestProcess.type === 'TOKEN_ALLOWANCE' && latestProcess.txHash) {
                                callbacks?.onApprovalSubmitted?.(latestProcess.txHash);
                            }
                            else if (latestProcess.type === 'SWAP' && latestProcess.txHash) {
                                callbacks?.onSwapSubmitted?.(latestProcess.txHash);
                            }
                        }
                    }
                },
            });
            // Extract transaction hash
            const txHash = executedRoute.steps?.[0]?.execution?.process?.find((p) => p.type === 'SWAP')?.txHash || executedRoute.steps?.[0]?.execution?.process?.[0]?.txHash;
            if (!txHash) {
                this.logError('No transaction hash returned from LiFi', executedRoute);
                throw new Error('No transaction hash returned from LiFi');
            }
            this.log('Swap completed', { txHash });
            return {
                success: true,
                txHash,
                steps: executedRoute.steps,
            };
        }
        catch (error) {
            this.logError('LiFi swap failed', error);
            // Provide more specific error messages
            if (error.message?.includes('SDK Execution Provider not found')) {
                return {
                    success: false,
                    error: 'Wallet connection issue. Please ensure your wallet is connected and try again.',
                };
            }
            if (error.message?.includes('No wallet provider')) {
                return {
                    success: false,
                    error: 'No wallet detected. Please install MetaMask or another Web3 wallet.',
                };
            }
            return {
                success: false,
                error: error.message || 'LiFi swap execution failed',
            };
        }
    }
}
exports.LiFiSwapStrategy = LiFiSwapStrategy;
//# sourceMappingURL=lifi-swap.strategy.js.map