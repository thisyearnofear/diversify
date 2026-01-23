/**
 * API Route: Exchange Rate Data Proxy
 * Fetches from Frankfurter (primary) → fallback for unsupported currencies
 * Handles CORS by making server-side requests
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const FRANKFURTER_URL = 'https://api.frankfurter.app';

// Currencies supported by Frankfurter (ECB-based)
const FRANKFURTER_SUPPORTED = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY', 'BRL', 'MXN', 'SGD', 'HKD', 'KRW', 'CNY', 'INR', 'IDR', 'THB', 'MYR', 'PHP', 'ILS', 'ZAR'];

// Fallback rates for unsupported currencies
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  'USD': {
    'KES': 130,
    'COP': 4000,
    'GHS': 12.5
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { from = 'USD', to, historical } = req.query;
  
  if (!to) {
    return res.status(400).json({ error: 'Missing "to" currency parameter' });
  }

  const fromCurrency = from as string;
  const toCurrency = to as string;

  try {
    // Check if both currencies are supported by Frankfurter
    const fromSupported = FRANKFURTER_SUPPORTED.includes(fromCurrency);
    const toSupported = FRANKFURTER_SUPPORTED.includes(toCurrency);

    if (fromSupported && toSupported) {
      // Use Frankfurter API
      const frankfurterData = historical 
        ? await fetchHistoricalFromFrankfurter(fromCurrency, toCurrency)
        : await fetchCurrentFromFrankfurter(fromCurrency, toCurrency);
      
      if (frankfurterData) {
        console.log(`[Exchange Rate API] Frankfurter returned data for ${fromCurrency}-${toCurrency}`);
        return res.status(200).json(frankfurterData);
      }
    }

    // Fallback to static rates
    console.log(`[Exchange Rate API] Using fallback for ${fromCurrency}-${toCurrency}`);
    const fallbackData = getFallbackRate(fromCurrency, toCurrency, historical === 'true');
    return res.status(200).json(fallbackData);

  } catch (error) {
    console.error('[Exchange Rate API] Error:', error);
    
    // Return fallback data on error
    const fallbackData = getFallbackRate(fromCurrency, toCurrency, historical === 'true');
    return res.status(200).json(fallbackData);
  }
}

async function fetchCurrentFromFrankfurter(from: string, to: string) {
  const response = await fetch(
    `${FRANKFURTER_URL}/latest?from=${from}&to=${to}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) {
    throw new Error(`Frankfurter API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.rates || !data.rates[to]) {
    throw new Error('No exchange rate data found');
  }

  return {
    rate: data.rates[to],
    date: data.date,
    source: 'frankfurter',
    from,
    to
  };
}

async function fetchHistoricalFromFrankfurter(from: string, to: string) {
  // Get last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const response = await fetch(
    `${FRANKFURTER_URL}/${startDateStr}..${endDateStr}?from=${from}&to=${to}`,
    { signal: AbortSignal.timeout(10000) }
  );

  if (!response.ok) {
    throw new Error(`Frankfurter historical API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.rates) {
    throw new Error('No historical data found');
  }

  // Convert to arrays
  const dates = Object.keys(data.rates).sort();
  const rates = dates.map(date => data.rates[date][to]);

  return {
    dates,
    rates,
    source: 'frankfurter',
    from,
    to
  };
}

function getFallbackRate(from: string, to: string, historical: boolean) {
  // Direct rate
  let rate = FALLBACK_RATES[from]?.[to];
  
  // Inverse rate
  if (!rate && FALLBACK_RATES[to]?.[from]) {
    rate = 1 / FALLBACK_RATES[to][from];
  }
  
  // Default to 1 if no data
  if (!rate) {
    rate = 1;
  }

  if (historical) {
    // Generate 30 days of mock historical data
    const dates: string[] = [];
    const rates: number[] = [];
    const today = new Date();

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
      
      // Add small random variation
      const variation = 0.95 + Math.random() * 0.1;
      rates.push(rate * variation);
    }

    return {
      dates,
      rates,
      source: 'fallback',
      from,
      to
    };
  }

  return {
    rate,
    date: new Date().toISOString().split('T')[0],
    source: 'fallback',
    from,
    to
  };
}
