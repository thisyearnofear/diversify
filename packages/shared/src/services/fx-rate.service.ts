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

// ── Live value series (sparkline data) ─────────────────────────────────

export interface FxSeriesResult {
  /** ISO dates, oldest → newest. */
  dates: string[];
  /** Currency value vs USD indexed to 100 at the start of the window.
      Declining values = the currency bought less USD over time. */
  values: number[];
  source: 'fawazahmed0';
}

/**
 * Pure helper: turn resolved (date, local-per-USD rate) pairs into a value
 * series indexed to 100 at the start of the window.
 *
 * The dataset quotes local-per-USD (e.g. 130 KES per USD), so the
 * currency's USD value is proportional to 1/rate. Indexing:
 * value_i = (rate_first / rate_i) * 100 — a weakening currency produces a
 * declining line. This draws the REAL path from sampled daily tables;
 * nothing is interpolated or fabricated (Wave 8 honesty rule).
 */
export function buildIndexedSeries(
  dates: string[],
  rates: number[],
): { dates: string[]; values: number[] } | null {
  if (dates.length !== rates.length || dates.length < 2) return null;
  const first = rates[0];
  if (!first || first <= 0) return null;
  const values = rates.map((r) => Math.round((first / r) * 100 * 100) / 100);
  return { dates: [...dates], values };
}

/**
 * Sampled ~12-month value series for a currency against USD, for the
 * risk-card sparkline. Fetches `points` evenly spaced daily tables in
 * parallel (biweekly by default) — a full 365-day sequential walk would
 * take minutes; 26 parallel fetches land in about a second cold, then
 * the per-process memo and the route cache carry the load.
 *
 * Returns null for USD (a flat line against itself carries no story)
 * or when too few dates resolve.
 */
export async function getLiveValueSeries(
  currency: string,
  points = 26,
): Promise<FxSeriesResult | null> {
  if (currency.toUpperCase() === 'USD') return null;

  const today = new Date();
  const dates: string[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - Math.round((i * 365) / (points - 1)));
    dates.push(d.toISOString().slice(0, 10));
  }

  // Parallel resolution; memo makes overlaps with getLiveDepreciation free.
  const resolved = await Promise.all(
    dates.map(async (iso) => ({ iso, rate: await resolveRate(currency, iso) })),
  );
  const ok = resolved.filter(
    (r): r is { iso: string; rate: number } => r.rate != null,
  );
  if (ok.length < Math.min(12, points)) return null;

  const series = buildIndexedSeries(
    ok.map((r) => r.iso),
    ok.map((r) => r.rate),
  );
  if (!series) return null;

  return { ...series, source: 'fawazahmed0' };
}

export interface DepreciationResult {
  /** Depreciation percentage. Negative = currency weakened vs benchmark. */
  '1yr': number | null;
  '3yr': number | null;
  '5yr': number | null;
  /** The date the data was fetched. */
  asOf: string;
  /** Whether each horizon was computed from live data or is null. */
  source: 'fawazahmed0';
}

/**
 * Compute live depreciation of a currency against USD over 1/3/5 year horizons.
 *
 * Depreciation = ((rate_now / rate_then) - 1) * 100
 * A negative number means the currency weakened (you get fewer USD per unit).
 *
 * The fawazahmed0 dataset starts 2024-03-02, so:
 * - 1yr: available if today > 2025-03-02 (we are)
 * - 3yr: not available from this dataset (need pre-2024 data)
 * - 5yr: not available from this dataset
 *
 * Returns null for horizons where no historical data exists. The caller
 * (API route / hook) should merge with the curated static dataset for
 * those horizons.
 */
export async function getLiveDepreciation(
  currency: string,
): Promise<DepreciationResult | null> {
  if (currency.toUpperCase() === 'USD') {
    return { '1yr': 0, '3yr': 0, '5yr': 0, asOf: new Date().toISOString().slice(0, 10), source: 'fawazahmed0' };
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Calculate the historical dates for each horizon
  const horizons: Array<{ key: '1yr' | '3yr' | '5yr'; years: number }> = [
    { key: '1yr', years: 1 },
    { key: '3yr', years: 3 },
    { key: '5yr', years: 5 },
  ];

  const result: DepreciationResult = {
    '1yr': null,
    '3yr': null,
    '5yr': null,
    asOf: todayIso,
    source: 'fawazahmed0',
  };

  // Current rate: local per USD (e.g., 130 KES per 1 USD)
  const currentRate = await resolveRate(currency, todayIso);
  if (currentRate == null) return null;

  for (const { key, years } of horizons) {
    const pastDate = new Date(today);
    pastDate.setFullYear(pastDate.getFullYear() - years);
    const pastIso = pastDate.toISOString().slice(0, 10);

    // Dataset doesn't cover dates before 2024-03-02
    if (pastIso < DATASET_MIN_DATE) {
      continue;
    }

    const pastRate = await resolveRate(currency, pastIso);
    if (pastRate == null) continue;

    // Depreciation: if 1 USD bought 100 KES then and 130 now,
    // the KES weakened by 30%: (130/100 - 1) * 100 = +30
    // We want the user's currency perspective: how much value it lost.
    // If KES went from 100→130 per USD, KES lost (1 - 100/130) = -23%
    // = ((pastRate / currentRate) - 1) * 100
    const dep = ((pastRate / currentRate) - 1) * 100;
    result[key] = Math.round(dep * 10) / 10;
  }

  // If we couldn't compute even 1yr, the service is not useful
  if (result['1yr'] == null) return null;

  return result;
}
