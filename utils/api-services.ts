/**
 * API Services for DiversiFi
 *
 * This file contains services for interacting with external APIs:
 * - Alpha Vantage API for currency exchange rates
 * - World Bank API for inflation data
 */

// Cache durations
const CACHE_DURATIONS = {
  EXCHANGE_RATE: 1000 * 60 * 60, // 1 hour
  INFLATION_DATA: 1000 * 60 * 60 * 24, // 24 hours
};

// Cache keys
const CACHE_KEYS = {
  ALPHA_VANTAGE_FOREX: 'alpha-vantage-forex-',
  WORLD_BANK_INFLATION: 'world-bank-inflation-',
};

/**
 * Alpha Vantage API Service
 */
export const AlphaVantageService = {
  /**
   * Get API key from environment variables
   */
  getApiKey: (): string => {
    // In Next.js, process.env with NEXT_PUBLIC_ prefix is available in the browser
    // We don't need to check if process is defined
    const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || '';
    console.log('Alpha Vantage API Key:', apiKey ? 'Found (not showing for security)' : 'Not found');
    return apiKey;
  },

  /**
   * Get exchange rate between two currencies
   * @param fromCurrency Base currency code (e.g., USD)
   * @param toCurrency Target currency code (e.g., EUR)
   * @returns Exchange rate data
   */
  getExchangeRate: async (fromCurrency: string, toCurrency: string) => {
    try {
      const cacheKey = `${CACHE_KEYS.ALPHA_VANTAGE_FOREX}${fromCurrency}-${toCurrency}`;

      // Check cache first
      const cachedData = getCachedData(cacheKey, CACHE_DURATIONS.EXCHANGE_RATE);
      if (cachedData) {
        return { ...cachedData, source: 'cache' };
      }

      // Get API key
      const apiKey = AlphaVantageService.getApiKey();
      if (!apiKey) {
        console.warn('Alpha Vantage API key not found');
        return getFallbackExchangeRate(fromCurrency, toCurrency);
      }

      // Make API request
      const response = await fetch(
        `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();

      // Check if API returned an error
      if (data['Error Message']) {
        throw new Error(`Alpha Vantage API error: ${data['Error Message']}`);
      }

      // Check if API returned rate limit error
      if (data.Note?.includes('API call frequency')) {
        console.warn('Alpha Vantage API rate limit reached');
        return getFallbackExchangeRate(fromCurrency, toCurrency);
      }

      // Extract exchange rate data
      const exchangeRateData = data['Realtime Currency Exchange Rate'];
      if (!exchangeRateData) {
        throw new Error('No exchange rate data found');
      }

      const result = {
        rate: Number.parseFloat(exchangeRateData['5. Exchange Rate']),
        timestamp: exchangeRateData['6. Last Refreshed'],
        source: 'api' as const
      };

      // Cache the result
      setCachedData(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      return getFallbackExchangeRate(fromCurrency, toCurrency);
    }
  },

  /**
   * Get historical exchange rates for a currency pair
   * @param fromCurrency Base currency code (e.g., USD)
   * @param toCurrency Target currency code (e.g., EUR)
   * @param outputSize Data points to return ('compact' = 100, 'full' = all)
   * @returns Historical exchange rate data
   */
  getHistoricalExchangeRates: async (
    fromCurrency: string,
    toCurrency: string,
    outputSize: 'compact' | 'full' = 'compact'
  ) => {
    try {
      const cacheKey = `${CACHE_KEYS.ALPHA_VANTAGE_FOREX}historical-${fromCurrency}-${toCurrency}-${outputSize}`;

      // Check cache first
      const cachedData = getCachedData(cacheKey, CACHE_DURATIONS.EXCHANGE_RATE);
      if (cachedData) {
        return { ...cachedData, source: 'cache' };
      }

      // Get API key
      const apiKey = AlphaVantageService.getApiKey();
      if (!apiKey) {
        console.warn('Alpha Vantage API key not found');
        return getFallbackHistoricalRates(fromCurrency, toCurrency);
      }

      // Make API request
      const response = await fetch(
        `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${fromCurrency}&to_symbol=${toCurrency}&outputsize=${outputSize}&apikey=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();

      // Check if API returned an error
      if (data['Error Message']) {
        throw new Error(`Alpha Vantage API error: ${data['Error Message']}`);
      }

      // Check if API returned rate limit error
      if (data.Note?.includes('API call frequency')) {
        console.warn('Alpha Vantage API rate limit reached');
        return getFallbackHistoricalRates(fromCurrency, toCurrency);
      }

      // Extract time series data
      const timeSeries = data['Time Series FX (Daily)'];
      if (!timeSeries) {
        throw new Error('No time series data found');
      }

      // Convert to arrays of dates and rates
      const dates: string[] = [];
      const rates: number[] = [];

      Object.entries(timeSeries).forEach(([date, values]: [string, any]) => {
        dates.push(date);
        rates.push(Number.parseFloat(values['4. close']));
      });

      // Sort by date (oldest to newest)
      const sortedIndices = dates.map((_, i) => i).sort((a, b) => {
        return new Date(dates[a]).getTime() - new Date(dates[b]).getTime();
      });

      const sortedDates = sortedIndices.map(i => dates[i]);
      const sortedRates = sortedIndices.map(i => rates[i]);

      const result = {
        dates: sortedDates,
        rates: sortedRates,
        source: 'api' as const
      };

      // Cache the result
      setCachedData(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error fetching historical exchange rates:', error);
      return getFallbackHistoricalRates(fromCurrency, toCurrency);
    }
  }
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
    try {
      const cacheKey = `${CACHE_KEYS.WORLD_BANK_INFLATION}all-${year || 'latest'}`;

      // Check cache first
      const cachedData = getCachedData(cacheKey, CACHE_DURATIONS.INFLATION_DATA);
      if (cachedData) {
        return { ...cachedData, source: 'cache' };
      }

      // Build URL
      let url = 'https://api.worldbank.org/v2/country/all/indicator/FP.CPI.TOTL.ZG?format=json&per_page=300';
      if (year) {
        url += `&date=${year}`;
      } else {
        // Get last 2 years of data to ensure we have recent data
        const currentYear = new Date().getFullYear();
        url += `&date=${currentYear-2}:${currentYear}`;
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

      const result = {
        countries,
        source: 'api' as const
      };

      // Cache the result
      setCachedData(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error fetching inflation data:', error);
      return getFallbackInflationData();
    }
  },

  /**
   * Get inflation data for a specific region
   * @param regionCode World Bank region code
   * @param year Year to get data for (defaults to most recent)
   * @returns Inflation data for countries in the region
   */
  getRegionalInflationData: async (
    regionCode: string,
    year?: number
  ) => {
    try {
      const cacheKey = `${CACHE_KEYS.WORLD_BANK_INFLATION}region-${regionCode}-${year || 'latest'}`;

      // Check cache first
      const cachedData = getCachedData(cacheKey, CACHE_DURATIONS.INFLATION_DATA);
      if (cachedData) {
        return { ...cachedData, source: 'cache' };
      }

      // Get all inflation data
      const allData = await WorldBankService.getInflationData(year);

      // Filter by region (using our mapping)
      const regionCountries = REGION_COUNTRY_MAPPING[regionCode] || [];
      const countries = allData.countries.filter((country: {
        country: string;
        countryCode: string;
        value: number;
        year: number;
      }) =>
        regionCountries.includes(country.countryCode)
      );

      const result = {
        countries,
        source: allData.source
      };

      // Cache the result
      setCachedData(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`Error fetching regional inflation data for ${regionCode}:`, error);
      return getFallbackRegionalInflationData(regionCode);
    }
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

// Fallback data for when API calls fail
const FALLBACK_EXCHANGE_RATES: Record<string, Record<string, number>> = {
  'USD': {
    'EUR': 0.92,
    'KES': 130,
    'COP': 4000,
    'PHP': 56,
    'GHS': 12.5,
    'BRL': 5.2
  },
  'EUR': {
    'USD': 1.09,
    'KES': 141,
    'COP': 4350,
    'PHP': 61,
    'GHS': 13.6,
    'BRL': 5.7
  }
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
function getFallbackExchangeRate(fromCurrency: string, toCurrency: string) {
  // Direct rate
  if (FALLBACK_EXCHANGE_RATES[fromCurrency]?.[toCurrency]) {
    return {
      rate: FALLBACK_EXCHANGE_RATES[fromCurrency][toCurrency],
      timestamp: new Date().toISOString(),
      source: 'fallback' as const
    };
  }

  // Inverse rate
  if (FALLBACK_EXCHANGE_RATES[toCurrency]?.[fromCurrency]) {
    return {
      rate: 1 / FALLBACK_EXCHANGE_RATES[toCurrency][fromCurrency],
      timestamp: new Date().toISOString(),
      source: 'fallback' as const
    };
  }

  // USD as intermediate (if neither direct nor inverse is available)
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const fromToUSD = FALLBACK_EXCHANGE_RATES.USD[fromCurrency]
      ? 1 / FALLBACK_EXCHANGE_RATES.USD[fromCurrency]
      : 1;
    const usdToTarget = FALLBACK_EXCHANGE_RATES.USD[toCurrency] || 1;

    return {
      rate: fromToUSD * usdToTarget,
      timestamp: new Date().toISOString(),
      source: 'fallback' as const
    };
  }

  // Default 1:1 if no data available
  return {
    rate: 1,
    timestamp: new Date().toISOString(),
    source: 'fallback' as const
  };
}

function getFallbackHistoricalRates(fromCurrency: string, toCurrency: string) {
  // Generate 30 days of mock data
  const dates: string[] = [];
  const rates: number[] = [];

  const baseRate = getFallbackExchangeRate(fromCurrency, toCurrency).rate;
  const today = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);

    // Add some random variation to the rate
    const randomFactor = 0.95 + Math.random() * 0.1;
    rates.push(baseRate * randomFactor);
  }

  return {
    dates,
    rates,
    source: 'fallback' as const
  };
}

function getFallbackInflationData() {
  return FALLBACK_INFLATION_DATA;
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
