/**
 * Live FX rate service using the open-licensed fawazahmed0 currency dataset.
 *
 * This is the same data source the CLI FX drag report uses
 * (scripts/fx-drag/rates.ts), exposed as a shared service for the Next.js
 * API route and hooks. Covers 200+ currencies including KES, GHS, NGN —
 * currencies that Frankfurter (ECB) does not support.
 *
 * Dataset: daily USD-base snapshots via jsDelivr CDN (primary) with a
 * Cloudflare Pages fallback. Coverage starts 2024-03-02.
 *
 * Rates are indicative mid-market, not tradeable quotes.
 */

const DATASET_MIN_DATE = '2024-03-02';
const MAX_LOOKBACK_DAYS = 7;
const FETCH_TIMEOUT_MS = 8_000;

/** Per-process memo: `${isoDate}:${code}` → local-per-USD rate */
const memo = new Map<string, number>();

export interface FxRateResult {
  rate: number;
  date: string;
  source: 'fawazahmed0';
}

export interface FxHistoricalResult {
  dates: string[];
  rates: number[];
  source: 'fawazahmed0';
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) continue;
      const body = (await res.json()) as { usd?: Record<string, number> };
      if (body.usd) return body.usd;
    } catch {
      // timeout or network error — try next mirror
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Resolve a single date's rate for a currency, walking back up to
 * MAX_LOOKBACK_DAYS if the dataset skipped that day. Memoises the result.
 */
async function resolveRate(
  currency: string,
  isoDate: string,
): Promise<number | null> {
  const code = currency.toLowerCase();
  const key = `${isoDate}:${code}`;
  if (memo.has(key)) return memo.get(key)!;

  let probe = isoDate;
  for (let i = 0; i <= MAX_LOOKBACK_DAYS && probe >= DATASET_MIN_DATE; i++) {
    const table = await fetchUsdTable(probe);
    if (table?.[code] != null) {
      memo.set(key, table[code]);
      return table[code];
    }
    probe = previousDay(probe);
  }
  return null;
}

/**
 * Get the current (latest available) mid-market rate for a currency pair.
 * Both `from` and `to` are resolved against USD, then cross-rated.
 *
 * Returns null if either currency cannot be resolved.
 */
export async function getLiveRate(
  from: string,
  to: string,
): Promise<FxRateResult | null> {
  if (from === to) {
    return { rate: 1, date: new Date().toISOString().slice(0, 10), source: 'fawazahmed0' };
  }

  // fawazahmed0 is USD-base: "usd" → { "kes": 130, "ghs": 15, ... }
  // So `from` per USD and `to` per USD. Cross rate = toPerUsd / fromPerUsd.
  const today = new Date().toISOString().slice(0, 10);

  const fromPerUsd = from.toUpperCase() === 'USD' ? 1 : await resolveRate(from, today);
  const toPerUsd = to.toUpperCase() === 'USD' ? 1 : await resolveRate(to, today);

  if (fromPerUsd == null || toPerUsd == null) return null;

  const rate = toPerUsd / fromPerUsd;
  return { rate, date: today, source: 'fawazahmed0' };
}

/**
 * Get historical mid-market rates for the last N days.
 * Returns arrays of ISO dates and corresponding rates (from → to).
 *
 * @param from base currency code
 * @param to target currency code
 * @param days number of days of history (default 30)
 */
export async function getLiveHistoricalRates(
  from: string,
  to: string,
  days = 30,
): Promise<FxHistoricalResult | null> {
  if (from === to) {
    const dates: string[] = [];
    const rates: number[] = [];
    const today = new Date();
    for (let i = days; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
      rates.push(1);
    }
    return { dates, rates, source: 'fawazahmed0' };
  }

  const today = new Date();
  const dates: string[] = [];
  const isoDates: string[] = [];

  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    dates.push(iso);
    isoDates.push(iso);
  }

  const fromCode = from.toLowerCase();
  const toCode = to.toLowerCase();

  const rates: number[] = [];

  for (const iso of isoDates) {
    const fromPerUsd = from.toUpperCase() === 'USD' ? 1 : await resolveRate(from, iso);
    const toPerUsd = to.toUpperCase() === 'USD' ? 1 : await resolveRate(to, iso);

    if (fromPerUsd == null || toPerUsd == null) {
      // Skip dates we can't resolve — caller sees a shorter series
      continue;
    }
    rates.push(toPerUsd / fromPerUsd);
  }

  if (rates.length === 0) return null;

  // Trim dates array to match rates array length
  const resolvedDates = dates.slice(-rates.length);

  return { dates: resolvedDates, rates, source: 'fawazahmed0' };
}

export const FX_RATE_SOURCE_NOTE =
  'Mid-market rates: fawazahmed0 open currency dataset (daily snapshots). ' +
  'Indicative mid-market, not tradeable quotes.';
