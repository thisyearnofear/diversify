/**
 * LiFi Bridge Strategy
 * Handles cross-chain swaps/bridges using LiFi SDK
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class LiFiBridgeStrategy extends BaseSwapStrategy {
    constructor();
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
}
//# sourceMappingURL=lifi-bridge.strategy.d.ts.map