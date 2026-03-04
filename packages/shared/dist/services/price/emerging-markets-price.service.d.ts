/**
 * Emerging Markets Price Service
 * Fetches real stock prices from multiple free APIs with intelligent caching
 * Supports both real emerging market stocks and fictional companies
 */
interface PriceCache {
    symbol: string;
    price: number;
    currency: string;
    usdEquivalent: number;
    change24h: number | null;
    changePercent24h: number | null;
    lastUpdated: number;
    source: string;
}
export declare class EmergingMarketsPriceService {
    private cache;
    private rateLimiter;
    private alphaVantageKey;
    private readonly RATE_LIMITS;
    /**
     * Get cached price or fetch fresh data
     */
    getPrice(symbol: string): Promise<PriceCache | null>;
    /**
     * Get prices for all emerging market stocks
     */
    getAllPrices(): Promise<Record<string, PriceCache>>;
    /**
     * Check if cache is valid
     */
    private getCachedPrice;
    /**
     * Fetch price with fallback chain
     */
    private fetchAndCachePrice;
    /**
     * Yahoo Finance (unofficial but widely used)
     * Best for international exchanges
     */
    private fetchFromYahoo;
    /**
     * Alpha Vantage API
     * Reliable but limited free tier
     */
    private fetchFromAlphaVantage;
    /**
     * Finnhub API
     * Good for real-time data
     */
    private fetchFromFinnhub;
    /**
     * Convert ticker to Yahoo Finance format
     */
    private toYahooTicker;
    /**
     * Convert ticker to Finnhub format
     */
    private toFinnhubTicker;
    /**
     * Infer currency from market
     */
    private inferCurrency;
    /**
     * Convert local currency to USD
     * In production, use a proper exchange rate API
     */
    private convertToUsd;
    /**
     * Check if market is currently open
     * Used to determine cache TTL
     */
    private isMarketHours;
    /**
     * Get service status for debugging
     */
    getStatus(): {
        cacheSize: number;
        rateLimits: Record<string, {
            remaining: number;
            resetIn: string;
        }>;
    };
    /**
     * Clear cache (useful for testing)
     */
    clearCache(): void;
}
export declare const emergingMarketsPriceService: EmergingMarketsPriceService;
export {};
//# sourceMappingURL=emerging-markets-price.service.d.ts.map