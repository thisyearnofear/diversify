import mongoose, { Schema, Document } from 'mongoose';

/**
 * Off-chain echo of a ledger record's reasoning text.
 *
 * The RecommendationLedger contract stores only `reasoningHash` — the
 * readable line never comes back over RPC. Writers (the Firecrawl macro
 * webhook, the POST attestation path) persist the text here keyed by
 * (chainId, recordId) — the identity the proof feed actually carries. The
 * feed's `settlementTxHash` is the caller-supplied swap tx, not the anchor
 * tx, so it cannot serve as the join key. The on-chain hash remains the
 * tamper-proof anchor; this store is a readability mirror, never evidence.
 */
export interface ILedgerReasoning extends Document {
  chainId: number;
  /** On-chain recommendation id (1-based, per contract). */
  recordId: number;
  /** Anchor transaction hash, kept for reference/debugging. */
  txHash?: string;
  action: string;
  targetToken?: string;
  reasoning: string;
  /** Beats go stale long before this; 90 days keeps the mirror shallow. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerReasoningSchema = new Schema<ILedgerReasoning>(
  {
    chainId: { type: Number, required: true },
    recordId: { type: Number, required: true },
    txHash: { type: String, default: undefined },
    action: { type: String, required: true },
    targetToken: { type: String, default: undefined },
    reasoning: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, minimize: false },
);

LedgerReasoningSchema.index({ chainId: 1, recordId: 1 }, { unique: true });

export const LedgerReasoning =
  mongoose.models.LedgerReasoning ||
  mongoose.model<ILedgerReasoning>('LedgerReasoning', LedgerReasoningSchema);
