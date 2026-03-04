/**
 * Direct RWA Swap Strategy
 * Fallback strategy for Real World Asset swaps when other strategies fail
 * Uses direct DEX calls for common RWA pairs like USDC/PAXG
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class DirectRWAStrategy extends BaseSwapStrategy {
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
    private getHelpfulErrorMessage;
}
//# sourceMappingURL=direct-rwa.strategy.d.ts.map