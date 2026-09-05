/**
 * FX intent pool — persistence bridge between the pure matching engine and
 * Mongo (FxIntentRecord). The engine (packages/shared/src/services/fx-netting)
 * stays stateless: these helpers load the open pool into engine-shaped
 * FxIntents and write match outcomes back (remainingSell decrement, status
 * advance, matchId audit trail).
 *
 * All functions take the model as a parameter (dependency injection) so tests
 * can exercise the logic without a live Mongo connection.
 */

import type { FxIntent } from '@diversifi/shared/src/services/fx-netting/intent';

/** Amounts below this are dust — treated as fully matched (mirrors the engine). */
export const DUST_THRESHOLD = 0.005;

/** Statuses eligible for matching. */
const MATCHABLE_STATUSES = ['open', 'partially_matched'] as const;

/** Statuses that can still be advanced to `settled` by a settlement execution. */
const SETTLEABLE_STATUSES = ['open', 'matched', 'partially_matched'] as const;

/**
 * Minimal structural view of the persisted intent — everything the pool
 * helpers touch. Deliberately NOT the full mongoose Document: the helpers
 * depend only on these fields, which keeps them unit-testable with plain
 * fakes (see lib/__tests__/fx-intent-pool.test.ts).
 */
export interface PoolIntentDoc {
  intentId: string;
  participantId: string;
  sellCurrency: string;
  sellAmount: number;
  buyCurrency: string;
  buyAmountMin: number | null;
  deadline: number;
  remainingSell: number;
  status: string;
  matchedWith: string[];
  createdAt: Date | string | number;
  save: () => Promise<unknown>;
}

/** Minimal structural model seam (the real FxIntentRecord satisfies it). */
export interface PoolModel {
  find: (filter: Record<string, unknown>) => { lean: () => Promise<PoolIntentDoc[]> };
  findOne: (filter: Record<string, unknown>) => { exec: () => Promise<PoolIntentDoc | null> };
  create: (doc: Record<string, unknown>) => Promise<PoolIntentDoc>;
}

/**
 * Load the open pool as engine-shaped FxIntents. Excludes cancelled/settled
 * intents, expired deadlines, and dust remainders.
 */
export async function loadOpenPool(model: PoolModel, now: number): Promise<FxIntent[]> {
  const docs = await model
    .find({
      status: { $in: MATCHABLE_STATUSES },
      remainingSell: { $gt: DUST_THRESHOLD },
      $or: [{ deadline: 0 }, { deadline: { $gte: now } }],
    })
    .lean();

  return docs.map((d) => ({
    intentId: d.intentId,
    participantId: d.participantId,
    sellCurrency: d.sellCurrency,
    sellAmount: d.sellAmount,
    buyCurrency: d.buyCurrency,
    buyAmountMin: d.buyAmountMin ?? null,
    deadline: d.deadline,
    remainingSell: d.remainingSell,
    status: d.status as FxIntent['status'],
    createdAt: d.createdAt ? new Date(d.createdAt).getTime() : now,
  }));
}

/**
 * Upsert an intent into the pool. Idempotent per caller: if the same
 * participant already has an open/partially-matched intent for the same
 * currency pair at the same amount, refresh it (new deadline) instead of
 * piling up duplicates — the card may re-submit on retry.
 */
export async function upsertPoolIntent(
  model: PoolModel,
  intent: FxIntent,
): Promise<PoolIntentDoc> {
  const existing = await model
    .findOne({
      participantId: intent.participantId.toLowerCase(),
      sellCurrency: intent.sellCurrency.toUpperCase(),
      buyCurrency: intent.buyCurrency.toUpperCase(),
      sellAmount: intent.sellAmount,
      status: { $in: MATCHABLE_STATUSES },
    })
    .exec();

  if (existing) {
    existing.deadline = intent.deadline;
    existing.remainingSell = intent.sellAmount;
    existing.intentId = intent.intentId;
    await existing.save();
    return existing;
  }

  try {
    return await model.create({
      intentId: intent.intentId,
      participantId: intent.participantId.toLowerCase(),
      sellCurrency: intent.sellCurrency.toUpperCase(),
      sellAmount: intent.sellAmount,
      buyCurrency: intent.buyCurrency.toUpperCase(),
      buyAmountMin: intent.buyAmountMin ?? null,
      deadline: intent.deadline,
      remainingSell: intent.sellAmount,
      status: 'open',
    });
  } catch (err) {
    // Concurrent match runs can pass the findOne check simultaneously and
    // both reach create() — the unique intentId index rejects the loser.
    // That's the idempotency contract WORKING (one row wins, both callers
    // proceed with the same pool state), not an error: re-read and return
    // the winner, refreshed to this run's deadline.
    if ((err as { code?: number }).code !== 11000) throw err;
    const winner = await model
      .findOne({ intentId: intent.intentId })
      .exec();
    if (winner) {
      winner.deadline = intent.deadline;
      await winner.save();
      return winner;
    }
    throw err;
  }
}

interface MatchSide {
  participantId: string;
  sellCurrency: string;
  intentId?: string;
}

