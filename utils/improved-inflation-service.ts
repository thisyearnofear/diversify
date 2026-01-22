/**
 * Improved Inflation Data Service
 * Multi-source approach with redundancy and real-time data
 */

import { unifiedCache, CacheCategory } from './unified-cache-service';
import { batchService } from './batch-request-service';
import { circuitBreakerManager } from './circuit-breaker-service';

// Configuration for different data sources
const DATA_SOURCES = {
  STAT_BUREAU: {
    baseUrl: 'https://www.statbureau.org/get-data-json',
    countries: ['united-states', 'canada', 'germany', 'japan', 'united-kingdom', 'australia'],
    updateFrequency: 'monthly',
    reliability: 'high'
  },
  TRADING_ECONOMICS: {
    baseUrl: 'https://api.tradingeconomics.com',
    apiKey: process.env.TRADING_ECONOMICS_API_KEY || 'guest', // guest access available
    updateFrequency: 'daily',
    reliability: 'high'
  },
  FRED: {
    baseUrl: 'https://api.stlouisfed.org/fred',
    apiKey: process.env.FRED_API_KEY || '',
    updateFrequency: 'weekly',
    reliability: 'high'
  },
  WORLD_BANK: {
    baseUrl: 'https://api.worldbank.org/v2',
    updateFrequency: 'quarterly',
    reliability: 'medium'
  }
};

// Country code mappings for different APIs
const COUNTRY_MAPPINGS = {
  // ISO3 to API-specific codes
  'USA': { statbureau: 'united-states', tradingeco: 'US', fred: 'USA' },
  'CAN': { statbureau: 'canada', tradingeco: 'CA', fred: 'CAN' },
  'DEU': { statbureau: 'germany', tradingeco: 'DE', fred: 'DEU' },
  'GBR': { statbureau: 'united-kingdom', tradingeco: 'GB', fred: 'GBR' },
  'JPN': { statbureau: 'japan', tradingeco: 'JP', fred: 'JPN' },
  'AUS': { statbureau: 'australia', tradingeco: 'AU', fred: 'AUS' },
  'FRA': { statbureau: 'france', tradingeco: 'FR', fred: 'FRA' },
  'ITA': { statbureau: 'italy', tradingeco: 'IT', fred: 'ITA' },
  'ESP': { statbureau: 'spain', tradingeco: 'ES', fred: 'ESP' }
};

export class ImprovedInflationService {
  private readonly circuitBreaker = circuitBreakerManager.getCircuit('inflation-service', {
    failureThreshold: 3,
    timeout: 30000, // 30 seconds
    successThreshold: 2
  });

  /**
   * Get inflation data with multi-source fallback and efficiency improvements
   */
  async getInflationData(countryCodes: string[] = []): Promise<any> {
    const cacheKey = `inflation-${countryCodes.sort().join(',')}`;
    
    return this.circuitBreaker.callWithFallback(
      async () => {
        return unifiedCache.getOrFetch(
          cacheKey,
          () => this.fetchMultiSourceData(countryCodes),
          'moderate' // Inflation data changes moderately
        );
      },
      () => this.getFallbackData()
    );
  }

  /**
   * Fetch data from multiple sources with batching
   */
  private async fetchMultiSourceData(countryCodes: string[]): Promise<{ data: any; source: string }> {
    // Try primary sources in order of preference
    const sources = [
      { name: 'statbureau', fetch: () => this.fetchFromStatBureau(countryCodes) },
      { name: 'tradingeconomics', fetch: () => this.fetchFromTradingEconomics(countryCodes) },
      { name: 'fred', fetch: () => this.fetchFromFred(countryCodes) },
      { name: 'worldbank', fetch: () => this.fetchFromWorldBank(countryCodes) }
    ];

    for (const source of sources) {
      try {
        console.log(`Attempting to fetch from ${source.name}...`);
        const data = await source.fetch();
        if (data && data.countries && data.countries.length > 0) {
          console.log(`Successfully fetched from ${source.name}: ${data.countries.length} countries`);
          return {
            data,
            source: source.name
          };
        }
      } catch (error) {
        console.warn(`Source ${source.name} failed:`, error);
        // Continue to next source
      }
    }

    // All sources failed
    throw new Error('All inflation data sources failed');
  }

