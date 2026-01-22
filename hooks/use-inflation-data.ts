import { useState, useEffect } from 'react';
import { WorldBankService } from '../utils/api-services';
import { inflationService } from '../utils/improved-inflation-service';
import { useDataFreshness } from './use-data-freshness';

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

// Fallback inflation data (used when API fails or is unavailable)
const FALLBACK_INFLATION_DATA: Record<string, RegionalInflationData> = {
  Africa: {
    region: 'Africa',
    countries: [
      { country: 'Kenya', region: 'Africa', currency: 'KES', rate: 6.8, year: 2023, source: 'fallback' },
      { country: 'Ghana', region: 'Africa', currency: 'GHS', rate: 23.2, year: 2023, source: 'fallback' },
      { country: 'CFA Zone', region: 'Africa', currency: 'XOF', rate: 3.5, year: 2023, source: 'fallback' },
      { country: 'South Africa', region: 'Africa', currency: 'ZAR', rate: 5.2, year: 2023, source: 'fallback' },
    ],
    avgRate: 9.7,
    stablecoins: ['cKES', 'cGHS', 'eXOF', 'cZAR'],
  },
  LatAm: {
    region: 'LatAm',
    countries: [
      { country: 'Brazil', region: 'LatAm', currency: 'BRL', rate: 4.5, year: 2023, source: 'fallback' },
      { country: 'Colombia', region: 'LatAm', currency: 'COP', rate: 7.2, year: 2023, source: 'fallback' },
    ],
    avgRate: 5.9,
    stablecoins: ['cREAL', 'cCOP'],
  },
  Asia: {
    region: 'Asia',
    countries: [
      { country: 'Philippines', region: 'Asia', currency: 'PHP', rate: 3.9, year: 2023, source: 'fallback' },
      { country: 'Australia', region: 'Asia', currency: 'AUD', rate: 3.6, year: 2023, source: 'fallback' },
    ],
    avgRate: 3.8,
    stablecoins: ['PUSO', 'cAUD', 'cPESO'],
  },
  Europe: {
    region: 'Europe',
    countries: [
      { country: 'Euro Zone', region: 'Europe', currency: 'EUR', rate: 2.4, year: 2023, source: 'fallback' },
      { country: 'United Kingdom', region: 'Europe', currency: 'GBP', rate: 2.0, year: 2023, source: 'fallback' },
    ],
    avgRate: 2.2,
    stablecoins: ['cEUR', 'cGBP'],
  },
  USA: {
    region: 'USA',
    countries: [
      { country: 'United States', region: 'USA', currency: 'USD', rate: 3.1, year: 2023, source: 'fallback' },
      { country: 'Canada', region: 'USA', currency: 'CAD', rate: 3.4, year: 2023, source: 'fallback' },
    ],
    avgRate: 3.25,
    stablecoins: ['cUSD', 'cCAD', 'USDC'],
  },
  Global: {
    region: 'Global',
    countries: [
      { country: 'Gold', region: 'Global', currency: 'XAU', rate: 0.0, year: 2023, source: 'fallback' },
    ],
    avgRate: 0.0,
    stablecoins: ['PAXG'],
  },
};

