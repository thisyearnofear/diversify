/**
 * Guardian run-status store + pure health derivation.
 *
 * Cron endpoints (guardian-loop, guardian-heartbeat) record their terminal
 * outcome here; /api/agent/status reads it back to answer "is the Guardian
 * alive and working?" honestly — distinguishing a healthy idle beat from a
 * degraded or dead one instead of trusting the cron's HTTP 200 alone.
 */

import dbConnect from '../lib/mongodb';
import { GuardianRunLog, type GuardianRunKind, type GuardianRunTerminalStatus } from '../models/GuardianRunLog';

/** Expected cadence per run kind (ms). A run older than this is overdue. */
export const GUARDIAN_RUN_CADENCE_MS: Record<GuardianRunKind, number> = {
  // The loop cron fires every 5 minutes.
  loop: 5 * 60 * 1000,
  // The heartbeat cron fires roughly every 30 minutes (deployment cron).
  heartbeat: 30 * 60 * 1000,
};

/** A run is only considered "fresh" up to 3× its cadence late. */
export function guardianRunFreshnessWindowMs(kind: GuardianRunKind): number {
  return GUARDIAN_RUN_CADENCE_MS[kind] * 3;
}

export interface GuardianRunHealth {
  key: GuardianRunKind;
  /** ISO of the last completed run, or null if never recorded. */
  lastRunAt: string | null;
  /** Age of the last run in seconds (null when never recorded). */
  ageSeconds: number | null;
  /** Persisted terminal status of the last run. */
  status: GuardianRunTerminalStatus | null;
  summary?: Record<string, unknown>;
  error?: string;
  /**
   * Derived liveness: 'fresh' (ran within the window), 'stale' (ran, but
   * longer ago than 3× cadence), or 'never'.
   */
  freshness: 'fresh' | 'stale' | 'never';
  /** True when the Guardian is demonstrably working right now. */
  healthy: boolean;
}

export interface GuardianRunHealthSummary {
  loop: GuardianRunHealth;
  heartbeat: GuardianRunHealth;
}

/**
 * Pure: derive the health view for one run kind from a raw record.
 * Exportable for unit tests without Mongo.
 */
export function deriveGuardianRunHealth(
  kind: GuardianRunKind,
  record: {
    lastRunAt?: string;
    status?: GuardianRunTerminalStatus;
    summary?: Record<string, unknown>;
    error?: string;
  } | null,
  now: number = Date.now(),
): GuardianRunHealth {
  if (!record?.lastRunAt) {
    return {
      key: kind,
      lastRunAt: null,
      ageSeconds: null,
      status: null,
      freshness: 'never',
      healthy: false,
    };
  }
  const lastRunMs = new Date(record.lastRunAt).getTime();
  const ageMs = Number.isFinite(lastRunMs) ? Math.max(0, now - lastRunMs) : guardianRunFreshnessWindowMs(kind) + 1;
  const ageSeconds = Math.floor(ageMs / 1000);
  const freshness =
    ageMs <= guardianRunFreshnessWindowMs(kind) ? 'fresh' : 'stale';
  const status = record.status ?? null;
  // Working now = ran recently AND the last run was not a failure. An idle
  // beat is still a healthy Guardian.
  const healthy = freshness === 'fresh' && status !== 'failed';
  return {
    key: kind,
    lastRunAt: record.lastRunAt,
    ageSeconds,
    status,
    summary: record.summary,
    error: record.error,
    freshness,
    healthy,
  };
}

/**
 * Record the terminal outcome of a run. Fire-and-forget callers wrap this
 * in try/catch — recording must never change the cron's own behaviour.
 */
export async function recordGuardianRun(
  kind: GuardianRunKind,
  args: {
    status: GuardianRunTerminalStatus;
    summary?: Record<string, unknown>;
    error?: string;
    now?: string;
  },
): Promise<void> {
  await dbConnect();
  await GuardianRunLog.findOneAndUpdate(
    { key: kind },
    {
      $set: {
        lastRunAt: args.now ?? new Date().toISOString(),
        status: args.status,
        summary: args.summary ?? {},
        error: args.error,
      },
      $setOnInsert: { key: kind },
    },
    { upsert: true },
  ).lean();
}

/** Read both run kinds and derive their health views. */
export async function getGuardianRunHealth(
  now: number = Date.now(),
): Promise<GuardianRunHealthSummary> {
  await dbConnect();
  const docs = await GuardianRunLog.find({}).lean();
  const byKey = new Map(docs.map((d) => [d.key as GuardianRunKind, d as any]));
  return {
    loop: deriveGuardianRunHealth('loop', byKey.get('loop') ?? null, now),
    heartbeat: deriveGuardianRunHealth('heartbeat', byKey.get('heartbeat') ?? null, now),
  };
}
