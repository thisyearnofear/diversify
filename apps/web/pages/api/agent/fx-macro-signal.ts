/**
 * POST /api/agent/fx-macro-signal — the measured FX-move macro producer.
 *
 * Why this exists: the `LiveLine` beats (Home / Guardian / Shield) and the
 * corridor dateline render `MACRO_SIGNAL:*` records that are fresh,
 * attributable and readable. Before this route the only producer was the
 * stablecoin depeg monitor, whose `PRICE_DEVIATION` action requires a >1%
 * measured deviation — so in calm markets every ledger held zero renderable
 * beats and the line had no data source at all.
 *
 * This is the same honesty pattern, generalised off a different measured
 * source (the open FX dataset, a fixed endpoint — never scraped text and
 * never a model classification):
 *
 *   - the claim is a measured move that ALREADY happened, with the
 *     provider's own dates and rates;
 *   - one run anchors at most `MAX_ANCHORS` records, so a scheduled tick
 *     cannot flood the ledger;
 *   - it never queues a recommendation, never writes Guardian state and
 *     never writes user memory — an observation is not a portfolio action;
 *   - a code with no corridor token is not attributable, so it is dropped
 *     rather than anchored against `NONE`;
 *   - dry-run by default: `apply: true` is required to write anything.
 *
 * Auth mirrors the Firecrawl webhook's server-to-server contract
 * (`x-guardian-secret`, from `GUARDIAN_LOOP_SECRET`).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { recommendationLedgerService } from '@diversifi/shared/src/services/recommendation-ledger.service';
import { constantTimeEqual } from '@diversifi/shared/src/utils/security';
import {
  FX_MOVE_DEFAULT_WINDOW_DAYS,
  fxMoveReasoning,
  readFxMoveMeasurements,
  selectMaterialFxMoves,
  type FxMoveMeasurement,
} from '@diversifi/shared/src/services/guardian/fx-move-measurement';
import { rememberLedgerReasoning } from '@/lib/ledger-reasoning-store';
import { corridorTokenForCurrency } from '@/lib/corridor-context';
import { CURRENCY_RISK_DATA } from '@/constants/currency-risk';
import {
  REHEARSAL_LABEL,
  REHEARSAL_SIGNAL_ACTION,
} from '@/lib/macro-rehearsal';
import { GUARDIAN_AGENT_ADDRESS } from '../../../constants/guardian-identity';

/** The reader-facing action a real measured move anchors under. */
export const FX_MOVE_SIGNAL_ACTION = 'MACRO_SIGNAL:FX_MOVE';

/** Bound on ledger writes per run — a tick surfaces the largest moves, not all. */
const MAX_ANCHORS = 5;

const SECRET = (() => {
  const secret = process.env.GUARDIAN_LOOP_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'GUARDIAN_LOOP_SECRET environment variable is required in production. ' +
      'Set it in the API runtime .env and restart so the FX macro-signal route is authenticated.',
    );
  }
  console.warn('[fx-macro-signal] GUARDIAN_LOOP_SECRET not set — route is UNAUTHENTICATED. Do NOT use in production.');
  return '';
})();

/**
 * The currencies this route may speak about: a curated risk entry AND a
 * corridor token, so the record's `targetToken` can be attributed back to a
 * fiat code by the reader (`corridorSideFor`). Anything else is unattributable
 * and is dropped.
 */
