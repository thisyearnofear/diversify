/**
 * Historical mid-market rate provider for the FX drag report.
 *
 * Source: the open-licensed fawazahmed0 currency dataset (daily snapshots,
 * covers KES/GHS/NGN and 200+ currencies, USD base). Primary via jsDelivr,
 * fallback via Cloudflare Pages. Dataset coverage starts 2024-03-02 —
 * earlier cycle dates need rates supplied manually via the cache file.
 *
 * Rates are cached in scripts/fx-drag/.rate-cache.json (gitignored) so a
 * report re-run is offline and deterministic.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(HERE, '.rate-cache.json');
const DATASET_MIN_DATE = '2024-03-02';
/** Dataset occasionally skips a day; walk back at most this many days. */
const MAX_LOOKBACK_DAYS = 7;

type RateCache = Record<string, Record<string, number>>;

function loadCache(): RateCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache: RateCache): void {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function previousDay(isoDate: string): string {
  const d = new Date(Date.parse(isoDate) - 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function fetchUsdTable(isoDate: string): Promise<Record<string, number> | null> {
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${isoDate}/v1/currencies/usd.min.json`,
    `https://${isoDate}.currency-api.pages.dev/v1/currencies/usd.min.json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = (await res.json()) as { usd?: Record<string, number> };
      if (body.usd) return body.usd;
    } catch {
      // try next mirror
    }
  }
  return null;
}

/**
 * Prefetch local-per-USD mid rates for the given dates and return a
 * synchronous lookup for the calc module. Missing dates resolve to the
 * nearest previous available day.
 */
export async function buildRateProvider(
  currency: string,
  isoDates: string[],
): Promise<{ getRate: (isoDate: string) => number; sourceNote: string }> {
  const code = currency.toLowerCase();
  const cache = loadCache();
  let cacheDirty = false;

  const resolved = new Map<string, number>();
  for (const date of isoDates) {
    if (cache[date]?.[code] != null) {
      resolved.set(date, cache[date][code]);
      continue;
    }
    let probe = date;
    let rate: number | null = null;
    for (let i = 0; i <= MAX_LOOKBACK_DAYS && probe >= DATASET_MIN_DATE; i++) {
      const table = await fetchUsdTable(probe);
      if (table?.[code] != null) {
        rate = table[code];
        break;
      }
      probe = previousDay(probe);
    }
    if (rate == null) {
      throw new Error(
        `No ${currency.toUpperCase()}/USD rate available for ${date}. ` +
          `Dataset coverage starts ${DATASET_MIN_DATE}; for earlier dates add the rate to ${CACHE_FILE} ` +
          `as {"${date}": {"${code}": <local per USD>}} (e.g. from central bank records).`,
      );
    }
    resolved.set(date, rate);
    cache[date] = { ...cache[date], [code]: rate };
    cacheDirty = true;
  }
  if (cacheDirty) saveCache(cache);

  return {
    getRate: (isoDate: string) => {
      const rate = resolved.get(isoDate);
      if (rate == null) throw new Error(`Rate for ${isoDate} was not prefetched`);
      return rate;
    },
    sourceNote:
      'Mid-market rates: fawazahmed0 open currency dataset (daily snapshots). ' +
      'Indicative mid-market, not tradeable quotes; bank statements remain the source of truth for achieved rates.',
  };
}
