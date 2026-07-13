import dbConnect from '../../../lib/mongodb';
import { GuardianState } from '../../../models/GuardianState';
import type { GuardianRecommendationContract } from '@diversifi/shared/src/types/guardian-protection';

export interface GuardianRecommendationSnapshot {
  capturedAt: string;
  source: 'advisor-analysis' | 'proactive-yield' | 'cycle-monitor' | 'firecrawl-webhook';
  action?: string;
  targetToken?: string;
  oneLiner?: string;
  reasoning?: string;
  /** Purchase-cycle monitor — dedupe key when source is cycle-monitor */
  cycleId?: string;
  paymentDate?: string;
  localCurrency?: string;
  /** USD obligation for purchase-cycle protection (distinct from tradeAmountUSD) */
  targetAmountUsd?: number;
  contract?: GuardianRecommendationContract;
  /**
   * Notional size of the swap in USD — the amount actually spent. This is
   * distinct from `expectedSavings` (projected annual purchasing-power
   * preserved). The Guardian loop sizes trades and accounts against the
   * daily limit using THIS field, never `expectedSavings`.
   */
  tradeAmountUSD?: number;
  expectedSavings?: number;
  confidence?: number;
  riskLevel?: string;
  protocol?: string;
  chain?: string;
  marketSymbol?: string;
  apy?: number;
  tvl?: number;
  researchEvidence?: {
    summary?: string;
    bundle?: {
      confidence: number;
      agreementScore: number;
      freshnessScore: number;
      averageReputation: number;
      sourceCount: number;
    };
    sources?: Array<{
      sourceId: string;
      label: string;
      tier?: 'free' | 'paid';
      dataType?: string;
      category?: string;
      cost?: number;
      freshnessMinutes?: number;
      reputation?: number;
    }>;
  };
}

export interface GuardianAnchorRecord {
  status: 'pending' | 'anchored' | 'failed';
  txHash?: string;
  explorerUrl?: string;
  id?: number;
  error?: string;
  capturedAt: string;
}

export interface GuardianStateRecord {
  /**
   * Head of `recommendationQueue` — kept for backward-compatible readers
   * (permission API, AgentTierStatus, rebalance). Prefer enqueue/dequeue
   * helpers over writing this field directly.
   */
  latestRecommendation?: GuardianRecommendationSnapshot;
  /**
   * Bounded pending recommendations, newest-first. Prevents cycle/yield/
   * macro writers from clobbering each other via a single pointer.
   */
  recommendationQueue?: GuardianRecommendationSnapshot[];
  latestAnchor?: GuardianAnchorRecord;
  /**
   * Last N anchor records, newest-first. Bounded to `MAX_ANCHOR_HISTORY`
   * entries on every write via `pushAnchorHistory`. The proof feed
   * renders the most recent entries; `latestAnchor` remains the
   * single-source-of-truth pointer for callers that only need the
   * most recent one.
   */
  latestAnchors?: GuardianAnchorRecord[];
  /**
   * Map of alertId → unix epoch ms when the alert was last emitted.
   * Per-user (server-side) cooldowns for the proactive monitoring loop.
   * Pruned to a 4× cooldown window on every write.
   */
  alertCooldowns?: Record<string, number>;
}

/**
 * Upper bound on `latestAnchors`. Five entries is enough to show a
 * rolling recent history in the proof feed without bloating the
 * per-user JSON file.
 */
export const MAX_ANCHOR_HISTORY = 5;

/** Upper bound on pending recommendations per user. */
export const MAX_RECOMMENDATION_QUEUE = 5;

function normalizeUserAddress(userAddress: string): string {
  return userAddress.trim().toLowerCase();
}

/** Fields persisted on the GuardianState document that we project back out. */
const STATE_FIELDS: Array<keyof GuardianStateRecord> = [
  'latestRecommendation',
  'recommendationQueue',
  'latestAnchor',
  'latestAnchors',
  'alertCooldowns',
];

/**
 * Stable identity for deduping queue entries. Cycle monitors key by cycleId;
 * other sources key by source+action+target so a newer yield alert replaces
 * an older one for the same opportunity without wiping unrelated proposals.
 */
export function recommendationIdentityKey(rec: GuardianRecommendationSnapshot): string {
  if (rec.source === 'cycle-monitor' && rec.cycleId) {
    return `cycle-monitor:${rec.cycleId}`;
  }
  const target = (rec.targetToken || '').toLowerCase();
  if (rec.source && rec.action) {
    return `${rec.source}:${rec.action}:${target}`;
  }
  return rec.capturedAt;
}

/**
 * Pure helper: upsert `next` into a newest-first queue, replacing any prior
 * entry with the same identity key, then cap length.
 */
