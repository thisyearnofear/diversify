/**
 * currency-instrument — one currency, derived as an object.
 *
 * A currency page in most apps is a feed: text, headlines, a chart of a
 * number nobody can act on. This module instead derives ONE instrument
 * from the curated datasets we already trust, so the currency can be
 * understood the way a coin is: its shape is its real numbers, every
 * value carries a date, and the only prose on the surface is a curated
 * voice that wraps a number it does not own.
 *
 * Everything here is pure and code-driven. Same discipline as the corridor
 * and the share cards: the route takes a currency CODE, never numbers, and
 * an unknown code derives nothing (the page 404s).
 *
 * Depth layers (§ design-language):
 *   L0  the disc — buying power retained vs the dollar, euro, gold
 *   L1  one line — the currency's own register, wrapping that number
 *   L2  the inspector — the dated trail, the token's provenance, the
 *       stamps this currency can press onto a postcard
 *
 * Honesty rules baked in here:
 *   - no entry, no instrument (never a fabricated reading)
 *   - no staple anchor, no goods sentence (absence is honest)
 *   - no onchain token, no provenance and no stamps (silence, not filler)
 *   - a fact is a dated claim; anything without a date is not a fact
 */
import {
  CURRENCY_BY_CODE,
  CURRENCY_RISK_DATA_AS_OF,
  currencyRiskDatasetAgeDays,
  isCurrencyRiskDatasetStale,
  riskEventAge,
  type CurrencyRiskEntry,
} from '@/constants/currency-risk';
import { SCHEDULED_EVENTS } from '@/constants/scheduled-events';
import {
  HORIZON_YEARS,
  currencyRiskAsOfLabel,
  moneyNameFor,
  tokenForFiatCode,
  type Horizon,
} from '@/lib/corridor-context';
import { voiceFor } from '@/lib/corridor-voice';
import {
  provenanceFor,
  type TokenProvenance,
} from '@diversifi/shared/src/constants/token-provenance';
import { stampsForPair, type Stamp } from '@/lib/stamps';

/** The three reference moneys the dataset measures against. */
export type Benchmark = 'USD' | 'EUR' | 'XAU';

export const BENCHMARKS: readonly Benchmark[] = ['USD', 'EUR', 'XAU'] as const;

export const BENCHMARK_LABEL: Record<Benchmark, string> = {
  USD: 'the dollar',
  EUR: 'the euro',
  XAU: 'gold',
};

const BENCHMARK_FIELD: Record<Benchmark, 'vsUSD' | 'vsEUR' | 'vsXAU'> = {
  USD: 'vsUSD',
  EUR: 'vsEUR',
  XAU: 'vsXAU',
};

export const HORIZONS: readonly Horizon[] = ['1yr', '3yr', '5yr'] as const;

export const HORIZON_LABEL: Record<Horizon, string> = {
  '1yr': '1 year',
  '3yr': '3 years',
  '5yr': '5 years',
};

/** A currency's reading against one benchmark, per horizon. */
export interface BenchmarkRing {
  benchmark: Benchmark;
  /** Buying power retained, 0–100 by construction (a currency cannot
   *  retain more than 100% of itself). This is the arc's sweep. */
  retained: Record<Horizon, number>;
  /** Points lost against this benchmark, positive. */
  lost: Record<Horizon, number>;
}

/** One dated, sourced claim about the currency. */
export interface CurrencyFact {
  id: string;
  kind: 'trail' | 'scheduled';
  /** ISO date when this claim was checked against its source. */
  asOf: string;
  /** Short date on the card — "2023" for a trail year, "Dec 8, 2026" for
   *  something scheduled. */
  dateLabel: string;
  /** How old the claim is in the currency's own grammar ("3y ago"), or
   *  that it was scheduled for a past date. */
  ageLabel: string;
  title: string;
  detail: string;
  /** Where the claim comes from. Always a named source, never "data". */
  source: string;
  /** Only scheduled events carry a url — curated trail rows are sourced
   *  at the dataset level, so they render the review date instead of a
   *  fabricated link. */
  url?: string;
}

