/**
 * Token approval service
 * Handles ERC20 token approvals for swaps
 */

import { ethers } from 'ethers';
import { ABIS, TX_CONFIG } from '../../config';
import type { ApprovalStatus } from '../../types/swap';

export class ApprovalService {
    /**
     * Check if token is approved for spending
     * Note: Always uses a read-only JsonRpcProvider to ensure compatibility with all wallet types
     * including Farcaster embedded wallets that don't support eth_call
     */
    static async checkApproval(
        tokenAddress: string,
        ownerAddress: string,
        spenderAddress: string,
        amount: ethers.BigNumber,
        chainId: number,
        decimals: number = 18
    ): Promise<ApprovalStatus> {
        // Import here to avoid circular dependency
        const { ProviderFactoryService } = require('./provider-factory.service');
        
        // Use JsonRpcProvider for read-only calls (works with all wallet types)
        const provider = ProviderFactoryService.getProvider(chainId);
        const tokenContract = new ethers.Contract(tokenAddress, ABIS.ERC20, provider);
        const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);

        return {
            isApproved: allowance.gte(amount),
            currentAllowance: ethers.utils.formatUnits(allowance, decimals),
            requiredAllowance: ethers.utils.formatUnits(amount, decimals),
        };
    }

    /**
     * Approve token for spending
     */
    static async approve(
        tokenAddress: string,
        spenderAddress: string,
        amount: ethers.BigNumber,
        signer: ethers.Signer,
        options: {
            useLegacyTx?: boolean;
            gasPrice?: ethers.BigNumber;
        } = {}
    ): Promise<ethers.ContractTransaction> {
        const tokenContract = new ethers.Contract(tokenAddress, ABIS.ERC20, signer);

        const txOptions: any = {
            gasLimit: TX_CONFIG.GAS_LIMITS.APPROVAL,
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
    static async waitForApproval(
        tx: ethers.ContractTransaction,
        confirmations: number = 1
    ): Promise<ethers.ContractReceipt> {
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
