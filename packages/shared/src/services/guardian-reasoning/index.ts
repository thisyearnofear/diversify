/**
 * Guardian reasoning domain — Phase 0 of the unified reasoning service.
 *
 * Docs: docs/guardian-reasoning-service.md. One deterministic, free,
 * provenance-honest reasoning floor that the heartbeat (and, in later
 * phases, the loop and the Arc marketplace agent) consume.
 *
 * Hard invariants (doc §8):
 * - A signal with `live: false` can never be quoted as observed or drive a
 *   decision (the heartbeat fallback-honesty rule, generalized).
 * - Same signals ⇒ same draft, byte-for-byte (golden-tested).
 * - This module must NEVER import executor or Mongo-dependent modules —
 *   reasoning produces what-and-why; gates authorize; the executor moves.
 */

// ---------------------------------------------------------------------------
// Layer B — signals
// ---------------------------------------------------------------------------
// (artifact.ts — Phase 1's unified GuardianDecision + buildAdvisoryReasoning —
// lives beside this file and re-exports through the barrel below.)

/** A provenance-tracked observation. `live: false` disqualifies it from
 *  reasoning text and gate math — producers map provider failures to
 *  `live: false`, never to a plausible-looking value. */
export interface GuardianSignal {
  key: string; // 'inflation.us.cpi' | 'yield.stable.topApy' | 'price.btc' | ...
  value: number | string | null;
  unit?: string;
  source: string; // 'world-bank' | 'defillama' | 'coingecko' | ...
  live: boolean;
  capturedAt: string;
}