export function mergeRecommendationQueue(
  existing: GuardianRecommendationSnapshot[] | undefined,
  next: GuardianRecommendationSnapshot,
  cap: number = MAX_RECOMMENDATION_QUEUE,
): GuardianRecommendationSnapshot[] {
  const key = recommendationIdentityKey(next);
  const withoutDup = (existing ?? []).filter((r) => recommendationIdentityKey(r) !== key);
  return [next, ...withoutDup].slice(0, Math.max(0, cap));
}

/**
 * Normalize legacy single-pointer state into a queue. Used by enqueue/dequeue
 * so older documents without `recommendationQueue` still behave correctly.
 */
export function resolveRecommendationQueue(
  state: Pick<GuardianStateRecord, 'recommendationQueue' | 'latestRecommendation'> | null | undefined,
): GuardianRecommendationSnapshot[] {
  if (state?.recommendationQueue && state.recommendationQueue.length > 0) {
    return state.recommendationQueue;
  }
  return state?.latestRecommendation ? [state.latestRecommendation] : [];
}

function toStateRecord(doc: Record<string, any> | null): GuardianStateRecord | null {
  if (!doc) return null;
  const record: GuardianStateRecord = {};
  for (const field of STATE_FIELDS) {
    if (doc[field] !== undefined && doc[field] !== null) {
      (record as any)[field] = doc[field];
    }
  }
  // Keep the legacy pointer aligned with the queue head for readers that
  // only look at latestRecommendation.
  if (record.recommendationQueue && record.recommendationQueue.length > 0) {
    record.latestRecommendation = record.recommendationQueue[0];
  }
  return record;
}

/**
 * Pure helper: prune an alertCooldowns map down to entries fired within
 * the most recent `windowMs`. Older entries are dropped to keep the
 * per-user JSON file bounded.
 */
export function pruneAlertCooldowns(
  cooldowns: Record<string, number>,
  windowMs: number,
  now: number = Date.now(),
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(cooldowns).filter(([, timestamp]) => now - timestamp <= windowMs),
  );
}

/**
 * Pure helper: prepend `next` to `history` and cap the result at
 * `MAX_ANCHOR_HISTORY` entries (newest first). Empty `history` is
 * treated as `[]` so the caller does not have to special-case the
 * first anchor for a user.
 */
export function pushAnchorHistory(
  history: GuardianAnchorRecord[] | undefined,
  next: GuardianAnchorRecord,
  cap: number = MAX_ANCHOR_HISTORY,
): GuardianAnchorRecord[] {
  return [next, ...(history ?? [])].slice(0, Math.max(0, cap));
}

export async function getGuardianState(userAddress: string): Promise<GuardianStateRecord | null> {
  await dbConnect();
  const doc = await GuardianState.findOne({ userAddress: normalizeUserAddress(userAddress) }).lean();
  return toStateRecord(doc as Record<string, any> | null);
}

/**
 * Atomically merge `partial` into a user's Guardian state. Setting a field to
 * `undefined` clears it (translated to a Mongo `$unset`). This is a single
 * atomic findOneAndUpdate, so concurrent writers (cron loop + webhook) no
 * longer clobber each other the way the old read-modify-write file store did.
 */
export async function updateGuardianState(
  userAddress: string,
  partial: Partial<GuardianStateRecord>,
): Promise<GuardianStateRecord> {
  await dbConnect();
  const normalized = normalizeUserAddress(userAddress);

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) {
      $unset[key] = '';
    } else {
      $set[key] = value;
    }
  }

  const update: Record<string, unknown> = { $setOnInsert: { userAddress: normalized } };
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys($unset).length > 0) update.$unset = $unset;

  const doc = await GuardianState.findOneAndUpdate(
    { userAddress: normalized },
    update,
    { new: true, upsert: true },
  ).lean();

  return toStateRecord(doc as Record<string, any>) || {};
}

/**
 * Atomically claim the per-user execution lock. Returns the lock token (the
 * claim's ISO timestamp) if the caller won the lock, or `null` if another tick
 * already holds a fresh one. The token MUST be passed back to
 * `releaseExecutionLock` so a tick only ever releases the lock it owns.
 *
 * This is pure per-user mutual exclusion: a caller wins only if NO lock
 * exists or the existing lock is stale (older than `staleMs`). The
 * staleness reclaim is the ONLY way to take a held lock, so a crashed tick
 * can't wedge a user forever while a live, in-flight tick is never preempted.
 *
 * `recommendationCapturedAt` is recorded on the lock for observability only —
 * it is deliberately NOT a claim condition. An earlier version let a caller
 * win whenever the stored recommendation differed, which allowed a newly
 * arrived recommendation (e.g. from the firecrawl webhook) to steal a live
 * lock mid-`rebalance()` and run a second execution concurrently.
 */
