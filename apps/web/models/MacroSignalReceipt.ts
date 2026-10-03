import mongoose, { Schema, Document } from 'mongoose';

/**
 * MacroSignalReceipt — singleton receipt log for the Firecrawl macro webhook.
 *
 * The on-chain feed can only show signals that anchored, but most monitors
 * legitimately anchor rarely (a central bank page changes a few times a
 * year; the NHC monitor needs an actual Caribbean storm). "No MACRO_SIGNAL
 * rows" therefore cannot distinguish a quiet path from a dead one — the
 * 2026-07→09 outage (missing FIRECRAWL_API_KEY, zero webhook traffic for
 * two months) was invisible to every feed check.
 *
 * This document is the observable the health check needs: every
 * authenticated webhook call bumps `receivedCount` and records its
 * outcome, so `/api/agent/status` can answer "is the path being hit, and
 * did the last hit succeed" without guessing from anchor scarcity.
 *
 * Unauthenticated calls are never recorded — a forged receipt would defeat
 * the purpose.
 */
export interface IMacroSignalReceipt extends Document {
  /** Singleton key — always 'firecrawl-webhook'. */
  key: string;
  receivedCount: number;
  firstReceivedAt?: Date;
  lastReceivedAt?: Date;
  lastMonitorId?: string;
  lastUrl?: string;
  /** Terminal action the handler returned: 'ignored' | 'no_change' |
   *  'empty_content' | 'source_rejected' | 'observation_recorded' |
   *  'rehearsal_recorded' | 'error'. */
  lastOutcome?: string;
  lastSignal?: string;
  /** Anchor result on the last recorded observation or rehearsal. */
  lastAnchorStatus?: 'pending' | 'anchored' | 'failed';
}

const MacroSignalReceiptSchema = new Schema<IMacroSignalReceipt>(
  {
    key: { type: String, required: true, unique: true, default: 'firecrawl-webhook' },
    receivedCount: { type: Number, required: true, default: 0 },
    firstReceivedAt: { type: Date, default: undefined },
    lastReceivedAt: { type: Date, default: undefined },
    lastMonitorId: { type: String, default: undefined },
    lastUrl: { type: String, default: undefined },
    lastOutcome: { type: String, default: undefined },
    lastSignal: { type: String, default: undefined },
    lastAnchorStatus: { type: String, enum: ['pending', 'anchored', 'failed'], default: undefined },
  },
  { timestamps: true, minimize: false },
);

export const MacroSignalReceipt =
  mongoose.models.MacroSignalReceipt ||
  mongoose.model<IMacroSignalReceipt>('MacroSignalReceipt', MacroSignalReceiptSchema);