export interface GuardianDraft {
  action: string;
  targetToken: string;
  confidence: number;
  /** Why — self-verifying text: every quoted figure names its live source. */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Layer A — gates (floor). Execution concurrency is deliberately NOT a gate.
// ---------------------------------------------------------------------------

export type GateId = string;

export interface GateContext {
  draft?: GuardianDraft;
  signals: GuardianSignal[];
  /** ISO timestamp of evaluation; defaults omitted for pure tests. */
  now?: string;
}

export interface GateResult {
  allowed: boolean;
  /** Stable machine reason code (e.g. 'daily_limit_reached'). */
  reason?: GateId;
  /** Human-readable explanation for journal/decision records. */
  detail?: string;
}

export type Gate = (ctx: GateContext) => GateResult;

export type EligibilityStatus = 'eligible' | 'declined';

export interface EligibilityVerdict {
  status: EligibilityStatus;
  reasons: GateId[];
}

/** Aggregates gates — the same evaluator will run on all three surfaces. */
export function evaluateGates(gates: Gate[], ctx: GateContext): EligibilityVerdict {
  const reasons: GateId[] = [];
  for (const gate of gates) {
    const result = gate(ctx);
    if (!result.allowed && result.reason) reasons.push(result.reason);
  }
  return { status: reasons.length > 0 ? 'declined' : 'eligible', reasons };
}

// ---------------------------------------------------------------------------
// Deterministic synthesizer — extracted verbatim from the heartbeat's
// `pickRecommendation` so Phase 0 output is byte-identical.
// ---------------------------------------------------------------------------

/** Heartbeat market snapshot shape (provenance-tracked). Kept structurally
 *  identical to the route's `MarketSnapshot` — see `toHeartbeatSnapshot`. */
export interface HeartbeatMarketSnapshot {
  defillama: {
    live: boolean;
    pools: { protocol: string; apy: number; tvl: number }[];
  };
  coingecko: {
    live: boolean;
    bitcoin: number | null;
    pax_gold: number | null;
  };
  worldBank: {
    /** True only when the request succeeded AND a finite value was returned. */
    live: boolean;
    current_inflation: number | null;
  };
  timestamp: string;
}

export interface HeartbeatRecommendation {
  action: string;
  targetToken: string;
  reasoning: string;
  confidence: number;
}

/**
 * Deterministic advisory synthesizer — the free floor.
 *
 * Moved byte-for-byte from `guardian-heartbeat.ts::pickRecommendation`;
 * the golden tests in `deterministic-synthesizer.test.ts` pin its output
 * across live / partial-down / all-down fixtures.
 *
 * Only observed figures enter the reasoning; each carries its live source.
 * Decisions gate on the driving datum being LIVE.
 */
export function synthesizeHeartbeatAdvisory(
  snapshot: HeartbeatMarketSnapshot,
): HeartbeatRecommendation {
  const inflation = snapshot.worldBank.current_inflation;
  const btcPrice = snapshot.coingecko.bitcoin;
  const paxGoldPrice = snapshot.coingecko.pax_gold;
  const topYield = snapshot.defillama.pools[0];

  // Simple rule-based logic — real AI synthesis happens via the gateway,
  // but for the heartbeat we want deterministic, auditable reasoning.
  const dataPoints: string[] = [];
  if (inflation !== null) dataPoints.push(`Inflation: ${inflation}% (World Bank CPI, live)`);
  if (btcPrice !== null) dataPoints.push(`BTC: $${btcPrice.toLocaleString()} (CoinGecko, live)`);
  if (paxGoldPrice !== null) dataPoints.push(`PAXG: $${paxGoldPrice.toLocaleString()} (CoinGecko, live)`);
  if (topYield && topYield.apy > 0) {
    dataPoints.push(`Top yield: ${topYield.protocol} at ${topYield.apy.toFixed(2)}% APY ($${(topYield.tvl / 1e6).toFixed(1)}M TVL, DeFiLlama, live)`);
  }

  // Name what could not be observed so the recorded advisory never reads as
  // if those sources had spoken — the on-chain reasoning is immutable, so a
  // missing source is disclosed, never defaulted.
  const unavailable: string[] = [];
  if (inflation === null) unavailable.push('World Bank CPI');
  if (!snapshot.coingecko.live) unavailable.push('CoinGecko prices');
  if (!snapshot.defillama.live) unavailable.push('DeFiLlama yields');
  const caveat =
    unavailable.length > 0
      ? ` Sources unavailable this beat: ${unavailable.join(', ')} — no fallback figures were used.`
      : '';

  const dataLine = dataPoints.length > 0 ? `${dataPoints.join(', ')}.` : '';

  if (inflation !== null && inflation > 3.5) {
    const reasoning =
      `High inflation (${inflation}%) detected (World Bank CPI, live). ` +
      `Recommend cUSD savings position on Celo to preserve purchasing power. ${dataLine}${caveat}`;
    return { action: 'ADVISORY_HEARTBEAT', targetToken: 'cUSD', reasoning, confidence: 0.72 };
  }

  if (topYield && topYield.apy > 5) {
    const reasoning =
      `Attractive yield opportunity: ${topYield.protocol} at ${topYield.apy.toFixed(2)}% APY (DeFiLlama, live). ` +
      `Recommend USDC deployment on Arbitrum. ${dataLine}${caveat}`;
    return { action: 'ADVISORY_HEARTBEAT', targetToken: 'USDC', reasoning, confidence: 0.68 };
  }

  // Default: hold cEUR as the steady-state core. "Stable regime" is only
  // claimed when inflation was actually measured below the threshold.
  if (inflation !== null && inflation <= 3.5) {
    const reasoning =
      `Stable regime measured: inflation ${inflation}% (World Bank CPI, live). ` +
      `Recommend holding cEUR as inflation hedge. ${dataLine}${caveat}`;
    return { action: 'ADVISORY_HEARTBEAT', targetToken: 'cEUR', reasoning, confidence: 0.65 };
  }

  const reasoning = (
    'No actionable live signal this beat — inflation not measured' +
    (topYield ? ' and yields below the 5% threshold' : '') +
    '. Recommend holding the cEUR core; no fallback market figures were used.' +
    ` ${dataLine}${caveat}`
  ).trim();
  return { action: 'ADVISORY_HEARTBEAT', targetToken: 'cEUR', reasoning, confidence: 0.6 };
}

/**
 * Map the heartbeat snapshot to `GuardianSignal`s (the bundle the gate layer
 * and, from Phase 1, the shared decision artifact consume). Provenance-honest:
 * nulls map to `live: false` with `value: null`, never to a default figure.
 */
export function toGuardianSignals(snapshot: HeartbeatMarketSnapshot): GuardianSignal[] {
  const signals: GuardianSignal[] = [];
  const inflation = snapshot.worldBank.current_inflation;
  if (inflation !== null) {
    signals.push({
      key: 'inflation.us.cpi',
      value: inflation,
      unit: '%',
      source: 'world-bank',
      live: true,
      capturedAt: snapshot.timestamp,
    });
  }
  if (snapshot.coingecko.bitcoin !== null) {
    signals.push({
      key: 'price.btc',
      value: snapshot.coingecko.bitcoin,
      unit: 'USD',
      source: 'coingecko',
      live: true,
      capturedAt: snapshot.timestamp,
    });
  }
  if (snapshot.coingecko.pax_gold !== null) {
    signals.push({
      key: 'price.paxg',
      value: snapshot.coingecko.pax_gold,
      unit: 'USD',
      source: 'coingecko',
      live: true,
      capturedAt: snapshot.timestamp,
    });
  }
  const topYield = snapshot.defillama.pools[0];
  if (topYield && topYield.apy > 0) {
    signals.push({
      key: 'yield.stable.topApy',
      value: topYield.apy,
      unit: '%APY',
      source: 'defillama',
      live: true,
      capturedAt: snapshot.timestamp,
    });
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Phase 1 — the unified decision artifact (re-exported from artifact.ts)
// ---------------------------------------------------------------------------

export type {
  GuardianSurface,
  GuardianCohort,
  DecisionRecordKind,
  GuardianDecisionArtifact,
  LedgerParams,
  LedgerParamOverrides,
} from './artifact';
export {
  buildAdvisoryReasoning,
  decisionToLedgerParams,
  surfaceToServingModel,
} from './artifact';

// ---------------------------------------------------------------------------
// Phase 3 — the cross-surface replay harness
// ---------------------------------------------------------------------------

export type { ReplaySurface, ReplaySurfaceProjection, ReplayFixture, ReplayResult, ReplaySurfacesResult } from './harness';
export {
  replaySignalFixture,
  assertReplayContract,
  findQuotedDeadSignals,
  textQuotesUnlabeledFigures,
  describeReplay,
  harness,
} from './harness';