export interface CurrencyWhatIf {
  horizon: Horizon;
  startYear: number;
  /** Buying power today's local savings would have retained, as a percent
   *  (100 = unharmed). Can exceed 100 when the currency gained against the
   *  dollar — unlike a ring sweep, this is not capped, because capping it
   *  would understate a real gain. Derived from the depreciation only. */
  retainedPct: number;
  /** Only when the currency has a curated staple: what today's 10 staples
   *  would have bought had the savings been held in dollars. Rounding
   *  happens once, here, so the sentence cannot drift from the number. */
  goods: { unit: string; kept: number; moved: number } | null;
}

export interface CurrencyInstrument {
  code: string;
  flag: string;
  countryName: string;
  /** Plain-language name ("the naira") from the shared corridor map. */
  name: string;
  /** The currency's own register, when one has been curated. */
  epithet: string | null;
  rings: BenchmarkRing[];
  facts: CurrencyFact[];
  /** The next scheduled, sourced thing a holder should watch — null when
   *  nothing is on the calendar for this currency. */
  watch: CurrencyFact | null;
  /** The onchain mirror (cNGN → NGNm) or null when the currency has none. */
  token: string | null;
  provenance: TokenProvenance | null;
  /** Facts this currency can press — currency vs the dollar, the pair the
   *  stamps system already understands. Empty without an onchain token. */
  stamps: Stamp[];
  whatIf: Record<Horizon, CurrencyWhatIf | null>;
  /** The curated dataset's review date, disclosed on the surface. */
  asOfLabel: string;
  ageDays: number;
  stale: boolean;
}

/** Buying power retained (0–100) from a depreciation figure. */
function retainedFrom(depreciation: number): number {
  if (!Number.isFinite(depreciation)) return 0;
  return Math.max(0, Math.min(100, 100 + depreciation));
}

function ringsFor(entry: CurrencyRiskEntry): BenchmarkRing[] {
  return BENCHMARKS.map((benchmark) => {
    const track = entry.depreciation[BENCHMARK_FIELD[benchmark]];
    const retained = {} as Record<Horizon, number>;
    const lost = {} as Record<Horizon, number>;
    for (const horizon of HORIZONS) {
      retained[horizon] = retainedFrom(track[horizon]);
      lost[horizon] = 100 - retained[horizon];
    }
    return { benchmark, retained, lost };
  });
}

/**
 * The next scheduled event as the thing to watch. Only ever called for a
 * future date: a passed date stops being a thing to watch, and we cannot
 * verify what the event decided — so the calendar speaks only forward.
 */
function scheduledFact(
  event: (typeof SCHEDULED_EVENTS)[number],
): CurrencyFact {
  const dateLabel = new Date(`${event.date}T00:00:00Z`).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
  );
  return {
    id: event.id,
    kind: 'scheduled',
    asOf: event.asOf,
    dateLabel,
    ageLabel: 'scheduled',
    title: event.event,
    detail:
      'A dated calendar entry from a named source. Not a forecast of its outcome.',
    source: event.source,
    url: event.url,
  };
}

function trailFacts(entry: CurrencyRiskEntry, now: Date): CurrencyFact[] {
  return entry.riskEvents
    .slice()
    .sort((a, b) => b.year - a.year)
    .map((event, index) => ({
      id: `trail-${entry.code}-${event.year}-${index}`,
      kind: 'trail' as const,
      // An event without its own `asOf` predates the per-event freshness
      // discipline — it honestly reports the dataset's review date.
      asOf: event.asOf ?? CURRENCY_RISK_DATA_AS_OF,
      dateLabel: String(event.year),
      ageLabel: riskEventAge(event.year, now),
      title: event.event,
      detail: event.impact,
      source: 'Curated FX trail (central bank, IMF, World Bank)',
    }));
}

