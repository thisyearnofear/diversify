/**
 * PurchaseCycle — working-capital payment cycles for FX drag monitoring.
 *
 * Distinct from philosophy/importer archetype: this is a time-bound liquidity
 * need (supplier payment date), not a values choice.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type PurchaseCycleStatus = 'draft' | 'active' | 'payment_due' | 'completed' | 'cancelled';
export type CycleProtectionExecutionStatus = 'claimed' | 'executed' | 'failed';

export interface ICycleReportSnapshot {
  computedAt: Date;
  totalDragLocal: number;
  totalDragPct: number;
  exposureDays: number;
  narrativeHeadline: string;
  dragLine: string;
  protectionCostLine: string;
  disclaimer: string;
  provenance?: Record<string, unknown>;
  summary?: Record<string, unknown>;
}

export interface IPaymentOutcome {
  confirmedAt: Date;
  achievedLocalAmount: number;
  achievedRate?: number;
  achievedFeesLocal?: number;
  notes?: string;
}

export interface IPurchaseCycle extends Document {
  userAddress: string;
  label: string;
  localCurrency: string;
  targetCurrency: string;
  paymentDate: Date;
  targetAmountUsd: number;
  monitoringEnabled: boolean;
  cycleProtectionExecutionStatus?: CycleProtectionExecutionStatus;
  cycleProtectionClaimedAt?: Date;
  cycleProtectionExecutedAt?: Date;
  cycleProtectionTxHash?: string;
  cycleProtectionError?: string;
  status: PurchaseCycleStatus;
  lastReport?: ICycleReportSnapshot;
  postEventReport?: ICycleReportSnapshot;
  paymentOutcome?: IPaymentOutcome;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSnapshotSchema = new Schema<ICycleReportSnapshot>(
  {
    computedAt: { type: Date, required: true },
    totalDragLocal: { type: Number, required: true },
    totalDragPct: { type: Number, required: true },
    exposureDays: { type: Number, required: true },
    narrativeHeadline: { type: String, required: true },
    dragLine: { type: String, required: true },
    protectionCostLine: { type: String, required: true },
    disclaimer: { type: String, required: true },
    provenance: { type: Schema.Types.Mixed },
    summary: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const PaymentOutcomeSchema = new Schema<IPaymentOutcome>(
  {
    confirmedAt: { type: Date, required: true },
    achievedLocalAmount: { type: Number, required: true, min: 0 },
    achievedRate: { type: Number, min: 0 },
    achievedFeesLocal: { type: Number, min: 0 },
    notes: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const PurchaseCycleSchema = new Schema<IPurchaseCycle>(
  {
    userAddress: { type: String, required: true, lowercase: true, index: true },
    label: { type: String, required: true, default: 'Upcoming payment' },
    localCurrency: { type: String, required: true, uppercase: true, maxlength: 3 },
    targetCurrency: { type: String, required: true, uppercase: true, maxlength: 3, default: 'USD' },
    paymentDate: { type: Date, required: true },
    targetAmountUsd: { type: Number, required: true, min: 0 },
    monitoringEnabled: { type: Boolean, default: false },
    cycleProtectionExecutionStatus: {
      type: String,
      enum: ['claimed', 'executed', 'failed'],
    },
    cycleProtectionClaimedAt: { type: Date },
    cycleProtectionExecutedAt: { type: Date },
    cycleProtectionTxHash: { type: String },
    cycleProtectionError: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ['draft', 'active', 'payment_due', 'completed', 'cancelled'],
      default: 'active',
    },
    lastReport: { type: ReportSnapshotSchema },
    postEventReport: { type: ReportSnapshotSchema },
    paymentOutcome: { type: PaymentOutcomeSchema },
  },
  { timestamps: true },
);

PurchaseCycleSchema.index({ userAddress: 1, paymentDate: 1 });
PurchaseCycleSchema.index({ userAddress: 1, status: 1, monitoringEnabled: 1 });

export const PurchaseCycle =
  mongoose.models.PurchaseCycle ||
  mongoose.model<IPurchaseCycle>('PurchaseCycle', PurchaseCycleSchema);
