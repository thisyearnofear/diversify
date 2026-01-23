/**
 * LiFi Bridge Strategy
 * Handles cross-chain swaps/bridges using LiFi SDK
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
import { initializeLiFiConfig } from '../lifi-config';

export class LiFiBridgeStrategy extends BaseSwapStrategy {
    constructor() {
        super();
        // Ensure LiFi SDK is configured
        initializeLiFiConfig();
    }
    getName(): string {
        return 'LiFiBridgeStrategy';
    }

    supports(params: SwapParams): boolean {
        // Supports cross-chain swaps
        return ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId);
    }

    async validate(params: SwapParams): Promise<boolean> {
        // Check if both chains are supported
        if (!ChainDetectionService.isSupported(params.fromChainId)) {
            throw new Error(`Source chain ${params.fromChainId} not supported`);
        }

        if (!ChainDetectionService.isSupported(params.toChainId)) {
            throw new Error(`Destination chain ${params.toChainId} not supported`);
        }

        // Check if tokens exist on respective chains
        const fromTokens = getTokenAddresses(params.fromChainId);
        const toTokens = getTokenAddresses(params.toChainId);

        const fromTokenAddress = fromTokens[params.fromToken as keyof typeof fromTokens];
        const toTokenAddress = toTokens[params.toToken as keyof typeof toTokens];

        if (!fromTokenAddress) {
            throw new Error(
                `Token ${params.fromToken} not available on ${ChainDetectionService.getNetworkName(params.fromChainId)}`
            );
        }

        if (!toTokenAddress) {
            throw new Error(
                `Token ${params.toToken} not available on ${ChainDetectionService.getNetworkName(params.toChainId)}`
            );
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting cross-chain estimate via LiFi', {
            from: `${params.fromToken} on ${ChainDetectionService.getNetworkName(params.fromChainId)}`,
            to: `${params.toToken} on ${ChainDetectionService.getNetworkName(params.toChainId)}`,
        });

        const fromTokens = getTokenAddresses(params.fromChainId);
        const toTokens = getTokenAddresses(params.toChainId);

        const fromTokenAddress = fromTokens[params.fromToken as keyof typeof fromTokens];
        const toTokenAddress = toTokens[params.toToken as keyof typeof toTokens];

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
            },
        });

        if (!result.routes || result.routes.length === 0) {
            throw new Error('No bridge routes found');
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
        this.log('Executing cross-chain bridge via LiFi', {
            from: `${params.fromToken} on ${ChainDetectionService.getNetworkName(params.fromChainId)}`,
            to: `${params.toToken} on ${ChainDetectionService.getNetworkName(params.toChainId)}`,
        });

        try {
            // Validate
            await this.validate(params);

            // Get signer
            const signer = await ProviderFactoryService.getSignerForChain(params.fromChainId);

            // Get configuration
            const fromTokens = getTokenAddresses(params.fromChainId);
            const toTokens = getTokenAddresses(params.toChainId);

            const fromTokenAddress = fromTokens[params.fromToken as keyof typeof fromTokens];
            const toTokenAddress = toTokens[params.toToken as keyof typeof toTokens];

            // Get token metadata
            const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };

            const amountInWei = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

            // Get route from LiFi
            this.log('Requesting cross-chain route from LiFi');
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
                },
            });

            if (!result.routes || result.routes.length === 0) {
                throw new Error('No bridge routes found');
            }

            const route = result.routes[0] as Route;
            this.log('Route found', {
                steps: route.steps.length,
                tools: route.steps.map(s => s.tool).join(' -> ')
            });

            // Execute route via LiFi SDK
            // LiFi SDK v3 will automatically use window.ethereum
            this.log('Executing cross-chain route');
            const executedRoute = await executeRoute(route, {
                updateRouteHook: (updatedRoute) => {
                    // Track execution progress across all steps
                    updatedRoute.steps.forEach((step, index) => {
                        if (step?.execution?.process) {
                            const latestProcess = step.execution.process[step.execution.process.length - 1];

                            if (latestProcess.type === 'TOKEN_ALLOWANCE' && latestProcess.txHash) {
                                this.log(`Step ${index + 1}: Approval submitted`, { hash: latestProcess.txHash });
                                callbacks?.onApprovalSubmitted?.(latestProcess.txHash);
                            } else if (latestProcess.type === 'CROSS_CHAIN' && latestProcess.txHash) {
                                this.log(`Step ${index + 1}: Bridge transaction submitted`, { hash: latestProcess.txHash });
                                callbacks?.onSwapSubmitted?.(latestProcess.txHash);
                            } else if (latestProcess.type === 'SWAP' && latestProcess.txHash) {
                                this.log(`Step ${index + 1}: Swap submitted`, { hash: latestProcess.txHash });
                                callbacks?.onSwapSubmitted?.(latestProcess.txHash);
                            }
                        }
                    });
                },
            });

            // Extract transaction hash from first step (source chain transaction)
            const txHash = executedRoute.steps?.[0]?.execution?.process?.find(
                (p: any) => p.type === 'CROSS_CHAIN' || p.type === 'SWAP'
            )?.txHash || executedRoute.steps?.[0]?.execution?.process?.[0]?.txHash;

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
        } catch (error: any) {
            this.logError('LiFi bridge failed', error);
            return {
                success: false,
                error: error.message || 'Cross-chain bridge execution failed',
            };
        }
    }
}
