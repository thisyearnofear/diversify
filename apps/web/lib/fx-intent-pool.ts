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

  return model.create({
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