  /**
   * Fetch from StatBureau API (Primary - Free) via our proxy
   */
  private async fetchFromStatBureau(countryCodes: string[]): Promise<any> {
    if (countryCodes.length === 0) {
      countryCodes = Object.keys(COUNTRY_MAPPINGS);
    }

    try {
      // Use our API proxy to avoid CORS issues
      const response = await fetch(`/api/inflation/statbureau?countries=${countryCodes.join(',')}`);
      
      if (!response.ok) {
        throw new Error(`Proxy API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Return the data in expected format
      return {
        countries: data.countries || [],
        source: 'statbureau',
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };
    } catch (error) {
      console.warn('StatBureau proxy failed:', error);
      // Return empty array instead of throwing
      return {
        countries: [],
        source: 'statbureau',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch from Trading Economics API (Secondary)
   */
  private async fetchFromTradingEconomics(countryCodes: string[]): Promise<any> {
    // Implementation would require API key setup
    // This is a placeholder for when we have proper credentials
    throw new Error('Trading Economics API key required');
  }

  /**
   * Fetch from FRED API (Tertiary)
   */
  private async fetchFromFred(countryCodes: string[]): Promise<any> {
    if (!DATA_SOURCES.FRED.apiKey) {
      throw new Error('FRED API key not configured');
    }

    // Would fetch US CPI data and convert to inflation rate
    throw new Error('FRED implementation pending API key');
  }

  /**
   * Fallback to World Bank (Current implementation)
   */
  private async fetchFromWorldBank(countryCodes: string[]): Promise<any> {
    // Current World Bank implementation from existing code
    let url = `${DATA_SOURCES.WORLD_BANK.baseUrl}/country/all/indicator/FP.CPI.TOTL.ZG?format=json&per_page=300`;
    const currentYear = new Date().getFullYear();
    url += `&date=${currentYear - 1}:${currentYear}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`World Bank API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
      throw new Error('Invalid World Bank API response format');
    }

    const countries = data[1]
      .filter((item: any) => item.value !== null)
      .map((item: any) => ({
        country: item.country.value,
        countryCode: item.countryiso3code,
        value: item.value,
        year: parseInt(item.date),
        source: 'worldbank'
      }));

    return {
      countries: countries.slice(0, 20), // Limit for performance
      source: 'worldbank',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Fallback data when all APIs fail
   */
  private getFallbackData(): { data: any; source: string } {
    return {
      data: {
        countries: [
          { country: 'United States', countryCode: 'USA', value: 3.1, year: 2024, source: 'fallback' },
          { country: 'Euro Area', countryCode: 'EMU', value: 2.4, year: 2024, source: 'fallback' },
          { country: 'United Kingdom', countryCode: 'GBR', value: 2.0, year: 2024, source: 'fallback' },
          { country: 'Japan', countryCode: 'JPN', value: 2.8, year: 2024, source: 'fallback' },
          { country: 'Canada', countryCode: 'CAN', value: 2.9, year: 2024, source: 'fallback' },
          { country: 'Australia', countryCode: 'AUS', value: 3.4, year: 2024, source: 'fallback' }
        ],
        source: 'fallback',
        lastUpdated: new Date().toISOString()
      },
      source: 'fallback'
    };
  }

  // Helper methods
  private normalizeCountryName(apiCountry: string): string {
    const mappings: Record<string, string> = {
      'united-states': 'United States',
      'united-kingdom': 'United Kingdom',
      'germany': 'Germany',
      'canada': 'Canada',
      'japan': 'Japan',
      'australia': 'Australia',
      'france': 'France',
      'italy': 'Italy',
      'spain': 'Spain'
    };
    return mappings[apiCountry] || apiCountry;
  }

  private reverseLookupCountryCode(statBureauCountry: string): string {
    for (const [iso3, mappings] of Object.entries(COUNTRY_MAPPINGS)) {
      if (mappings.statbureau === statBureauCountry) {
        return iso3;
      }
    }
    return 'UNKNOWN';
  }

}

// Export singleton instance
export const inflationService = new ImprovedInflationService();