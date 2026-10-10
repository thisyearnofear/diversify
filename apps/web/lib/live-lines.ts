/**
 * live-lines — the pure beat builders behind each tab's LiveLine.
 *
 * Every beat is real, dated or cited data: fresh MACRO_SIGNAL ledger
 * records (14-day freshness, rehearsal filter and echo check live in
 * corridor-context.ts), a token's standing watch cadence from curated
 * provenance, a currency's newest curated risk event, or a saved
 * payment cycle the user already unlocked. A builder returns only the
 * beats whose data exists — never fabricate, never forecast.
 */
import {
  corridorSignalForCurrency,
  corridorSideFor,
  corridorTokenForCurrency,
  type CorridorSignal,
  type CorridorSignalRecord,
} from '@/lib/corridor-context';
import { voiceBeatForCode } from '@/lib/corridor-voice';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import {
  comingStampsForFiat,
  pastStampsForFiat,
  watchStampForToken,
} from '@/lib/stamps';
import { daysUntilPaymentDate } from '@diversifi/shared/src/services/guardian/recommendation-contract';

export interface LiveBeatText {
  key: string;
  text: string;
  /** Present when the beat is a keepable fact — a stamp id that
   *  resolveStamps accepts for the pair it flows beside. Fresh signal
   *  beats never carry one: they expire in 14 days, postcards endure. */
  stampId?: string;
}

/** A fresh ledger signal in the corridor line's dateline grammar:
 *  "Sep 18 🇳🇬: CBN held the benchmark rate". */
function signalBeat(sig: CorridorSignal, flag: string, key: string): LiveBeatText {
  return { key, text: `${sig.dateLabel} ${flag}: ${sig.text}` };
}

/** The freshest dated macro signal for a fiat code, formatted as a beat.
 *  Null when nothing fresh exists (stale records and rehearsals are
 *  already filtered inside corridorSignalForCurrency). */
export function macroSignalBeatForCode(
  records: CorridorSignalRecord[] | null | undefined,
  code: string | null | undefined,
  nowMs: number = Date.now(),
): LiveBeatText | null {
  const sig = corridorSignalForCurrency(records, code, nowMs);
  if (!sig) return null;
  const flag = corridorSideFor(corridorTokenForCurrency(code))?.flag ?? '';
  return signalBeat(sig, flag, `signal-${code}`);
}

/** A token's standing watch cadence — "Watch 🇳🇬: CBN decisions · 8× a
 *  year". The beat IS the stamp: same builder, same sentence. */
export function watchBeatForToken(
  token: string | null | undefined,
): LiveBeatText | null {
  const stamp = token ? watchStampForToken(token) : null;
  if (!stamp) return null;
  return { key: stamp.id, text: stamp.sentence, stampId: stamp.id };
}

/** The nearest sourced scheduled event for a fiat within `withinDays`
 *  (default 120 — the line looks a season ahead, never further). */
export function comingBeatForCode(
  code: string | null | undefined,
  now: Date = new Date(),
  withinDays = 120,
): LiveBeatText | null {
  if (!code) return null;
  const stamp = comingStampsForFiat(code, now, withinDays)[0];
  if (!stamp) return null;
  return { key: stamp.id, text: stamp.sentence, stampId: stamp.id };
}

/** Watch cadence for a bare fiat code — looks up the token that carries
 *  the currency, then its provenance. */
function watchBeatForCode(code: string | null | undefined): LiveBeatText | null {
  return watchBeatForToken(corridorTokenForCurrency(code));
}

/**
 * Home — the visitor's currency, in order:
 *   1. a fresh macro signal (dateline), else the currency's watch cadence;
 *   2. the newest curated riskEvent with its date.
 * `includeRiskEvent: false` when the same event is already on-screen
 * (the flipped coin's back face) — the line never repeats visible copy.
 */
export function homeBeats(args: {
  records: CorridorSignalRecord[] | null | undefined;
  currencyCode: string | null | undefined;
  includeRiskEvent?: boolean;
  nowMs?: number;
}): LiveBeatText[] {
  const { records, currencyCode, nowMs = Date.now() } = args;
  const beats: LiveBeatText[] = [];
  const first =
    macroSignalBeatForCode(records, currencyCode, nowMs) ??
    watchBeatForCode(currencyCode);
  if (first) beats.push(first);

  // The persona beat — the currency's own register ("japa math", "la
  // TRM") around its 5y drift. Second in rotation: the persona hooks,
  // the calendar and risk event keep it grounded.
  const voice = voiceBeatForCode(currencyCode);
  if (voice) beats.push(voice);

  // The sourced calendar — informational on Home (no stamping UI here).
  const coming = comingBeatForCode(currencyCode, new Date(nowMs));
  if (coming) beats.push(coming);

  if (args.includeRiskEvent !== false) {
    const events = CURRENCY_BY_CODE[currencyCode ?? '']?.riskEvents ?? [];
    const newest = events.reduce<(typeof events)[number] | null>(
      (acc, ev) => (acc === null || ev.year >= acc.year ? ev : acc),
      null,
    );
    if (newest) {
      const stamp = pastStampsForFiat(currencyCode ?? '').find(
        (s) => s.id === `past-${currencyCode}-${newest.year}`,
      );
      beats.push({
        key: `risk-${currencyCode}-${newest.year}`,
        text: `${newest.year}: ${newest.event}`,
        stampId: stamp?.id,
      });
    }
  }
  return beats;
}

