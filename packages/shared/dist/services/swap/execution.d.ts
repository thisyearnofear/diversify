/**
 * Swap execution service
 * Handles the actual swap transactions
 */
import { ethers } from 'ethers';
import type { ExchangeInfo } from '../../types/swap';
export declare class SwapExecutionService {
    /**
     * Execute a direct swap
     */
    static executeSwap(brokerAddress: string, exchangeInfo: ExchangeInfo, fromTokenAddress: string, toTokenAddress: string, amountIn: ethers.BigNumber, minAmountOut: ethers.BigNumber, signer: ethers.Signer, options?: {
        useLegacyTx?: boolean;
        gasPrice?: ethers.BigNumber;
        gasLimit?: number;
    }): Promise<ethers.ContractTransaction>;
    /**
     * Wait for swap confirmation
     * Uses JsonRpcProvider for compatibility with Farcaster embedded wallets
     */
    static waitForSwap(tx: ethers.ContractTransaction, confirmations?: number): Promise<ethers.ContractReceipt>;
    /**
     * Calculate minimum amount out with slippage
     */
    static calculateMinAmountOut(expectedAmount: ethers.BigNumber, slippageTolerance: number): ethers.BigNumber;
}
//# sourceMappingURL=execution.d.ts.map