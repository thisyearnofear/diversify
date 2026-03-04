/**
 * LiFi Swap Strategy
 * Handles same-chain swaps on Arbitrum using LiFi SDK
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class LiFiSwapStrategy extends BaseSwapStrategy {
    constructor();
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
}
//# sourceMappingURL=lifi-swap.strategy.d.ts.map