/**
 * The what-if, from depreciation ratios only — no FX rate is read.
 *
 * This is the same ratio family as `pairWhatIfFor` in corridor-context
 * (1 / (1 + depreciation)); the currency page can address a currency with
 * no onchain token (ARS) so it derives from the entry directly. A test
 * pins the two to the same result wherever both can answer.
 */
function whatIfFor(
  entry: CurrencyRiskEntry,
  horizon: Horizon,
): CurrencyWhatIf | null {
  const drift = entry.depreciation.vsUSD[horizon];
  if (!Number.isFinite(drift) || Math.abs(drift) < 1) return null;
  // The ring clamps at 100 (a currency cannot retain more than all of
  // itself), but the what-if is dollar purchasing power — a gain is one.
  const retainedPct = 100 + drift;
  const multiplier = 1 / (1 + drift / 100);
  const anchor = entry.goodsAnchor;
  const moved = 10 * multiplier;
  return {
    horizon,
    startYear: Number(CURRENCY_RISK_DATA_AS_OF.slice(0, 4)) - HORIZON_YEARS[horizon],
    retainedPct: Math.round(retainedPct * 10) / 10,
    // Same rounding as pairWhatIfFor so the pair card and this page cannot
    // quote two different basket counts for the same horizon.
    goods: anchor
      ? {
          unit: anchor.unit,
          kept: 10,
          moved:
            moved >= 10
              ? Math.round(moved)
              : Math.round(moved * 10) / 10,
        }
      : null,
  };
}

/**
 * Derive the currency's instrument, or null for a code we do not cover.
 *
 * `now` is injected so the scheduled-event and stamp windows are testable
 * and so a statically rendered page can pin the clock it was built at.
 */
export function currencyInstrumentFor(
  code: string | null | undefined,
  now: Date = new Date(),
): CurrencyInstrument | null {
  const upper = (code ?? '').toUpperCase();
  const entry = CURRENCY_BY_CODE[upper];
  if (!entry) return null;

  const token = tokenForFiatCode(upper);
  const scheduled = SCHEDULED_EVENTS.filter(
    (e) => e.fiat === upper && new Date(`${e.date}T00:00:00Z`).getTime() >= now.getTime(),
  ).sort((a, b) => a.date.localeCompare(b.date));
  const watch = scheduled[0] ? scheduledFact(scheduled[0]) : null;

  const whatIf = {} as Record<Horizon, CurrencyWhatIf | null>;
  for (const horizon of HORIZONS) whatIf[horizon] = whatIfFor(entry, horizon);

  return {
    code: upper,
    flag: entry.flag,
    countryName: entry.countryName,
    name: moneyNameFor(upper),
    epithet: voiceFor(upper)?.epithet ?? null,
    rings: ringsFor(entry),
    facts: trailFacts(entry, now),
    watch,
    token,
    provenance: token ? provenanceFor(token) : null,
    // The currency's stamps are the pair it actually has meaning against:
    // itself and the dollar. No token → nothing to press, so nothing shown.
    stamps: token ? stampsForPair(token, 'USDm', now) : [],
    whatIf,
    asOfLabel: currencyRiskAsOfLabel(),
    ageDays: currencyRiskDatasetAgeDays(now),
    stale: isCurrencyRiskDatasetStale(now),
  };
}

/** The L0 readout: the dollar ring at the caller's chosen horizon. */
export function headlineFor(
  instrument: CurrencyInstrument,
  horizon: Horizon,
): { retainedPct: number; lostPct: number } {
  const usd = instrument.rings.find((r) => r.benchmark === 'USD');
  const retained = usd?.retained[horizon] ?? 0;
  return { retainedPct: Math.round(retained), lostPct: Math.round(100 - retained) };
}

/** Every code this route can serve — statically known from the dataset. */
export function currencyInstrumentCodes(): string[] {
  return Object.keys(CURRENCY_BY_CODE);
}
