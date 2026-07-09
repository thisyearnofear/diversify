import mongoose, { Schema, Document } from 'mongoose';

/**
 * ProcessedPaymentProof — durable deduplication of x402 payment proofs.
 *
 * The gateway previously kept processed tx hashes in an in-memory Set, which
 * reset on restart and was not safe across multiple server instances. This
 * collection is the source of truth for replay protection.
 *
 * Unique index on (txHash, network, env) so the same hash cannot be credited
 * twice, even across rail/environment flips.
 */

export interface IProcessedPaymentProof extends Document {
  txHash: string;
  network: string;
  env: string;
  amountUSDC: number;
  processedAt: Date;
}

const ProcessedPaymentProofSchema = new Schema<IProcessedPaymentProof>({
  txHash: { type: String, required: true },
  network: { type: String, required: true },
  env: { type: String, required: true },
  amountUSDC: { type: Number, default: 0 },
  processedAt: { type: Date, default: Date.now },
});

// Unique index prevents any proof from being replayed on a given rail/env.
ProcessedPaymentProofSchema.index({ txHash: 1, network: 1, env: 1 }, { unique: true });
// TTL index: keep proof records for 90 days, then auto-delete.
ProcessedPaymentProofSchema.index({ processedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ProcessedPaymentProof =
  mongoose.models.ProcessedPaymentProof ||
  mongoose.model<IProcessedPaymentProof>('ProcessedPaymentProof', ProcessedPaymentProofSchema);
