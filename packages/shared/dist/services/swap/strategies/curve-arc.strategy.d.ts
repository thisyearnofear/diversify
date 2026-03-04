/**
 * Curve Finance Arc Testnet Strategy
 * Direct integration with Curve Finance on Arc Testnet
 * Implements seamless USDC/EURC swaps using Curve's stable swap pools
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class CurveArcStrategy extends BaseSwapStrategy {
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
    private getCurveEstimate;
    private getFallbackEstimate;
    private executeCurveSwap;
    private executeGuidedSwap;
    private discoverCurveContracts;
    private checkAndHandleApproval;
    private getSwapGuidance;
}
//# sourceMappingURL=curve-arc.strategy.d.ts.map