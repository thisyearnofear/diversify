import { useState, useEffect, useCallback } from 'react';
import { inflationService } from '../utils/improved-data-services';
import {
  FALLBACK_INFLATION_DATA,
  COUNTRY_TO_REGION,
  CURRENCY_TO_COUNTRY,
  getFallbackByRegion
} from '../constants/inflation';

// Types
export interface InflationData {
  country: string;
  region: string;
  currency: string;
  rate: number;
  year: number;
  source: 'api' | 'cache' | 'fallback';
}

export interface RegionalInflationData {
  region: string;
  countries: InflationData[];
  avgRate: number;
  stablecoins: string[];
}

// Region to stablecoins mapping (UPPERCASE symbols to match TOKEN_METADATA)
const REGION_STABLECOINS: Record<string, string[]> = {
  Africa: ['CKES', 'CGHS', 'CXOF', 'CZAR', 'CNGN'],
  LatAm: ['CREAL', 'CCOP'],
  Asia: ['PUSO', 'CAUD', 'CPESO', 'CJPY'],
  Europe: ['CEUR', 'CGBP', 'EURC', 'CCHF'],
  USA: ['CUSD', 'CCAD', 'USDC', 'USDT', 'USDY'],
  Global: ['PAXG'],
  Commodities: ['PAXG'],
};

// Currency to stablecoin mapping (UPPERCASE symbols)
const CURRENCY_TO_STABLECOIN: Record<string, string> = {
  'KES': 'CKES', 'GHS': 'CGHS', 'XOF': 'CXOF', 'ZAR': 'CZAR', 'NGN': 'CNGN',
  'BRL': 'CREAL', 'COP': 'CCOP',
  'PHP': 'PUSO', 'AUD': 'CAUD', 'JPY': 'CJPY',
  'EUR': 'CEUR', 'GBP': 'CGBP', 'CHF': 'CCHF',
  'USD': 'CUSD', 'CAD': 'CCAD',
  'XAU': 'PAXG',
};

// Build initial fallback data from constants
function buildFallbackRegionalData(): Record<string, RegionalInflationData> {
  const byRegion = getFallbackByRegion();
  const result: Record<string, RegionalInflationData> = {};

  for (const [region, data] of Object.entries(byRegion)) {
    result[region] = {
      region,
      countries: data.countries.map(c => ({
        country: c.country,
        region: c.region,
        currency: c.currency,
        rate: c.value,
        year: c.year,
        source: 'fallback' as const
      })),
      avgRate: data.avgRate,
      stablecoins: REGION_STABLECOINS[region] || []
    };
  }

  return result;
}

const INITIAL_FALLBACK_DATA = buildFallbackRegionalData();

