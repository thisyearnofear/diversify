/**
 * AgentUsage — MongoDB model for the daily-question allowance.
 *
 * One document per (subject, UTC day). `subject` is namespaced:
 * `wallet:0x…` for connected wallets, `ip:…` for walletless callers.
 * `questions` counts advisor calls consumed today; `bonus` counts extra
 * questions earned today; `actions` records which earn actions already
 * granted (dedupe is subject+action+day).
 *
 * The allowance is the only thing the advisor gate reads — there is no
 * dollar balance, and nothing here represents money.
 */

import mongoose, { Schema, Document } from 'mongoose';
import dbConnect from '../lib/mongodb';
import {
  ANON_DAILY_QUESTIONS,
  WALLET_DAILY_QUESTIONS,
  REWARD_ACTIONS,
  utcDayKey,
  nextUtcMidnightIso,
  type RewardActionKey,
} from '../constants/credits';

export interface IAgentUsage extends Document {
  subject: string;
  day: string;
  questions: number;
  bonus: number;
  actions: string[];
  updatedAt: Date;
}

const AgentUsageSchema = new Schema<IAgentUsage>(
  {
    subject: { type: String, required: true },
    day: { type: String, required: true },
    questions: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    actions: { type: [String], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true }, minimize: false },
);

// One doc per subject per UTC day — the unit of enforcement.
AgentUsageSchema.index({ subject: 1, day: 1 }, { unique: true });

export const AgentUsage =
  mongoose.models.AgentUsage ||
  mongoose.model<IAgentUsage>('AgentUsage', AgentUsageSchema);

// ── Allowance helpers (server-only) ──────────────────────────────────────

export type SubjectKind = 'wallet' | 'ip';

const WALLET_ADDRESS_RE = /^0x[a-f0-9]{40}$/i;

/**
 * Resolve the allowance subject for a request. A well-formed wallet
 * address wins the wallet allowance; anything else (missing, malformed,
 * or a non-address string like an IP passed as `subject`) falls back to
 * the caller's IP so a query param can't claim the higher limit.
 */
export function resolveSubject(
  address: unknown,
  ip: string,
): { subject: string; kind: SubjectKind } {
  if (typeof address === 'string' && WALLET_ADDRESS_RE.test(address)) {
    return { subject: `wallet:${address.toLowerCase()}`, kind: 'wallet' };
  }
  return { subject: `ip:${ip}`, kind: 'ip' };
}

export function dailyLimitFor(kind: SubjectKind): number {
  return kind === 'wallet' ? WALLET_DAILY_QUESTIONS : ANON_DAILY_QUESTIONS;
}

export interface AllowanceStatus {
  remaining: number;
  limit: number;
  bonus: number;
  resetsAt: string;
  earnedToday: RewardActionKey[];
}

/** Read today's allowance without consuming anything. */
export async function getAllowance(
  subject: string,
  kind: SubjectKind,
): Promise<AllowanceStatus> {
  await dbConnect();
  const doc = await AgentUsage.findOne({ subject, day: utcDayKey() }).lean();
  const bonus = doc?.bonus ?? 0;
  const limit = dailyLimitFor(kind) + bonus;
  return {
    remaining: Math.max(0, limit - (doc?.questions ?? 0)),
    limit,
    bonus,
    resetsAt: nextUtcMidnightIso(),
    earnedToday: (doc?.actions ?? []) as RewardActionKey[],
  };
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetsAt: string;
}

/**
 * Consume one question. Creates today's doc if missing, then increments
 * only while under the allowance (the `questions < limit` guard rides in
 * the update filter so a concurrent request can't overshoot). Callers
 * should wrap this in try/catch and decide their own failure mode.
 */
export async function consumeQuestion(
  subject: string,
  kind: SubjectKind,
): Promise<ConsumeResult> {
  await dbConnect();
  const day = utcDayKey();
  const resetsAt = nextUtcMidnightIso();
  const doc = await AgentUsage.findOneAndUpdate(
    { subject, day },
    { $setOnInsert: { subject, day } },
    { upsert: true, new: true },
  );
  const limit = dailyLimitFor(kind) + (doc.bonus ?? 0);
  if (doc.questions >= limit) {
    return { allowed: false, remaining: 0, limit, resetsAt };
  }
  const res = await AgentUsage.updateOne(
    { _id: doc._id, questions: { $lt: limit } },
    { $inc: { questions: 1 } },
  );
  if (res.modifiedCount === 0) {
    // Lost a race to the last question — treat as exhausted.
    return { allowed: false, remaining: 0, limit, resetsAt };
  }
  return {
    allowed: true,
    remaining: Math.max(0, limit - doc.questions - 1),
    limit,
    resetsAt,
  };
}

export interface GrantResult extends AllowanceStatus {
  granted: boolean;
  alreadyClaimed: boolean;
}

/**
 * Record an earn action and add its questions to today's bonus. The
 * `actions: { $ne: action }` filter makes the dedupe atomic — one grant
 * per action per subject per day.
 */
export async function grantEarnAction(
  subject: string,
  kind: SubjectKind,
  action: RewardActionKey,
): Promise<GrantResult> {
  await dbConnect();
  const day = utcDayKey();
  await AgentUsage.findOneAndUpdate(
    { subject, day },
    { $setOnInsert: { subject, day } },
    { upsert: true, new: true },
  );
  const res = await AgentUsage.updateOne(
    { subject, day, actions: { $ne: action } },
    { $inc: { bonus: REWARD_ACTIONS[action].questions }, $push: { actions: action } },
  );
  const alreadyClaimed = res.modifiedCount === 0;
  const status = await getAllowance(subject, kind);
  return { ...status, granted: !alreadyClaimed, alreadyClaimed };
}
