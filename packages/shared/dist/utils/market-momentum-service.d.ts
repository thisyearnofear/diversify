/**
 * MarketMomentumService
 *
 * Fetches live "Institutional Truths" and "Category Momentum" from free, keyless APIs.
 * This ensures our social proof is ALWAYS HONEST by anchoring to global trends.
 */
export interface MarketMomentum {
    globalStablecoinCap: number;
    stablecoin24hChange: number;
    marketSentiment: number;
    rwaGrowth7d: number;
    lastUpdated: number;
}
export declare class MarketMomentumService {
    private readonly circuitBreaker;
    /**
     * Get aggregated global momentum metrics
     */
    getMomentum(): Promise<MarketMomentum>;
    private fetchAllMomentum;
    private getFallbackMomentum;
}
export declare const marketMomentumService: MarketMomentumService;
//# sourceMappingURL=market-momentum-service.d.ts.map