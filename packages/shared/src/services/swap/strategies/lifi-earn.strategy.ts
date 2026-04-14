/**
 * LiFi Earn Strategy
 * Strategy for depositing into yield vaults using LI.FI Earn API
 */

import {
    BaseSwapStrategy,
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './base-swap.strategy';
import { EarnService } from '../../earn-service';
import { ChainDetectionService } from '../chain-detection.service';

export class LiFiEarnStrategy extends BaseSwapStrategy {
    getName(): string {
        return 'LiFiEarn';
    }

    /**
     * Supports if destination is a vault (prefixed with 'lifi-earn:')
     */
    supports(params: SwapParams): boolean {
        return params.toToken.startsWith('lifi-earn:');
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        try {
            const vaultId = params.toToken.replace('lifi-earn:', '');
            
            callbacks?.onStatusUpdate?.('Fetching deposit quote from LI.FI Earn...');
            
            const quote = await EarnService.getDepositQuote({
                vaultId,
                fromChainId: params.fromChainId,
                fromTokenAddress: await this.getTokenAddress(params.fromChainId, params.fromToken),
                fromAddress: params.userAddress,
                amount: params.amount,
                integrator: 'diversifi-minipay'
            });

            callbacks?.onStatusUpdate?.('Initiating vault deposit...');
            
            const signer = params.signer || await this.getSigner(params.fromChainId);
            const tx = await signer.sendTransaction({
                to: quote.transactionRequest.to,
                data: quote.transactionRequest.data,
                value: quote.transactionRequest.value,
            });

            callbacks?.onStatusUpdate?.('Waiting for confirmation...');
            const receipt = await tx.wait();

            return {
                success: receipt.status === 1,
                txHash: receipt.transactionHash,
                amountOut: quote.estimate.toAmount,
            };
        } catch (error: any) {
            console.error('[LiFiEarnStrategy] Execution failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to execute vault deposit',
            };
        }
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        const vaultId = params.toToken.replace('lifi-earn:', '');
        
        const quote = await EarnService.getDepositQuote({
            vaultId,
            fromChainId: params.fromChainId,
            fromTokenAddress: await this.getTokenAddress(params.fromChainId, params.fromToken),
            fromAddress: params.userAddress,
            amount: params.amount,
        });

        return {
            fromAmount: params.amount,
            toAmount: quote.estimate.toAmount,
            priceImpact: 0, // LI.FI Earn doesn't provide explicit price impact in the same way
            feeUSD: parseFloat(quote.estimate.feeUSD),
            estimatedTime: 120, // Typical cross-chain/vault deposit time
            provider: 'LI.FI Earn',
        };
    }

    async validate(params: SwapParams): Promise<boolean> {
        if (!params.userAddress) throw new Error('User address is required');
        if (!params.amount || params.amount === '0') throw new Error('Amount must be greater than 0');
        return true;
    }

    private async getTokenAddress(chainId: number, symbol: string): Promise<string> {
        const { getTokenAddresses } = require('../../../config');
        const tokens = getTokenAddresses(chainId);
        const address = tokens[symbol as keyof typeof tokens];
        if (!address) {
            // If it's a full address already
            if (symbol.startsWith('0x')) return symbol;
            throw new Error(`Token ${symbol} not found on chain ${chainId}`);
        }
        return address;
    }

    private async getSigner(chainId: number): Promise<any> {
        const { ProviderFactoryService } = require('../provider-factory.service');
        return ProviderFactoryService.getSignerForChain(chainId);
    }
}
