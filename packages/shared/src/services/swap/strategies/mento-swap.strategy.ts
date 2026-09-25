/**
 * Mento Swap Strategy
 * Same-chain swaps on Celo via Mento Protocol v3 (FPMM + legacy pools,
 * multi-hop in a single Router transaction). All SDK access goes through
 * mento-sdk.service — the strategy only handles signing UX.
 */

import { ethers } from 'ethers';
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
import {
    buildMentoSwap,
    isMentoPair,
    quoteMento,
} from '../mento-sdk.service';

export class MentoSwapStrategy extends BaseSwapStrategy {
    getName(): string {
        return 'MentoSwapStrategy';
    }

    supports(params: SwapParams): boolean {
        // Same-chain Celo swaps where the Mento route graph actually
        // connects the pair — address-keyed, so CELO and other
        // non-Mento assets decline instead of burning an approval.
        if (!ChainDetectionService.isCelo(params.fromChainId) ||
            params.fromChainId !== params.toChainId) {
            return false;
        }

        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];
        if (!fromTokenAddress || !toTokenAddress) return false;

        return isMentoPair(params.fromChainId, fromTokenAddress, toTokenAddress);
    }

    async validate(params: SwapParams): Promise<boolean> {
        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(
                `Token pair ${params.fromToken}/${params.toToken} not available on ${ChainDetectionService.getNetworkName(params.fromChainId)}`
            );
        }

        if (!isMentoPair(params.fromChainId, fromTokenAddress, toTokenAddress)) {
            throw new Error(`No route found for ${params.fromToken}/${params.toToken} on Mento`);
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting swap estimate', { from: params.fromToken, to: params.toToken });

        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

        const quote = await quoteMento(
            params.fromChainId,
            fromTokenAddress,
            toTokenAddress,
            BigInt(amountIn.toString())
        );
        const expectedOutput = ethers.BigNumber.from(quote.amountOut.toString());

        const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

        const provider = ProviderFactoryService.getProvider(params.fromChainId);
        const gasCostEstimate = ethers.BigNumber.from(TX_CONFIG.GAS_LIMITS.SWAP)
            .mul(await provider.getGasPrice());

        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: quote.costPercent ?? 0,
            gasCostEstimate,
        };
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing Mento swap', params);

        try {
            await this.validate(params);

            const signer = params.signer || await ProviderFactoryService.getSignerForChain(params.fromChainId);

            const tokens = getTokenAddresses(params.fromChainId);
            const isTestnet = ChainDetectionService.isTestnet(params.fromChainId);
            const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
            const toTokenAddress = tokens[params.toToken as keyof typeof tokens];
            const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
            const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
            const confirmations = isTestnet
                ? TX_CONFIG.CONFIRMATIONS.TESTNET
                : TX_CONFIG.CONFIRMATIONS.MAINNET;

            // Build the swap BEFORE any approval — the SDK resolves the
            // route and checks the circuit breaker first, so gas is never
            // spent on a pair that can't trade.
            const built = await buildMentoSwap({
                chainId: params.fromChainId,
                tokenIn: fromTokenAddress,
                tokenOut: toTokenAddress,
                amountIn: BigInt(amountIn.toString()),
                recipient: params.userAddress,
                owner: params.userAddress,
                slippagePercent: slippage,
            });

            // Celo wallet calls go legacy (type 0 + explicit gasPrice) —
            // same handling the old broker path used.
            const readProvider = ProviderFactoryService.getProvider(params.fromChainId);
            const gasPrice = await readProvider.getGasPrice();
            const baseTxOptions = { type: 0, gasPrice };

            let approvalTxHash: string | undefined;
            if (built.approval) {
                this.log('Approving token for Mento Router');
                const approveTx = await signer.sendTransaction({
                    to: built.approval.to,
                    data: built.approval.data,
                    value: ethers.BigNumber.from(built.approval.value),
                    gasLimit: TX_CONFIG.GAS_LIMITS.APPROVAL,
                    ...baseTxOptions,
                });
                approvalTxHash = approveTx.hash;
                callbacks?.onApprovalSubmitted?.(approveTx.hash);

                const approvalReceipt = await readProvider.waitForTransaction(
                    approveTx.hash,
                    confirmations
                );
                if (!approvalReceipt || approvalReceipt.status !== 1) {
                    throw new Error('Approval transaction failed');
                }
                callbacks?.onApprovalConfirmed?.();
                this.log('Approval confirmed');
            }

            this.log('Sending swap to Mento Router', { hops: built.hops });
            const swapTx = await signer.sendTransaction({
                to: built.swap.to,
                data: built.swap.data,
                value: ethers.BigNumber.from(built.swap.value),
                gasLimit: TX_CONFIG.GAS_LIMITS.SWAP,
                ...baseTxOptions,
            });
            callbacks?.onSwapSubmitted?.(swapTx.hash);
            this.log('Swap transaction submitted', { hash: swapTx.hash });

            const receipt = await readProvider.waitForTransaction(swapTx.hash, confirmations);
            if (!receipt || receipt.status !== 1) {
                throw new Error('Swap transaction failed');
            }
            this.log('Swap confirmed', { hash: swapTx.hash, gasUsed: receipt.gasUsed.toString() });

            const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };
            return {
                success: true,
                txHash: swapTx.hash,
                approvalTxHash,
                amountOut: this.formatAmount(
                    ethers.BigNumber.from(built.expectedAmountOut.toString()),
                    toTokenMeta.decimals || 18
                ),
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
