/**
 * API Services for DiversiFi
 *
 * This file contains services for interacting with external APIs:
 * - World Bank API for inflation data (legacy, use improved-data-services.ts instead)
 * - Token pricing services for DeFi integrations
 */

import { unifiedCache, CacheCategory } from './unified-cache-service';
import { circuitBreakerManager } from './circuit-breaker-service';
import { EXCHANGE_RATES } from '../config';

// Cache durations
const CACHE_DURATIONS = {
  INFLATION_DATA: 1000 * 60 * 60 * 24, // 24 hours
};

// Cache keys
const CACHE_KEYS = {
  WORLD_BANK_INFLATION: 'world-bank-inflation-',
};

/**
 * World Bank API Service
 */
export const WorldBankService = {
  /**
   * Get inflation data for all countries
   * @param year Year to get data for (defaults to most recent)
   * @returns Inflation data by country
   */
  getInflationData: async (year?: number) => {
    const cacheKey = `worldbank-inflation-${year || 'latest'}`;

    // Simple caching without circuit breaker for now
    return unifiedCache.getOrFetch(
      cacheKey,
      () => WorldBankService.fetchInflationData(year),
      'moderate'
    );
  },

  /**
   * Internal method to fetch data from World Bank API
   */
  fetchInflationData: async (year?: number): Promise<{ data: any; source: string }> => {
    // Build URL
    let url = 'https://api.worldbank.org/v2/country/all/indicator/FP.CPI.TOTL.ZG?format=json&per_page=300';
    if (year) {
      url += `&date=${year}`;
    } else {
      // Get last 2 years of data to ensure we have recent data
      const currentYear = new Date().getFullYear();
      url += `&date=${currentYear - 2}:${currentYear}`;
    }

    // Make API request
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`World Bank API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if API returned valid data
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
      throw new Error('Invalid World Bank API response format');
    }

    // Extract country inflation data
    const countries = data[1]
      .filter((item: any) => item.value !== null)
      .map((item: any) => ({
        country: item.country.value,
        countryCode: item.countryiso3code,
        value: item.value,
        year: Number.parseInt(item.date)
      }));

    return {
      data: {
        countries,
        source: 'worldbank',
        lastUpdated: new Date().toISOString()
      },
      source: 'worldbank'
    };
  },
};

/**
 * Exchange Rate Service (Frankfurter → World Bank → Fallback)
 * Follows same pattern as inflation data for consistency
 */
export const ExchangeRateService = {
  /**
   * Get exchange rate between two currencies
   * @param fromCurrency Base currency code (e.g., USD)
   * @param toCurrency Target currency code (e.g., EUR)
   * @returns Exchange rate data
   */
  getExchangeRate: async (fromCurrency: string, toCurrency: string) => {
    const cacheKey = `exchange-rate-${fromCurrency}-${toCurrency}`;

    return unifiedCache.getOrFetch(
      cacheKey,
      () => ExchangeRateService.fetchExchangeRate(fromCurrency, toCurrency),
      'volatile'
    );
  },

  /**
   * Internal method to fetch exchange rate with fallback chain
   */
  fetchExchangeRate: async (fromCurrency: string, toCurrency: string): Promise<{ data: any; source: string }> => {
    // Try Frankfurter first (free, no key required)
    try {
      const frankfurterData = await ExchangeRateService.fetchFromFrankfurter(fromCurrency, toCurrency);
      if (frankfurterData) {
        console.log(`Using live data from Frankfurter for ${fromCurrency}-${toCurrency}`);
        return { data: frankfurterData, source: 'frankfurter' };
      }
    } catch (error) {
      console.warn('Frankfurter API unavailable, trying fallback');
    }

    // Fallback to static rates
    const fallbackData = getFallbackExchangeRate(fromCurrency, toCurrency);
    console.log(`Using fallback data for ${fromCurrency}-${toCurrency}`);
    return { data: fallbackData, source: 'fallback' };
  },

  /**
   * Fetch from Frankfurter API (free, ECB-based)
   */
  fetchFromFrankfurter: async (fromCurrency: string, toCurrency: string) => {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`);

    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates || !data.rates[toCurrency]) {
      throw new Error('No exchange rate data found');
    }

    return {
      rate: data.rates[toCurrency],
      timestamp: data.date,
      source: 'frankfurter'
    };
  },

  /**
   * Get historical exchange rates for a currency pair
   * @param fromCurrency Base currency code (e.g., USD)
   * @param toCurrency Target currency code (e.g., EUR)
   * @param outputSize Data points to return ('compact' = 100, 'full' = all)
   * @returns Historical exchange rate data
   */
  getHistoricalRates: async (fromCurrency: string, toCurrency: string, outputSize: 'compact' | 'full' = 'compact') => {
    // Placeholder for historical rates - could integrate with Alpha Vantage or similar
    return {
      data: [],
      source: 'not-implemented'
    };
  }
};

