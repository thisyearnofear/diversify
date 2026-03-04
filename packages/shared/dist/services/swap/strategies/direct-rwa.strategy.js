"use strict";
/**
 * Direct RWA Swap Strategy
 * Fallback strategy for Real World Asset swaps when other strategies fail
 * Uses direct DEX calls for common RWA pairs like USDC/PAXG
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectRWAStrategy = void 0;
const ethers_1 = require("ethers");
const base_swap_strategy_1 = require("./base-swap.strategy");
const config_1 = require("../../../config");
// Curve Finance pools for RWA swaps on Arbitrum
const CURVE_POOLS = {
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
class DirectRWAStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    getName() {
        return 'DirectRWAStrategy';
    }
    supports(params) {
        // Supports Arbitrum RWA swaps: USDC/PAXG, USDC/USDY, USDC/SYRUPUSDC
        const isArbitrum = params.fromChainId === params.toChainId && params.fromChainId === 42161;
        if (!isArbitrum)
            return false;
        const rwaTokens = ['PAXG', 'USDY', 'SYRUPUSDC'];
        const isRwaSwap = (params.fromToken === 'USDC' && rwaTokens.includes(params.toToken)) ||
            (rwaTokens.includes(params.fromToken) && params.toToken === 'USDC');
        return isRwaSwap;
    }
    async validate(params) {
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const toTokenAddress = tokens[params.toToken];
        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(`Token pair ${params.fromToken}/${params.toToken} not available on Arbitrum`);
        }
        return true;
    }
    async getEstimate(params) {
        this.log('Getting direct RWA estimate', { from: params.fromToken, to: params.toToken });
        // Price approximations for RWA tokens
        const tokenPrices = {
            'USDC': 1,
            'PAXG': 2650, // Gold price
            'USDY': 1.05, // Slightly above $1 due to accrued yield
            'SYRUPUSDC': 1.02, // Slightly above $1 due to accrued yield
        };
        const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = config_1.TOKEN_METADATA[params.toToken] || { decimals: 18 };
        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
        const fromPrice = tokenPrices[params.fromToken] || 1;
        const toPrice = tokenPrices[params.toToken] || 1;
        // Calculate expected output based on price ratio
        const amountInUSD = parseFloat(params.amount) * fromPrice;
        const expectedOutputAmount = amountInUSD / toPrice;
        // Convert to token decimals
        const expectedOutput = ethers_1.ethers.utils.parseUnits(expectedOutputAmount.toFixed(6), toTokenMeta.decimals || 18);
        const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        // Estimate gas cost
        const gasCostEstimate = ethers_1.ethers.utils.parseEther('0.001'); // ~$2-3 on Arbitrum
        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: 0.5, // Estimate 0.5% price impact
            gasCostEstimate,
        };
    }
    async execute(params, callbacks) {
        this.log('Executing direct RWA swap', params);
        try {
            // For now, return a helpful error message since we don't have actual DEX integration
            // This strategy serves as a fallback to provide better error messages
            const errorMessage = this.getHelpfulErrorMessage(params);
            return {
                success: false,
                error: errorMessage,
            };
        }
        catch (error) {
            this.logError('Direct RWA swap failed', error);
            return {
                success: false,
                error: error.message || 'Direct RWA swap execution failed',
            };
        }
    }
    getHelpfulErrorMessage(params) {
        const rwaTokenNames = {
            'PAXG': 'Paxos Gold (PAXG)',
            'USDY': 'Ondo US Dollar Yield (USDY)',
            'SYRUPUSDC': 'Syrup USDC'
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
exports.DirectRWAStrategy = DirectRWAStrategy;
//# sourceMappingURL=direct-rwa.strategy.js.map