/**
 * GuardianState Model — MongoDB-backed per-user Guardian state.
 *
 * Replaces the flat-file `.data/guardian-state.json` store. That file was
 * read-modify-written by both the cron loop and the firecrawl webhook with no
 * locking, so concurrent writes clobbered each other (the silent "queued
 * recommendation vanished" bug) and it could not scale past a single node.
 *
 * This model keeps the same logical shape (latestRecommendation pointer +
 * bounded recommendationQueue, rolling anchor history, per-user alert
 * cooldowns) but persists it in Mongo so updates can be atomic via
 * findOneAndUpdate.
 *
 * `executionLock` is an advisory lock the Guardian loop claims atomically
 * before auto-executing, so two overlapping cron ticks can never fire the
 * same recommendation twice.
 *
 * `graduationPromptDismissedAt` is a Phase 4 graduation-funnel field:
 * when the retail→business graduation prompt is dismissed, we record the
 * dismissal timestamp on the user's GuardianState so the next signal
 * evaluation short-circuits. Distinct from the Streak.graduation concept
 * (testnet recovery graduation) — this one is the SME funnel graduation.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IGuardianExecutionLock {
  claimedAt: Date;
  /** capturedAt of the recommendation this lock was claimed for. */
  recommendationCapturedAt?: string;
}

export interface IGuardianState extends Document {
  userAddress: string;
  latestRecommendation?: Record<string, unknown>;
  recommendationQueue?: Array<Record<string, unknown>>;
  latestAnchor?: Record<string, unknown>;
  latestAnchors?: Array<Record<string, unknown>>;
  alertCooldowns?: Record<string, number>;
  executionLock?: IGuardianExecutionLock | null;
  /**
   * Phase 4 graduation-funnel dismissal timestamp. When set, the
   * GET /api/agent/business/graduation-signals endpoint short-circuits
   * and returns `shouldShow: false`. Persists across devices (a single
   * GuardianState is wallet-keyed), not per-browser like localStorage.
   */
  graduationPromptDismissedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const GuardianStateSchema = new Schema<IGuardianState>(
  {
    userAddress: { type: String, required: true, unique: true, lowercase: true, index: true },
    latestRecommendation: { type: Schema.Types.Mixed, default: undefined },
    recommendationQueue: { type: [Schema.Types.Mixed], default: undefined },
    latestAnchor: { type: Schema.Types.Mixed, default: undefined },
    latestAnchors: { type: [Schema.Types.Mixed], default: undefined },
    alertCooldowns: { type: Schema.Types.Mixed, default: undefined },
    executionLock: { type: Schema.Types.Mixed, default: null },
    graduationPromptDismissedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

export const GuardianState =
  mongoose.models.GuardianState ||
  mongoose.model<IGuardianState>('GuardianState', GuardianStateSchema);
