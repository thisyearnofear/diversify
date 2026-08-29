/**
 * FxIntentRecord — a persisted FX netting intent in the hosted pool.
 *
 * The matching engine (packages/shared/src/services/fx-netting) is pure and
 * stateless; this model is its persistence layer. A participant posts
 * "I need to sell X for Y by T" once; every subsequent match run against the
 * pool can fill it partially (remainingSell decrements, status advances) —
 * the same lifecycle the engine's in-memory copies model.
 *
 * Trust boundary: participantId is derived server-side from wallet-signed
 * headers (requireWalletAuth), never from the body.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type FxIntentPoolStatus =
  | 'open'
  | 'matched'
  | 'partially_matched'
  | 'settled'
  | 'expired'
  | 'cancelled';

export interface IFxIntentRecord extends Document {
  /** Engine-facing stable id (mirrors FxIntent.intentId). */
  intentId: string;
  /** Wallet address — lowercased, derived from the signed auth headers. */
  participantId: string;
  sellCurrency: string;
  /** Major units (e.g. 20000 = 20,000 BBD). */
  sellAmount: number;
  buyCurrency: string;
  /** Minimum acceptable buy amount; null = accept mid-market. */
  buyAmountMin: number | null;
  /** Epoch-ms deadline; 0 = no expiry. */
  deadline: number;
  /** What's left to match — decremented as partial matches fill. */
  remainingSell: number;
  status: FxIntentPoolStatus;
  /** Match ids that filled this intent (audit trail). */
  matchedWith: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FxIntentRecordSchema = new Schema<IFxIntentRecord>(
  {
    intentId: { type: String, required: true, unique: true },
    participantId: { type: String, required: true, lowercase: true, index: true },
    sellCurrency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    sellAmount: { type: Number, required: true, min: 0 },
    buyCurrency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    buyAmountMin: { type: Number, default: null },
    deadline: { type: Number, default: 0 },
    remainingSell: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['open', 'matched', 'partially_matched', 'settled', 'expired', 'cancelled'],
      default: 'open',
    },
    matchedWith: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Pool scans are by status + currency pair; expiry filtering happens in the query.
FxIntentRecordSchema.index({ status: 1, sellCurrency: 1, buyCurrency: 1 });
FxIntentRecordSchema.index({ participantId: 1, status: 1 });

export const FxIntentRecord =
  mongoose.models.FxIntentRecord ||
  mongoose.model<IFxIntentRecord>('FxIntentRecord', FxIntentRecordSchema);