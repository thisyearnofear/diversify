/**
 * Mento Swap Strategy
 * Handles same-chain swaps on Celo using Mento Protocol
 */

import { ethers } from 'ethers';
import {
    BaseSwapStrategy,
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './base-swap.strategy';
import { ApprovalService } from '../approval';
import { ExchangeDiscoveryService } from '../exchange-discovery';
import { SwapExecutionService } from '../execution';
import { ProviderFactoryService } from '../provider-factory.service';
import { ChainDetectionService } from '../chain-detection.service';
import { getTokenAddresses, getBrokerAddress, TOKEN_METADATA, TX_CONFIG } from '../../../config';

// CUSD is the hub token - all Mento pairs route through it
const CUSD_SYMBOL = 'CUSD';

export class MentoSwapStrategy extends BaseSwapStrategy {
    getName(): string {
        return 'MentoSwapStrategy';
    }

    supports(params: SwapParams): boolean {
        // Supports same-chain swaps on Celo networks
        return (
            ChainDetectionService.isCelo(params.fromChainId) &&
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

        // Check if broker exists
        const brokerAddress = getBrokerAddress(params.fromChainId);
        if (!brokerAddress || brokerAddress === '0x0000000000000000000000000000000000000000') {
            throw new Error('Mento broker not available on this network');
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting swap estimate', { from: params.fromToken, to: params.toToken });

        const provider = ProviderFactoryService.getProvider(params.fromChainId);
        const tokens = getTokenAddresses(params.fromChainId);
        const brokerAddress = getBrokerAddress(params.fromChainId);

        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        // Get token decimals
        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

        // Find exchange
        const exchangeInfo = await ExchangeDiscoveryService.findDirectExchange(
            brokerAddress,
            fromTokenAddress,
            toTokenAddress,
            provider
        );

        if (!exchangeInfo) {
            throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
        }

        // Get quote
        const expectedOutput = await ExchangeDiscoveryService.getQuote(
            brokerAddress,
            exchangeInfo,
            fromTokenAddress,
            toTokenAddress,
            amountIn,
            provider
        );

        const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

        // Estimate gas (rough estimate)
        const gasCostEstimate = ethers.BigNumber.from(TX_CONFIG.GAS_LIMITS.SWAP)
            .mul(await provider.getGasPrice());

        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: 0.1, // TODO: Calculate actual price impact
            gasCostEstimate,
        };
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing Mento swap', params);

        try {
            // Validate
            await this.validate(params);

            // Get signer for transactions
            const signer = await ProviderFactoryService.getSignerForChain(params.fromChainId);
            
            // Use JsonRpcProvider for read-only calls (works with Farcaster)
            const readProvider = ProviderFactoryService.getProvider(params.fromChainId);

            // Get configuration
            const tokens = getTokenAddresses(params.fromChainId);
            const brokerAddress = getBrokerAddress(params.fromChainId);
            const isTestnet = ChainDetectionService.isTestnet(params.fromChainId);

            const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
            const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

            // Get token metadata
            const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
            const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

            const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

            // Transaction options
            const gasPrice = await readProvider.getGasPrice();
            const txOptions = { 
                useLegacyTx: true, // Celo uses legacy transactions
                gasPrice 
            };

            // Step 1: Check and handle approval
            this.log('Checking token approval');
            const approvalStatus = await ApprovalService.checkApproval(
                fromTokenAddress,
                params.userAddress,
                brokerAddress,
                amountIn,
                params.fromChainId,
                fromTokenMeta.decimals || 18
            );

            let approvalTxHash: string | undefined;

            if (!approvalStatus.isApproved) {
                this.log('Approving token');
                const approveTx = await ApprovalService.approve(
                    fromTokenAddress,
                    brokerAddress,
                    amountIn,
                    signer,
                    txOptions
                );

                approvalTxHash = approveTx.hash;
                callbacks?.onApprovalSubmitted?.(approveTx.hash);

                const confirmations = isTestnet
                    ? TX_CONFIG.CONFIRMATIONS.TESTNET
                    : TX_CONFIG.CONFIRMATIONS.MAINNET;

                await ApprovalService.waitForApproval(approveTx, confirmations);
                callbacks?.onApprovalConfirmed?.();
                this.log('Approval confirmed');
            }

            // Step 2: Find exchange (direct or via CUSD)
            this.log('Finding exchange');
            const directExchange = await ExchangeDiscoveryService.findDirectExchange(
                brokerAddress,
                fromTokenAddress,
                toTokenAddress,
                readProvider
            );

            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
            const confirmations = isTestnet
                ? TX_CONFIG.CONFIRMATIONS.TESTNET
                : TX_CONFIG.CONFIRMATIONS.MAINNET;

            let finalTxHash: string;

            if (directExchange) {
                // Direct swap available
                this.log('Direct exchange found, executing single swap');
                
                const expectedAmountOut = await ExchangeDiscoveryService.getQuote(
                    brokerAddress,
                    directExchange,
                    fromTokenAddress,
                    toTokenAddress,
                    amountIn,
                    readProvider
                );

                const minAmountOut = this.calculateMinOutput(expectedAmountOut, slippage);

                const swapTx = await SwapExecutionService.executeSwap(
                    brokerAddress,
                    directExchange,
                    fromTokenAddress,
                    toTokenAddress,
                    amountIn,
                    minAmountOut,
                    signer,
                    txOptions
                );

                callbacks?.onSwapSubmitted?.(swapTx.hash);
                this.log('Swap transaction submitted', { hash: swapTx.hash });

                await SwapExecutionService.waitForSwap(swapTx, confirmations);
                finalTxHash = swapTx.hash;
            } else {
                // No direct exchange - route through CUSD
                this.log('No direct exchange, routing through CUSD');
                const cusdAddress = tokens[CUSD_SYMBOL as keyof typeof tokens];
                
                if (!cusdAddress) {
                    throw new Error('CUSD not available on this network for routing');
                }

                // Skip if one of the tokens is already CUSD
                if (params.fromToken === CUSD_SYMBOL || params.toToken === CUSD_SYMBOL) {
                    throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
                }

                const twoStepExchange = await ExchangeDiscoveryService.findTwoStepExchange(
                    brokerAddress,
                    fromTokenAddress,
                    toTokenAddress,
                    cusdAddress,
                    readProvider
                );

                if (!twoStepExchange) {
                    throw new Error(`No exchange found for ${params.fromToken}/${params.toToken} (even via CUSD)`);
                }

                // Step 1: Swap fromToken -> CUSD
                this.log('Step 1: Swapping to CUSD');
                const cusdAmountOut = await ExchangeDiscoveryService.getQuote(
                    brokerAddress,
                    twoStepExchange.first,
                    fromTokenAddress,
                    cusdAddress,
                    amountIn,
                    readProvider
                );

                const minCusdOut = this.calculateMinOutput(cusdAmountOut, slippage);

                const firstSwapTx = await SwapExecutionService.executeSwap(
                    brokerAddress,
                    twoStepExchange.first,
                    fromTokenAddress,
                    cusdAddress,
                    amountIn,
                    minCusdOut,
                    signer,
                    txOptions
                );

                this.log('First swap submitted', { hash: firstSwapTx.hash });
                await SwapExecutionService.waitForSwap(firstSwapTx, confirmations);
                this.log('First swap confirmed');

                // Approve CUSD for second swap if needed
                const cusdApprovalStatus = await ApprovalService.checkApproval(
                    cusdAddress,
                    params.userAddress,
                    brokerAddress,
                    cusdAmountOut,
                    params.fromChainId,
                    18
                );

                if (!cusdApprovalStatus.isApproved) {
                    this.log('Approving CUSD for second swap');
                    const cusdApproveTx = await ApprovalService.approve(
                        cusdAddress,
                        brokerAddress,
                        cusdAmountOut,
                        signer,
                        txOptions
                    );
                    await ApprovalService.waitForApproval(cusdApproveTx, confirmations);
                }

                // Step 2: Swap CUSD -> toToken
                this.log('Step 2: Swapping CUSD to target token');
                const finalAmountOut = await ExchangeDiscoveryService.getQuote(
                    brokerAddress,
                    twoStepExchange.second,
                    cusdAddress,
                    toTokenAddress,
                    cusdAmountOut,
                    readProvider
                );

                const minFinalOut = this.calculateMinOutput(finalAmountOut, slippage);

                const secondSwapTx = await SwapExecutionService.executeSwap(
                    brokerAddress,
                    twoStepExchange.second,
                    cusdAddress,
                    toTokenAddress,
                    cusdAmountOut,
                    minFinalOut,
                    signer,
                    txOptions
                );

                callbacks?.onSwapSubmitted?.(secondSwapTx.hash);
                this.log('Second swap submitted', { hash: secondSwapTx.hash });

                await SwapExecutionService.waitForSwap(secondSwapTx, confirmations);
                finalTxHash = secondSwapTx.hash;
            }

            this.log('Swap confirmed');

            return {
                success: true,
                txHash: finalTxHash,
                approvalTxHash,
            };
        } catch (error: any) {
            this.logError('Swap failed', error);
            return {
                success: false,
                error: error.message || 'Swap execution failed',
            };
        }
    }
}
