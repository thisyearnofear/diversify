/**
 * Tavily Search Service
 *
 * Cited web / news search for the Guardian's explanations and the walletless
 * currency-research flow. Every result carries its url and (when Tavily knows
 * it) its publication date, so surfaces can render dated, cited beats and
 * never an uncited claim.
 *
 * Server-only, env-gated (TAVILY_API_KEY). Never throws to callers — returns
 * an empty response on failure so a research pass degrades to "nothing to
 * show", never to invented text.
 *
 * API: POST https://api.tavily.com/search with `Authorization: Bearer <key>`.
 * SandBase fallback route: POST {SANDBASE_BASE_URL}/v1/api/tavily/search with
 * the same request body — free during SandBase's API Free Week. Route order
 * comes from SEARCH_ROUTE_ORDER (`native,sandbase` default, or
 * `sandbase,native`); keyless routes are skipped.
 */

import { unifiedCache } from '../utils/unified-cache-service';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const SANDBASE_BASE_URL = () =>
  (process.env.SANDBASE_BASE_URL || 'https://api.sandbase.ai').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 12_000;
const API_KEY = () => process.env.TAVILY_API_KEY || '';
const SANDBASE_API_KEY = () => process.env.SANDBASE_API_KEY || '';

type SearchRoute = 'native' | 'sandbase';

/** Ordered route list for a call: keyless routes dropped. */
function routeOrder(): SearchRoute[] {
  const order =
    (process.env.SEARCH_ROUTE_ORDER || '').trim().toLowerCase() === 'sandbase,native'
      ? (['sandbase', 'native'] as const)
      : (['native', 'sandbase'] as const);
  return order.filter((r) => (r === 'native' ? !!API_KEY() : !!SANDBASE_API_KEY()));
}

export type TavilyTopic = 'general' | 'news';
export type TavilyTimeRange = 'day' | 'week' | 'month' | 'year';

export interface TavilySearchOptions {
  /** `news` for recent events (default `general`). */
  topic?: TavilyTopic;
  /** Restrict to results published within this window. */
  timeRange?: TavilyTimeRange;
  /** 1–10 (default 5). */
  maxResults?: number;
  /** `basic` is one credit; `advanced` is two and returns better snippets. */
  searchDepth?: 'basic' | 'advanced';
  /** Boost results from a country, lowercase English name, e.g. `nigeria`. general topic only. */
  country?: string;
}

export interface TavilyResult {
  title: string;
  url: string;
  /** Relevant extract from the page, not the whole page. */
  snippet: string;
  /** Tavily relevance, 0–1. */
  score: number;
  /** Only present when Tavily reports it; never inferred. */
  publishedDate?: string;
  /** Hostname without `www.`, derived from the url. */
  source: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilyResult[];
  fromCache: boolean;
  /** Which route served the result — 'native' (Tavily) or 'sandbase'. */
  provider?: 'native' | 'sandbase';
}

function isConfigured(): boolean {
  return typeof window === 'undefined' && !!(API_KEY() || SANDBASE_API_KEY());
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function cacheKeyFor(query: string, opts: TavilySearchOptions): string {
  return [
    'tavily',
    opts.topic ?? 'general',
    opts.timeRange ?? '',
    opts.maxResults ?? 5,
    opts.searchDepth ?? 'basic',
    opts.country ?? '',
    query.toLowerCase().trim(),
  ].join(':');
}

export async function tavilySearch(
  query: string,
  options: TavilySearchOptions = {},
): Promise<TavilySearchResponse> {
  const empty: TavilySearchResponse = { query, results: [], fromCache: false };
  if (!query.trim() || !isConfigured()) return empty;

  const topic = options.topic ?? 'general';
  const category = topic === 'news' ? 'realtime' : 'volatile';

  try {
    const { data, fromCache } = await unifiedCache.getOrFetch<TavilySearchResponse>(
      cacheKeyFor(query, options),
      async () => {
        const body: Record<string, unknown> = {
          query: query.trim().slice(0, 400),
          topic,
          search_depth: options.searchDepth ?? 'basic',
          max_results: Math.min(10, Math.max(1, options.maxResults ?? 5)),
        };
        if (options.timeRange) body.time_range = options.timeRange;
        if (options.country && topic === 'general') body.country = options.country;

        const routes = routeOrder();
        let lastErr: unknown = new Error('no search route configured');
        for (const route of routes) {
          const maxResults =
            route === 'sandbase'
              ? Math.min(20, Math.max(1, body.max_results as number))
              : body.max_results;
          const url =
            route === 'sandbase'
              ? `${SANDBASE_BASE_URL()}/v1/api/tavily/search`
              : TAVILY_SEARCH_URL;
          const key = route === 'sandbase' ? SANDBASE_API_KEY() : API_KEY();
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
              body: JSON.stringify({ ...body, max_results: maxResults }),
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`${route} search ${res.status}`);

            const json = (await res.json()) as Record<string, any>;
            // SandBase wraps the native Tavily response: {status:"completed", output:{...}}.
            const payload: Record<string, any> | undefined =
              route === 'sandbase'
                ? json?.status === 'completed' && json.output && typeof json.output === 'object'
                  ? (json.output as Record<string, any>)
                  : undefined
                : json;
            if (!payload) throw new Error('sandbase response not completed');

            const results: TavilyResult[] = ((payload.results ?? []) as Array<Record<string, any>>)
              .filter((r) => typeof r.url === 'string' && r.url && typeof r.title === 'string')
              .map((r) => ({
                title: r.title,
                url: r.url,
                snippet: typeof r.content === 'string' ? r.content : '',
                score: typeof r.score === 'number' ? r.score : 0,
                publishedDate: typeof r.published_date === 'string' ? r.published_date : undefined,
                source: hostOf(r.url),
              }));
            return {
              data: { query, results, fromCache: false, provider: route },
              source: route === 'sandbase' ? 'sandbase-tavily' : 'tavily',
            };
          } catch (err) {
            lastErr = err;
          }
        }
        throw lastErr;
      },
      category,
    );
    return { ...data, fromCache };
  } catch (err) {
    console.warn('[Tavily] search failed:', err instanceof Error ? err.message : err);
    return empty;
  }
}

export const tavilySearchService = {
  isConfigured,
  search: tavilySearch,
};
