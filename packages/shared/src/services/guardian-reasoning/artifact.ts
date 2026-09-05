/**
 * The unified Guardian decision artifact — Phase 1 of the reasoning-service
 * plan (docs/guardian-reasoning-service.md §5).
 *
 * Every Guardian surface (auto-execution loop, advisory heartbeat, Arc
 * marketplace agent) composes its on-chain `reasoning` text through ONE
 * builder so the same facts produce the same words everywhere: data points
 * name their live source, unavailable sources are disclosed, and cohort
 * framing is a prefix that travels with the draft instead of being
 * re-handwritten at each call site. `servingModel` stays the *origin* label —
 * same facts, same wording, different origin stamps is the unification.
 *
 * Invariants (doc §8):
 * - A signal with `live: false` can never be quoted as observed.
 * - Identical (draft facts, signals, cohort) ⇒ byte-identical reasoning.
 * - No executor or Mongo-dependent imports in this module.
 */

import type { GuardianDraft, GuardianSignal, EligibilityVerdict } from './index';

// Re-exported for artifact consumers so `GuardianSignal` resolves from the
// same module surface the builder types live on.
export type { GuardianSignal, GuardianDraft, EligibilityVerdict };

export type GuardianSurface =
  | 'guardian-loop'
  | 'heartbeat'
  | 'arc-marketplace';

/** Cohort framing — one canonical prefix per cohort, defined once. */
export type GuardianCohort =
  | 'global'
  | 'confucian'
  | 'pan_caribbean';

const COHORT_PREFIX: Record<GuardianCohort, string> = {
  global: '',
  confucian: 'APAC savings advisory (Confucian/Gotong Royong cohort): hold stablecoin core on the APAC rail. ',
  pan_caribbean: 'Caribbean savings advisory (Pan-Caribbean cohort): hold USD-pegged stablecoin core on Celo. ',
};

/**
 * How this record reaches the ledger — keep distinct from WHO reasoned
 * (`surface`), because one surface emits several record kinds:
 * the heartbeat's primary advisory, its 0G evidence mirror, and the loop's
 * post-execution evidence mirror are all `EVIDENCE_MIRROR`-style records
 * whose `reasoning` references another record.
 */
export type DecisionRecordKind =
  | 'advisory'
  | 'autonomous-execution'
  | 'cycle-execution'
  | 'evidence-mirror';

export interface GuardianDecisionArtifact {
  surface: GuardianSurface;
  recordKind: DecisionRecordKind;
  /** What was concluded (Phase 0's draft — synthesized, LLM-ranked, or loop-queued). */
  draft: GuardianDraft;
  /** The provenance-honest observations behind the draft. */
  signals: GuardianSignal[];
  /** Gate outcome. Advisory surfaces usually carry an implicit eligible verdict. */
  verdict?: EligibilityVerdict;
  /** Optional cohort framing prefix (heartbeat regional advisories). */
  cohort?: GuardianCohort;
  /** For evidence mirrors: the kind + status + chain of the record being mirrored. */
  mirror?: { anchorStatus: string; chainId: number | string; primaryReasoning?: string };
}

/** Render one signal as a quoted data point — NEVER for `live: false`. */
function renderSignal(signal: GuardianSignal): string {
  if (!signal.live || signal.value === null) return '';
  const withUnit = signal.unit ? `${signal.value}${signal.unit}` : String(signal.value);
  return `${signal.key}: ${withUnit} (${signal.source}, live)`;
}

/**
 * The ONE reasoning-text builder (doc §5: `buildAdvisoryReasoning`).
 *
 * Composition, in order:
 *   1. cohort prefix (empty for global)
 *   2. kind-specific body:
 *      - advisory: draft.reasoning, then live data points, then outage disclosure
 *      - autonomous/cycle execution: draft.reasoning (the loop composes the
 *        operational detail — cycle dates, amounts — which are execution
 *        facts, not market signals), then live data points, then disclosure
 *      - evidence mirror: a deterministic reference to the mirrored record
 *   3. gate-decline disclosure when a verdict carries reasons
 *
 * Deterministic: same artifact ⇒ byte-identical string (golden-tested across
 * surfaces in `__tests__/artifact.golden.test.ts`).
 */
