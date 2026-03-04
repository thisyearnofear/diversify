"use strict";
/**
 * Token approval service
 * Handles ERC20 token approvals for swaps
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../../config");
class ApprovalService {
    /**
     * Check if token is approved for spending
     * Note: Always uses a read-only JsonRpcProvider to ensure compatibility with all wallet types
     * including Farcaster embedded wallets that don't support eth_call
     */
    static async checkApproval(tokenAddress, ownerAddress, spenderAddress, amount, chainId, decimals = 18) {
        // Import here to avoid circular dependency
        const { ProviderFactoryService } = require('./provider-factory.service');
        // Use JsonRpcProvider for read-only calls (works with all wallet types)
        const provider = ProviderFactoryService.getProvider(chainId);
        const tokenContract = new ethers_1.ethers.Contract(tokenAddress, config_1.ABIS.ERC20, provider);
        const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
        return {
            isApproved: allowance.gte(amount),
            currentAllowance: ethers_1.ethers.utils.formatUnits(allowance, decimals),
            requiredAllowance: ethers_1.ethers.utils.formatUnits(amount, decimals),
        };
    }
    /**
     * Approve token for spending
     */
    static async approve(tokenAddress, spenderAddress, amount, signer, options = {}) {
        const tokenContract = new ethers_1.ethers.Contract(tokenAddress, config_1.ABIS.ERC20, signer);
        const txOptions = {
            gasLimit: config_1.TX_CONFIG.GAS_LIMITS.APPROVAL,
        };
        if (options.useLegacyTx) {
            txOptions.type = 0;
            txOptions.gasPrice = options.gasPrice;
        }
        return tokenContract.approve(spenderAddress, amount, txOptions);
    }
    /**
     * Wait for approval confirmation
     * Uses JsonRpcProvider for compatibility with Farcaster embedded wallets
     */
    static async waitForApproval(tx, confirmations = 1) {
        // Import ProviderFactoryService dynamically to avoid circular dependency
        const { ProviderFactoryService } = require('./provider-factory.service');
        // Get the chain ID from the transaction
        const chainId = tx.chainId;
        // Use JsonRpcProvider for polling (works with all wallet types including Farcaster)
        const provider = ProviderFactoryService.getProvider(chainId);
        // Wait for transaction with the JsonRpcProvider
        const receipt = await provider.waitForTransaction(tx.hash, confirmations);
        if (!receipt || receipt.status !== 1) {
            throw new Error('Approval transaction failed');
        }
        return receipt;
    }
}
exports.ApprovalService = ApprovalService;
//# sourceMappingURL=approval.js.map