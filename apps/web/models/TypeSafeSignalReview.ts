import mongoose, { Schema, Document } from 'mongoose';

/**
 * Shadow-mode comparison record for optional TypeSafe Signal Lens reviews.
 *
 * Stores no wallet address, balances, permissions, chat content, or raw page
 * excerpt. `sourceFingerprint` is a SHA-256 hash of the public source change,
 * allowing a later assessment to be joined to its baseline extraction without
 * retaining the vendor input locally.
 */
export interface ITypeSafeSignalReview extends Document {
  sourceFingerprint: string;
  sourceUrl?: string;
  baseline: {
    signal: string;
    confidence: number;
    actionable: boolean;
  };
  assessment?: {
    provider: 'vercel-ai-gateway' | 'typesafe-direct';
    model: string;
    evaluatedAt: string;
    materiality: number;
    category: string;
    categoryConfidence: number;
    urgency: string;
    urgencyConfidence: number;
    sourceQuality: number;
    sourceQualityConfidence: number;
    durationMs?: number;
  };
  /** Shadow records are comparative telemetry, not an audit system. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TypeSafeSignalReviewSchema = new Schema<ITypeSafeSignalReview>(
  {
    sourceFingerprint: { type: String, required: true, unique: true, index: true },
    sourceUrl: { type: String, default: undefined },
    baseline: { type: Schema.Types.Mixed, required: true },
    assessment: { type: Schema.Types.Mixed, default: undefined },
    // Keep shadow-mode evaluation data only long enough to compare outcomes.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, minimize: false },
);

export const TypeSafeSignalReview =
  mongoose.models.TypeSafeSignalReview ||
  mongoose.model<ITypeSafeSignalReview>('TypeSafeSignalReview', TypeSafeSignalReviewSchema);
