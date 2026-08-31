/**
 * Narrative moment model — visual primitives, not prose.
 *
 * Transforms the curated currency-risk dataset into the structured state
 * the marquee surfaces render: one delta, one personal consequence, one
 * horizon, one trust cue. Components decide how that becomes coin scale,
 * colour and motion; copy is the accessible interpretation, never the
 * product. Pure + deterministic — no fetch, no LLM.
 */
import {
  type CurrencyRiskEntry,
  type Benchmark,
  type Horizon,
  BENCHMARKS,
} from '@/constants/currency-risk';

export type MomentState = 'calm' | 'watch' | 'review';

export interface NarrativeMoment {
  currencyCode: string;
  countryName: string;
  /** ISO2 country code — bridges the story to portfolio asset regions. */
  iso2: string;
  flag: string;
  benchmark: Benchmark;
  benchmarkLabel: string;
  horizon: Horizon;
  /** Depreciation % over the horizon vs the benchmark. Negative = weakened. */
  delta: number;
  savingsAmount: number;
  /** Purchasing power lost on the savings amount, in the same unit. */
  personalImpact: number;
  /** Share of value retained vs the benchmark (0..1). Drives coin scale. */
  retainedRatio: number;
  state: MomentState;
  /** Whether the 1yr figure is live feed data or curated. */
  isLive: boolean;
  dataAsOf: string;
  /** Goods-based risk framing — how many staple units the lost buying power
      is worth at today's price. null when the currency has no goods anchor
      or the delta is an appreciation (fewer units would be wrong). */
  goods: { unit: string; count: number } | null;
}

export interface CurrencyMomentInput {
  entry: CurrencyRiskEntry;
  benchmark: Benchmark;
  horizon: Horizon;
  savingsAmount: number;
  /** Live 1yr vs-USD depreciation when the feed has one. */
  liveDepreciation1yr?: number | null;
  isLive?: boolean;
  dataAsOf: string;
}

/** |delta| thresholds that earn attention without manufacturing urgency. */
export function momentStateFromDelta(delta: number): MomentState {
  const magnitude = Math.abs(delta);
  if (magnitude >= 15) return 'review';
  if (magnitude >= 5) return 'watch';
  return 'calm';
}

/**
 * A vs-USD delta inside this band (percentage points) is treated as an
 * inert default comparison — the currency is pegged or effectively flat
 * against the dollar, so a USD-framed moment reads as "−0%". Pegged
 * Caribbean dollars (BBD 2:1, XCD 2.7:1), Trinidad & Tobago, and USD
 * itself all sit at exactly 0. Below the band a delta is a real (if
 * small) depreciation that is worth framing on the default benchmark.
 */
export const DEFAULT_COMPARISON_INERT_THRESHOLD = 1;

/**
 * Is the default benchmark comparison (vs USD, 1 year) inert?
 *
 * The moment always starts on USD @ 1yr. When that number is ~0 the
 * whole "your money vs the dollar" story is dead — a Barbadian visitor
 * sees "−0% · now buys BBD 0 less". Seed such visitors onto gold (XAU)
 * instead, where the risk is real (gold has outperformed every fiat),
 * matching the "stable ≠ safe" thesis.
 */
export function isDefaultComparisonInert(entry: CurrencyRiskEntry): boolean {
  return Math.abs(entry.depreciation.vsUSD['1yr']) < DEFAULT_COMPARISON_INERT_THRESHOLD;
}

export function buildCurrencyMoment(input: CurrencyMomentInput): NarrativeMoment {
  const { entry, benchmark, horizon, savingsAmount, dataAsOf } = input;
  const live = input.liveDepreciation1yr ?? null;

  const delta =
    benchmark === 'USD' && horizon === '1yr' && live != null
      ? live
      : entry.depreciation[`vs${benchmark}`][horizon];

  const personalImpact = savingsAmount * (Math.abs(delta) / 100);
  const retainedRatio = Math.max(0, 1 + Math.min(delta, 0) / 100);

  // Goods framing: translate the abstract percent into "N fewer staples".
  // Only when the currency has a verified staple AND it is depreciating
  // (a positive delta would make "fewer units" a lie). Honest by omission.
  const goods =
    entry.goodsAnchor && delta < 0
      ? {
          unit: entry.goodsAnchor.unit,
          count: Math.max(0, Math.round(personalImpact / entry.goodsAnchor.price)),
        }
      : null;

  return {
    currencyCode: entry.code,
    countryName: entry.countryName,
    iso2: entry.iso2,
    flag: entry.flag,
    benchmark,
    benchmarkLabel: BENCHMARKS[benchmark].label,
    horizon,
    delta,
    savingsAmount,
    personalImpact,
    retainedRatio,
    state: momentStateFromDelta(delta),
    isLive: input.isLive ?? false,
    dataAsOf,
    goods,
  };
}

