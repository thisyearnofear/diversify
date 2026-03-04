/**
 * Emerging Markets Stock Price Tracking
 * Free API options for real-time price data
 */
export declare function getEmergingMarketStockPrice(symbol: string): Promise<number | null>;
export declare function getAllEmergingMarketPrices(): Promise<Record<string, number | null>>;
export declare function useEmergingMarketPrices(): {
    prices: Record<string, number | null>;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};
//# sourceMappingURL=emerging-markets-prices.d.ts.map