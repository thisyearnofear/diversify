import mongoose, { Schema, Document } from 'mongoose';

/**
 * Off-chain echo of a ledger record's reasoning text.
 *
 * The RecommendationLedger contract stores only `reasoningHash` — the
 * readable line never comes back over RPC. Writers (the Firecrawl macro
 * webhook, the POST attestation path) persist the text here. The on-chain
 * hash remains the tamper-proof anchor; this store is a readability mirror,
 * never evidence.
 *
 * Two kinds of echo, because an anchor can be broadcast before it has an id:
 *   - `record`  — keyed by (chainId, recordId): the identity the proof feed
 *                 carries. `settlementTxHash` is the caller-supplied swap tx,
 *                 not the anchor tx, so it cannot serve as the join key.
 *   - `pending` — keyed by the keccak `reasoningHash` of the text itself, for
 *                 anchors still awaiting confirmation ("pending" has no id).
 *                 The feed can join these by hash, which is a *verified* join:
 *                 the words hash to the commitment stored on-chain.
 */
export type LedgerReasoningKind = 'record' | 'pending';

export interface ILedgerReasoning extends Document {
  kind: LedgerReasoningKind;
  chainId?: number;
  /** On-chain recommendation id (1-based, per contract). `record` kind only. */
  recordId?: number;
  /** keccak256 of `reasoning` — the on-chain commitment. Effectively
   *  always present; `pending` kind is keyed by it. */
  reasoningHash?: string;
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
    kind: { type: String, enum: ['record', 'pending'], required: true },
    chainId: { type: Number, default: undefined },
    recordId: { type: Number, default: undefined },
    reasoningHash: { type: String, default: undefined },
    txHash: { type: String, default: undefined },
    action: { type: String, required: true },
    targetToken: { type: String, default: undefined },
    reasoning: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, minimize: false },
);

// Partial unique indexes: one identity space per kind. A plain compound
// unique index on (chainId, recordId) would collide across `pending` rows
// (which have neither field), so each kind carries its own.
LedgerReasoningSchema.index(
  { chainId: 1, recordId: 1 },
  { unique: true, partialFilterExpression: { kind: 'record' }, name: 'record_identity' },
);
LedgerReasoningSchema.index(
  { reasoningHash: 1 },
  { unique: true, partialFilterExpression: { kind: 'pending' }, name: 'pending_reasoning_hash' },
);

export const LedgerReasoning =
  mongoose.models.LedgerReasoning ||
  mongoose.model<ILedgerReasoning>('LedgerReasoning', LedgerReasoningSchema);
