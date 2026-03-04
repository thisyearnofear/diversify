/**
 * Emerging Markets Swap Strategy
 * Handles CELO↔fictional company token swaps on Celo Sepolia
 * Mirrors the Robinhood AMM strategy but for emerging markets
 */
import { BaseSwapStrategy, SwapParams, SwapResult, SwapCallbacks, SwapEstimate } from './base-swap.strategy';
export declare class EmergingMarketsStrategy extends BaseSwapStrategy {
    private readonly AMM_ADDRESS;
    private readonly WETH_ADDRESS;
    getName(): string;
    /**
     * Check if this strategy supports the swap
     */
    supports(params: SwapParams): boolean;
    /**
     * Validate swap parameters
     */
    validate(params: SwapParams): Promise<boolean>;
    /**
     * Get swap estimate
     */
    getEstimate(params: SwapParams): Promise<SwapEstimate>;
    /**
     * Execute the swap
     */
    execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult>;
    /**
     * Convert error to user-friendly message
     */
    private getUserFriendlyError;
}
//# sourceMappingURL=emerging-markets.strategy.d.ts.map