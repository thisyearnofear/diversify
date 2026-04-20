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
            const correlationId = this.getCorrelationId();
            
            callbacks?.onStatusUpdate?.('Routing via LI.FI Composer for optimal vault deposit...');

            const vault = await EarnService.getVaultDetails(vaultId);
            if (vault.status !== 'active') {
                return {
                    success: false,
                    error: `Selected vault is not active: ${vault.name || vaultId}.`,
                };
            }

            const fromTokenAddress = await this.getTokenAddress(params.fromChainId, params.fromToken);
            
            const quote = await EarnService.getDepositQuote({
                vaultId,
                fromChainId: params.fromChainId,
                toChainId: params.toChainId,
                fromTokenAddress,
                fromAddress: params.userAddress,
                amount: params.amount,
                integrator: process.env.LIFI_INTEGRATOR_ID || 'diversifi-minipay',
                slippage: typeof params.slippageTolerance === 'number'
                    ? params.slippageTolerance / 100
                    : undefined,
                correlationId,
            });

            const preflightError = this.getQuotePreflightError(quote);
            if (preflightError) {
                return {
                    success: false,
                    error: preflightError,
                };
            }

            console.info('[LiFiEarnStrategy] Quote preflight passed', {
                correlationId,
                vaultId,
                fromChainId: params.fromChainId,
                toChainId: params.toChainId,
                fromTokenAddress,
            });

            callbacks?.onStatusUpdate?.('Executing atomic swap + deposit via LI.FI...');
            
            const signer = params.signer || await this.getSigner(params.fromChainId);
            const tx = await signer.sendTransaction({
                to: quote.transactionRequest.to,
                data: quote.transactionRequest.data,
                value: quote.transactionRequest.value,
            });

            callbacks?.onStatusUpdate?.('Confirming vault deposit...');
            const receipt = await tx.wait();

            console.info('[LiFiEarnStrategy] Execution result', {
                correlationId,
                vaultId,
                success: receipt.status === 1,
                txHash: receipt.transactionHash,
            });

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
            toChainId: params.toChainId,
            fromTokenAddress: await this.getTokenAddress(params.fromChainId, params.fromToken),
            fromAddress: params.userAddress,
            amount: params.amount,
        });

        return {
            fromAmount: params.amount,
            toAmount: quote.estimate.toAmount,
            priceImpact: 0,
            feeUSD: parseFloat(quote.estimate.feeUSD),
            estimatedTime: 120,
            provider: 'LI.FI Composer',
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

    private getQuotePreflightError(quote: any): string | null {
        if (!quote?.transactionRequest?.to || !quote?.transactionRequest?.data) {
            return 'Quote did not return a valid transaction route. Please try a different token or amount.';
        }

        const fromAmount = Number(quote?.estimate?.fromAmount ?? '0');
        const toAmount = Number(quote?.estimate?.toAmount ?? '0');
        if (!Number.isFinite(fromAmount) || fromAmount <= 0 || !Number.isFinite(toAmount) || toAmount <= 0) {
            return 'Quote output is invalid. Please retry with a supported source token and amount.';
        }

        return null;
    }

    private getCorrelationId(): string {
        return `earn-exec-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    private async getSigner(chainId: number): Promise<any> {
        const { ProviderFactoryService } = require('../provider-factory.service');
        return ProviderFactoryService.getSignerForChain(chainId);
    }
}