export async function claimExecutionLock(
  userAddress: string,
  recommendationCapturedAt: string | undefined,
  staleMs: number = 5 * 60 * 1000,
  now: number = Date.now(),
): Promise<string | null> {
  await dbConnect();
  const normalized = normalizeUserAddress(userAddress);
  const staleBefore = new Date(now - staleMs);
  const claimedAt = new Date(now);

  // Win the lock iff no document/lock exists or the lock is stale. Upsert
  // handles the first-ever write for a user.
  const res = await GuardianState.findOneAndUpdate(
    {
      userAddress: normalized,
      $or: [
        { executionLock: null },
        { 'executionLock.claimedAt': { $lt: staleBefore } },
      ],
    },
    {
      $set: { executionLock: { claimedAt, recommendationCapturedAt } },
      $setOnInsert: { userAddress: normalized },
    },
    { new: true, upsert: true },
  ).lean().catch((err: any) => {
    // Duplicate-key (11000) means another tick won the upsert race first.
    if (err?.code === 11000) return null;
    throw err;
  });

  return res !== null ? claimedAt.toISOString() : null;
}

/**
 * Release the per-user execution lock once a tick finishes — but ONLY if the
 * lock currently held matches `lockToken` (the value returned by the
 * `claimExecutionLock` that this tick won). This owner check closes a race:
 * if a slow tick A runs past `staleMs`, tick B can reclaim the stale lock and
 * start a second execution. Without the owner check, A's `finally` would then
 * delete B's live lock, reopening the double-execution window the lock exists
 * to prevent. With it, A's release is a no-op because the stored
 * `claimedAt` no longer matches A's token.
 */
export async function releaseExecutionLock(
  userAddress: string,
  lockToken: string,
): Promise<void> {
  await dbConnect();
  await GuardianState.findOneAndUpdate(
    {
      userAddress: normalizeUserAddress(userAddress),
      'executionLock.claimedAt': new Date(lockToken),
    },
    { $set: { executionLock: null } },
  );
}

/**
 * Enqueue a recommendation without clobbering unrelated pending proposals.
 * Upserts by identity key, newest-first, capped at `MAX_RECOMMENDATION_QUEUE`.
 * Mirrors queue head onto `latestRecommendation` for legacy readers.
 */
export async function enqueueRecommendation(
  userAddress: string,
  recommendation: GuardianRecommendationSnapshot,
): Promise<GuardianStateRecord> {
  const existing = await getGuardianState(userAddress);
  const queue = mergeRecommendationQueue(resolveRecommendationQueue(existing), recommendation);
  return updateGuardianState(userAddress, {
    recommendationQueue: queue,
    latestRecommendation: queue[0],
  });
}

/**
 * Atomically dequeue (claim) a specific pending recommendation for execution.
 * Returns true if THIS caller removed it, false if it was already gone — i.e.
 * another concurrent tick claimed it, or it was already cleared.
 *
 * Matching on `capturedAt` makes this the idempotency gate for auto-execution:
 * the recommendation is removed BEFORE the swap runs, so a given recommendation
 * can be executed at most once even if a slow `rebalance()` overran the
 * execution lock's staleness window and a second tick reclaimed the lock — that
 * tick finds the recommendation already gone and skips. It also means a swap
 * that may have already landed on-chain before a post-submit failure is never
 * blindly retried (the recommendation is already dequeued).
 *
 * With a multi-entry queue, only the matched entry is removed; the next head
 * is promoted to `latestRecommendation`.
 */
export async function dequeueRecommendation(
  userAddress: string,
  capturedAt: string,
): Promise<boolean> {
  await dbConnect();
  const normalized = normalizeUserAddress(userAddress);

  const doc = await GuardianState.findOne({
    userAddress: normalized,
    $or: [
      { 'latestRecommendation.capturedAt': capturedAt },
      { 'recommendationQueue.capturedAt': capturedAt },
    ],
  }).lean();

  if (!doc) return false;

  const queue = resolveRecommendationQueue(toStateRecord(doc as Record<string, any>));
  if (!queue.some((r) => r.capturedAt === capturedAt)) return false;

  const nextQueue = queue.filter((r) => r.capturedAt !== capturedAt);
  const $set: Record<string, unknown> = { recommendationQueue: nextQueue };
  const $unset: Record<string, ''> = {};
  if (nextQueue[0]) {
    $set.latestRecommendation = nextQueue[0];
  } else {
    $unset.latestRecommendation = '';
  }

  const update: Record<string, unknown> = { $set };
  if (Object.keys($unset).length > 0) update.$unset = $unset;

  const res = await GuardianState.findOneAndUpdate(
    {
      userAddress: normalized,
      $or: [
        { 'latestRecommendation.capturedAt': capturedAt },
        { 'recommendationQueue.capturedAt': capturedAt },
      ],
    },
    update,
  ).lean();

  return res !== null;
}
