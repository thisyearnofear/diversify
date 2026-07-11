/**
 * TinyFish Search Service
 *
 * Free web / news / research-paper search for the Guardian and the app.
 * Gives real-time, region-specific context (e.g. cedi/naira FX news, central-
 * bank moves, importer sentiment) that our static/keyed data sources don't
 * cover. Replaces the paid marketplace web-search/news services — see
 * docs/circle-marketplace-resale.md (free-first principle).
 *
 * Server-only, env-gated (TINYFISH_API_KEY). Results are cached briefly since
 * news/search is volatile. Never throws to callers — returns [] on failure so
 * a research pass degrades gracefully.
 *
 * API: GET https://api.search.tinyfish.ai?query=... with an `X-API-Key` header.
 */

import { unifiedCache } from '../utils/unified-cache-service';

const TINYFISH_SEARCH_BASE = 'https://api.search.tinyfish.ai';
const API_KEY = () => process.env.TINYFISH_API_KEY || '';

export type TinyFishDomainType = 'web' | 'news' | 'research_paper';

export interface TinyFishSearchOptions {
  /** web (default), news, or research_paper */
  domainType?: TinyFishDomainType;
  /** Restrict to results from the last N minutes (1–5,256,000). */
  recencyMinutes?: number;
  /** Geo targeting, e.g. 'GH', 'KE', 'US'. */
  location?: string;
  /** Language, e.g. 'en'. */
  language?: string;
  /** Free-text explanation of intent — improves result quality. */
  purpose?: string;
  /** 0-based page (max 10). */
  page?: number;
}

export interface TinyFishResult {
  position: number;
  title: string;
  snippet: string;
  url: string;
  siteName?: string;
  publisher?: string;
  date?: string;
}

export interface TinyFishSearchResponse {
  query: string;
  results: TinyFishResult[];
  totalResults: number;
  fromCache: boolean;
}

function isConfigured(): boolean {
  return typeof window === 'undefined' && !!API_KEY();
}

function cacheKeyFor(query: string, opts: TinyFishSearchOptions): string {
  return `tinyfish:${opts.domainType ?? 'web'}:${opts.location ?? ''}:${opts.recencyMinutes ?? ''}:${query.toLowerCase().trim()}`;
}

/**
 * Search the web / news / research papers. Returns [] (never throws) if the
 * key is missing or the request fails, so a Guardian research pass degrades.
 */
export async function tinyFishSearch(
  query: string,
  options: TinyFishSearchOptions = {},
): Promise<TinyFishSearchResponse> {
  const empty: TinyFishSearchResponse = { query, results: [], totalResults: 0, fromCache: false };
  if (!query.trim() || !isConfigured()) return empty;

  // News is more volatile than web; cache accordingly.
  const category = options.domainType === 'news' ? 'realtime' : 'volatile';

  try {
    const { data, fromCache } = await unifiedCache.getOrFetch<TinyFishSearchResponse>(
      cacheKeyFor(query, options),
      async () => {
        const params = new URLSearchParams({ query });
        if (options.domainType) params.set('domain_type', options.domainType);
        if (options.recencyMinutes) params.set('recency_minutes', String(options.recencyMinutes));
        if (options.location) params.set('location', options.location);
        if (options.language) params.set('language', options.language);
        if (options.purpose) params.set('purpose', options.purpose.slice(0, 2000));
        if (options.page != null) params.set('page', String(options.page));

        const res = await fetch(`${TINYFISH_SEARCH_BASE}?${params.toString()}`, {
          headers: { 'X-API-Key': API_KEY() },
        });
        if (!res.ok) {
          throw new Error(`TinyFish search ${res.status}`);
        }
        const body = (await res.json()) as {
          query?: string;
          results?: Array<Record<string, any>>;
          total_results?: number;
        };
        const results: TinyFishResult[] = (body.results ?? []).map((r) => ({
          position: r.position,
          title: r.title ?? '',
          snippet: r.snippet ?? '',
          url: r.url ?? '',
          siteName: r.site_name,
          publisher: r.publisher,
          date: r.date,
        }));
        return {
          data: { query, results, totalResults: body.total_results ?? results.length, fromCache: false },
          source: 'tinyfish',
        };
      },
      category,
    );
    return { ...data, fromCache };
  } catch (err) {
    console.warn('[TinyFish] search failed:', err instanceof Error ? err.message : err);
    return empty;
  }
}

export const tinyFishSearchService = {
  isConfigured,
  search: tinyFishSearch,
};
