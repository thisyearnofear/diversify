import { useState, useEffect } from 'react';
import { type GeographicRegion } from '../config';

interface CurrencyPerformance {
  symbol: string;
  name: string;
  region: GeographicRegion;
  values: number[];
  percentChange: number;
}

interface PerformanceData {
  dates: string[];
  currencies: CurrencyPerformance[];
  baseCurrency: string;
  source: 'api' | 'cache' | 'fallback' | 'unavailable';
}

// Currency metadata - currencies are tied to geographic regions
const CURRENCY_METADATA: Record<string, { name: string; region: GeographicRegion }> = {
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

export function useCurrencyPerformance(baseCurrency = 'USD', enabled = true) {
  const [data, setData] = useState<PerformanceData>({
    dates: [],
    currencies: [],
    baseCurrency,
    source: 'unavailable'
  });
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

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
              // The route owns the external provider request. Frankfurter
              // rejects browser-originated calls in production.
              const response = await fetch(
                `/api/exchange-rates?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(currency.symbol)}&historical=true`,
              );
              if (!response.ok) throw new Error(`Exchange-rate API error: ${response.status}`);
              const historicalData = await response.json();

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

        // Check if we got any real data (not unavailable/empty)
        const anyRealData = results.some(result =>
          result.historicalData && result.historicalData.source !== 'unavailable'
        );

        // If we have at least some real data, use it
        if (anyRealData) {
          // Get the dates from the first successful result
          const firstValidResult = results.find(r => r.historicalData && r.historicalData.dates && r.historicalData.dates.length > 0);
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
            const last30Rates = historicalData.rates ? historicalData.rates.slice(-30) : [];

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
            source: results.some((item) => item.historicalData?.source === 'unavailable')
              ? 'unavailable'
              : 'api'
          };

          setData(result);
        } else {
          // No real data available — return an honest empty state instead
          // of fabricating random values that look like market data.
          setData({
            dates: [],
            currencies: currencyData.map(c => ({ ...c, values: [], percentChange: 0 })),
            baseCurrency,
            source: 'unavailable'
          });
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error fetching currency performance:', err);
        setError(err.message || 'Failed to fetch currency performance data');

        // No data available — return an honest empty state instead
        // of fabricating random values that look like market data.
        setData({
          dates: [],
          currencies: TRACKED_CURRENCIES.map(symbol => ({
            symbol,
            name: CURRENCY_METADATA[symbol]?.name || symbol,
            region: CURRENCY_METADATA[symbol]?.region || 'USA',
            values: [],
            percentChange: 0
          })),
          baseCurrency,
          source: 'unavailable'
        });
        setIsLoading(false);
      }
    };

    fetchCurrencyPerformance();
  }, [baseCurrency, enabled]);

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
