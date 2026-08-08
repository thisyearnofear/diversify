/**
 * API Route: Exchange Rate Data Proxy
 *
 * Uses the fawazahmed0 open currency dataset (primary) which covers 200+
 * currencies including KES, GHS, NGN — currencies Frankfurter (ECB) does
 * not support. Falls back to Frankfurter for major pairs if the primary
 * dataset is unreachable.
 *
 * Handles CORS by making server-side requests.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiveRate, getLiveHistoricalRates } from '../../../../../packages/shared/src/services/fx-rate.service';

const FRANKFURTER_URL = 'https://api.frankfurter.app';

// Currencies supported by Frankfurter (ECB-based) — used as secondary source
const FRANKFURTER_SUPPORTED = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY', 'BRL', 'MXN', 'SGD', 'HKD', 'KRW', 'CNY', 'INR', 'IDR', 'THB', 'MYR', 'PHP', 'ILS', 'ZAR'];

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

  const fromCurrency = (from as string).toUpperCase();
  const toCurrency = (to as string).toUpperCase();
  const isHistorical = historical === 'true';

  res.setHeader(
    'Cache-Control',
    isHistorical
      ? 'public, s-maxage=3600, stale-while-revalidate=86400'
      : 'public, s-maxage=300, stale-while-revalidate=900',
  );

  // ── Primary: fawazahmed0 dataset (200+ currencies) ──────────────────
  try {
    if (isHistorical) {
      const result = await getLiveHistoricalRates(fromCurrency, toCurrency, 30);
      if (result) {
        return res.status(200).json({
          dates: result.dates,
          rates: result.rates,
          source: result.source,
          from: fromCurrency,
          to: toCurrency,
        });
      }
    } else {
      const result = await getLiveRate(fromCurrency, toCurrency);
      if (result) {
        return res.status(200).json({
          rate: result.rate,
          date: result.date,
          source: result.source,
          from: fromCurrency,
          to: toCurrency,
        });
      }
    }
  } catch (error) {
    console.warn(`[Exchange Rate API] fawazahmed0 failed for ${fromCurrency}-${toCurrency}:`, error instanceof Error ? error.message : error);
  }

  // ── Secondary: Frankfurter (major pairs only) ───────────────────────
  const fromSupported = FRANKFURTER_SUPPORTED.includes(fromCurrency);
  const toSupported = FRANKFURTER_SUPPORTED.includes(toCurrency);

  if (fromSupported && toSupported) {
    try {
      const frankfurterData = isHistorical
        ? await fetchHistoricalFromFrankfurter(fromCurrency, toCurrency)
        : await fetchCurrentFromFrankfurter(fromCurrency, toCurrency);

      if (frankfurterData) {
        return res.status(200).json(frankfurterData);
      }
    } catch (error) {
      console.warn(`[Exchange Rate API] Frankfurter failed for ${fromCurrency}-${toCurrency}:`, error instanceof Error ? error.message : error);
    }
  }

  // ── No data available — return honest empty response ───────────────
  // Previously this returned hardcoded static rates (KES: 130, GHS: 12.5)
  // that looked like live data. Now we return a transparent "unavailable"
  // state so the UI can show an honest message instead of fake numbers.
  if (isHistorical) {
    return res.status(200).json({
      dates: [],
      rates: [],
      source: 'unavailable',
      from: fromCurrency,
      to: toCurrency,
    });
  }

  return res.status(200).json({
    rate: null,
    date: new Date().toISOString().slice(0, 10),
    source: 'unavailable',
    from: fromCurrency,
    to: toCurrency,
  });
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


