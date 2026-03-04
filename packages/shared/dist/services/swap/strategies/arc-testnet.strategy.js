"use strict";
/**
 * Arc Testnet Swap Strategy
 * Handles swaps on Arc Testnet using Curve Finance and AeonDEX
 * Based on real working DEXs discovered through user research
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArcTestnetStrategy = void 0;
const ethers_1 = require("ethers");
const base_swap_strategy_1 = require("./base-swap.strategy");
const chain_detection_service_1 = require("../chain-detection.service");
const config_1 = require("../../../config");
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
class ArcTestnetStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    getName() {
        return 'ArcTestnetStrategy';
    }
    supports(params) {
        // Only supports Arc Testnet same-chain swaps
        if (!chain_detection_service_1.ChainDetectionService.isArc(params.fromChainId) || params.fromChainId !== params.toChainId) {
            return false;
        }
        // Check if this is a supported pair
        return SUPPORTED_PAIRS.some(pair => pair.from === params.fromToken && pair.to === params.toToken);
    }
    async validate(params) {
        // Check if tokens exist on Arc Testnet
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const toTokenAddress = tokens[params.toToken];
        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(`Token pair ${params.fromToken}/${params.toToken} not available on Arc Testnet`);
        }
        // Check if this is a supported pair
        const isSupported = SUPPORTED_PAIRS.some(pair => pair.from === params.fromToken && pair.to === params.toToken);
        if (!isSupported) {
            throw new Error(`${params.fromToken}/${params.toToken} swaps not yet supported. Currently only USDC/EURC pairs are available.`);
        }
        return true;
    }
    async getEstimate(params) {
        this.log('Getting Arc Testnet swap estimate', { from: params.fromToken, to: params.toToken });
        // Get token metadata
        const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 6 };
        const toTokenMeta = config_1.TOKEN_METADATA[params.toToken] || { decimals: 6 };
        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 6);
        // For USDC/EURC stablecoin pairs, use near 1:1 rate with Curve's 0.04% fee
        let expectedOutput;
        let priceImpact;
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
                    expectedOutput = expectedOutput.div(ethers_1.ethers.BigNumber.from(10).pow(decimalDiff));
                }
                else {
                    expectedOutput = expectedOutput.mul(ethers_1.ethers.BigNumber.from(10).pow(-decimalDiff));
                }
            }
        }
        else {
            throw new Error('Unsupported token pair for Arc Testnet');
        }
        const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        // Arc uses USDC for gas, so gas cost is predictable (~$0.01)
        const gasCostEstimate = ethers_1.ethers.utils.parseUnits('0.01', 6);
        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 6),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 6),
            priceImpact,
            gasCostEstimate,
        };
    }
    async execute(params, callbacks) {
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
        }
        catch (error) {
            this.logError('Arc Testnet swap failed', error);
            return {
                success: false,
                error: error.message || 'Arc Testnet swap execution failed',
            };
        }
    }
    getDetailedSwapGuidance(params) {
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
exports.ArcTestnetStrategy = ArcTestnetStrategy;
//# sourceMappingURL=arc-testnet.strategy.js.map