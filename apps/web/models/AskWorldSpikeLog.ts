import mongoose, { Schema, Document } from 'mongoose';

/**
 * Shadow-mode divergence record for the Ask-the-World Jev router spike.
 *
 * Stores no user prose, wallet state, or chat content: `skeletonHash` is a
 * SHA-256 of the canonical question skeleton (one of ~four template shapes),
 * so even the skeleton itself is not retained. `regexKind` is the
 * deterministic classifier's verdict ('none' = miss) which the vendor never
 * sees — it exists only to join the two sides for the agreement report.
 */
export interface IAskWorldSpikeLog extends Document {
  skeletonHash: string;
  regexKind: string;
  /** Agreement bucket vs the deterministic classifier (see agreement.ts). */
  bucket: string;
  jev: {
    provider: 'vercel-ai-gateway' | 'typesafe-direct';
    model: string;
    intent: string;
    confidence: number;
    margin: number;
    accepted: boolean;
    durationMs?: number;
  };
  /** Shadow telemetry, not an audit record — short retention by design. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AskWorldSpikeLogSchema = new Schema<IAskWorldSpikeLog>(
  {
    skeletonHash: { type: String, required: true, index: true },
    regexKind: { type: String, required: true },
    bucket: { type: String, required: true },
    jev: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, minimize: false },
);

export const AskWorldSpikeLog =
  mongoose.models.AskWorldSpikeLog ||
  mongoose.model<IAskWorldSpikeLog>('AskWorldSpikeLog', AskWorldSpikeLogSchema);
