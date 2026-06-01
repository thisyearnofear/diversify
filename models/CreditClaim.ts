/**
 * CreditClaim — MongoDB model for research credit claims.
 *
 * Each claim is keyed by (userAddress, action) to enforce one-claim-per-action
 * server-side. The client-side localStorage is a cache; the server is the
 * source of truth.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type RewardActionKey =
  | 'share_app'
  | 'blog_post'
  | 'youtube_video'
  | 'twitter_thread'
  | 'gooddollar_claim';

export interface ICreditClaim extends Document {
  userAddress: string;
  action: RewardActionKey;
  creditsEarned: number;
  proof?: string;
  proofVerified: boolean;
  claimedAt: Date;
}

const CreditClaimSchema = new Schema<ICreditClaim>({
  userAddress: { type: String, required: true, index: true },
  action: { type: String, required: true, enum: ['share_app', 'blog_post', 'youtube_video', 'twitter_thread', 'gooddollar_claim'] },
  creditsEarned: { type: Number, required: true },
  proof: { type: String, default: null },
  proofVerified: { type: Boolean, default: false },
  claimedAt: { type: Date, default: Date.now },
});

// Compound index: one claim per action per user
CreditClaimSchema.index({ userAddress: 1, action: 1 }, { unique: true });

export const CreditClaim = mongoose.models.CreditClaim || mongoose.model<ICreditClaim>('CreditClaim', CreditClaimSchema);