/**
 * FxSettlementRecord — a persisted FX netting settlement obligation.
 *
 * The matching engine nets pairwise flows into one cUSD obligation per
 * participant pair (models/FxIntentRecord powers the matching side; this
 * model powers the settlement side). A settlement is created `pending`
 * when a match run produces a net obligation; the net debtor executes the
 * cUSD transfer from their own wallet (zero-custody) and the server
 * verifies it on-chain before advancing both sides' intents to `settled`.
 *
 * Trust boundary: fromParticipant/toParticipant are engine-computed wallet
 * addresses; every API access is wallet-authenticated and party-checked
 * (see pages/api/fx-netting/settle.ts).
 */

import mongoose, { Schema, Document } from 'mongoose';

export type FxSettlementPoolStatus = 'pending' | 'settled' | 'cancelled';

export interface IFxSettlementRecord extends Document {
  settlementId: string;
  /** Net debtor — must sign the settle call AND the on-chain transfer. */
  fromParticipant: string;
  /** Net creditor — receives the cUSD transfer. */
  toParticipant: string;
  settlementCurrency: string;
  /** Net amount in major units. */
  netAmount: number;
  /** Chain the transfer settles on (region-canonical, per matching engine). */
  chainId: number;
  sourceMatchIds: string[];
  intentIds: string[];
  status: FxSettlementPoolStatus;
  txHash?: string;
  settledAt?: number;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FxSettlementRecordSchema = new Schema<IFxSettlementRecord>(
  {
    settlementId: { type: String, required: true, unique: true },
    fromParticipant: { type: String, required: true, lowercase: true, index: true },
    toParticipant: { type: String, required: true, lowercase: true, index: true },
    settlementCurrency: { type: String, required: true, uppercase: true },
    netAmount: { type: Number, required: true, min: 0 },
    chainId: { type: Number, required: true },
    sourceMatchIds: { type: [String], default: [] },
    intentIds: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending', 'settled', 'cancelled'],
      default: 'pending',
    },
    txHash: { type: String },
    settledAt: { type: Number },
    failureReason: { type: String },
  },
  { timestamps: true },
);

// Debtor worklist + creditor inbox scans are by party + status.
FxSettlementRecordSchema.index({ fromParticipant: 1, status: 1 });
FxSettlementRecordSchema.index({ toParticipant: 1, status: 1 });

export const FxSettlementRecord =
  mongoose.models.FxSettlementRecord ||
  mongoose.model<IFxSettlementRecord>('FxSettlementRecord', FxSettlementRecordSchema);
