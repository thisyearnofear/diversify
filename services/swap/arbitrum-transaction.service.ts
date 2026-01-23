/**
 * Arbitrum Transaction Service
 * Handles Arbitrum-specific transaction formatting and execution
 * Separate from Celo to avoid conflicts
 */

import { ethers } from 'ethers';
import { ChainDetectionService } from './chain-detection.service';

export interface ArbitrumTxOptions {
    to: string;
    data: string;
    value?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
}

export class ArbitrumTransactionService {
    /**
     * Execute transaction with Arbitrum-optimized settings
     */
    static async executeTransaction(
        signer: ethers.Signer,
        txOptions: ArbitrumTxOptions
    ): Promise<ethers.ContractTransaction> {
        const chainId = await signer.getChainId();

        if (!ChainDetectionService.isArbitrum(chainId)) {
            throw new Error('ArbitrumTransactionService can only be used on Arbitrum networks');
        }

        // Use EIP-1559 transaction format for Arbitrum
        const tx: ethers.providers.TransactionRequest = {
            to: txOptions.to,
            data: txOptions.data,
            value: txOptions.value || '0',
        };

        // Set gas parameters
        if (txOptions.gasLimit) {
            tx.gasLimit = txOptions.gasLimit;
        }

        // Use EIP-1559 gas pricing if available, otherwise fall back to legacy
        if (txOptions.maxFeePerGas && txOptions.maxPriorityFeePerGas) {
            tx.maxFeePerGas = txOptions.maxFeePerGas;
            tx.maxPriorityFeePerGas = txOptions.maxPriorityFeePerGas;
        } else {
            // Get current gas price for legacy transaction
            const provider = signer.provider;
            if (provider) {
                try {
                    const feeData = await provider.getFeeData();
                    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                        tx.maxFeePerGas = feeData.maxFeePerGas;
                        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                    } else if (feeData.gasPrice) {
                        tx.gasPrice = feeData.gasPrice;
                    }
                } catch (error) {
                    console.warn('[ArbitrumTx] Could not get fee data, using default');
                }
            }
        }

        return signer.sendTransaction(tx);
    }

    /**
     * Execute token approval with Arbitrum-optimized settings
     */
    static async executeApproval(
        tokenAddress: string,
        spenderAddress: string,
        amount: ethers.BigNumber,
        signer: ethers.Signer
    ): Promise<ethers.ContractTransaction> {
        const chainId = await signer.getChainId();

        if (!ChainDetectionService.isArbitrum(chainId)) {
            throw new Error('ArbitrumTransactionService can only be used on Arbitrum networks');
        }

        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function approve(address spender, uint256 amount) returns (bool)'],
            signer
        );

        // Get fee data for EIP-1559
        const provider = signer.provider;
        const txOptions: any = {
            gasLimit: 100000, // Standard approval gas limit
        };

        if (provider) {
            try {
                const feeData = await provider.getFeeData();
                if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                    txOptions.maxFeePerGas = feeData.maxFeePerGas;
                    txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                } else if (feeData.gasPrice) {
                    txOptions.gasPrice = feeData.gasPrice;
                }
            } catch (error) {
                console.warn('[ArbitrumTx] Could not get fee data for approval');
            }
        }

        return tokenContract.approve(spenderAddress, amount, txOptions);
    }

    /**
     * Check token allowance
     */
    static async checkAllowance(
        tokenAddress: string,
        ownerAddress: string,
        spenderAddress: string,
        signer: ethers.Signer
    ): Promise<ethers.BigNumber> {
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function allowance(address owner, address spender) view returns (uint256)'],
            signer
        );

        return tokenContract.allowance(ownerAddress, spenderAddress);
    }
}