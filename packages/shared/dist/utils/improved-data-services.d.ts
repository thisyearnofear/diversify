/**
 * Improved Data Services
 * Centralized services for inflation and exchange rate data
 * Uses IMF → World Bank → fallback (inflation) and Frankfurter → fallback (exchange rates)
 */
export declare class ImprovedInflationService {
    private readonly circuitBreaker;
    /**
     * Get inflation data via API proxy with caching
     */
    getInflationData(): Promise<{
        data: any;
        source: string;
    }>;
    /**
     * Fetch from API proxy (handles IMF/World Bank server-side)
     */
    private fetchFromProxy;
    /**
     * Fallback when API is unavailable
     */
    private getFallbackData;
}
export declare class ExchangeRateService {
    private readonly circuitBreaker;
    /**
     * Get current exchange rate between two currencies
     */
    getExchangeRate(fromCurrency: string, toCurrency: string): Promise<{
        data: any;
        source: string;
    }>;
    /**
     * Get historical exchange rates (30 days)
     */
    getHistoricalRates(fromCurrency: string, toCurrency: string): Promise<{
        data: any;
        source: string;
    }>;
    /**
     * Fetch current rate from API proxy
     */
    private fetchCurrentRate;
    /**
     * Fetch historical rates from API proxy
     */
    private fetchHistoricalRates;
    /**
     * Fallback current rate
     */
    private getFallbackCurrentRate;
    /**
     * Fallback historical rates
     */
    private getFallbackHistoricalRates;
}
export declare const inflationService: ImprovedInflationService;
export declare const exchangeRateService: ExchangeRateService;
//# sourceMappingURL=improved-data-services.d.ts.map