function attributableCodes(): string[] {
  const codes: string[] = [];
  for (const entry of CURRENCY_RISK_DATA) {
    if (!entry?.code) continue;
    if (!corridorTokenForCurrency(entry.code)) continue;
    codes.push(entry.code.toUpperCase());
  }
  return codes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (SECRET) {
    const provided = req.headers['x-guardian-secret'] ?? req.body?.secret;
    const normalized = Array.isArray(provided) ? provided[0] : provided;
    if (typeof normalized !== 'string' || !constantTimeEqual(normalized, SECRET)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const body = (req.body ?? {}) as {
    apply?: unknown;
    rehearsal?: unknown;
    codes?: unknown;
    windowDays?: unknown;
  };
  const apply = body.apply === true;
  const rehearsal = body.rehearsal === true;
  const windowDays =
    typeof body.windowDays === 'number' && Number.isFinite(body.windowDays) && body.windowDays > 0
      ? Math.min(90, Math.floor(body.windowDays))
      : FX_MOVE_DEFAULT_WINDOW_DAYS;

  // Only curated+attributable codes; a caller-supplied subset is intersected,
  // never trusted, so this route can't be pointed at an arbitrary currency.
  const allowed = attributableCodes();
  const requested = Array.isArray(body.codes)
    ? body.codes.filter((c): c is string => typeof c === 'string').map((c) => c.toUpperCase())
    : null;
  const codes = requested ? allowed.filter((c) => requested.includes(c)) : allowed;

  if (codes.length === 0) {
    return res.status(200).json({
      ok: true,
      action: 'no_attributable_currency',
      measured: 0,
      material: 0,
      anchored: [],
      usersUpdated: 0,
    });
  }

  let measurements: FxMoveMeasurement[];
  try {
    measurements = await readFxMoveMeasurements(codes, { windowDays });
  } catch (error) {
    // Provider unavailable → record nothing rather than an unmeasured claim.
    const message = error instanceof Error ? error.message : 'measurement unavailable';
    console.warn('[fx-macro-signal] measurement unavailable:', message);
    return res.status(200).json({ ok: false, action: 'measurement_unavailable', error: message, anchored: [] });
  }

  const material = selectMaterialFxMoves(measurements, MAX_ANCHORS);

  if (!apply) {
    return res.status(200).json({
      ok: true,
      action: 'dry_run',
      dryRun: true,
      rehearsal,
      windowDays,
      measured: measurements.length,
      material: material.length,
      proposals: material.map((m) => ({
        code: m.code,
        targetToken: corridorTokenForCurrency(m.code),
        movePercent: m.movePercent,
        fromDate: m.fromDate,
        toDate: m.toDate,
        line: fxMoveReasoning(m),
      })),
      anchored: [],
      usersUpdated: 0,
      executionEligibility: 'observation_only',
    });
  }

  const anchored: Array<Record<string, unknown>> = [];
  for (const m of material) {
    const targetToken = corridorTokenForCurrency(m.code);
    // Re-checked per item: attributableCodes() already guarantees it, but a
    // record with no corridor token would be an unattributable claim on-chain.
    if (!targetToken) continue;

    const action = rehearsal ? REHEARSAL_SIGNAL_ACTION : FX_MOVE_SIGNAL_ACTION;
    const reasoning = rehearsal ? `${REHEARSAL_LABEL} ${fxMoveReasoning(m)}` : fxMoveReasoning(m);

    const anchor = await recommendationLedgerService.recordRecommendation({
      user: GUARDIAN_AGENT_ADDRESS,
      action,
      targetToken,
      reasoning,
      evidenceCid: '',
      servingModel: 'fx-rate-monitor',
      confidence: 0,
    });

    // The chain stores only the reasoning hash — echo the readable line
    // off-chain so the beats engine can render words. Best-effort: a missed
    // echo degrades to hash-only, which the reader correctly skips.
    if (anchor.status !== 'failed') {
      await rememberLedgerReasoning({
        chainId: anchor.chainId,
        recordId: anchor.status === 'anchored' ? anchor.id : undefined,
        txHash: anchor.txHash,
        action,
        targetToken,
        reasoning,
      });
    }

    anchored.push({
      code: m.code,
      targetToken,
      movePercent: m.movePercent,
      action,
      status: anchor.status,
      chainId: anchor.status === 'failed' ? undefined : anchor.chainId,
      txHash: anchor.status === 'failed' ? undefined : anchor.txHash,
      recordId: anchor.status === 'anchored' ? anchor.id : undefined,
      error: anchor.status === 'failed' ? anchor.error : undefined,
    });
  }

  return res.status(200).json({
    ok: true,
    action: rehearsal ? 'rehearsal_recorded' : 'fx_moves_recorded',
    ...(rehearsal ? { rehearsal: true } : {}),
    measured: measurements.length,
    material: material.length,
    anchored,
    // No queueing, no Guardian state, no memory: an observation is not a
    // portfolio action, and this route cannot authorize one.
    usersUpdated: 0,
    executionEligibility: 'observation_only',
  });
}
