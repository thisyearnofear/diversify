/**
 * Emerging Markets Stock Price Tracking
 * Free API options for real-time price data
 */

// ============================================================================
// OPTION 1: Alpha Vantage (Recommended)
// ============================================================================
// Free tier: 25 requests/day, 5 requests/minute
// Coverage: Global exchanges including Nairobi, Lagos, JSE, B3, BMV, NSE, PSE

const ALPHA_VANTAGE_CONFIG = {
  baseUrl: 'https://www.alphavantage.co/query',
  apiKey: process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY, // Get free at alphavantage.co
  function: 'GLOBAL_QUOTE',
  
  // Emerging market ticker mappings
  tickers: {
    SAFCOM: 'SCOM.NR',    // Nairobi Securities Exchange
    DANGOTE: 'DANGCEM.LG', // Lagos Stock Exchange  
    SHOPRITE: 'SHP.JO',    // Johannesburg Stock Exchange
    PETROBRAS: 'PETR4.SA', // B3 (Brazil)
    MELI: 'MELI',          // NASDAQ (also trades in LatAm)
    CEMEX: 'CEMEXCPO.MX',  // Mexican Stock Exchange
    RELIANCE: 'RELIANCE.NS', // NSE India
    GRAB: 'GRAB',          // NASDAQ
    JOLLIBEE: 'JFC.PS',    // Philippine Stock Exchange
  },
};

async function getAlphaVantagePrice(symbol: string): Promise<number | null> {
  const ticker = ALPHA_VANTAGE_CONFIG.tickers[symbol];
  if (!ticker) return null;

  const url = `${ALPHA_VANTAGE_CONFIG.baseUrl}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_CONFIG.apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    const quote = data['Global Quote'];
    
    if (quote && quote['05. price']) {
      return parseFloat(quote['05. price']);
    }
    return null;
  } catch (error) {
    console.error(`Alpha Vantage error for ${symbol}:`, error);
    return null;
  }
}

// ============================================================================
// OPTION 2: Financial Modeling Prep (Better Free Tier)
// ============================================================================
// Free tier: 250 requests/day, no rate limit
// Coverage: 20+ exchanges globally

const FMP_CONFIG = {
  baseUrl: 'https://financialmodelingprep.com/api/v3',
  apiKey: process.env.NEXT_PUBLIC_FMP_KEY, // Get free at financialmodelingprep.com
  
  tickers: {
    SAFCOM: 'SCOM.NR',
    DANGOTE: 'DANGCEM.LG',
    SHOPRITE: 'SHP.JO',
    PETROBRAS: 'PETR4.SA',
    MELI: 'MELI',
    CEMEX: 'CEMEXCPO.MX',
    RELIANCE: 'RELIANCE.NS',
    GRAB: 'GRAB',
    JOLLIBEE: 'JFC.PS',
  },
};

async function getFMPPrice(symbol: string): Promise<number | null> {
  const ticker = FMP_CONFIG.tickers[symbol];
  if (!ticker) return null;

  const url = `${FMP_CONFIG.baseUrl}/quote/${ticker}?apikey=${FMP_CONFIG.apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.length > 0 && data[0].price) {
      return data[0].price;
    }
    return null;
  } catch (error) {
    console.error(`FMP error for ${symbol}:`, error);
    return null;
  }
}

// ============================================================================
// OPTION 3: Yahoo Finance via Proxy (Unofficial but Reliable)
// ============================================================================
// Free, no API key needed
// Use rapidapi.com or build your own proxy

const YAHOO_CONFIG = {
  baseUrl: 'https://query1.finance.yahoo.com/v8/finance/chart',
  
  tickers: {
    SAFCOM: 'SCOM.NR',
    DANGOTE: 'DANGCEM.LG',
    SHOPRITE: 'SHP.JO',
    PETROBRAS: 'PETR4.SA',
    MELI: 'MELI',
    CEMEX: 'CEMEXCPO.MX',
    RELIANCE: 'RELIANCE.NS',
    GRAB: 'GRAB',
    JOLLIBEE: 'JFC.PS',
  },
};

async function getYahooPrice(symbol: string): Promise<number | null> {
  const ticker = YAHOO_CONFIG.tickers[symbol];
  if (!ticker) return null;

  const url = `${YAHOO_CONFIG.baseUrl}/${ticker}?range=1d&interval=1d`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (result && result.meta && result.meta.regularMarketPrice) {
      return result.meta.regularMarketPrice;
    }
    return null;
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error);
    return null;
  }
}

// ============================================================================
// OPTION 4: Twelve Data (Best for Emerging Markets)
// ============================================================================
// Free tier: 800 requests/day, 8 requests/minute
// Excellent emerging markets coverage

const TWELVE_DATA_CONFIG = {
  baseUrl: 'https://api.twelvedata.com/price',
  apiKey: process.env.NEXT_PUBLIC_TWELVE_DATA_KEY, // Get free at twelvedata.com
  
  tickers: {
    SAFCOM: 'SCOM:NR',
    DANGOTE: 'DANGCEM:LG',
    SHOPRITE: 'SHP:JSE',
    PETROBRAS: 'PETR4:BVMF',
    MELI: 'MELI:NASDAQ',
    CEMEX: 'CEMEXCPO:BMV',
    RELIANCE: 'RELIANCE:NSE',
    GRAB: 'GRAB:NASDAQ',
    JOLLIBEE: 'JFC:PSE',
  },
};

