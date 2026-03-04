/**
 * Token approval service
 * Handles ERC20 token approvals for swaps
 */
import { ethers } from 'ethers';
import type { ApprovalStatus } from '../../types/swap';
export declare class ApprovalService {
    /**
     * Check if token is approved for spending
     * Note: Always uses a read-only JsonRpcProvider to ensure compatibility with all wallet types
     * including Farcaster embedded wallets that don't support eth_call
     */
    static checkApproval(tokenAddress: string, ownerAddress: string, spenderAddress: string, amount: ethers.BigNumber, chainId: number, decimals?: number): Promise<ApprovalStatus>;
    /**
     * Approve token for spending
     */
    static approve(tokenAddress: string, spenderAddress: string, amount: ethers.BigNumber, signer: ethers.Signer, options?: {
        useLegacyTx?: boolean;
        gasPrice?: ethers.BigNumber;
    }): Promise<ethers.ContractTransaction>;
    /**
     * Wait for approval confirmation
     * Uses JsonRpcProvider for compatibility with Farcaster embedded wallets
     */
    static waitForApproval(tx: ethers.ContractTransaction, confirmations?: number): Promise<ethers.ContractReceipt>;
}
//# sourceMappingURL=approval.d.ts.map