/** Benchmark coins shown as the selector row; self-comparisons dropped. */
export function selectableBenchmarks(entryCode: string): Benchmark[] {
  return (Object.keys(BENCHMARKS) as Benchmark[]).filter(
    (b) => BENCHMARKS[b].code !== entryCode,
  );
}

/**
 * Regional-indicator flag emoji derived deterministically from an ISO2
 * code (JP → 🇯🇵). Used for countries that aren't in the curated currency
 * dataset but are still detected by IP geolocation — they should get an
 * honest inflation-only moment, not a placeholder. Returns null for
 * anything that isn't a two-letter code.
 */
export function flagEmojiForIso2(iso2: string): string | null {
  if (!iso2 || iso2.length !== 2) return null;
  const cc = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const REGIONAL_INDICATOR_A = 0x1f1e6; // 🇦
  return String.fromCodePoint(
    ...[...cc].map((ch) => REGIONAL_INDICATOR_A + ch.charCodeAt(0) - 65),
  );
}

/**
 * Inflation-only moment — the honest fallback for visitors whose currency
 * isn't in the curated dataset. Same grammar as a currency moment (one
 * object, one number, one personal consequence) but the object is gold
 * and the number is the region's annual inflation. It never fakes a
 * currency-vs-benchmark delta it doesn't have: "prices rise X% a year"
 * is real, and it is the whole point (even a flat currency loses buying
 * power to inflation).
 */
export interface InflationMoment {
  kind: 'inflation';
  countryName: string;
  /** ISO2 country code. */
  countryCode: string;
  flag: string | null;
  region: string;
  /** Annual regional inflation rate, % per year. */
  inflationRate: number;
  savingsAmount: number;
  /** Buying power lost to inflation each year on the savings amount. */
  annualImpact: number;
  dataAsOf: string;
  /** true when from the live inflation feed; false for fallback constants. */
  isLive: boolean;
}

export interface InflationMomentInput {
  region: string;
  countryCode: string;
  countryName: string;
  flag?: string | null;
  inflationRate: number;
  savingsAmount: number;
  dataAsOf: string;
  isLive?: boolean;
}

export function buildInflationMoment(input: InflationMomentInput): InflationMoment {
  const {
    region,
    countryCode,
    countryName,
    flag,
    inflationRate,
    savingsAmount,
    dataAsOf,
  } = input;
  return {
    kind: 'inflation',
    countryName,
    countryCode,
    flag: flag ?? flagEmojiForIso2(countryCode),
    region,
    inflationRate,
    savingsAmount,
    annualImpact: savingsAmount * (inflationRate / 100),
    dataAsOf,
    isLive: input.isLive ?? false,
  };
}

/**
 * ISO2 → the app's coarse asset regions. Bridges the visitor's currency
 * story to the portfolio dial: a Ghanaian visitor's moment opens the dial
 * on "Africa" coverage. Caribbean countries map to LatAm (the asset-region
 * taxonomy has no Caribbean bucket). Null when the country has no sensible
 * bucket — callers must check the region actually exists in their holdings.
 */
const COUNTRY_TO_ASSET_REGION: Record<string, string> = {
  AR: 'LatAm', BR: 'LatAm', CO: 'LatAm', MX: 'LatAm',
  HT: 'LatAm', JM: 'LatAm', TT: 'LatAm', BB: 'LatAm', LC: 'LatAm',
  EG: 'Africa', NG: 'Africa', GH: 'Africa', KE: 'Africa', ZA: 'Africa',
  TZ: 'Africa', UG: 'Africa',
  PK: 'Asia', LK: 'Asia', TH: 'Asia', IN: 'Asia', ID: 'Asia',
  PH: 'Asia', VN: 'Asia', TR: 'Asia',
  UA: 'Europe', RU: 'Europe', GB: 'Europe', DE: 'Europe',
  US: 'USA',
};

export function assetRegionForCountry(iso2: string): string | null {
  return COUNTRY_TO_ASSET_REGION[iso2.toUpperCase()] ?? null;
}
