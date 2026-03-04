/**
 * 1inch Swap Strategy
 * Handles same-chain swaps using 1inch DEX aggregator
 * Excellent for USDC → PAXG and other RWA swaps on Arbitrum
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class OneInchSwapStrategy extends BaseSwapStrategy {
    private readonly API_BASE_URL;
    getName(): string;
    supports(params: SwapParams): boolean;
    private getSupportedChainIds;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
    private getQuote;
    private getSwapTransaction;
    private checkAndHandleApproval;
}
//# sourceMappingURL=oneinch-swap.strategy.d.ts.map