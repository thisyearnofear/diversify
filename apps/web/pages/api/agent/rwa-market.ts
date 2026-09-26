import type { NextApiRequest, NextApiResponse } from 'next';
import {
  fetchRwaMarket,
  type RwaMarket,
} from '@diversifi/shared/src/services/rwa-market-service';

/**
 * GET /api/agent/rwa-market — live figures for Shield's tokenized-asset
 * sleeve (USDY / syrupUSDC APY, PAXG price). Public, read-only, no keys.
 *
 * Cached 10 minutes in memory and at the CDN: the DeFiLlama pools payload
 * is large, and these rates move slowly. A figure a provider couldn't
 * supply is `null` — never a stored default.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
let cached: { market: RwaMarket; at: number } | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!cached || Date.now() - cached.at > CACHE_TTL_MS) {
    const market = await fetchRwaMarket();
    const anyLive = Object.values(market).some(Boolean);
    // Keep the last good snapshot when every provider failed this round —
    // its capturedAt still tells the truth about its age.
    if (anyLive || !cached) cached = { market, at: Date.now() };
  }

  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
  return res.status(200).json({ market: cached.market });
}
