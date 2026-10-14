/**
 * GET/POST /api/agent/web-search — cited web/news search.
 *
 * Gives the app and Guardian real-time, region-specific context (FX news,
 * central-bank moves, importer sentiment). Tavily is preferred when
 * TAVILY_API_KEY is set; TinyFish is the fallback. Server-side so provider
 * keys never reach the client. The response names its `provider` and
 * always carries one shape: { title, url, snippet, source, date }.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { tinyFishSearch, type TinyFishDomainType } from '@diversifi/shared/src/services/tinyfish-search.service';
import { tavilySearch, tavilySearchService } from '@diversifi/shared/src/services/tavily-search.service';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

const ALLOWED_DOMAINS: TinyFishDomainType[] = ['web', 'news', 'research_paper'];
// TinyFish is free but quota-limited; per-IP throttle so one caller can't burn
// the shared search quota (and can't use us as an open search proxy).
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute

function recencyToTimeRange(minutes: number): 'day' | 'week' | 'month' | 'year' {
  if (minutes <= 1440) return 'day';
  if (minutes <= 10080) return 'week';
  if (minutes <= 44640) return 'month';
  return 'year';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rl = rateLimit(`web-search:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

  const src = req.method === 'POST' ? req.body : req.query;
  const query = typeof src?.query === 'string' ? src.query : '';
  if (!query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  const useTavily = tavilySearchService.isConfigured();
  if (!useTavily && !process.env.TINYFISH_API_KEY) {
    return res.status(503).json({ error: 'Web search not configured (TAVILY_API_KEY or TINYFISH_API_KEY)' });
  }

  const domainType = ALLOWED_DOMAINS.includes(src?.domainType) ? (src.domainType as TinyFishDomainType) : undefined;
  const recencyMinutes = src?.recencyMinutes ? Number(src.recencyMinutes) : undefined;

  try {
    if (useTavily) {
      const result = await tavilySearch(query.slice(0, 400), {
        topic: domainType === 'news' ? 'news' : 'general',
        timeRange: recencyMinutes ? recencyToTimeRange(recencyMinutes) : undefined,
      });
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).json({
        provider: 'tavily',
        query: result.query,
        results: result.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.source,
          date: r.publishedDate ?? null,
        })),
        totalResults: result.results.length,
      });
    }
    const result = await tinyFishSearch(query.slice(0, 400), {
      domainType,
      recencyMinutes: Number.isFinite(recencyMinutes) ? recencyMinutes : undefined,
      location: typeof src?.location === 'string' ? src.location : undefined,
      purpose: typeof src?.purpose === 'string' ? src.purpose : undefined,
    });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res
      .status(200)
      .json({
        provider: 'tinyfish',
        query: result.query,
        results: result.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.publisher ?? r.siteName ?? '',
          date: r.date ?? null,
        })),
        totalResults: result.totalResults,
      });
  } catch (err) {
    console.error('[api/agent/web-search] failed:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Web search failed' });
  }
}
