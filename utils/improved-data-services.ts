/**
 * Improved Data Services
 * Centralized services for inflation and exchange rate data
 * Uses IMF → World Bank → fallback (inflation) and Frankfurter → fallback (exchange rates)
 */

import { unifiedCache } from './unified-cache-service';
import { circuitBreakerManager } from './circuit-breaker-service';
import { getFallbackByRegion } from '../constants/inflation';

export class ImprovedInflationService {
  private readonly circuitBreaker = circuitBreakerManager.getCircuit('inflation-service', {
    failureThreshold: 3,
    timeout: 30000,
    successThreshold: 2
  });

  /**
   * Get inflation data via API proxy with caching
   */
  async getInflationData(): Promise<{ data: any; source: string }> {
    const cacheKey = 'inflation-all-regions';

    return this.circuitBreaker.callWithFallback(
      async () => {
        return unifiedCache.getOrFetch(
          cacheKey,
          () => this.fetchFromProxy(),
          'moderate'
        );
      },
      () => this.getFallbackData()
    );
  }

  /**
   * Fetch from API proxy (handles IMF/World Bank server-side)
   */
  private async fetchFromProxy(): Promise<{ data: any; source: string }> {
    const response = await fetch('/api/inflation', {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Inflation API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.countries || data.countries.length === 0) {
      throw new Error('No inflation data returned');
    }

    console.log(`[Inflation] Fetched from ${data.source}: ${data.countries.length} countries`);

    return { data, source: data.source };
  }

  /**
   * Fallback when API is unavailable
   */
  private getFallbackData(): { data: any; source: string } {
    console.warn('[Inflation] Using static fallback data');

    // Get the fallback data organized by region
    const fallbackByRegion = getFallbackByRegion();

    // Flatten the regional data into a single countries array
    const allCountries = Object.values(fallbackByRegion).flatMap(regionData =>
      regionData.countries.map(country => ({
        country: country.country,
        countryCode: country.country, // Using country as countryCode for simplicity
        value: country.value,
        year: country.year,
        source: 'fallback'
      }))
    );

    return {
      data: {
        countries: allCountries,
        source: 'fallback',
        lastUpdated: new Date().toISOString()
      },
      source: 'fallback'
    };
  }
}

export class ExchangeRateService {
  private readonly circuitBreaker = circuitBreakerManager.getCircuit('exchange-rate-service', {
    failureThreshold: 3,
    timeout: 15000,
    successThreshold: 2
  });

  /**
   * Get current exchange rate between two currencies
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<{ data: any; source: string }> {
    const cacheKey = `exchange-rate-${fromCurrency}-${toCurrency}`;

    return this.circuitBreaker.callWithFallback(
      async () => {
        return unifiedCache.getOrFetch(
          cacheKey,
          () => this.fetchCurrentRate(fromCurrency, toCurrency),
          'volatile'
        );
      },
      () => this.getFallbackCurrentRate(fromCurrency, toCurrency)
    );
  }

  /**
   * Get historical exchange rates (30 days)
   */
  async getHistoricalRates(fromCurrency: string, toCurrency: string): Promise<{ data: any; source: string }> {
    const cacheKey = `exchange-rate-historical-${fromCurrency}-${toCurrency}`;

    return this.circuitBreaker.callWithFallback(
      async () => {
        return unifiedCache.getOrFetch(
          cacheKey,
          () => this.fetchHistoricalRates(fromCurrency, toCurrency),
          'moderate'
        );
      },
      () => this.getFallbackHistoricalRates(fromCurrency, toCurrency)
    );
  }

  /**
   * Fetch current rate from API proxy
   */
  private async fetchCurrentRate(fromCurrency: string, toCurrency: string): Promise<{ data: any; source: string }> {
    const response = await fetch(`/api/exchange-rates?from=${fromCurrency}&to=${toCurrency}`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.rate) {
      throw new Error('No exchange rate returned');
    }

    console.log(`[Exchange Rate] Fetched ${fromCurrency}-${toCurrency} from ${data.source}`);

    return { data, source: data.source };
  }

  /**
   * Fetch historical rates from API proxy
   */
  private async fetchHistoricalRates(fromCurrency: string, toCurrency: string): Promise<{ data: any; source: string }> {
    const response = await fetch(`/api/exchange-rates?from=${fromCurrency}&to=${toCurrency}&historical=true`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Historical exchange rate API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.dates || !data.rates) {
      throw new Error('No historical exchange rate data returned');
    }

    console.log(`[Exchange Rate] Fetched historical ${fromCurrency}-${toCurrency} from ${data.source}: ${data.dates.length} days`);

    return { data, source: data.source };
  }

  /**
   * Fallback current rate
   */
  private getFallbackCurrentRate(fromCurrency: string, toCurrency: string): { data: any; source: string } {
    console.warn(`[Exchange Rate] Using fallback for ${fromCurrency}-${toCurrency}`);
    
    return {
      data: {
        rate: 1,
        date: new Date().toISOString().split('T')[0],
        source: 'fallback',
        from: fromCurrency,
        to: toCurrency
      },
      source: 'fallback'
    };
  }

  /**
   * Fallback historical rates
   */
  private getFallbackHistoricalRates(fromCurrency: string, toCurrency: string): { data: any; source: string } {
    console.warn(`[Exchange Rate] Using fallback historical data for ${fromCurrency}-${toCurrency}`);
    
    const dates: string[] = [];
    const rates: number[] = [];
    const today = new Date();

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
      rates.push(1);
    }

    return {
      data: {
        dates,
        rates,
        source: 'fallback',
        from: fromCurrency,
        to: toCurrency
      },
      source: 'fallback'
    };
  }
}

export const inflationService = new ImprovedInflationService();
export const exchangeRateService = new ExchangeRateService();
