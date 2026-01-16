/**
 * Swap execution service
 * Handles the actual swap transactions
 */

import { ethers } from 'ethers';
import { ABIS, TX_CONFIG } from '../../config';
import type { ExchangeInfo } from '../../types/swap';

export class SwapExecutionService {
    /**
     * Execute a direct swap
     */
    static async executeSwap(
        brokerAddress: string,
        exchangeInfo: ExchangeInfo,
        fromTokenAddress: string,
        toTokenAddress: string,
        amountIn: ethers.BigNumber,
        minAmountOut: ethers.BigNumber,
        signer: ethers.Signer,
        options: {
            useLegacyTx?: boolean;
            gasPrice?: ethers.BigNumber;
            gasLimit?: number;
        } = {}
    ): Promise<ethers.ContractTransaction> {
        const brokerContract = new ethers.Contract(brokerAddress, ABIS.BROKER.SWAP, signer);

        const txOptions: any = {
            gasLimit: options.gasLimit || TX_CONFIG.GAS_LIMITS.SWAP,
        };

        if (options.useLegacyTx) {
            txOptions.type = 0;
            txOptions.gasPrice = options.gasPrice;
        }

        return brokerContract.swapIn(
            exchangeInfo.provider,
            exchangeInfo.exchangeId,
            fromTokenAddress,
            toTokenAddress,
            amountIn,
            minAmountOut,
            txOptions
        );
    }

    /**
     * Wait for swap confirmation
     */
    static async waitForSwap(
        tx: ethers.ContractTransaction,
        confirmations: number = 1
    ): Promise<ethers.ContractReceipt> {
        const receipt = await tx.wait(confirmations);

        if (receipt.status !== 1) {
            throw new Error('Swap transaction failed');
        }

        return receipt;
    }

    /**
     * Calculate minimum amount out with slippage
     */
    static calculateMinAmountOut(
        expectedAmount: ethers.BigNumber,
        slippageTolerance: number
    ): ethers.BigNumber {
        const slippageBps = Math.floor((100 - slippageTolerance) * 100);
        return expectedAmount.mul(slippageBps).div(10000);
    }
}
