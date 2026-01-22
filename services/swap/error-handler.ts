/**
 * Swap error handler
 * Provides user-friendly error messages
 */

import { ChainDetectionService } from './chain-detection.service';

export class SwapErrorHandler {
    static handle(error: unknown, context: string = 'swap'): string {
        const errorMsg = error instanceof Error ? error.message : String(error);

        // User rejection
        if (errorMsg.includes('user rejected') || errorMsg.includes('User denied')) {
            return 'Transaction was rejected. Please try again when ready.';
        }

        // Insufficient funds
        if (errorMsg.includes('insufficient funds')) {
            return 'Insufficient funds for gas fees. Please add more CELO to your wallet.';
        }

        // Insufficient balance
        if (
            errorMsg.includes('low-level call failed') ||
            errorMsg.includes('UNPREDICTABLE_GAS_LIMIT')
        ) {
            return 'Insufficient token balance or approval. Please check your balance.';
        }

        // Nonce issues
        if (errorMsg.includes('nonce') || errorMsg.includes('replacement transaction')) {
            return 'Transaction error. Please wait for pending transactions to complete.';
        }

        // Execution reverted
        if (errorMsg.includes('execution reverted')) {
            return 'Transaction failed. This may be due to price slippage or liquidity issues.';
        }

        // Timeout
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
            return 'Transaction timed out. The network may be congested. Please check your wallet.';
        }

        // No valid median (oracle issue)
        if (errorMsg.includes('no valid median')) {
            return 'No valid price data available. This is common on testnets. Try a different pair.';
        }

        // No exchange found
        if (errorMsg.includes('No exchange found')) {
            if (errorMsg.includes('Alfajores') || errorMsg.includes('44787')) {
                return 'This token pair is not available on Alfajores testnet. Try using CUSD as an intermediary.';
            }
            return 'No exchange found for this token pair. Try a different pair or use an intermediary token.';
        }

        // Transaction underpriced
        if (errorMsg.includes('transaction underpriced')) {
            return 'Transaction underpriced. Please try again with a higher gas price.';
        }

        // Always failing transaction
        if (errorMsg.includes('always failing transaction')) {
            return 'Transaction would fail. This could be due to contract restrictions or insufficient liquidity.';
        }

        // Generic testnet error
        if (errorMsg.toLowerCase().includes('alfajores') || errorMsg.includes('44787')) {
            return 'Testnet transaction error. Alfajores may have limited liquidity. Some swaps will be simulated.';
        }

        // Default error
        return `Failed to ${context}. ${errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg}`;
    }

    static isTestnetError(error: unknown): boolean {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return (
            errorMsg.toLowerCase().includes('alfajores') ||
            errorMsg.includes('44787') ||
            errorMsg.includes('testnet')
        );
    }

    static shouldSimulateSwap(error: unknown, chainId: number): boolean {
        return ChainDetectionService.isTestnet(chainId) && this.isTestnetError(error);
    }
}
