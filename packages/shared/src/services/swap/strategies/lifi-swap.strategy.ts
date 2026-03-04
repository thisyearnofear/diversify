/**
 * LiFi Swap Strategy
 * Handles same-chain swaps on Arbitrum using LiFi SDK
 */

import { ethers } from 'ethers';
import { getRoutes, executeRoute, config as lifiConfig, Route } from '@lifi/sdk';
import {
    BaseSwapStrategy,
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './base-swap.strategy';
import { ProviderFactoryService } from '../provider-factory.service';
import { ChainDetectionService } from '../chain-detection.service';
import { getTokenAddresses, TOKEN_METADATA, TX_CONFIG } from '../../../config';
import { initializeLiFiConfig, initializeLiFiForQuotes, validateWalletProvider, checkExecutionProviders, ensureWalletConnection } from '../lifi-config';

export class LiFiSwapStrategy extends BaseSwapStrategy {
    constructor() {
        super();
        // Ensure LiFi SDK is configured
        initializeLiFiConfig();
    }
    getName(): string {
        return 'LiFiSwapStrategy';
    }

    supports(params: SwapParams): boolean {
        // Supports same-chain swaps on Arbitrum and Celo (not Arc Testnet)
        // LiFi aggregates DEXes on both chains (Uniswap V3, etc.)
        return (
            (ChainDetectionService.isArbitrum(params.fromChainId) ||
                ChainDetectionService.isCelo(params.fromChainId)) &&
            params.fromChainId === params.toChainId
        );
    }

    async validate(params: SwapParams): Promise<boolean> {
        // Check if tokens exist on this chain
        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(
                `Token pair ${params.fromToken}/${params.toToken} not available on ${ChainDetectionService.getNetworkName(params.fromChainId)}`
            );
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting swap estimate via LiFi', { from: params.fromToken, to: params.toToken });

        // Use quote-only initialization (no wallet needed)
        initializeLiFiForQuotes();

        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        // Get token decimals
        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountInWei = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

        // Get routes from LiFi
        const result = await getRoutes({
            fromChainId: params.fromChainId,
            fromTokenAddress,
            fromAmount: amountInWei.toString(),
            toChainId: params.toChainId,
            toTokenAddress,
            fromAddress: params.userAddress,
            options: {
                slippage: (params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE) / 100,
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
        const expectedOutput = ethers.BigNumber.from(route.toAmount);
        const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

        // Estimate gas from route
        const gasCostEstimate = route.gasCostUSD
            ? ethers.utils.parseEther(route.gasCostUSD)
            : ethers.BigNumber.from(0);

        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: (route.steps[0]?.estimate as any)?.priceImpact || 0,
            gasCostEstimate,
        };
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing LiFi swap on Arbitrum', params);

        try {
            // Validate
            await this.validate(params);

            // Get signer
            const signer = await ProviderFactoryService.getSignerForChain(params.fromChainId);

            // Get configuration
            const tokens = getTokenAddresses(params.fromChainId);
            const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
            const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

            // Get token metadata
            const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };

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
            initializeLiFiForQuotes();

            const result = await getRoutes({
                fromChainId: params.fromChainId,
                fromTokenAddress,
                fromAmount: amountInWei.toString(),
                toChainId: params.toChainId,
                toTokenAddress,
                fromAddress: params.userAddress,
                options: {
                    slippage: (params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE) / 100,
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

            const route = result.routes[0] as Route;
            this.log('Route found', {
                tool: route.steps[0]?.tool,
                steps: route.steps.length,
                fromAmount: route.fromAmount,
                toAmount: route.toAmount
            });

            // Now initialize LiFi with wallet for execution
            initializeLiFiConfig();

            // Ensure wallet is connected and ready
            await ensureWalletConnection();

            // Validate wallet provider is available
            validateWalletProvider();

            // Check execution providers
            await checkExecutionProviders();

            // Execute route via LiFi SDK
            this.log('Executing route with LiFi SDK');

            const executedRoute = await executeRoute(route, {
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
                            } else if (latestProcess.type === 'SWAP' && latestProcess.txHash) {
                                callbacks?.onSwapSubmitted?.(latestProcess.txHash);
                            }
                        }
                    }
                },
            });

            // Extract transaction hash
            const txHash = executedRoute.steps?.[0]?.execution?.process?.find(
                (p: any) => p.type === 'SWAP'
            )?.txHash || executedRoute.steps?.[0]?.execution?.process?.[0]?.txHash;

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
        } catch (error: any) {
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
