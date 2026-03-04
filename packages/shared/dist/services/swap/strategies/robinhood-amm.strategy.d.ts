/**
 * Robinhood AMM Swap Strategy
 * Handles ETH↔stock token swaps on Robinhood Chain testnet via TestnetMarketMaker AMM
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class RobinhoodAMMStrategy extends BaseSwapStrategy {
    getName(): string;
    supports(params: SwapParams): boolean;
    validate(params: SwapParams): Promise<boolean>;
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
}
//# sourceMappingURL=robinhood-amm.strategy.d.ts.map