export function useInflationData() {
  const [inflationData, setInflationData] = useState<Record<string, RegionalInflationData>>(INITIAL_FALLBACK_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'cache' | 'fallback'>('fallback');

  useEffect(() => {
    const fetchInflationData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try improved multi-source service (IMF → World Bank → fallback)
        const improvedData = await inflationService.getInflationData();

        if (improvedData.data?.countries) {
          console.log(`Using improved data from ${improvedData.source}`);
          console.log(`[Inflation] Loaded ${improvedData.data.countries.length} countries from ${improvedData.source}`);

          // Process the improved data - ensure countries array exists
          const countryData: InflationData[] = (improvedData.data.countries || []).map((item: any) => {
            // Special handling for WEOWORLD (global inflation)
            const isGlobal = item.countryCode === 'WEOWORLD' || item.isGlobal;

            return {
              country: item.country,
              region: isGlobal ? 'Global' : (COUNTRY_TO_REGION[item.countryCode] || 'Global'),
              currency: isGlobal ? 'XAU' : getCurrencyFromCountryCode(item.countryCode),
              rate: item.value,
              year: item.year,
              source: improvedData.source as 'api' | 'cache' | 'fallback'
            };
          });

          console.log(`[Inflation] Processed country data:`, countryData.slice(0, 3)); // Log first 3 for debugging

          // Group by region (same logic as before)
          const regionalData = processCountryDataIntoRegions(countryData);
          console.log(`[Inflation] Regional data:`, Object.keys(regionalData).map(r => `${r}: ${regionalData[r].countries.length} countries`));
          setInflationData(regionalData);
          setDataSource(improvedData.source as 'api' | 'cache' | 'fallback');
          return;
        }

        // If for some reason the service doesn't return data, use fallback
        console.warn("All data sources failed, using fallback data");
        setInflationData(INITIAL_FALLBACK_DATA);
        setDataSource('fallback');
      } catch (err: any) {
        console.error('Error in inflation data hook:', err);
        setError(err.message || 'Failed to fetch inflation data');
        setInflationData(INITIAL_FALLBACK_DATA);
        setDataSource('fallback');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInflationData();
  }, []);

  // Helper function to process country data into regional structure
  const processCountryDataIntoRegions = (countryData: InflationData[]): Record<string, RegionalInflationData> => {
    const regionalData: Record<string, RegionalInflationData> = {};

    // Initialize with regions
    ['Africa', 'LatAm', 'Asia', 'Europe', 'USA', 'Global'].forEach(region => {
      regionalData[region] = {
        region,
        countries: [],
        avgRate: 0,
        stablecoins: FALLBACK_INFLATION_DATA[region].stablecoins
      };
    });

    // Add countries to their regions
    countryData.forEach(country => {
      if (regionalData[country.region]) {
        regionalData[country.region].countries.push(country);
      }
    });

    // Calculate average rates for each region
    Object.keys(regionalData).forEach(region => {
      const countries = regionalData[region].countries;
      if (countries.length > 0) {
        const sum = countries.reduce((acc, country) => acc + country.rate, 0);
        regionalData[region].avgRate = sum / countries.length;
      } else {
        // If no data for region, use fallback
        const fallbackRegionData = getFallbackByRegion()[region];
        if (fallbackRegionData) {
          regionalData[region] = {
            region: fallbackRegionData.region,
            countries: fallbackRegionData.countries.map(c => ({
              country: c.country,
              region: c.region,
              currency: c.currency,
              rate: c.value,
              year: c.year,
              source: 'fallback' as const
            })),
            avgRate: fallbackRegionData.avgRate,
            stablecoins: fallbackRegionData.stablecoins
          };
        } else {
          // Fallback fallback
          regionalData[region] = {
            region,
            countries: [],
            avgRate: 0,
            stablecoins: []
          };
        }
      }
    });

    return regionalData;
  };

  // Helper function to get currency from country code
  const getCurrencyFromCountryCode = (countryCode: string): string => {
    // This is a simplified mapping - in production, you would use a more complete mapping
    const currencyMap: Record<string, string> = {
      'KEN': 'KES', // Kenya
      'GHA': 'GHS', // Ghana
      'SEN': 'XOF', // Senegal (CFA)
      'CIV': 'XOF', // Ivory Coast (CFA)
      'ZAF': 'ZAR', // South Africa
      'BRA': 'BRL', // Brazil
      'COL': 'COP', // Colombia
      'PHL': 'PHP', // Philippines
      'AUS': 'AUD', // Australia
      'DEU': 'EUR', // Germany (Euro)
      'FRA': 'EUR', // France (Euro)
      'ITA': 'EUR', // Italy (Euro)
      'ESP': 'EUR', // Spain (Euro)
      'GBR': 'GBP', // United Kingdom
      'USA': 'USD', // United States
      'CAN': 'CAD', // Canada
    };

    return currencyMap[countryCode] || 'Unknown';
  };

  // Get inflation rate for a specific currency (memoized)
  const getInflationRateForCurrency = useCallback((currency: string): number => {
    const countryCode = CURRENCY_TO_COUNTRY[currency];
    if (!countryCode) {
      console.warn(`[Inflation] No country code found for currency: ${currency}`);
      return 0;
    }

    const region = COUNTRY_TO_REGION[countryCode];
    if (!region || !inflationData[region]) {
      console.warn(`[Inflation] No region found for country code: ${countryCode}`);
      return 0;
    }

    // First try to find exact currency match
    const countryData = inflationData[region].countries.find(
      c => c.currency === currency
    );

    if (countryData) {
      console.log(`[Inflation] Found exact match for ${currency}: ${countryData.rate}%`);
      return countryData.rate;
    }

    // If no exact match, use region average
    const avgRate = inflationData[region].avgRate;
    console.log(`[Inflation] Using region average for ${currency}: ${avgRate}%`);
    return avgRate;
  }, [inflationData]);

  // Get inflation rate for a specific stablecoin (memoized)
  const getInflationRateForStablecoin = useCallback((stablecoin: string): number => {
    // Normalize stablecoin name (handle both CXOF and EXOF)
    const normalizedStablecoin = stablecoin.toUpperCase();

    // Special case for CFA Franc (handle both CXOF and EXOF)
    if (normalizedStablecoin === 'CXOF' || normalizedStablecoin === 'EXOF') {
      // Get the inflation rate for XOF directly
      const xofData = inflationData['Africa']?.countries.find(c => c.currency === 'XOF');
      const rate = xofData ? xofData.rate : inflationData['Africa']?.avgRate || 3.5;
      console.log(`[Inflation] ${stablecoin} -> XOF rate: ${rate}`);
      return rate;
    }

    if (normalizedStablecoin === 'USDC' || normalizedStablecoin === 'USDT') {
      const rate = getInflationRateForCurrency('USD');
      console.log(`[Inflation] ${stablecoin} -> USD rate: ${rate}`);
      return rate;
    }

    if (normalizedStablecoin === 'EURC') {
      const rate = getInflationRateForCurrency('EUR');
      console.log(`[Inflation] ${stablecoin} -> EUR rate: ${rate}`);
      return rate;
    }

    // Special case for PAXG and other Global region assets
    if (normalizedStablecoin === 'PAXG') {
      const rate = inflationData['Global']?.avgRate || 5.0;
      console.log(`[Inflation] ${stablecoin} -> Global rate: ${rate}`);
      return rate;
    }

    // Special case for USDY (Ondo US Dollar Yield) - uses USD inflation rate
    if (normalizedStablecoin === 'USDY') {
      const rate = getInflationRateForCurrency('USD');
      console.log(`[Inflation] ${stablecoin} -> USD rate: ${rate}`);
      return rate;
    }

    // Find the currency that corresponds to this stablecoin
    const currency = Object.keys(CURRENCY_TO_STABLECOIN).find(
      key => CURRENCY_TO_STABLECOIN[key].toUpperCase() === normalizedStablecoin
    );

    if (!currency) {
      console.warn(`[Inflation] No currency mapping found for ${stablecoin}`);
      return 0;
    }

    const rate = getInflationRateForCurrency(currency);
    console.log(`[Inflation] ${stablecoin} -> ${currency} rate: ${rate}`);
    return rate;
  }, [inflationData, getInflationRateForCurrency]);

  // Get region for a specific stablecoin (memoized)
  const getRegionForStablecoin = useCallback((stablecoin: string): string => {
    // Make case-insensitive by converting to uppercase
    const stablecoinUpper = stablecoin.toUpperCase();

    // Try direct mapping first based on known stablecoin patterns
    // USA region (North America)
    if (stablecoinUpper === 'CUSD') return 'USA';
    if (stablecoinUpper === 'USDC') return 'USA';
    if (stablecoinUpper === 'USDT') return 'USA'; // Tether USD
    if (stablecoinUpper === 'CCAD') return 'USA'; // Canadian Dollar (could be "North America" in future)

    // Europe region
    if (stablecoinUpper === 'CEUR') return 'Europe';
    if (stablecoinUpper === 'EURC') return 'Europe'; // Euro Coin (Arc testnet)
    if (stablecoinUpper === 'CGBP') return 'Europe'; // British Pound

    // Latin America region
    if (stablecoinUpper === 'CREAL') return 'LatAm';
    if (stablecoinUpper === 'CCOP') return 'LatAm';

    // Africa region
    if (stablecoinUpper === 'CKES') return 'Africa';
    if (stablecoinUpper === 'CGHS') return 'Africa';
    if (stablecoinUpper === 'CZAR') return 'Africa'; // South African Rand
    if (stablecoinUpper === 'CXOF' || stablecoinUpper === 'EXOF') return 'Africa';

    // Asia region
    if (stablecoinUpper === 'PUSO') return 'Asia';
    if (stablecoinUpper === 'CAUD') return 'Asia'; // Australian Dollar (grouped with Asia-Pacific)
    if (stablecoinUpper === 'CPESO') return 'Asia'; // Philippine Peso (alternative name)
    if (stablecoinUpper === 'CJPY') return 'Asia'; // Japanese Yen
    if (stablecoinUpper === 'CCHF') return 'Europe'; // Swiss Franc
    if (stablecoinUpper === 'CNGN') return 'Africa'; // Nigerian Naira

    // Global
    if (stablecoinUpper === 'PAXG') return 'Global';

    // USA region (Yield-bearing USD assets)
    if (stablecoinUpper === 'USDY') return 'USA';

    // Fallback to the original lookup method (case-insensitive)
    const currency = Object.keys(CURRENCY_TO_STABLECOIN).find(
      key => CURRENCY_TO_STABLECOIN[key].toUpperCase() === stablecoinUpper
    );

    if (!currency) return 'Unknown';

    const countryCode = CURRENCY_TO_COUNTRY[currency];
    if (!countryCode) return 'Unknown';

    return COUNTRY_TO_REGION[countryCode] || 'Unknown';
  }, []);

  // Get data freshness information (memoized)
  const getOverallDataFreshness = useCallback(() => {
    // Find the most recent data point
    let mostRecentDate = '';
    Object.values(inflationData).forEach(region => {
      region.countries.forEach(country => {
        if (country.year && (!mostRecentDate || country.year > parseInt(mostRecentDate))) {
          mostRecentDate = country.year.toString();
        }
      });
    });

    return {
      mostRecentYear: mostRecentDate || 'Unknown',
      dataSources: Array.from(new Set(
        Object.values(inflationData).flatMap(region =>
          region.countries.map(c => c.source)
        )
      )),
      totalCountries: Object.values(inflationData).reduce((sum, region) =>
        sum + region.countries.length, 0
      )
    };
  }, [inflationData]);

  return {
    inflationData,
    isLoading,
    error,
    dataSource,
    getInflationRateForCurrency,
    getInflationRateForStablecoin,
    getRegionForStablecoin,
    getDataFreshness: getOverallDataFreshness
  };
}
