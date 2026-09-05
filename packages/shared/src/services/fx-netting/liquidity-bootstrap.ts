/**
 * Liquidity bootstrap — standing Guardian intents for empty-corridor cold start.
 *
 * The two-sided cold start is the pool's real risk: a real SME posting the
 * first BBD→JMD intent finds no counterparty, and a dead first experience
 * kills the network effect before it starts. The honest fix is a STANDING
 * LIQUIDITY program, run by the Guardian, the way a market maker seeds an
 * order book:
 *
 * - The Guardian posts deterministic, always-available intents on the
 *   deepest Caribbean corridors (BBD↔JMD, TTD↔JMD) at mid-market.
 * - Every synthetic id is `guardian-` prefixed and EXCLUDED from credit
 *   scoring (isSyntheticParticipant) and from savings claims.
 * - When a real SME's intent matches Guardian liquidity, the on-chain
 *   record says so — the cohort/observer pattern: no pretend counterparties.
 *
 * What this is NOT (kept honest): Guardian intents are NOT a promise of
 * settlement capital. They guarantee a MATCH at mid-market; settlement
 * remains zero-custody debtor-executed. Guardian liquidity participation
 * is a Phase 2 workstream (funded Guardian float) — this module never
 * pretends otherwise.
 */

import type { FxIntent } from './intent';

export interface StandingIntentSpec {
  participantId: string;
  sellCurrency: string;
  buyCurrency: string;
  /** Sell amount in major units. */
  amount: number;
}

/** The deepest Caribbean corridors — the pairs the brief's example flows use. */
export const STANDING_CORRIDORS: StandingIntentSpec[] = [
  { participantId: 'guardian-liquidity-bbd-jmd', sellCurrency: 'BBD', buyCurrency: 'JMD', amount: 5_000 },
  { participantId: 'guardian-liquidity-jmd-bbd', sellCurrency: 'JMD', buyCurrency: 'BBD', amount: 400_000 },
  { participantId: 'guardian-liquidity-ttd-jmd', sellCurrency: 'TTD', buyCurrency: 'JMD', amount: 20_000 },
  { participantId: 'guardian-liquidity-jmd-ttd', sellCurrency: 'JMD', buyCurrency: 'TTD', amount: 400_000 },
];

/** Deterministic id prefix — the route excludes these from credit scoring. */
export const GUARDIAN_LIQUIDITY_PREFIX = 'guardian-liquidity-';

export function isGuardianLiquidityParticipant(participantId: string): boolean {
  return participantId.toLowerCase().startsWith(GUARDIAN_LIQUIDITY_PREFIX);
}

/**
 * Build the standing intents as real FxIntents (engine-compatible).
 * `rateFor` converts a USD amount to the corridor's sell currency at
 * mid-market; when no live rate exists the corridor is SKIPPED, never
 * fabricated (the heartbeat honesty rule).
 */
export function buildStandingIntents(
  nowMs: number,
  rateFor: (currency: string) => number | null,
): { intents: FxIntent[]; skipped: { corridor: string; reason: string }[] } {
  const intents: FxIntent[] = [];
  const skipped: { corridor: string; reason: string }[] = [];

  for (const spec of STANDING_CORRIDORS) {
    const rate = rateFor(spec.sellCurrency);
    if (rate == null || !Number.isFinite(rate) || rate <= 0) {
      skipped.push({ corridor: `${spec.sellCurrency}/${spec.buyCurrency}`, reason: 'no live rate — corridor not seeded (never fabricated)' });
      continue;
    }
    intents.push({
      intentId: `${spec.participantId}-${Math.floor(nowMs / 3_600_000)}`, // hourly deterministic rotation
      participantId: spec.participantId,
      sellCurrency: spec.sellCurrency,
      sellAmount: spec.amount,
      buyCurrency: spec.buyCurrency,
      buyAmountMin: null, // accept mid-market — we ARE the reference quote
      deadline: nowMs + 3_600_000, // rotate hourly
      remainingSell: spec.amount,
      status: 'open',
      createdAt: nowMs,
    });
  }

  return { intents, skipped };
}
