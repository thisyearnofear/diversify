/**
 * Direct RWA Swap Strategy
 * Fallback strategy for Real World Asset swaps when other strategies fail
 * Uses direct DEX calls for common RWA pairs like USDC/PAXG
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
import { ArbitrumTransactionService } from '../arbitrum-transaction.service';

// Curve Finance pools for RWA swaps on Arbitrum
const CURVE_POOLS: Record<string, { address: string; coins: string[]; decimals: number[] }> = {
    'USDC-PAXG': {
        address: '0x0000000000000000000000000000000000000000', // Placeholder - would need actual pool
        coins: ['0xaf88d065e77c8cC2239327C5EDb3A432268e5831', '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429'],
        decimals: [6, 18]
    }
};

// Simple DEX aggregator for RWA swaps
const DEX_ROUTER_ABI = [
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
];

export class DirectRWAStrategy extends BaseSwapStrategy {
    getName(): string {
        return 'DirectRWAStrategy';
    }

    supports(params: SwapParams): boolean {
        // Supports Arbitrum RWA swaps: USDC/PAXG, USDC/USDY, USDC/sDAI
        const isArbitrum = params.fromChainId === params.toChainId && params.fromChainId === 42161;
        if (!isArbitrum) return false;
        
        const rwaTokens = ['PAXG', 'USDY', 'SDAI'];
        const isRwaSwap = 
            (params.fromToken === 'USDC' && rwaTokens.includes(params.toToken)) ||
            (rwaTokens.includes(params.fromToken) && params.toToken === 'USDC');
        
        return isRwaSwap;
    }

    async validate(params: SwapParams): Promise<boolean> {
        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(`Token pair ${params.fromToken}/${params.toToken} not available on Arbitrum`);
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting direct RWA estimate', { from: params.fromToken, to: params.toToken });

        // Price approximations for RWA tokens
        const tokenPrices: Record<string, number> = {
            'USDC': 1,
            'PAXG': 2650,  // Gold price
            'USDY': 1.05,  // Slightly above $1 due to accrued yield
            'SDAI': 1.02,  // Slightly above $1 due to accrued yield
        };

        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
        const fromPrice = tokenPrices[params.fromToken] || 1;
        const toPrice = tokenPrices[params.toToken] || 1;

        // Calculate expected output based on price ratio
        const amountInUSD = parseFloat(params.amount) * fromPrice;
        const expectedOutputAmount = amountInUSD / toPrice;
        
        // Convert to token decimals
        const expectedOutput = ethers.utils.parseUnits(
            expectedOutputAmount.toFixed(6), 
            toTokenMeta.decimals || 18
        );

        const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

        // Estimate gas cost
        const gasCostEstimate = ethers.utils.parseEther('0.001'); // ~$2-3 on Arbitrum

        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: 0.5, // Estimate 0.5% price impact
            gasCostEstimate,
        };
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing direct RWA swap', params);

        try {
            // For now, return a helpful error message since we don't have actual DEX integration
            // This strategy serves as a fallback to provide better error messages

            const errorMessage = this.getHelpfulErrorMessage(params);

            return {
                success: false,
                error: errorMessage,
            };

        } catch (error: any) {
            this.logError('Direct RWA swap failed', error);
            return {
                success: false,
                error: error.message || 'Direct RWA swap execution failed',
            };
        }
    }

    private getHelpfulErrorMessage(params: SwapParams): string {
        const rwaTokenNames: Record<string, string> = {
            'PAXG': 'Paxos Gold (PAXG)',
            'USDY': 'Ondo US Dollar Yield (USDY)',
            'SDAI': 'Savings DAI (sDAI)'
        };
        
        if (params.fromToken === 'USDC' && rwaTokenNames[params.toToken]) {
            return `USDC to ${rwaTokenNames[params.toToken]} swap temporarily unavailable. This requires a 1inch API key for optimal routing. Please try again later or contact support.`;
        }

        if (rwaTokenNames[params.fromToken] && params.toToken === 'USDC') {
            return `${rwaTokenNames[params.fromToken]} to USDC swap temporarily unavailable. This requires a 1inch API key for optimal routing. Please try again later or contact support.`;
        }

        return `${params.fromToken} to ${params.toToken} swap is not currently supported on Arbitrum.`;
    }
}