export interface LiveLineCycle {
  id: string;
  localCurrency: string;
  targetCurrency: string;
  paymentDate: string;
  status: string;
}

/**
 * Guardian — what the agent is already doing, in order:
 *   1. the next active saved payment cycle ("Watching your GHS → USD
 *      payment · 12 days") — only when cycle data is already unlocked;
 *   2. the freshest macro signal across the followed plan's currencies;
 *   3. the watch cadence of the plan's primary local currency.
 */
export function guardianBeats(args: {
  records: CorridorSignalRecord[] | null | undefined;
  cycles?: LiveLineCycle[] | null;
  planTokens?: string[];
  primaryLocalToken?: string | null;
  nowMs?: number;
}): LiveBeatText[] {
  const { records, cycles, planTokens = [], primaryLocalToken, nowMs = Date.now() } = args;
  const beats: LiveBeatText[] = [];

  const next = [...(cycles ?? [])]
    .filter((c) => c.status === 'active')
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))[0];
  if (next) {
    const days = daysUntilPaymentDate(next.paymentDate, new Date(nowMs));
    if (days >= 0) {
      beats.push({
        key: `cycle-${next.id}`,
        text: `Watching your ${next.localCurrency} → ${next.targetCurrency} payment · ${days} day${days === 1 ? '' : 's'}`,
      });
    }
  }

  // One macro beat: the freshest signal across any currency in the plan.
  const seen = new Set<string>();
  let freshest: { sig: CorridorSignal; code: string } | null = null;
  for (const token of planTokens) {
    const code = corridorSideFor(token)?.code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const sig = corridorSignalForCurrency(records, code, nowMs);
    if (sig && (!freshest || sig.timestamp > freshest.sig.timestamp)) {
      freshest = { sig, code };
    }
  }
  if (freshest) {
    const flag = corridorSideFor(corridorTokenForCurrency(freshest.code))?.flag ?? '';
    beats.push(signalBeat(freshest.sig, flag, `signal-${freshest.code}`));
  }

  const watch = watchBeatForToken(primaryLocalToken);
  if (watch) beats.push(watch);
  return beats;
}

/**
 * Shield — under the resting ring, in order:
 *   1. fresh macro signals for the plan legs' currencies, newest first,
 *      max two;
 *   2. the watch cadence of the plan's largest non-USD leg.
 */
export function shieldBeats(args: {
  records: CorridorSignalRecord[] | null | undefined;
  legs: { token: string; percent: number }[];
  nowMs?: number;
}): LiveBeatText[] {
  const { records, legs, nowMs = Date.now() } = args;
  const beats: LiveBeatText[] = [];

  const seen = new Set<string>();
  const signals: { sig: CorridorSignal; code: string }[] = [];
  for (const leg of legs) {
    const code = corridorSideFor(leg.token)?.code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const sig = corridorSignalForCurrency(records, code, nowMs);
    if (sig) signals.push({ sig, code });
  }
  signals
    .sort((a, b) => b.sig.timestamp - a.sig.timestamp)
    .slice(0, 2)
    .forEach(({ sig, code }) => {
      const flag = corridorSideFor(corridorTokenForCurrency(code))?.flag ?? '';
      beats.push(signalBeat(sig, flag, `signal-${code}`));
    });

  const watch = watchBeatForToken(primaryLocalToken(legs));
  if (watch) beats.push(watch);
  return beats;
}

/** The plan leg a live line treats as "the local currency" — the largest
 *  leg whose corridor side isn't the dollar. Shared by Guardian and
 *  Shield call sites. */
export function primaryLocalToken(legs: { token: string; percent: number }[]): string | null {
  return (
    [...legs]
      .filter((l) => {
        const code = corridorSideFor(l.token)?.code;
        return code && code !== 'USD';
      })
      .sort((a, b) => b.percent - a.percent)[0]?.token ?? null
  );
}
