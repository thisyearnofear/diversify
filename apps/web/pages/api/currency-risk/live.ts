/**
 * API Route: Live Currency Depreciation
 *
 * Returns live 1yr/3yr/5yr depreciation for a currency against USD,
 * computed from the fawazahmed0 open dataset. Falls back to null for
 * horizons the dataset doesn't cover (3yr/5yr need pre-2024 data).
 *
 * The client merges this with the curated static dataset in
 * constants/currency-risk.ts to show the most accurate available number.
 *
 * GET /api/currency-risk/live?currency=KES
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiveDepreciation } from '../../../../../packages/shared/src/services/fx-rate.service';

// Simple per-process cache: currency → { data, expiry }
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { currency } = req.query;
  if (!currency || typeof currency !== 'string') {
    return res.status(400).json({ error: 'Missing "currency" parameter' });
  }

  const code = currency.toUpperCase();

  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=43200');

  // Check cache
  const cached = cache.get(code);
  if (cached && cached.expiry > Date.now()) {
    return res.status(200).json(cached.data);
  }

  try {
    const result = await getLiveDepreciation(code);
    if (!result) {
      return res.status(200).json({
        currency: code,
        depreciation: null,
        source: 'fawazahmed0',
        note: 'No live data available for this currency. Using curated historical data.',
      });
    }

    const response = {
      currency: code,
      depreciation: result,
      source: 'fawazahmed0' as const,
      note:
        result['3yr'] == null
          ? '1yr computed from live data. 3yr/5yr use curated historical data (live dataset starts 2024-03-02).'
          : 'All horizons computed from live data.',
    };

    // Cache for 6 hours
    cache.set(code, { data: response, expiry: Date.now() + CACHE_TTL_MS });

    return res.status(200).json(response);
  } catch (error) {
    console.error(`[currency-risk/live] Error for ${code}:`, error);
    return res.status(200).json({
      currency: code,
      depreciation: null,
      source: 'fawazahmed0',
      note: 'Live data temporarily unavailable. Using curated historical data.',
    });
  }
}
