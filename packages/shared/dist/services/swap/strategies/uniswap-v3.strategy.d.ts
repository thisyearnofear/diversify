/**
 * Uniswap V3 Direct Swap Strategy
 * Simple, reliable direct swaps using Uniswap V3
 * Good fallback when aggregators fail
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class UniswapV3Strategy extends BaseSwapStrategy {
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
    private checkAndHandleApproval;
}
//# sourceMappingURL=uniswap-v3.strategy.d.ts.map