/**
 * Improved Data Services
 * Centralized services for inflation and exchange rate data
 * Uses IMF → World Bank → fallback (inflation) and Frankfurter → fallback (exchange rates)
 */

import { unifiedCache } from './unified-cache-service';
import { circuitBreakerManager } from './circuit-breaker-service';
import { getFallbackByRegion, PRIORITY_COUNTRIES, COUNTRY_NAMES } from '../constants/inflation';

// Re-export macroService for backwards compatibility
export { macroService } from './macro-economic-service';

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
          () => this.fetchFromSources(),
          'moderate'
        );
      },
      () => this.getFallbackData()
    );
  }

  /**
   * Fetch from API proxy (handles IMF/World Bank server-side)
   */
  private async fetchFromSources(): Promise<{ data: any; source: string }> {
    const IMF_URL = 'https://www.imf.org/external/datamapper/api/v1/PCPIPCH';
    const WORLD_BANK_URL = 'https://api.worldbank.org/v2';
    const currentYear = new Date().getFullYear();

    // Try IMF first
    try {
      const years = [currentYear - 1, currentYear, currentYear + 1];
      const allCodes = [...PRIORITY_COUNTRIES, 'WEOWORLD'];

      const response = await fetch(
        `${IMF_URL}?periods=${years.join(',')}`,
        {
          headers: { 'Accept': 'application/json', 'User-Agent': 'DiversiFi-App/1.0' },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.values?.PCPIPCH) {
          const inflationData = data.values.PCPIPCH;
          const countries = allCodes
            .filter((code: string) => inflationData[code])
            .map((code: string) => {
              const countryData = inflationData[code];
              const value = countryData[currentYear.toString()] ??
                countryData[(currentYear - 1).toString()] ??
                countryData[(currentYear + 1).toString()];
              const isGlobal = code === 'WEOWORLD';
              return {
                country: isGlobal ? 'World' : (COUNTRY_NAMES[code] || code),
                countryCode: code,
                value: typeof value === 'number' ? parseFloat(value.toFixed(1)) : null,
                year: countryData[currentYear.toString()] !== undefined ? currentYear : currentYear - 1,
                source: 'imf',
                isGlobal,
              };
            })
            .filter((item: any) => item.value !== null);

          if (countries.length > 0) {
            return { data: { countries, source: 'imf', lastUpdated: new Date().toISOString() }, source: 'imf' };
          }
        }
      }
    } catch (e) {
      console.warn('[Inflation] IMF failed:', e);
    }

    // Fall back to World Bank
    try {
      const countryParam = PRIORITY_COUNTRIES.join(';');
      const response = await fetch(
        `${WORLD_BANK_URL}/country/${countryParam}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=100&date=${currentYear - 2}:${currentYear}`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
          const countryLatest: Record<string, any> = {};
          data[1]
            .filter((item: any) => item.value !== null)
            .forEach((item: any) => {
              const code = item.countryiso3code;
              const year = parseInt(item.date);
              const value = item.value as number;
              if (!countryLatest[code] || year > countryLatest[code].year) {
                countryLatest[code] = {
                  country: item.country.value,
                  countryCode: code,
                  value: parseFloat(value.toFixed(1)),
                  year,
                  source: 'worldbank',
                };
              }
            });

          const countries = Object.values(countryLatest);
          if (countries.length > 0) {
            return { data: { countries, source: 'worldbank', lastUpdated: new Date().toISOString() }, source: 'worldbank' };
          }
        }
      }
    } catch (e) {
      console.warn('[Inflation] World Bank failed:', e);
    }

    throw new Error('All inflation data sources failed');
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
    const FRANKFURTER_URL = 'https://api.frankfurter.app';

    const response = await fetch(`${FRANKFURTER_URL}/latest?from=${fromCurrency}&to=${toCurrency}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates || !data.rates[toCurrency]) {
      throw new Error('No exchange rate returned');
    }

    return {
      data: {
        rate: data.rates[toCurrency],
        from: fromCurrency,
        to: toCurrency,
        date: data.date,
        source: 'frankfurter',
      },
      source: 'frankfurter',
    };
  }

  /**
   * Fetch historical rates from API proxy
   */
  private async fetchHistoricalRates(fromCurrency: string, toCurrency: string): Promise<{ data: any; source: string }> {
    const FRANKFURTER_URL = 'https://api.frankfurter.app';
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const response = await fetch(
      `${FRANKFURTER_URL}/${startDateStr}..${endDateStr}?from=${fromCurrency}&to=${toCurrency}`,
      { signal: AbortSignal.timeout(10000) },
    );

    if (!response.ok) {
      throw new Error(`Frankfurter historical API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates) {
      throw new Error('No historical data found');
    }

    const dates = Object.keys(data.rates).sort();
    const rates = dates.map(date => data.rates[date][toCurrency]);

    return {
      data: { dates, rates, source: 'frankfurter', from: fromCurrency, to: toCurrency },
      source: 'frankfurter',
    };
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
