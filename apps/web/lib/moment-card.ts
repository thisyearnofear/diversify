/**
 * moment-card — the shareable currency card's content, derived only from
 * a fiat code. Every number comes from the curated 5-year dataset (never
 * live — the card can't carry a feed's freshness promise), plus the
 * newest dated risk event. Unknown code → null → neutral brand card /
 * 404, never a guess.
 *
 * Benchmark rule mirrors Home's default: gold for benchmark currencies
 * and pegged/inert comparisons, USD for everyone else.
 */
import {
  BENCHMARKS,
  CURRENCY_BY_CODE,
  type Benchmark,
} from '@/constants/currency-risk';
import { isDefaultComparisonInert } from '@/lib/narrative/currency-moment';
import { currencyRiskAsOfLabel, moneyNameFor } from './corridor-context';

export interface MomentCardContent {
  /** Canonical currency code. */
  code: string;
  flag: string;
  benchmark: Benchmark;
  benchmarkFlag: string;
  benchmarkName: string;
  /** The 5yr delta vs the benchmark (negative = weakened). */
  delta: number;
  /** "The naira bought 60% less than the dollar in 5 years". */
  headline: string;
  /** "2024 · Multiple FX windows" — the newest curated risk event. */
  event: string | null;
  /** "Jul 2025" — always disclosed. */
  asOf: string;
}

/** Codes whose "vs USD" story is the benchmark itself — they read gold. */
const GOLD_BENCHMARK_CODES = new Set(['USD', 'EUR', 'GBP', 'CAD']);

/** Home's default benchmark for a currency entry — shared by the card
 *  and the shared-view seeding so both weigh the same money. */
export function momentBenchmarkFor(entryCode: string): Benchmark {
  const entry = CURRENCY_BY_CODE[entryCode];
  if (GOLD_BENCHMARK_CODES.has(entryCode) || (entry && isDefaultComparisonInert(entry))) {
    return 'XAU';
  }
  return 'USD';
}

/** Plain-language money name ("the naira") — the corridor map where it
 *  covers the code, else an honest "the Nigeria NGN" fallback. */
function momentMoneyName(code: string, countryName: string): string {
  const mapped = moneyNameFor(code);
  return mapped === code ? `the ${countryName} ${code}` : mapped;
}

const BENCH_NAME: Record<Benchmark, string> = {
  USD: 'the dollar',
  EUR: 'the euro',
  XAU: 'gold',
};

export function momentCardContent(
  codeParam: string | null | undefined,
): MomentCardContent | null {
  if (!codeParam) return null;
  const entry = CURRENCY_BY_CODE[codeParam.toUpperCase()];
  if (!entry) return null;

  const benchmark = momentBenchmarkFor(entry.code);
  const delta = entry.depreciation[`vs${benchmark}`]['5yr'];
  const abs = Math.abs(Math.round(delta));
  const moneyName = momentMoneyName(entry.code, entry.countryName);
  const benchName = BENCH_NAME[benchmark];

  const headline =
    abs < 1
      ? `The ${moneyName.replace(/^the /, '')} held level with ${benchName} for 5 years`
      : `The ${moneyName.replace(/^the /, '')} bought ${abs}% ${
          delta < 0 ? 'less' : 'more'
        } than ${benchName} in 5 years`;

  const newest = entry.riskEvents.reduce<(typeof entry.riskEvents)[number] | null>(
    (acc, ev) => (acc === null || ev.year >= acc.year ? ev : acc),
    null,
  );

  return {
    code: entry.code,
    flag: entry.flag,
    benchmark,
    benchmarkFlag: BENCHMARKS[benchmark].flag,
    benchmarkName: benchName,
    delta,
    headline,
    event: newest ? `${newest.year} · ${newest.event}` : null,
    asOf: currencyRiskAsOfLabel(),
  };
}
