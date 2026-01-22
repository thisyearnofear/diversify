/**
 * Base Swap Strategy Interface
 * All swap implementations must conform to this interface
 */

import { ethers } from 'ethers';

export interface SwapParams {
    fromToken: string;
    toToken: string;
    amount: string;
    fromChainId: number;
    toChainId: number;
    userAddress: string;
    slippageTolerance?: number;
}

export interface SwapResult {
    success: boolean;
    txHash?: string;
    approvalTxHash?: string;
    error?: string;
    steps?: any[];
}

export interface SwapCallbacks {
    onApprovalSubmitted?: (hash: string) => void;
    onApprovalConfirmed?: () => void;
    onSwapSubmitted?: (hash: string) => void;
}

export interface SwapEstimate {
    expectedOutput: string;
    minimumOutput: string;
    priceImpact: number;
    gasCostEstimate: ethers.BigNumber;
}

/**
 * Abstract base class for swap strategies
 */
export abstract class BaseSwapStrategy {
    /**
     * Execute the swap
     */
    abstract execute(
        params: SwapParams,
        callbacks?: SwapCallbacks
    ): Promise<SwapResult>;

    /**
     * Validate swap parameters
     */
    abstract validate(params: SwapParams): Promise<boolean>;

    /**
     * Get swap estimate/quote
     */
    abstract getEstimate(params: SwapParams): Promise<SwapEstimate>;

    /**
     * Get strategy name for logging
     */
    abstract getName(): string;

    /**
     * Check if strategy supports the given swap
     */
    abstract supports(params: SwapParams): boolean;

    /**
     * Helper: Parse amount to BigNumber with correct decimals
     */
    protected parseAmount(amount: string, decimals: number): ethers.BigNumber {
        try {
            return ethers.utils.parseUnits(amount, decimals);
        } catch (error) {
            throw new Error(`Invalid amount: ${amount}`);
        }
    }

    /**
     * Helper: Format BigNumber to human-readable string
     */
    protected formatAmount(amount: ethers.BigNumber, decimals: number): string {
        return ethers.utils.formatUnits(amount, decimals);
    }

    /**
     * Helper: Calculate minimum output with slippage
     */
    protected calculateMinOutput(
        expectedOutput: ethers.BigNumber,
        slippageTolerance: number
    ): ethers.BigNumber {
        const slippageBps = Math.floor((100 - slippageTolerance) * 100);
        return expectedOutput.mul(slippageBps).div(10000);
    }

    /**
     * Helper: Log strategy execution
     */
    protected log(message: string, data?: any): void {
        console.log(`[${this.getName()}] ${message}`, data || '');
    }

    /**
     * Helper: Log error
     */
    protected logError(message: string, error: any): void {
        console.error(`[${this.getName()}] ${message}`, error);
    }
}