async function getTwelveDataPrice(symbol: string): Promise<number | null> {
  const ticker = TWELVE_DATA_CONFIG.tickers[symbol];
  if (!ticker) return null;

  const url = `${TWELVE_DATA_CONFIG.baseUrl}?symbol=${ticker}&apikey=${TWELVE_DATA_CONFIG.apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.price) {
      return parseFloat(data.price);
    }
    return null;
  } catch (error) {
    console.error(`Twelve Data error for ${symbol}:`, error);
    return null;
  }
}

// ============================================================================
// RECOMMENDED: Multi-Provider Fallback Strategy
// ============================================================================
// Try multiple providers in order of reliability/cost

const PROVIDERS = [
  { name: 'FMP', fn: getFMPPrice, priority: 1 },      // Best free tier
  { name: 'TwelveData', fn: getTwelveDataPrice, priority: 2 }, // Best EM coverage
  { name: 'AlphaVantage', fn: getAlphaVantagePrice, priority: 3 }, // Reliable
  { name: 'Yahoo', fn: getYahooPrice, priority: 4 },   // Fallback
];

export async function getEmergingMarketStockPrice(symbol: string): Promise<number | null> {
  // Try providers in priority order
  for (const provider of PROVIDERS) {
    try {
      const price = await provider.fn(symbol);
      if (price !== null && price > 0) {
        console.log(`[Price Service] Got ${symbol} price from ${provider.name}: $${price}`);
        return price;
      }
    } catch (error) {
      console.warn(`[Price Service] ${provider.name} failed for ${symbol}`);
    }
  }
  
  // All providers failed - return cached/fallback price
  console.error(`[Price Service] All providers failed for ${symbol}`);
  return getFallbackPrice(symbol);
}

// Fallback prices (last known or estimated)
const FALLBACK_PRICES: Record<string, number> = {
  SAFCOM: 0.85,      // Kenyan Shilling ~$0.0064, stock ~132 KES
  DANGOTE: 2.45,     // Nigerian Naira ~$0.0006, stock ~4000 NGN
  SHOPRITE: 12.50,   // South African Rand ~$0.055, stock ~227 ZAR
  PETROBRAS: 28.00,  // Brazilian Real ~$0.20, stock ~140 BRL
  MELI: 185.00,      // USD (NASDAQ)
  CEMEX: 8.50,       // Mexican Peso ~$0.05, stock ~170 MXN
  RELIANCE: 32.00,   // Indian Rupee ~$0.012, stock ~2700 INR
  GRAB: 4.20,        // USD (NASDAQ)
  JOLLIBEE: 18.00,   // Philippine Peso ~$0.018, stock ~1000 PHP
};

function getFallbackPrice(symbol: string): number | null {
  return FALLBACK_PRICES[symbol] || null;
}

// ============================================================================
// Batch Fetching (Optimize API Calls)
// ============================================================================
// Fetch all prices in parallel, cache results

const PRICE_CACHE = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 1 minute cache

export async function getAllEmergingMarketPrices(): Promise<Record<string, number | null>> {
  const symbols = Object.keys(FALLBACK_PRICES);
  const results: Record<string, number | null> = {};
  
  // Check cache first
  const now = Date.now();
  const cachedPrices: Record<string, number> = {};
  const uncachedSymbols: string[] = [];
  
  symbols.forEach(symbol => {
    const cached = PRICE_CACHE.get(symbol);
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      cachedPrices[symbol] = cached.price;
    } else {
      uncachedSymbols.push(symbol);
    }
  });
  
  // Fetch uncached prices in parallel
  if (uncachedSymbols.length > 0) {
    const fetchPromises = uncachedSymbols.map(async (symbol) => {
      const price = await getEmergingMarketStockPrice(symbol);
      if (price !== null) {
        PRICE_CACHE.set(symbol, { price, timestamp: now });
        results[symbol] = price;
      } else {
        results[symbol] = cachedPrices[symbol] || FALLBACK_PRICES[symbol] || null;
      }
    });
    
    await Promise.all(fetchPromises);
  }
  
  // Merge cached and new results
  return { ...cachedPrices, ...results };
}

// ============================================================================
// React Hook for Price Tracking
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useEmergingMarketPrices() {
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      const allPrices = await getAllEmergingMarketPrices();
      setPrices(allPrices);
      setError(null);
    } catch (err) {
      setError('Failed to fetch prices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    
    // Refresh every minute
    const interval = setInterval(fetchPrices, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return { prices, loading, error, refresh: fetchPrices };
}

// ============================================================================
// Usage Example in TradeTab.tsx
// ============================================================================

/*
import { useEmergingMarketPrices } from '../utils/emerging-markets-prices';

function TradeTab() {
  const { prices, loading, error } = useEmergingMarketPrices();
  
  // Display in UI
  const liveRates = {
    ...existingRates,
    SAFCOM: prices.SAFCOM ? `$${prices.SAFCOM.toFixed(2)}` : '—',
    DANGOTE: prices.DANGOTE ? `$${prices.DANGOTE.toFixed(2)}` : '—',
    // ... etc
  };
  
  return (
    <div>
      {loading && <div>Loading live prices...</div>}
      {error && <div>Price feed unavailable</div>}
      
      <StockTicker rates={liveRates} />
      <TradeWidget />
    </div>
  );
}
*/
