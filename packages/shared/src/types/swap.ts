/**
 * Strict TypeScript types for swap functionality
 */

// Re-export types from base strategy to avoid duplication
export type {
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from '../services/swap/strategies/base-swap.strategy';

export interface ExchangeInfo {
    provider: string;
    exchangeId: string;
}

export interface SwapQuote {
    expectedAmountOut: string;
    minAmountOut: string;
    exchangeRate: number;
    priceImpact: number;
}

export interface ApprovalStatus {
    isApproved: boolean;
    currentAllowance: string;
    requiredAllowance: string;
}

export type SwapStep = 'idle' | 'approving' | 'swapping' | 'completed' | 'error';

export interface SwapState {
    step: SwapStep;
    isLoading: boolean;
    error: string | null;
    txHash: string | null;
    approvalTxHash: string | null;
}