export function buildAdvisoryReasoning(decision: GuardianDecisionArtifact): string {
  const prefix = COHORT_PREFIX[decision.cohort ?? 'global'];

  if (decision.recordKind === 'evidence-mirror') {
    const m = decision.mirror;
    return `${prefix}Evidence anchor for ${m?.anchorStatus ?? 'unknown'} rec on chain ${m?.chainId ?? 'unknown'}: ${m?.primaryReasoning ?? decision.draft.reasoning}`.trim();
  }

  const body = decision.draft.reasoning || 'Guardian advisory';

  const dataPoints = decision.signals
    .map(renderSignal)
    .filter((line) => line.length > 0);

  const unavailable = decision.signals
    .filter((s) => !s.live)
    .map((s) => s.source);

  let text = `${prefix}${body}`;
  if (dataPoints.length > 0) {
    text += ` ${dataPoints.join(', ')}.`;
  }
  if (unavailable.length > 0) {
    text += ` Sources unavailable this beat: ${unavailable.join(', ')} — no fallback figures were used.`;
  }

  const declined = decision.verdict?.status === 'declined' && (decision.verdict.reasons.length > 0);
  if (declined) {
    text += ` Gates declined: ${decision.verdict!.reasons.join(', ')}.`;
  }

  return text.trim();
}

/** Origin stamps — `servingModel` keeps its role as the origin label. */
export function surfaceToServingModel(
  surface: GuardianSurface,
  recordKind: DecisionRecordKind,
): string {
  if (surface === 'heartbeat') {
    return recordKind === 'evidence-mirror' ? 'guardian-heartbeat-mirror' : 'guardian-heartbeat';
  }
  if (surface === 'guardian-loop') {
    if (recordKind === 'cycle-execution') return 'guardian-loop-cycle';
    return recordKind === 'evidence-mirror' ? 'guardian-loop-mirror' : 'guardian-loop';
  }
  return 'guardian-ai';
}

export interface LedgerParams {
  action: string;
  targetToken: string;
  reasoning: string;
  servingModel: string;
  confidence: number;
}

/**
 * Call-site overrides — the escape hatches real records need, kept explicit
 * so the default path (everything derived from the decision) stays canonical:
 * - `actionOverride`: evidence mirrors stamp `EVIDENCE_MIRROR`, not the
 *   draft's advisory action.
 * - `targetTokenOverride`: cohort receipts pin a settlement token (APAC →
 *   USDC on HashKey, Caribbean → cUSD on Celo) regardless of the draft.
 * - `servingModelOverride`: the Arc agent keeps its own `guardian-ai` stamp.
 * - `bodyOverride`: the loop's execution/cycle reasons carry operational
 *   detail (cycle dates, amounts) that are execution facts, not market
 *   signals — passed through verbatim in place of `draft.reasoning`.
 * - `mirrorBody`: full control of a mirror's reference line when the caller
 *   already composed it (legacy parity for the heartbeat mirror).
 */
export interface LedgerParamOverrides {
  actionOverride?: string;
  targetTokenOverride?: string;
  servingModelOverride?: string;
  bodyOverride?: string;
  mirrorBody?: string;
}

/**
 * Map a decision to the `recordRecommendation` param fields every surface
 * must agree on: reasoning comes from the ONE builder; confidence is basis
 * points; the origin stamp is derived, never hand-typed (unless explicitly
 * overridden).
 */
export function decisionToLedgerParams(
  decision: GuardianDecisionArtifact,
  overrides: LedgerParamOverrides = {},
): LedgerParams {
  let reasoning: string;
  if (overrides.mirrorBody !== undefined && decision.recordKind === 'evidence-mirror') {
    const prefix = COHORT_PREFIX[decision.cohort ?? 'global'];
    reasoning = `${prefix}${overrides.mirrorBody}`.trim();
  } else if (overrides.bodyOverride !== undefined && decision.recordKind !== 'evidence-mirror') {
    reasoning = buildAdvisoryReasoning({
      ...decision,
      draft: { ...decision.draft, reasoning: overrides.bodyOverride },
    });
  } else {
    reasoning = buildAdvisoryReasoning(decision);
  }

  return {
    action: overrides.actionOverride ?? decision.draft.action,
    targetToken: overrides.targetTokenOverride ?? decision.draft.targetToken,
    reasoning,
    servingModel:
      overrides.servingModelOverride ??
      surfaceToServingModel(decision.surface, decision.recordKind),
    confidence: Math.round(decision.draft.confidence * 10000),
  };
}
