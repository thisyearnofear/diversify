/**
 * API Services for DiversiFi
 *
 * This file contains services for interacting with external APIs:
 * - World Bank API for inflation data (legacy, use improved-data-services.ts instead)
 * - Token pricing services for DeFi integrations
 */
/**
 * World Bank API Service
 */
export declare const WorldBankService: {
    /**
     * Get inflation data for all countries
     * @param year Year to get data for (defaults to most recent)
     * @returns Inflation data by country
     */
    getInflationData: (year?: number) => Promise<{
        data: any;
        source: string;
        fromCache: boolean;
    }>;
    /**
     * Internal method to fetch data from World Bank API
     */
    fetchInflationData: (year?: number) => Promise<{
        data: any;
        source: string;
    }>;
};
/**
 * Exchange Rate Service (Frankfurter → World Bank → Fallback)
 * Follows same pattern as inflation data for consistency
 */
export declare const ExchangeRateService: {
    /**
     * Get exchange rate between two currencies
     * @param fromCurrency Base currency code (e.g., USD)
     * @param toCurrency Target currency code (e.g., EUR)
     * @returns Exchange rate data
     */
    getExchangeRate: (fromCurrency: string, toCurrency: string) => Promise<{
        data: any;
        source: string;
        fromCache: boolean;
    }>;
    /**
     * Internal method to fetch exchange rate with fallback chain
     */
    fetchExchangeRate: (fromCurrency: string, toCurrency: string) => Promise<{
        data: any;
        source: string;
    }>;
    /**
     * Fetch from Frankfurter API (free, ECB-based)
     */
    fetchFromFrankfurter: (fromCurrency: string, toCurrency: string) => Promise<{
        rate: any;
        timestamp: any;
        source: string;
    }>;
    /**
     * Get historical exchange rates for a currency pair
     * @param fromCurrency Base currency code (e.g., USD)
     * @param toCurrency Target currency code (e.g., EUR)
     * @param outputSize Data points to return ('compact' = 100, 'full' = all)
     * @returns Historical exchange rate data
     */
    getHistoricalRates: (fromCurrency: string, toCurrency: string, outputSize?: "compact" | "full") => Promise<{
        data: never[];
        source: string;
    }>;
};
/**
 * Token Price Service
 * Live USD pricing for on-chain tokens with caching and multi-provider fallback
 */
export declare const TokenPriceService: {
    /**
     * Get USD price for a token by chain and address, with optional symbol hint
     * Uses multiple free APIs with fallback chain:
     * 1. DefiLlama (free, no key needed)
     * 2. CoinGecko (free tier: 50 calls/min)
     * 3. CoinPaprika (free, no key needed)
     * 4. Hardcoded fallback rates
     */
    getTokenUsdPrice(params: {
        chainId: number;
        address?: string;
        symbol?: string;
    }): Promise<number | null>;
    /**
     * Get expected amount out calculation with live prices
     * This consolidates the pricing logic from use-expected-amount-out hook
     */
    getExpectedAmountOut(params: {
        fromToken: string;
        toToken: string;
        amount: string;
        chainId: number;
        getTokenAddresses: (chainId: number) => Record<string, string>;
    }): Promise<{
        amount: string;
        source: string;
    }>;
    /**
     * DefiLlama price by chain/address
     */
    fetchDefiLlamaPrice(chainId: number, address: string): Promise<number | null>;
    /**
     * Coingecko simple price (FREE tier: 50 calls/min)
     */
    fetchCoingeckoPrice(id: string, vsCurrency?: string): Promise<number | null>;
    /**
     * CoinPaprika price (FREE, no API key needed, no rate limits)
     */
    fetchCoinPaprikaPrice(symbol: string): Promise<number | null>;
    /**
     * Map our symbols to Coingecko IDs (minimal, grow as needed)
     */
    mapToCoingeckoId(symbol?: string): string | null;
    /**
     * Map our symbols to CoinPaprika IDs
     */
    mapToCoinPaprikaId(symbol?: string): string | null;
    /**
     * DefiLlama chain prefix by chainId
     */
    getDefiLlamaPrefix(chainId: number): string | null;
};
export declare const GeminiService: {
    /**
     * @deprecated Use the analyzePortfolio function from utils/portfolio-analysis.ts directly
     * This method is kept for backward compatibility but delegates to the new analysis engine
     */
    analyzeWealthProtection: (inflationData: any, userBalance: number, currentHoldings: string[], config?: any) => Promise<{
        action: "SWAP" | "HOLD" | "REBALANCE";
        targetToken?: string;
        reasoning: string;
        confidence: number;
        suggestedAmount?: number;
        expectedSavings?: number;
        timeHorizon?: string;
        riskLevel?: "LOW" | "MEDIUM" | "HIGH";
        dataSources?: string[];
        thoughtChain?: string[];
        actionSteps?: string[];
        urgencyLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        _meta?: {
            modelUsed: string;
            totalCost?: number;
        };
    }>;
};
//# sourceMappingURL=api-services.d.ts.map