/**
 * Token Price Service
 * Live USD pricing for on-chain tokens with caching and multi-provider fallback
 */
export const TokenPriceService = {
  /**
   * Get USD price for a token by chain and address, with optional symbol hint
   */
  async getTokenUsdPrice(params: {
    chainId: number;
    address?: string;
    symbol?: string;
  }): Promise<number | null> {
    const cacheKey = `token-usd-${params.chainId}-${(params.address || params.symbol || '').toLowerCase()}`;

    const result = await unifiedCache.getOrFetch(
      cacheKey,
      async () => {
        // Try DefiLlama first for address-based lookups
        if (params.address) {
          const defiLlamaPrice = await this.fetchDefiLlamaPrice(params.chainId, params.address);
          if (typeof defiLlamaPrice === 'number') {
            return { data: defiLlamaPrice, source: 'defillama' as const };
          }
        }

        // Try CoinGecko for symbol-based lookups
        if (params.symbol) {
          const cgId = this.mapToCoingeckoId(params.symbol);
          if (cgId) {
            const coingeckoPrice = await this.fetchCoingeckoPrice(cgId);
            if (typeof coingeckoPrice === 'number') {
              return { data: coingeckoPrice, source: 'coingecko' as const };
            }
          }
        }

        // Return null to trigger fallback logic in calling code
        return { data: null, source: 'fallback' as const };
      },
      'volatile'
    );

    return result.data ?? null;
  },

  /**
   * Get expected amount out calculation with live prices
   * This consolidates the pricing logic from use-expected-amount-out hook
   */
  async getExpectedAmountOut(params: {
    fromToken: string;
    toToken: string;
    amount: string;
    chainId: number;
    getTokenAddresses: (chainId: number) => Record<string, string>;
  }): Promise<{ amount: string; source: string }> {
    const { fromToken, toToken, amount, chainId, getTokenAddresses } = params;

    try {
      const amountNum = Number.parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return { amount: "0", source: "invalid-input" };
      }

      const tokens = getTokenAddresses(chainId);
      const fromAddr = tokens[fromToken] || tokens[fromToken.toUpperCase()] || tokens[fromToken.toLowerCase()];
      const toAddr = tokens[toToken] || tokens[toToken.toUpperCase()] || tokens[toToken.toLowerCase()];

      // Fetch live prices with proper fallback chain
      const fromUsd = await this.getTokenUsdPrice({
        chainId,
        address: fromAddr,
        symbol: fromToken
      });

      const toUsd = await this.getTokenUsdPrice({
        chainId,
        address: toAddr,
        symbol: toToken
      });

      // Use live prices when available, fallback to static rates
      const fromRate = typeof fromUsd === 'number' ? fromUsd : (EXCHANGE_RATES[fromToken] ?? 1);
      const toRate = typeof toUsd === 'number' ? toUsd : (EXCHANGE_RATES[toToken] ?? 1);

      const resultAmount = ((amountNum * fromRate) / toRate).toString();
      const source = (typeof fromUsd === 'number' && typeof toUsd === 'number')
        ? 'live-prices'
        : 'mixed-prices';

      return { amount: resultAmount, source };
    } catch (error) {
      console.warn('Error in getExpectedAmountOut:', error);
      // Ultimate fallback
      return { amount: "0", source: "error" };
    }
  },

  /**
   * DefiLlama price by chain/address
   */
  async fetchDefiLlamaPrice(chainId: number, address: string): Promise<number | null> {
    try {
      const prefix = this.getDefiLlamaPrefix(chainId);
      if (!prefix) return null;
      const url = `https://coins.llama.fi/prices/current/${prefix}:${address.toLowerCase()}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const key = `${prefix}:${address.toLowerCase()}`;
      const price = data?.coins?.[key]?.price;
      return typeof price === 'number' ? price : null;
    } catch {
      return null;
    }
  },

  /**
   * Coingecko simple price
   */
  async fetchCoingeckoPrice(id: string, vsCurrency = 'usd'): Promise<number | null> {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vsCurrency}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const price = data?.[id]?.[vsCurrency];
      return typeof price === 'number' ? price : null;
    } catch {
      return null;
    }
  },

  /**
   * Map our symbols to Coingecko IDs (minimal, grow as needed)
   */
  mapToCoingeckoId(symbol?: string): string | null {
    if (!symbol) return null;
    const idMap: Record<string, string> = {
      USDC: 'usd-coin',
      PAXG: 'pax-gold',
      USDm: 'celo-dollar',
      EURm: 'celo-euro',
    };
    return idMap[symbol.toUpperCase()] || null;
  },

  /**
   * DefiLlama chain prefix by chainId
   */
  getDefiLlamaPrefix(chainId: number): string | null {
    const map: Record<number, string> = {
      42161: 'arbitrum',
      1: 'ethereum',
      137: 'polygon',
      10: 'optimism',
      43114: 'avalanche',
      42220: 'celo',
      44787: 'celo', // DefiLlama may not have prices for testnets
    };
    return map[chainId] || null;
  }
};

// Mapping of our region codes to country ISO3 codes
const REGION_COUNTRY_MAPPING: Record<string, string[]> = {
  'Africa': ['KEN', 'GHA', 'SEN', 'CIV', 'NGA', 'ZAF', 'TZA', 'UGA', 'ETH', 'RWA'],
  'LatAm': ['BRA', 'COL', 'MEX', 'ARG', 'CHL', 'PER', 'VEN', 'ECU', 'BOL', 'URY'],
  'Asia': ['PHL', 'IDN', 'MYS', 'THA', 'IND', 'CHN', 'JPN', 'KOR', 'VNM', 'SGP'],
  'Europe': ['DEU', 'FRA', 'ITA', 'ESP', 'GBR', 'NLD', 'BEL', 'PRT', 'GRC', 'CHE'],
  'USA': ['USA', 'CAN']
};

// Fallback inflation data
const FALLBACK_INFLATION_DATA = {
  countries: [
    { country: 'United States', countryCode: 'USA', value: 3.1, year: 2023 },
    { country: 'Euro Area', countryCode: 'EMU', value: 2.4, year: 2023 },
    { country: 'Kenya', countryCode: 'KEN', value: 6.8, year: 2023 },
    { country: 'Ghana', countryCode: 'GHA', value: 23.2, year: 2023 },
    { country: 'Brazil', countryCode: 'BRA', value: 4.5, year: 2023 },
    { country: 'Colombia', countryCode: 'COL', value: 7.2, year: 2023 },
    { country: 'Philippines', countryCode: 'PHL', value: 3.9, year: 2023 }
  ],
  source: 'fallback' as const
};

// Helper functions for fallback data
function getFallbackInflationData() {
  return {
    ...FALLBACK_INFLATION_DATA,
    source: 'fallback' as const,
    lastUpdated: new Date().toISOString(),
    warning: 'Using fallback data - real-time sources unavailable'
  };
}

function getFallbackRegionalInflationData(regionCode: string) {
  const regionCountries = REGION_COUNTRY_MAPPING[regionCode] || [];
  const countries = FALLBACK_INFLATION_DATA.countries.filter(country =>
    regionCountries.includes(country.countryCode)
  );

  return {
    countries: countries.length > 0 ? countries : FALLBACK_INFLATION_DATA.countries,
    source: 'fallback' as const
  };
}

function getFallbackExchangeRate(fromCurrency: string, toCurrency: string) {
  // Simple fallback exchange rates
  const rates: Record<string, number> = {
    'USD': 1.0,
    'EUR': 0.85,
    'GBP': 0.73,
    'JPY': 110.0,
    'CAD': 1.25,
    'AUD': 1.35,
  };

  const fromRate = rates[fromCurrency] || 1.0;
  const toRate = rates[toCurrency] || 1.0;
  const rate = toRate / fromRate;

  return {
    rate,
    timestamp: new Date().toISOString().split('T')[0],
    source: 'fallback'
  };
}

// Cache helpers
function getCachedData(key: string, duration: number): any {
  try {
    if (typeof window === 'undefined') return null;

    const cachedData = localStorage.getItem(key);
    if (!cachedData) return null;

    const { value, timestamp } = JSON.parse(cachedData);
    const now = Date.now();

    if (now - timestamp < duration) {
      return value;
    }

    return null;
  } catch (error) {
    console.warn(`Error reading from cache (${key}):`, error);
    return null;
  }
}

function setCachedData(key: string, value: any): void {
  try {
    if (typeof window === 'undefined') return;

    const cacheData = {
      value,
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn(`Error writing to cache (${key}):`, error);
  }
}

// Gemini API Service - Now a thin wrapper around the portfolio analysis API
// The heavy lifting is done by utils/portfolio-analysis.ts (single source of truth)
export const GeminiService = {
  /**
   * @deprecated Use the analyzePortfolio function from utils/portfolio-analysis.ts directly
   * This method is kept for backward compatibility but delegates to the new analysis engine
   */
  analyzeWealthProtection: async (
    inflationData: any,
    userBalance: number,
    currentHoldings: string[],
    config?: any
  ): Promise<{
    action: 'SWAP' | 'HOLD' | 'REBALANCE';
    targetToken?: string;
    reasoning: string;
    confidence: number;
    suggestedAmount?: number;
    expectedSavings?: number;
    timeHorizon?: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    dataSources?: string[];
    thoughtChain?: string[];
    actionSteps?: string[];
    urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    _meta?: { modelUsed: string; totalCost?: number };
  }> => {
    try {
      // Delegate to the new API endpoint which uses portfolio-analysis.ts
      const response = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inflationData,
          userBalance,
          currentHoldings,
          config,
          networkInfo: { chainId: 42220, name: 'Celo' },
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status}`);
      }

      const result = await response.json();

      return {
        action: result.action || 'HOLD',
        targetToken: result.targetToken,
        reasoning: result.reasoning || 'Analysis completed.',
        confidence: result.confidence || 0.75,
        suggestedAmount: result.suggestedAmount,
        expectedSavings: result.expectedSavings,
        timeHorizon: result.timeHorizon,
        riskLevel: result.riskLevel || 'MEDIUM',
        dataSources: result.dataSources,
        thoughtChain: result.thoughtChain,
        actionSteps: result.actionSteps,
        urgencyLevel: result.urgencyLevel,
        _meta: {
          modelUsed: result._meta?.modelUsed || 'gemini-3-flash-preview',
          totalCost: 0.0035 // Example updated cost for Gemini 3 Flash Preview
        }
      };

    } catch (error) {
      console.error('Gemini Service Error:', error);
      return getFallbackAgentAdvice();
    }
  }
};

function getFallbackAgentAdvice() {
  return {
    action: 'HOLD',
    reasoning: 'AI Agent unavailable, defaulting to conservative strategy.',
    confidence: 0.0,
    suggestedAmount: 0
  } as const;
}