// Country to region mapping
const COUNTRY_TO_REGION: Record<string, string> = {
  // Africa
  'KEN': 'Africa', // Kenya
  'GHA': 'Africa', // Ghana
  'SEN': 'Africa', // Senegal (CFA)
  'CIV': 'Africa', // Ivory Coast (CFA)
  'NGA': 'Africa', // Nigeria
  'ZAF': 'Africa', // South Africa
  'TZA': 'Africa', // Tanzania
  'UGA': 'Africa', // Uganda
  'ETH': 'Africa', // Ethiopia
  'RWA': 'Africa', // Rwanda

  // Latin America
  'BRA': 'LatAm', // Brazil
  'COL': 'LatAm', // Colombia
  'MEX': 'LatAm', // Mexico
  'ARG': 'LatAm', // Argentina
  'CHL': 'LatAm', // Chile
  'PER': 'LatAm', // Peru
  'VEN': 'LatAm', // Venezuela
  'ECU': 'LatAm', // Ecuador
  'BOL': 'LatAm', // Bolivia
  'URY': 'LatAm', // Uruguay

  // Asia
  'PHL': 'Asia', // Philippines
  'IDN': 'Asia', // Indonesia
  'MYS': 'Asia', // Malaysia
  'THA': 'Asia', // Thailand
  'IND': 'Asia', // India
  'CHN': 'Asia', // China
  'JPN': 'Asia', // Japan
  'KOR': 'Asia', // South Korea
  'VNM': 'Asia', // Vietnam
  'SGP': 'Asia', // Singapore
  'AUS': 'Asia', // Australia (geographically Oceania, but grouped with Asia for simplicity)

  // Europe
  'DEU': 'Europe', // Germany (Euro)
  'FRA': 'Europe', // France (Euro)
  'ITA': 'Europe', // Italy (Euro)
  'ESP': 'Europe', // Spain (Euro)
  'GBR': 'Europe', // UK
  'NLD': 'Europe', // Netherlands
  'BEL': 'Europe', // Belgium
  'PRT': 'Europe', // Portugal
  'GRC': 'Europe', // Greece
  'CHE': 'Europe', // Switzerland

  // USA
  'USA': 'USA', // United States
  'CAN': 'USA', // Canada (grouped with USA for simplicity)
};

// Currency to country mapping
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  'KES': 'KEN', // Kenyan Shilling
  'GHS': 'GHA', // Ghanaian Cedi
  'XOF': 'SEN', // CFA Franc
  'BRL': 'BRA', // Brazilian Real
  'COP': 'COL', // Colombian Peso
  'PHP': 'PHL', // Philippine Peso
  'EUR': 'DEU', // Euro (using Germany as representative)
  'USD': 'USA', // US Dollar
  'CAD': 'CAN', // Canadian Dollar
  'AUD': 'AUS', // Australian Dollar
  'GBP': 'GBR', // British Pound
  'ZAR': 'ZAF', // South African Rand
};

// Currency to stablecoin mapping
const CURRENCY_TO_STABLECOIN: Record<string, string> = {
  'KES': 'cKES',
  'GHS': 'cGHS',
  'XOF': 'eXOF',
  'BRL': 'cREAL',
  'COP': 'cCOP',
  'PHP': 'PUSO',
  'EUR': 'CEUR',
  'USD': 'CUSD',
  'CAD': 'CCAD',
  'AUD': 'CAUD',
  'GBP': 'CGBP',
  'ZAR': 'CZAR',
  'XAU': 'PAXG',
};

