/**
 * Strict TypeScript types for swap functionality
 */

export interface SwapParams {
    fromToken: string;
    toToken: string;
    amount: string;
    fromChainId: number;
    toChainId: number;
    userAddress: string;
    slippageTolerance?: number;
}

export interface SwapCallbacks {
    onApprovalSubmitted?: (txHash: string) => void;
    onApprovalConfirmed?: () => void;
    onSwapSubmitted?: (txHash: string) => void;
}

export interface SwapResult {
    success: boolean;
    approvalTxHash?: string;
    swapTxHash?: string;
    error?: string;
}

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
