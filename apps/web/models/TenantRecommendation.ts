/**
 * TenantRecommendation Model — MongoDB schema for the enterprise audit index.
 *
 * The on-chain RecommendationLedger records `user` as a wallet address, so it
 * cannot carry an enterprise tenant id. This collection maps
 * (tenantId -> recommendation) so the audit-export endpoint can scope a
 * tenant's verifiable decisions without changing the deployed ledger contract.
 *
 * Follows the existing model pattern (mongoose.models.X || mongoose.model).
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITenantRecommendation extends Document {
  tenantId: string;
  recommendationId: number;
  chainId: number;
  user: string;
  action: string;
  targetToken: string;
  evidenceCid: string;
  txHash: string;
  status: string;
  createdAt: Date;
}

const TenantRecommendationSchema = new Schema<ITenantRecommendation>({
  tenantId: { type: String, required: true },
  recommendationId: { type: Number, required: true },
  chainId: { type: Number, required: true },
  user: { type: String, required: true },
  action: { type: String },
  targetToken: { type: String },
  evidenceCid: { type: String },
  txHash: { type: String },
  status: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for tenant + time-range audit queries.
TenantRecommendationSchema.index({ tenantId: 1, createdAt: -1 });
TenantRecommendationSchema.index({ tenantId: 1, recommendationId: 1, chainId: 1 }, { unique: true });

export const TenantRecommendation =
  mongoose.models.TenantRecommendation ||
  mongoose.model<ITenantRecommendation>('TenantRecommendation', TenantRecommendationSchema);
