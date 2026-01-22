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

            // Get signer
            const signer = await ProviderFactoryService.getSignerForChain(params.fromChainId);
            const provider = signer.provider as ethers.providers.Provider;

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
            const gasPrice = await provider.getGasPrice();
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
                provider,
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

            // Step 2: Find exchange
            this.log('Finding exchange');
            const exchangeInfo = await ExchangeDiscoveryService.findDirectExchange(
                brokerAddress,
                fromTokenAddress,
                toTokenAddress,
                provider
            );

            if (!exchangeInfo) {
                throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
            }

            // Step 3: Get quote
            this.log('Getting quote');
            const expectedAmountOut = await ExchangeDiscoveryService.getQuote(
                brokerAddress,
                exchangeInfo,
                fromTokenAddress,
                toTokenAddress,
                amountIn,
                provider
            );

            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
            const minAmountOut = this.calculateMinOutput(expectedAmountOut, slippage);

            // Step 4: Execute swap
            this.log('Executing swap transaction');
            const swapTx = await SwapExecutionService.executeSwap(
                brokerAddress,
                exchangeInfo,
                fromTokenAddress,
                toTokenAddress,
                amountIn,
                minAmountOut,
                signer,
                txOptions
            );

            callbacks?.onSwapSubmitted?.(swapTx.hash);
            this.log('Swap transaction submitted', { hash: swapTx.hash });

            // Step 5: Wait for confirmation
            const confirmations = isTestnet
                ? TX_CONFIG.CONFIRMATIONS.TESTNET
                : TX_CONFIG.CONFIRMATIONS.MAINNET;

            await SwapExecutionService.waitForSwap(swapTx, confirmations);
            this.log('Swap confirmed');

            return {
                success: true,
                txHash: swapTx.hash,
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
