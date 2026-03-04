export interface SynthForecast {
    current_price: number;
    "1H": {
        average_volatility: number;
        percentiles: Record<string, number>;
    };
    "24H": {
        average_volatility: number;
        percentiles: Record<string, number>;
    };
    forecast_future?: {
        average_volatility: number;
        percentiles: Record<string, number>;
    };
    realized?: {
        average_volatility: number;
    };
}
export interface SynthVolatility {
    asset: string;
    realized_vol: number;
    forecast_vol: number;
}
/**
 * Service for interacting with Synth API (docs.synthdata.co)
 * Provides probabilistic price forecasts and volatility metrics.
 *
 * Uses unified-cache-service for:
 * - Request coalescing (deduplicates concurrent requests)
 * - Stale-while-revalidate fallback on errors
 * - Smart TTL management (30min for price data)
 */
export declare class SynthDataService {
    /**
     * Fetches prediction data for a specific asset with unified caching and fallbacks.
     * @param asset The asset symbol (e.g., BTC, ETH, NVDAX)
     */
    static getPredictions(asset: string): Promise<SynthForecast | null>;
    /**
     * Fetches volatility insights for a specific asset with unified caching and fallbacks.
     * @param asset The asset symbol
     */
    static getVolatility(asset: string): Promise<SynthVolatility | null>;
    /**
     * Makes an API request with retry logic and proper error handling.
     */
    private static makeApiRequest;
    /**
     * Gets fallback forecast data for an asset.
     */
    private static getFallbackForecast;
    /**
     * Gets fallback volatility data for an asset.
     */
    private static getFallbackVolatility;
    /**
     * Maps app stocks to Synth API assets.
     * Synth API uses 'X' suffix for some equity proxies on Bittensor SN50.
     */
    static mapStockToSynthAsset(stock: string): string;
}
//# sourceMappingURL=synth-data-service.d.ts.map