/**
 * Atomic weekly Guardian activity counters (one doc per ISO week).
 *
 * Writers: the Guardian loop (checks/executions/declines + measured decision
 * durations). Readers: the public telemetry API, which exposes counts + the
 * median of the duration samples only — never per-user data.
 */

import dbConnect from '@/lib/mongodb';
import { GuardianActivityCounter } from '@/models/GuardianActivityCounter';
import { median } from './agent/guardian-telemetry-stats';

/** Rolling upper bound on duration samples per week doc. */
export const MAX_DURATION_SAMPLES = 500;

export interface GuardianActivityPatch {
  checks?: number;
  executions?: number;
  declines?: number;
  /** A real measured wall-clock duration for one decision, in ms. */
  durationMs?: number;
}

export interface GuardianActivitySummary {
  week: string;
  checks: number;
  executions: number;
  declines: number;
  /** Median over timed samples only; null when nothing has been measured. */
  medianDecisionMs: number | null;
  timedSampleCount: number;
}

/** ISO-8601 week key (UTC), e.g. '2026-W39'. */
export function isoWeekKey(now: number = Date.now()): string {
  const d = new Date(now);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Fire-and-forget bump: the loop must never fail a tick because a
 * telemetry counter write did.
 */
export async function bumpGlobalActivity(
  patch: GuardianActivityPatch,
  now: number = Date.now(),
): Promise<void> {
  try {
    await dbConnect();
  } catch {
    return;
  }
  const week = isoWeekKey(now);
  const $inc: Record<string, number> = {};
  if (patch.checks) $inc.checks = patch.checks;
  if (patch.executions) $inc.executions = patch.executions;
  if (patch.declines) $inc.declines = patch.declines;

  const update: Record<string, unknown> = { $setOnInsert: { week } };
  if (Object.keys($inc).length > 0) update.$inc = $inc;
  if (patch.durationMs !== undefined && Number.isFinite(patch.durationMs) && patch.durationMs >= 0) {
    update.$push = {
      durationMsSamples: { $each: [Math.round(patch.durationMs)], $slice: -MAX_DURATION_SAMPLES },
    };
  }
  if (Object.keys($inc).length === 0 && update.$push === undefined) return;

  await GuardianActivityCounter.findOneAndUpdate(
    { week },
    update,
    { upsert: true },
  ).lean().catch(() => undefined);
}

export async function getGlobalActivitySummary(
  now: number = Date.now(),
): Promise<GuardianActivitySummary | null> {
  await dbConnect();
  const week = isoWeekKey(now);
  const doc = await GuardianActivityCounter.findOne({ week }).lean();
  if (!doc) return null;
  const samples = Array.isArray(doc.durationMsSamples) ? doc.durationMsSamples : [];
  return {
    week,
    checks: doc.checks ?? 0,
    executions: doc.executions ?? 0,
    declines: doc.declines ?? 0,
    medianDecisionMs: median(samples),
    timedSampleCount: samples.length,
  };
}
