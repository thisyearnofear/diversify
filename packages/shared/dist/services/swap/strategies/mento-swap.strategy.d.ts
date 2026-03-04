/**
 * Mento Swap Strategy
 * Handles same-chain swaps on Celo using Mento Protocol
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class MentoSwapStrategy extends BaseSwapStrategy {
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
}
//# sourceMappingURL=mento-swap.strategy.d.ts.map