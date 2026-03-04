/**
 * Arbitrum Transaction Service
 * Handles Arbitrum-specific transaction formatting and execution
 * Separate from Celo to avoid conflicts
 */
import { ethers } from 'ethers';
export interface ArbitrumTxOptions {
    to: string;
    data: string;
    value?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
}
export declare class ArbitrumTransactionService {
    /**
     * Execute transaction with Arbitrum-optimized settings
     */
    static executeTransaction(signer: ethers.Signer, txOptions: ArbitrumTxOptions): Promise<ethers.ContractTransaction>;
    /**
     * Execute token approval with Arbitrum-optimized settings
     */
    static executeApproval(tokenAddress: string, spenderAddress: string, amount: ethers.BigNumber, signer: ethers.Signer): Promise<ethers.ContractTransaction>;
    /**
     * Check token allowance
     */
    static checkAllowance(tokenAddress: string, ownerAddress: string, spenderAddress: string, signer: ethers.Signer): Promise<ethers.BigNumber>;
}
//# sourceMappingURL=arbitrum-transaction.service.d.ts.map