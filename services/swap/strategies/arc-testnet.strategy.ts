/**
 * Arc Testnet Swap Strategy
 * Handles swaps on Arc Testnet using Curve Finance and AeonDEX
 * Based on real working DEXs discovered through user research
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
import { getTokenAddresses, TOKEN_METADATA, TX_CONFIG, ARC_TOKENS } from '../../../config';

// Arc Testnet DEX Configuration
const ARC_TESTNET_DEXS = {
    // Curve Finance - Primary DEX for USDC/EURC swaps
    CURVE: {
        name: 'Curve Finance',
        url: 'https://curve.fi/dex/arc/swap/',
        // Note: Contract addresses would need to be discovered via the Curve registry
        // For now, we'll provide guidance to use the UI directly
        supported_pairs: ['USDC/EURC', 'EURC/USDC'],
        fee: 0.04, // 0.04% as mentioned in research
    },

    // AeonDEX - Dedicated USDC ↔ EURC exchange
    AEON: {
        name: 'AeonDEX',
        description: 'Dedicated DEX for instant USDC ↔ EURC exchanges',
        supported_pairs: ['USDC/EURC', 'EURC/USDC'],
        fee: 0.1, // Estimated fee
    }
};

// Supported stablecoin pairs on Arc Testnet
const SUPPORTED_PAIRS = [
    { from: 'USDC', to: 'EURC' },
    { from: 'EURC', to: 'USDC' },
];

export class ArcTestnetStrategy extends BaseSwapStrategy {
    getName(): string {
        return 'ArcTestnetStrategy';
    }

    supports(params: SwapParams): boolean {
        // Only supports Arc Testnet same-chain swaps
        if (!ChainDetectionService.isArc(params.fromChainId) || params.fromChainId !== params.toChainId) {
            return false;
        }

        // Check if this is a supported pair
        return SUPPORTED_PAIRS.some(
            pair => pair.from === params.fromToken && pair.to === params.toToken
        );
    }

    async validate(params: SwapParams): Promise<boolean> {
        // Check if tokens exist on Arc Testnet
        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(
                `Token pair ${params.fromToken}/${params.toToken} not available on Arc Testnet`
            );
        }

        // Check if this is a supported pair
        const isSupported = SUPPORTED_PAIRS.some(
            pair => pair.from === params.fromToken && pair.to === params.toToken
        );

        if (!isSupported) {
            throw new Error(
                `${params.fromToken}/${params.toToken} swaps not yet supported. Currently only USDC/EURC pairs are available.`
            );
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting Arc Testnet swap estimate', { from: params.fromToken, to: params.toToken });

        // Get token metadata
        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 6 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 6 };

        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 6);

        // For USDC/EURC stablecoin pairs, use near 1:1 rate with Curve's 0.04% fee
        let expectedOutput: ethers.BigNumber;
        let priceImpact: number;

        if ((params.fromToken === 'USDC' && params.toToken === 'EURC') ||
            (params.fromToken === 'EURC' && params.toToken === 'USDC')) {

            // Apply Curve's 0.04% fee
            const feeAmount = amountIn.mul(4).div(10000); // 0.04%
            expectedOutput = amountIn.sub(feeAmount);
            priceImpact = 0.04; // 0.04% fee as price impact

            // Adjust for different decimals if needed
            if ((fromTokenMeta.decimals || 6) !== (toTokenMeta.decimals || 6)) {
                const decimalDiff = (fromTokenMeta.decimals || 6) - (toTokenMeta.decimals || 6);
                if (decimalDiff > 0) {
                    expectedOutput = expectedOutput.div(ethers.BigNumber.from(10).pow(decimalDiff));
                } else {
                    expectedOutput = expectedOutput.mul(ethers.BigNumber.from(10).pow(-decimalDiff));
                }
            }
        } else {
            throw new Error('Unsupported token pair for Arc Testnet');
        }

        const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

        // Arc uses USDC for gas, so gas cost is predictable (~$0.01)
        const gasCostEstimate = ethers.utils.parseUnits('0.01', 6);

        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 6),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 6),
            priceImpact,
            gasCostEstimate,
        };
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing Arc Testnet swap', params);

        try {
            // Validate the swap
            await this.validate(params);

            // Since we don't have direct contract integration yet, provide detailed guidance
            const swapGuidance = this.getDetailedSwapGuidance(params);

            return {
                success: false,
                error: swapGuidance,
            };

        } catch (error: any) {
            this.logError('Arc Testnet swap failed', error);
            return {
                success: false,
                error: error.message || 'Arc Testnet swap execution failed',
            };
        }
    }

    private getDetailedSwapGuidance(params: SwapParams): string {
        const { fromToken, toToken, amount } = params;

        return `✅ ${fromToken} to ${toToken} swaps are available on Arc Testnet!

🎯 **Recommended DEXs** (based on user research):

1️⃣ **Curve Finance** (Primary - Most documented)
   • URL: https://curve.fi/dex/arc/swap/
   • Fee: 0.04% (very low for stablecoin pairs)
   • Best for: Larger amounts, lowest slippage
   • Status: ✅ Confirmed working by users

2️⃣ **AeonDEX** (Alternative)
   • Dedicated USDC ↔ EURC exchange
   • Available via GitHub deployment
   • Best for: Quick swaps, simple interface

📋 **How to swap manually:**
1. Connect MetaMask to Arc Testnet (Chain ID: 5042002)
2. Get testnet tokens: https://faucet.circle.com/
3. Visit Curve Finance: https://curve.fi/dex/arc/swap/
4. Swap ${amount} ${fromToken} for ${toToken}
5. Use 10% slippage if needed (as confirmed by users)

🔧 **Integration Status:**
Direct API integration coming soon! For now, use the DEX UIs directly.

💡 **Pro Tip:** Users report successful swaps with 10% slippage on Curve.`;
    }
}