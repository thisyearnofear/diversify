/**
 * Inflation Data Service
 * Fetches live data via API proxy with caching and circuit breaker
 * Uses IMF → World Bank → fallback (handled server-side)
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

export const inflationService = new ImprovedInflationService();
