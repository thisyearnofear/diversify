/**
 * GuardianRunLog — last-run record for the Guardian cron endpoints.
 *
 * The cron loop (every 5 min) and heartbeat (every ~30 min) previously
 * reported ONLY through their HTTP response body, which a monitoring check
 * can misread: the loop returns HTTP 200 for "healthy, nothing actionable"
 * AND for a Mongo outage at start (`success:false`). This model persists the
 * terminal outcome of each run so `/api/agent/status` can answer honestly:
 * when did the Guardian last run, and did that run work?
 *
 * One document per `key` (`loop` | `heartbeat`), upserted atomically on every
 * run. The response body stays the authoritative per-run detail; this is the
 * compact rolling summary for health checks.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type GuardianRunKind = 'loop' | 'heartbeat';

export type GuardianRunTerminalStatus =
  /** The run completed and did useful work (executed, declined, or recorded). */
  | 'ok'
  /** The run completed but nothing needed doing — healthy idle. */
  | 'idle'
  /** The run hit recoverable errors (per-user failures, ledger hiccups). */
  | 'degraded'
  /** The run could not complete (Mongo down at start, unhandled throw). */
  | 'failed';

export interface IGuardianRunLog extends Document {
  key: GuardianRunKind;
  /** ISO timestamp of the most recent completed run. */
  lastRunAt: string;
  status: GuardianRunTerminalStatus;
  /** Compact per-run detail: counts / error text, never PII. */
  summary?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GuardianRunLogSchema = new Schema<IGuardianRunLog>(
  {
    key: { type: String, required: true, unique: true, enum: ['loop', 'heartbeat'] },
    lastRunAt: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['ok', 'idle', 'degraded', 'failed'],
    },
    summary: { type: Schema.Types.Mixed, default: undefined },
    error: { type: String, default: undefined },
  },
  { timestamps: true, minimize: false },
);

export const GuardianRunLog =
  mongoose.models.GuardianRunLog ||
  mongoose.model<IGuardianRunLog>('GuardianRunLog', GuardianRunLogSchema);
