/**
 * Weekly global Guardian activity counters (Mongo-backed, one doc per ISO week).
 *
 * The per-user `decisionLog` is capped at 8 and deduped, and `GuardianRunLog`
 * only keeps the last tick — neither can answer "how much did the Guardian do
 * this week?" without inflating or undercounting. UI cadence displays (proof
 * tier, while-you-were-away line) read these counters instead of doing client
 * math over capped data.
 *
 * `durationMsSamples` keeps a bounded rolling sample of measured decision
 * durations so a median can be shown honestly; medians are never computed
 * over, or interpolated from, untimed events.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IGuardianActivityCounter extends Document {
  /** ISO-8601 week key, e.g. '2026-W39'. Unique — one doc per week. */
  week: string;
  checks: number;
  executions: number;
  declines: number;
  durationMsSamples: number[];
  updatedAt: Date;
}

const GuardianActivityCounterSchema = new Schema<IGuardianActivityCounter>(
  {
    week: { type: String, required: true, unique: true, index: true },
    checks: { type: Number, default: 0 },
    executions: { type: Number, default: 0 },
    declines: { type: Number, default: 0 },
    durationMsSamples: { type: [Number], default: [] },
  },
  { timestamps: true, minimize: false },
);

export const GuardianActivityCounter =
  mongoose.models.GuardianActivityCounter ||
  mongoose.model<IGuardianActivityCounter>('GuardianActivityCounter', GuardianActivityCounterSchema);
