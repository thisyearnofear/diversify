import { useState, useEffect } from 'react';
import type { Region } from './use-user-region';
import { AlphaVantageService } from '../utils/api-services';

interface CurrencyPerformance {
  symbol: string;
  name: string;
  region: Region;
  values: number[];
  percentChange: number;
}

interface PerformanceData {
  dates: string[];
  currencies: CurrencyPerformance[];
  baseCurrency: string;
  source: 'api' | 'cache' | 'fallback';
}

// Currency metadata
const CURRENCY_METADATA: Record<string, { name: string; region: Region }> = {
  'USD': { name: 'US Dollar', region: 'USA' },
  'EUR': { name: 'Euro', region: 'Europe' },
  'KES': { name: 'Kenyan Shilling', region: 'Africa' },
  'COP': { name: 'Colombian Peso', region: 'LatAm' },
  'PHP': { name: 'Philippine Peso', region: 'Asia' },
  'GHS': { name: 'Ghanaian Cedi', region: 'Africa' },
  'BRL': { name: 'Brazilian Real', region: 'LatAm' }
};

// Currencies to track (in addition to base currency)
const TRACKED_CURRENCIES = ['EUR', 'KES', 'COP', 'PHP', 'BRL'];

export function useCurrencyPerformance(baseCurrency = 'USD') {
  const [data, setData] = useState<PerformanceData>({
    dates: [],
    currencies: [],
    baseCurrency,
    source: 'fallback'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrencyPerformance = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Prepare currencies to fetch (base currency + tracked currencies)
        const currenciesToFetch = [baseCurrency, ...TRACKED_CURRENCIES.filter(c => c !== baseCurrency)];

        // Prepare data structure for currencies
        const currencyData: CurrencyPerformance[] = currenciesToFetch.map(symbol => ({
          symbol,
          name: CURRENCY_METADATA[symbol]?.name || symbol,
          region: CURRENCY_METADATA[symbol]?.region || 'USA',
          values: [],
          percentChange: 0
        }));

        // Fetch historical data for each currency pair
        const fetchPromises = currencyData
          .filter(currency => currency.symbol !== baseCurrency) // Skip base currency
          .map(async (currency) => {
            try {
              // Get historical exchange rates
              const historicalData = await AlphaVantageService.getHistoricalExchangeRates(
                baseCurrency,
                currency.symbol
              );

              return {
                symbol: currency.symbol,
                historicalData
              };
            } catch (error) {
              console.error(`Error fetching data for ${currency.symbol}:`, error);
              return {
                symbol: currency.symbol,
                historicalData: null
              };
            }
          });

        // Wait for all fetches to complete
        const results = await Promise.all(fetchPromises);

        // Check if we got any real data
        const anyRealData = results.some(result =>
          result.historicalData && result.historicalData.source !== 'fallback'
        );

        // If we have at least some real data, use it
        if (anyRealData) {
          // Get the dates from the first successful result
          const firstValidResult = results.find(r => r.historicalData && r.historicalData.dates.length > 0);
          const dates = firstValidResult?.historicalData?.dates || [];

          // Limit to last 30 days
          const last30Dates = dates.slice(-30);

          // Process each currency
          results.forEach(result => {
            const { symbol, historicalData } = result;
            if (!historicalData) return;

            const currencyIndex = currencyData.findIndex(c => c.symbol === symbol);
            if (currencyIndex === -1) return;

            // Get the rates for the last 30 days
            const last30Rates = historicalData.rates.slice(-30);

            // Convert to "value of 1 base currency worth of this currency over time"
            const values = last30Rates.map((rate: number) => 1 / rate);

            // Calculate percent change
            const percentChange = values.length >= 2
              ? ((values[values.length - 1] - values[0]) / values[0]) * 100
              : 0;

            // Update currency data
            currencyData[currencyIndex].values = values;
            currencyData[currencyIndex].percentChange = percentChange;
          });

          // Add base currency (always 1.0)
          const baseCurrencyIndex = currencyData.findIndex(c => c.symbol === baseCurrency);
          if (baseCurrencyIndex !== -1) {
            currencyData[baseCurrencyIndex].values = last30Dates.map(() => 1);
            currencyData[baseCurrencyIndex].percentChange = 0;
          }

          // Create result
          const result: PerformanceData = {
            dates: last30Dates,
            currencies: currencyData,
            baseCurrency,
            source: 'api'
          };

          setData(result);
        } else {
          // Use fallback data
          const fallbackData = generateFallbackData(baseCurrency, currencyData);
          setData(fallbackData);
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error fetching currency performance:', err);
        setError(err.message || 'Failed to fetch currency performance data');

        // Use fallback data
        const fallbackData = generateFallbackData(baseCurrency,
          TRACKED_CURRENCIES.map(symbol => ({
            symbol,
            name: CURRENCY_METADATA[symbol]?.name || symbol,
            region: CURRENCY_METADATA[symbol]?.region || 'USA',
            values: [],
            percentChange: 0
          }))
        );
        setData(fallbackData);
        setIsLoading(false);
      }
    };

    fetchCurrencyPerformance();
  }, [baseCurrency]);

  // Generate fallback data when API fails
  const generateFallbackData = (
    baseCurrency: string,
    currencyData: CurrencyPerformance[]
  ): PerformanceData => {
    // Generate dates for the last 30 days
    const today = new Date();
    const dates: string[] = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Base values (approximately realistic as of 2023)
    const baseValues: Record<string, number> = {
      'USD': 1,
      'EUR': 0.92,
      'KES': 130,
      'COP': 4000,
      'PHP': 56,
      'GHS': 12.5,
      'BRL': 5.2
    };

    // Trends (annual % change, both up and down)
    const trends: Record<string, number> = {
      'USD': 0,  // Base currency
      'EUR': 2.5,  // Euro strengthening against USD
      'KES': -5,   // KES weakening against USD
      'COP': -3,   // COP weakening against USD
      'PHP': 1.5,  // PHP strengthening against USD
      'GHS': -8,   // GHS weakening against USD
      'BRL': -2    // BRL weakening against USD
    };

    // Volatility (daily random fluctuation %)
    const volatility: Record<string, number> = {
      'USD': 0,    // Base currency
      'EUR': 0.2,  // Low volatility
      'KES': 0.5,  // Higher volatility
      'COP': 0.4,  // Medium-high volatility
      'PHP': 0.3,  // Medium volatility
      'GHS': 0.6,  // High volatility
      'BRL': 0.4   // Medium-high volatility
    };

    // Generate values for each currency
    currencyData.forEach(currency => {
      const values: number[] = [];

      // If this is the base currency, all values are 1
      if (currency.symbol === baseCurrency) {
        values.push(...dates.map(() => 1));
        currency.values = values;
        currency.percentChange = 0;
        return;
      }

      // For other currencies, generate realistic values
      const baseValue = baseValues[currency.symbol] || 1;
      const annualTrend = trends[currency.symbol] || 0;
      const dailyVolatility = volatility[currency.symbol] || 0.3;

      // Calculate daily trend factor (compounded)
      const dailyTrendFactor = Math.pow(1 + annualTrend / 100, 1/365);

      for (let i = 0; i < dates.length; i++) {
        // Apply trend and random volatility
        const daysFactor = Math.pow(dailyTrendFactor, i);
        const randomFactor = 1 + (Math.random() * 2 - 1) * dailyVolatility / 100;

        // Calculate exchange rate
        const exchangeRate = baseValue * daysFactor * randomFactor;

        // Convert to "value of 1 base currency worth of this currency over time"
        values.push(1 / exchangeRate);
      }

      // Calculate percent change (last 30 days)
      const percentChange = ((values[values.length - 1] - values[0]) / values[0]) * 100;

      currency.values = values;
      currency.percentChange = percentChange;
    });

    return {
      dates,
      currencies: currencyData,
      baseCurrency,
      source: 'fallback'
    };
  };

  // Calculate the value of $1 invested in each currency over time
  const calculateDollarPerformance = () => {
    if (!data.currencies.length) return [];

    return data.currencies.map(currency => {
      // Start with $1 worth of each currency
      const initialValue = 1;

      // Calculate the current value based on exchange rate changes
      const currentValue = initialValue * (1 + currency.percentChange / 100);

      return {
        symbol: currency.symbol,
        name: currency.name,
        region: currency.region,
        initialValue,
        currentValue,
        percentChange: currency.percentChange,
        source: data.source
      };
    });
  };

  return {
    data,
    isLoading,
    error,
    calculateDollarPerformance
  };
}
