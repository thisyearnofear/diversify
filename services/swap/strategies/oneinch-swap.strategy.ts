/**
 * 1inch Swap Strategy
 * Handles same-chain swaps using 1inch DEX aggregator
 * Excellent for USDC → PAXG and other RWA swaps on Arbitrum
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

interface OneInchQuoteResponse {
    dstAmount: string;
    srcAmount: string;
    protocols: any[];
    gas: string;
    gasPrice: string;
}

interface OneInchSwapResponse {
    dstAmount: string;
    srcAmount: string;
    tx: {
        from: string;
        to: string;
        data: string;
        value: string;
        gasPrice: string;
        gas: string;
    };
}

export class OneInchSwapStrategy extends BaseSwapStrategy {
    private readonly API_BASE_URL = 'https://api.1inch.dev/swap/v6.0';

    getName(): string {
        return 'OneInchSwapStrategy';
    }

    supports(params: SwapParams): boolean {
        // Supports same-chain swaps on supported networks
        return (
            params.fromChainId === params.toChainId &&
            this.getSupportedChainIds().includes(params.fromChainId)
        );
    }

    private getSupportedChainIds(): number[] {
        return [
            1,     // Ethereum
            56,    // BSC
            137,   // Polygon
            42161, // Arbitrum
            43114, // Avalanche
            10,    // Optimism
            8453,  // Base
        ];
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
        this.log('Getting 1inch quote', { from: params.fromToken, to: params.toToken });

        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        // Get token decimals
        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountInWei = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

        try {
            const quote = await this.getQuote({
                src: fromTokenAddress,
                dst: toTokenAddress,
                amount: amountInWei.toString(),
                chainId: params.fromChainId,
                slippage: params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE,
            });

            const expectedOutput = ethers.BigNumber.from(quote.dstAmount);
            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
            const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

            // Estimate gas cost
            const gasCostEstimate = ethers.BigNumber.from(quote.gas || '0')
                .mul(ethers.BigNumber.from(quote.gasPrice || '0'));

            return {
                expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
                minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
                priceImpact: 0.1, // 1inch doesn't provide price impact in quote
                gasCostEstimate,
            };
        } catch (error: any) {
            this.logError('1inch quote failed', error);
            throw new Error(`Failed to get quote from 1inch: ${error.message}`);
        }
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing 1inch swap', params);

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

            // Get swap transaction data from 1inch
            this.log('Getting swap transaction from 1inch');
            const swapData = await this.getSwapTransaction({
                src: fromTokenAddress,
                dst: toTokenAddress,
                amount: amountInWei.toString(),
                from: params.userAddress,
                chainId: params.fromChainId,
                slippage: params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE,
            });

            // Check if approval is needed
            if (fromTokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
                const allowanceNeeded = await this.checkAndHandleApproval(
                    fromTokenAddress,
                    swapData.tx.to,
                    amountInWei,
                    signer,
                    callbacks
                );

                if (!allowanceNeeded) {
                    this.log('Approval transaction submitted');
                }
            }

            // Execute the swap
            this.log('Executing swap transaction');
            const tx = await signer.sendTransaction({
                to: swapData.tx.to,
                data: swapData.tx.data,
                value: swapData.tx.value,
                gasLimit: swapData.tx.gas,
                gasPrice: swapData.tx.gasPrice,
            });

            callbacks?.onSwapSubmitted?.(tx.hash);
            this.log('Swap transaction submitted', { hash: tx.hash });

            // Wait for confirmation
            const receipt = await tx.wait();
            this.log('Swap confirmed', { hash: tx.hash, gasUsed: receipt.gasUsed.toString() });

            return {
                success: true,
                txHash: tx.hash,
            };
        } catch (error: any) {
            this.logError('1inch swap failed', error);
            return {
                success: false,
                error: error.message || '1inch swap execution failed',
            };
        }
    }

    private async getQuote(params: {
        src: string;
        dst: string;
        amount: string;
        chainId: number;
        slippage: number;
    }): Promise<OneInchQuoteResponse> {
        const url = `${this.API_BASE_URL}/${params.chainId}/quote`;
        const searchParams = new URLSearchParams({
            src: params.src,
            dst: params.dst,
            amount: params.amount,
            includeProtocols: 'true',
            includeGas: 'true',
        });

        const response = await fetch(`${url}?${searchParams}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`1inch API error: ${response.status} ${errorText}`);
        }

        return response.json();
    }

    private async getSwapTransaction(params: {
        src: string;
        dst: string;
        amount: string;
        from: string;
        chainId: number;
        slippage: number;
    }): Promise<OneInchSwapResponse> {
        const url = `${this.API_BASE_URL}/${params.chainId}/swap`;
        const searchParams = new URLSearchParams({
            src: params.src,
            dst: params.dst,
            amount: params.amount,
            from: params.from,
            slippage: params.slippage.toString(),
            disableEstimate: 'true',
        });

        const response = await fetch(`${url}?${searchParams}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`1inch API error: ${response.status} ${errorText}`);
        }

        return response.json();
    }

    private async checkAndHandleApproval(
        tokenAddress: string,
        spenderAddress: string,
        amount: ethers.BigNumber,
        signer: ethers.Signer,
        callbacks?: SwapCallbacks
    ): Promise<boolean> {
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function allowance(address owner, address spender) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)'],
            signer
        );

        const userAddress = await signer.getAddress();
        const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);

        if (currentAllowance.gte(amount)) {
            return true; // Sufficient allowance
        }

        // Need approval
        this.log('Approving token spend');
        const approveTx = await tokenContract.approve(spenderAddress, amount);
        callbacks?.onApprovalSubmitted?.(approveTx.hash);

        await approveTx.wait();
        callbacks?.onApprovalConfirmed?.();
        this.log('Approval confirmed');

        return false; // Approval was needed and completed
    }
}