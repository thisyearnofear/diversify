/**
 * GET /api/agent/currency-news?code=NGN — cited recent news for one curated
 * currency, via Tavily. Public and read-only (no wallet, no memory). Takes
 * only a currency code; the query is derived server-side. Returns
 * `{ items: [] }` when Tavily is unconfigured or has nothing — never a
 * fallback sentence.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { tavilySearch, tavilySearchService } from '@diversifi/shared/src/services/tavily-search.service';
import { currencyNewsQuery, toCurrencyNewsItems } from '../../../lib/currency-news';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Generous per-IP: a venue or office shares one address. Upstream cost is
  // already bounded — the query comes from a finite code set and Tavily
  // results are cached — so this limit only guards against floods.
  const rl = rateLimit(`currency-news:${getClientIp(req)}`, 120, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const query = currencyNewsQuery(code);
  if (!query) return res.status(400).json({ error: 'Unknown currency code' });

  if (!tavilySearchService.isConfigured()) {
    return res.status(200).json({ code: code.toUpperCase(), provider: null, items: [] });
  }

  const result = await tavilySearch(query, { topic: 'news', timeRange: 'month', maxResults: 6 });
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
  return res.status(200).json({
    code: code.toUpperCase(),
    provider: 'tavily',
    items: toCurrencyNewsItems(result.results),
  });
}
