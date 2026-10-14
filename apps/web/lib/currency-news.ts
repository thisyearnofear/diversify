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
import { currencyNameFor } from './currency-names';
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
  // Naming the currency and the dollar pulls FX stories; a bare country
  // drifts to politics and neighbours.
  const name = currencyNameFor(entry.code);
  return `${entry.countryName} ${name ?? entry.code} dollar exchange rate central bank`;
}

function isoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

const CURRENCY_TERMS =
  /\b(currenc\w*|exchange rates?|forex|fx|devalu\w*|revalu\w*|central bank|monetary|inflation|interest rates?|rate (cut|hike|decision)|peg(ged)?|dollar)\b/i;

/** Search engines drift to neighbouring countries and off-topic stories
 *  (a gold endowment, another country's devaluation). A row stays only if it
 *  names this country or code AND talks about money — otherwise no row beats
 *  a wrong row. */
function isAboutCurrency(r: TavilyResult, code: string): boolean {
  const entry = CURRENCY_BY_CODE[code.toUpperCase()];
  if (!entry) return false;
  const text = `${r.title} ${r.snippet ?? ''}`;
  const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 'shilling' names four countries' money, so it can't vouch for Kenya.
  const found = currencyNameFor(entry.code);
  const local = found === 'shilling' ? null : found;
  const names = new RegExp(
    `\\b(${escape(entry.countryName)}\\w*|${escape(entry.code)}${local ? `|${escape(local)}s?` : ''})\\b`,
    'i',
  );
  return names.test(text) && CURRENCY_TERMS.test(text);
}

/** Newest first, undated rows last; https links only; one row per url.
 *  Headlines that trip the hype guard drop — a weak currency is someone's rent. */
export function toCurrencyNewsItems(
  results: TavilyResult[],
  limit = 3,
  code?: string,
): CurrencyNewsItem[] {
  const seen = new Set<string>();
  const items: CurrencyNewsItem[] = [];
  for (const r of results) {
    if (!r.url.startsWith('https://') || !r.title.trim() || hasHype(r.title) || seen.has(r.url)) continue;
    if (code && !isAboutCurrency(r, code)) continue;
    seen.add(r.url);
    items.push({ title: r.title.trim(), url: r.url, source: r.source, date: isoDate(r.publishedDate) });
  }
  items.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return items.slice(0, limit);
}
