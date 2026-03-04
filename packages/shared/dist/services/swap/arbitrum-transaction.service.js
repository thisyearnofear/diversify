"use strict";
/**
 * Arbitrum Transaction Service
 * Handles Arbitrum-specific transaction formatting and execution
 * Separate from Celo to avoid conflicts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArbitrumTransactionService = void 0;
const ethers_1 = require("ethers");
const chain_detection_service_1 = require("./chain-detection.service");
class ArbitrumTransactionService {
    /**
     * Execute transaction with Arbitrum-optimized settings
     */
    static async executeTransaction(signer, txOptions) {
        const chainId = await signer.getChainId();
        if (!chain_detection_service_1.ChainDetectionService.isArbitrum(chainId)) {
            throw new Error('ArbitrumTransactionService can only be used on Arbitrum networks');
        }
        // Use EIP-1559 transaction format for Arbitrum
        const tx = {
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
        }
        else {
            // Get current gas price for legacy transaction
            const provider = signer.provider;
            if (provider) {
                try {
                    const feeData = await provider.getFeeData();
                    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                        tx.maxFeePerGas = feeData.maxFeePerGas;
                        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                    }
                    else if (feeData.gasPrice) {
                        tx.gasPrice = feeData.gasPrice;
                    }
                }
                catch (error) {
                    console.warn('[ArbitrumTx] Could not get fee data, using default');
                }
            }
        }
        return signer.sendTransaction(tx);
    }
    /**
     * Execute token approval with Arbitrum-optimized settings
     */
    static async executeApproval(tokenAddress, spenderAddress, amount, signer) {
        const chainId = await signer.getChainId();
        if (!chain_detection_service_1.ChainDetectionService.isArbitrum(chainId)) {
            throw new Error('ArbitrumTransactionService can only be used on Arbitrum networks');
        }
        const tokenContract = new ethers_1.ethers.Contract(tokenAddress, ['function approve(address spender, uint256 amount) returns (bool)'], signer);
        // Get fee data for EIP-1559
        const provider = signer.provider;
        const txOptions = {
            gasLimit: 100000, // Standard approval gas limit
        };
        if (provider) {
            try {
                const feeData = await provider.getFeeData();
                if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                    txOptions.maxFeePerGas = feeData.maxFeePerGas;
                    txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                }
                else if (feeData.gasPrice) {
                    txOptions.gasPrice = feeData.gasPrice;
                }
            }
            catch (error) {
                console.warn('[ArbitrumTx] Could not get fee data for approval');
            }
        }
        return tokenContract.approve(spenderAddress, amount, txOptions);
    }
    /**
     * Check token allowance
     */
    static async checkAllowance(tokenAddress, ownerAddress, spenderAddress, signer) {
        const tokenContract = new ethers_1.ethers.Contract(tokenAddress, ['function allowance(address owner, address spender) view returns (uint256)'], signer);
        return tokenContract.allowance(ownerAddress, spenderAddress);
    }
}
exports.ArbitrumTransactionService = ArbitrumTransactionService;
//# sourceMappingURL=arbitrum-transaction.service.js.map