interface MatchOutcome {
  matchId: string;
  intentA: MatchSide;
  intentB: MatchSide;
  matchedAmount: number;
  rate: number;
}

/**
 * Write match outcomes back to the pool: decrement each side's remainingSell
 * by its filled amount (A fills matchedAmount of A's sell currency; B fills
 * matchedAmount * rate of B's sell currency), advance status, append the
 * matchId. Body-supplied intents that aren't persisted yet are inserted.
 */
export async function persistMatchOutcomes(
  model: PoolModel,
  matches: MatchOutcome[],
): Promise<number> {
  let touched = 0;

  for (const m of matches) {
    const sides: Array<{ side: MatchSide; filled: number }> = [
      { side: m.intentA, filled: m.matchedAmount },
      { side: m.intentB, filled: m.matchedAmount * m.rate },
    ];

    for (const { side, filled } of sides) {
      if (!(filled > DUST_THRESHOLD)) continue;

      let record = side.intentId
        ? await model.findOne({ intentId: side.intentId }).exec()
        : null;

      if (!record) {
        // Not persisted yet (client-supplied intent) — insert at its
        // post-match remaining (we never saw its pre-match amount).
        record = await model.create({
          intentId: side.intentId ?? `pool_${m.matchId}_${touched}`,
          participantId: side.participantId.toLowerCase(),
          sellCurrency: side.sellCurrency.toUpperCase(),
          sellAmount: filled,
          buyCurrency: '',
          buyAmountMin: null,
          deadline: 0,
          remainingSell: 0,
          status: 'matched',
          matchedWith: [m.matchId],
        });
        touched += 1;
        continue;
      }

      record.remainingSell = Math.max(0, record.remainingSell - filled);
      record.status = record.remainingSell <= DUST_THRESHOLD ? 'matched' : 'partially_matched';
      if (!record.matchedWith.includes(m.matchId)) {
        record.matchedWith.push(m.matchId);
      }
      await record.save();
      touched += 1;
    }
  }

  return touched;
}

// ─── Settlement execution (net obligation → verified cUSD transfer) ─────

/**
 * Minimal structural view of a persisted settlement — everything the
 * settlement helpers touch (see models/FxSettlementRecord.ts for the full
 * mongoose document).
 */
export interface SettlementDoc {
  settlementId: string;
  fromParticipant: string;
  toParticipant: string;
  settlementCurrency: string;
  netAmount: number;
  chainId: number;
  sourceMatchIds: string[];
  intentIds: string[];
  status: string;
  txHash?: string;
  settledAt?: number;
  failureReason?: string;
  createdAt: Date | string | number;
  save: () => Promise<unknown>;
}

/** Minimal structural model seam for settlement persistence. */
export interface SettlementModel {
  find: (filter: Record<string, unknown>) => { lean: () => Promise<SettlementDoc[]> };
  findOne: (filter: Record<string, unknown>) => { exec: () => Promise<SettlementDoc | null> };
  create: (doc: Record<string, unknown>) => Promise<SettlementDoc>;
}

/**
 * Persist new pending settlements from a match run. Idempotent per
 * settlementId — a re-run of the same match (or a card retry) refreshes
 * the pending record instead of duplicating it. Already-settled records
 * are never touched.
 */
export async function persistSettlements(
  model: SettlementModel,
  settlements: Array<Omit<SettlementDoc, 'save' | 'createdAt' | 'status'> & { status?: string; createdAt?: Date | string | number }>,
): Promise<number> {
  let touched = 0;
  for (const s of settlements) {
    const existing = await model.findOne({ settlementId: s.settlementId }).exec();
    if (existing) {
      if (existing.status === 'settled') continue; // never reopen a settled record
      existing.intentIds = s.intentIds ?? [];
      existing.netAmount = s.netAmount;
      await existing.save();
      touched += 1;
      continue;
    }
    await model.create({
      settlementId: s.settlementId,
      fromParticipant: String(s.fromParticipant).toLowerCase(),
      toParticipant: String(s.toParticipant).toLowerCase(),
      settlementCurrency: String(s.settlementCurrency).toUpperCase(),
      netAmount: s.netAmount,
      chainId: s.chainId,
      sourceMatchIds: s.sourceMatchIds ?? [],
      intentIds: s.intentIds ?? [],
      status: 'pending',
    });
    touched += 1;
  }
  return touched;
}

/**
 * Mark a settlement settled and advance both sides' matched intents to
 * `settled`. Intents not in a settleable status are skipped (they may have
 * been re-matched with new volume, or already settled) — the settlement
 * record itself is still the audit ground truth.
 */
export async function applySettledOutcome(
  intentModel: PoolModel,
  settlement: Pick<SettlementDoc, 'settlementId' | 'intentIds'>,
  txHash: string,
  now: number,
): Promise<number> {
  let advanced = 0;
  for (const intentId of settlement.intentIds ?? []) {
    const record = await intentModel.findOne({ intentId }).exec();
    if (!record) continue;
    if (!(SETTLEABLE_STATUSES as readonly string[]).includes(record.status)) continue;
    record.status = 'settled';
    await record.save();
    advanced += 1;
  }
  return advanced;
}