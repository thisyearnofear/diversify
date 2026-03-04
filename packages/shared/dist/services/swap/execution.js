"use strict";
/**
 * Swap execution service
 * Handles the actual swap transactions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapExecutionService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../../config");
class SwapExecutionService {
    /**
     * Execute a direct swap
     */
    static async executeSwap(brokerAddress, exchangeInfo, fromTokenAddress, toTokenAddress, amountIn, minAmountOut, signer, options = {}) {
        const brokerContract = new ethers_1.ethers.Contract(brokerAddress, config_1.ABIS.BROKER.SWAP, signer);
        const txOptions = {
            gasLimit: options.gasLimit || config_1.TX_CONFIG.GAS_LIMITS.SWAP,
        };
        if (options.useLegacyTx) {
            txOptions.type = 0;
            txOptions.gasPrice = options.gasPrice;
        }
        return brokerContract.swapIn(exchangeInfo.provider, exchangeInfo.exchangeId, fromTokenAddress, toTokenAddress, amountIn, minAmountOut, txOptions);
    }
    /**
     * Wait for swap confirmation
     * Uses JsonRpcProvider for compatibility with Farcaster embedded wallets
     */
    static async waitForSwap(tx, confirmations = 1) {
        // Import ProviderFactoryService dynamically to avoid circular dependency
        const { ProviderFactoryService } = require('./provider-factory.service');
        // Get the chain ID from the transaction
        const chainId = tx.chainId;
        // Use JsonRpcProvider for polling (works with all wallet types including Farcaster)
        const provider = ProviderFactoryService.getProvider(chainId);
        // Wait for transaction with the JsonRpcProvider
        const receipt = await provider.waitForTransaction(tx.hash, confirmations);
        if (!receipt || receipt.status !== 1) {
            throw new Error('Swap transaction failed');
        }
        return receipt;
    }
    /**
     * Calculate minimum amount out with slippage
     */
    static calculateMinAmountOut(expectedAmount, slippageTolerance) {
        const slippageBps = Math.floor((100 - slippageTolerance) * 100);
        return expectedAmount.mul(slippageBps).div(10000);
    }
}
exports.SwapExecutionService = SwapExecutionService;
//# sourceMappingURL=execution.js.map