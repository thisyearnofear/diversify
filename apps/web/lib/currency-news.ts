/**
 * currency-news — the cited-news shape behind the currency story's
 * "In the news" rows. The search query is built here from a curated
 * currency entry, never from visitor text, so the route can't be used
 * as an open search proxy. Rows are links to the publisher, passed
 * through as Tavily returned them — no summary, no sentiment, no
 * forecast.
 */
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { hasHype } from './card-tone';
import type { TavilyResult } from '@diversifi/shared/src/services/tavily-search.service';

export interface CurrencyNewsItem {
  title: string;
  url: string;
  /** Publisher hostname, e.g. "reuters.com". */
  source: string;
  /** ISO date (YYYY-MM-DD) when Tavily reported a parseable date, else null. */
  date: string | null;
}

/** Null for a code outside the curated dataset. */
export function currencyNewsQuery(code: string | null | undefined): string | null {
  const entry = code ? CURRENCY_BY_CODE[code.toUpperCase()] : null;
  if (!entry) return null;
  return `${entry.countryName} ${entry.code} currency exchange rate central bank`;
}

function isoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

/** Newest first, undated rows last; https links only; one row per url.
 *  Headlines that trip the hype guard drop — a weak currency is someone's rent. */
export function toCurrencyNewsItems(results: TavilyResult[], limit = 3): CurrencyNewsItem[] {
  const seen = new Set<string>();
  const items: CurrencyNewsItem[] = [];
  for (const r of results) {
    if (!r.url.startsWith('https://') || !r.title.trim() || hasHype(r.title) || seen.has(r.url)) continue;
    seen.add(r.url);
    items.push({ title: r.title.trim(), url: r.url, source: r.source, date: isoDate(r.publishedDate) });
  }
  items.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return items.slice(0, limit);
}
