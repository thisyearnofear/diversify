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
     */
    static async checkApproval(
        tokenAddress: string,
        ownerAddress: string,
        spenderAddress: string,
        amount: ethers.BigNumber,
        provider: ethers.providers.Provider,
        decimals: number = 18
    ): Promise<ApprovalStatus> {
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
     */
    static async waitForApproval(
        tx: ethers.ContractTransaction,
        confirmations: number = 1
    ): Promise<ethers.ContractReceipt> {
        const receipt = await tx.wait(confirmations);

        if (receipt.status !== 1) {
            throw new Error('Approval transaction failed');
        }

        return receipt;
    }
}
