/**
 * SentimentVote Model — the no-money nation confidence poll.
 *
 * One vote per anonymous browser session per currency, keyed
 * (sessionId, code) so re-voting changes the pick instead of stacking.
 * The session id is the same random `diversifi-anon-session` UUID the
 * funnel events use — no wallet, no account, no identity. A vote carries
 * a code and a three-way sentiment, nothing else.
 *
 * Votes expire after 180 days: sentiment is a *current* signal, and a
 * TTL'd collection can't quietly become a long-term profile of anonymous
 * sessions (same discipline as FunnelEvent's 90-day index, on a slower
 * clock because a poll ages more slowly than a funnel).
 *
 * Follows the existing model pattern (mongoose.models.X || mongoose.model).
 */

import mongoose, { Schema, Document } from 'mongoose';
import { SENTIMENTS, type Sentiment } from '@/lib/sentiment';

export { SENTIMENTS, type Sentiment };

export interface ISentimentVote extends Document {
  sessionId: string;
  /** Currency code the vote addresses (NGN, TRY, …) — allowlisted
   *  server-side against the curated dataset. */
  code: string;
  sentiment: Sentiment;
  createdAt: Date;
  updatedAt: Date;
}

const SentimentVoteSchema = new Schema<ISentimentVote>(
  {
    sessionId: { type: String, required: true, maxlength: 64 },
    code: { type: String, required: true, uppercase: true, maxlength: 8 },
    sentiment: { type: String, required: true, enum: SENTIMENTS },
  },
  { timestamps: true },
);

// One vote per session per currency — upsert target for re-votes.
SentimentVoteSchema.index({ sessionId: 1, code: 1 }, { unique: true });
// The tally read: every vote for one currency.
SentimentVoteSchema.index({ code: 1 });
// Sentiment is a current signal — expire rather than profile.
SentimentVoteSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);

export const SentimentVote =
  mongoose.models.SentimentVote ||
  mongoose.model<ISentimentVote>('SentimentVote', SentimentVoteSchema);
