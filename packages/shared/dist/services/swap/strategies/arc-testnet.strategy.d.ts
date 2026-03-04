/**
 * Arc Testnet Swap Strategy
 * Handles swaps on Arc Testnet using Curve Finance and AeonDEX
 * Based on real working DEXs discovered through user research
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class ArcTestnetStrategy extends BaseSwapStrategy {
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
    private getDetailedSwapGuidance;
}
//# sourceMappingURL=arc-testnet.strategy.d.ts.map