export function useInflationData() {
  const [inflationData, setInflationData] = useState<Record<string, RegionalInflationData>>(FALLBACK_INFLATION_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'cache' | 'fallback'>('fallback');

  useEffect(() => {
    const fetchInflationData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try improved multi-source service first
        const improvedData = await inflationService.getInflationData();
        
        if (improvedData.source !== 'fallback') {
          console.log(`Using improved data from ${improvedData.source}`);
          
          // Process the improved data
          const countryData: InflationData[] = improvedData.countries.map((item: any) => ({
            country: item.country,
            region: COUNTRY_TO_REGION[item.countryCode] || 'Global',
            currency: getCurrencyFromCountryCode(item.countryCode),
            rate: item.value,
            year: item.year,
            source: improvedData.source as 'api' | 'cache' | 'fallback'
          }));

          // Group by region (same logic as before)
          const regionalData = processCountryDataIntoRegions(countryData);
          setInflationData(regionalData);
          setDataSource(improvedData.source as 'api' | 'cache' | 'fallback');
          return;
        }

        // Fall back to World Bank service if improved service fails
        console.warn("Improved service failed, falling back to World Bank");
        const worldBankData = await WorldBankService.getInflationData();

        if (worldBankData.source === 'fallback') {
          console.warn("Using Fallback Data - World Bank API might be down or rate limited.");
        }

        // Process the API response
        const countryData: InflationData[] = [];

        // Convert World Bank data to our format
        if (worldBankData.data.countries && worldBankData.data.countries.length > 0) {
          worldBankData.data.countries.forEach((item: {
            country: string;
            countryCode: string;
            value: number;
            year: number;
          }) => {
            const countryCode = item.countryCode;
            const region = COUNTRY_TO_REGION[countryCode];

            if (region) {
              countryData.push({
                country: item.country,
                region: region,
                currency: getCurrencyFromCountryCode(countryCode),
                rate: item.value,
                year: item.year,
                source: worldBankData.source.includes('api') ? 'api' : 
                       worldBankData.source.includes('cache') ? 'cache' : 'fallback'
              });
            }
          });
        }

        // Group by region and calculate average rates
        const regionalData = processCountryDataIntoRegions(countryData);
        setInflationData(regionalData);
        setDataSource(worldBankData.source.includes('api') ? 'api' : 
                     worldBankData.source.includes('cache') ? 'cache' : 'fallback');
      } catch (err: any) {
        console.error('Error in inflation data hook:', err);
        setError(err.message || 'Failed to fetch inflation data');
        setInflationData(FALLBACK_INFLATION_DATA);
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
        regionalData[region] = FALLBACK_INFLATION_DATA[region];
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

  // Get inflation rate for a specific currency
  const getInflationRateForCurrency = (currency: string): number => {
    const countryCode = CURRENCY_TO_COUNTRY[currency];
    if (!countryCode) return 0;

    const region = COUNTRY_TO_REGION[countryCode];
    if (!region || !inflationData[region]) return 0;

    const countryData = inflationData[region].countries.find(
      c => c.currency === currency
    );

    return countryData ? countryData.rate : inflationData[region].avgRate;
  };

  // Get inflation rate for a specific stablecoin
  const getInflationRateForStablecoin = (stablecoin: string): number => {
    // Normalize stablecoin name (handle both CXOF and EXOF)
    const normalizedStablecoin = stablecoin.toUpperCase();

    // Special case for CFA Franc (handle both CXOF and EXOF)
    if (normalizedStablecoin === 'CXOF' || normalizedStablecoin === 'EXOF') {
      // Get the inflation rate for XOF directly
      const xofData = inflationData['Africa']?.countries.find(c => c.currency === 'XOF');
      return xofData ? xofData.rate : inflationData['Africa']?.avgRate || 3.5; // Fallback to region average or 3.5%
    }

    if (normalizedStablecoin === 'USDC') {
      return getInflationRateForCurrency('USD');
    }

    // Find the currency that corresponds to this stablecoin
    const currency = Object.keys(CURRENCY_TO_STABLECOIN).find(
      key => CURRENCY_TO_STABLECOIN[key].toUpperCase() === normalizedStablecoin
    );

    if (!currency) return 0;

    return getInflationRateForCurrency(currency);
  };

  // Get region for a specific stablecoin
  const getRegionForStablecoin = (stablecoin: string): string => {
    // Make case-insensitive by converting to uppercase
    const stablecoinUpper = stablecoin.toUpperCase();

    // Try direct mapping first based on known stablecoin patterns
    // USA region (North America)
    if (stablecoinUpper === 'CUSD') return 'USA';
    if (stablecoinUpper === 'USDC') return 'USA';
    if (stablecoinUpper === 'CCAD') return 'USA'; // Canadian Dollar (could be "North America" in future)

    // Europe region
    if (stablecoinUpper === 'CEUR') return 'Europe';
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
    if (stablecoinUpper === 'CAUD') return 'Asia'; // Australian Dollar
    if (stablecoinUpper === 'CPESO') return 'Asia'; // Philippine Peso (alternative name)

    // Global
    if (stablecoinUpper === 'PAXG') return 'Global';

    // Fallback to the original lookup method (case-insensitive)
    const currency = Object.keys(CURRENCY_TO_STABLECOIN).find(
      key => CURRENCY_TO_STABLECOIN[key].toUpperCase() === stablecoinUpper
    );

    if (!currency) return 'Unknown';

    const countryCode = CURRENCY_TO_COUNTRY[currency];
    if (!countryCode) return 'Unknown';

    return COUNTRY_TO_REGION[countryCode] || 'Unknown';
  };

  // Get data freshness information
  const getOverallDataFreshness = () => {
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
  };

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
