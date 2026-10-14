import mongoose, { Schema, Document } from 'mongoose';

export type MacroSignalAnchorStatus = 'pending' | 'anchored' | 'failed';

export interface IMacroSignalAnchor extends Document {
  dedupeKey: string;
  action: string;
  targetToken: string;
  reasoningHash: string;
  status: MacroSignalAnchorStatus;
  chainId?: number;
  recordId?: number;
  txHash?: string;
  error?: string;
  attempts: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MacroSignalAnchorSchema = new Schema<IMacroSignalAnchor>(
  {
    dedupeKey: { type: String, required: true, unique: true },
    action: { type: String, required: true, index: true },
    targetToken: { type: String, required: true, index: true },
    reasoningHash: { type: String, required: true },
    status: { type: String, enum: ['pending', 'anchored', 'failed'], required: true, index: true },
    chainId: { type: Number, default: undefined },
    recordId: { type: Number, default: undefined },
    txHash: { type: String, default: undefined },
    error: { type: String, default: undefined },
    attempts: { type: Number, required: true, default: 1 },
    firstAttemptAt: { type: Date, required: true },
    lastAttemptAt: { type: Date, required: true },
    settledAt: { type: Date, default: undefined },
  },
  { timestamps: true, minimize: false },
);

export const MacroSignalAnchor =
  mongoose.models.MacroSignalAnchor ||
  mongoose.model<IMacroSignalAnchor>('MacroSignalAnchor', MacroSignalAnchorSchema);
