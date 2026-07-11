/**
 * GET/POST /api/agent/web-search — free web/news/research search via TinyFish.
 *
 * Gives the app and Guardian real-time, region-specific context (FX news,
 * central-bank moves, importer sentiment). Server-side so the TinyFish key
 * never reaches the client. Returns { results } — [] when unconfigured.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { tinyFishSearch, type TinyFishDomainType } from '@diversifi/shared/src/services/tinyfish-search.service';

const ALLOWED_DOMAINS: TinyFishDomainType[] = ['web', 'news', 'research_paper'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const src = req.method === 'POST' ? req.body : req.query;
  const query = typeof src?.query === 'string' ? src.query : '';
  if (!query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  if (!process.env.TINYFISH_API_KEY) {
    return res.status(503).json({ error: 'Web search not configured (TINYFISH_API_KEY)' });
  }

  const domainType = ALLOWED_DOMAINS.includes(src?.domainType) ? (src.domainType as TinyFishDomainType) : undefined;
  const recencyMinutes = src?.recencyMinutes ? Number(src.recencyMinutes) : undefined;

  try {
    const result = await tinyFishSearch(query.slice(0, 400), {
      domainType,
      recencyMinutes: Number.isFinite(recencyMinutes) ? recencyMinutes : undefined,
      location: typeof src?.location === 'string' ? src.location : undefined,
      purpose: typeof src?.purpose === 'string' ? src.purpose : undefined,
    });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ query: result.query, results: result.results, totalResults: result.totalResults });
  } catch (err) {
    console.error('[api/agent/web-search] failed:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Web search failed' });
  }
}
