/**
 * Purchase cycle — working-capital payment intent for FX drag monitoring.
 */

import type { DragSummary } from '../services/fx-drag/calc';
import type { DataProvenance } from './guardian-protection';

export type PurchaseCycleStatus = 'draft' | 'active' | 'payment_due' | 'completed' | 'cancelled';

export interface CycleReportSnapshot {
  computedAt: string;
  totalDragLocal: number;
  totalDragPct: number;
  exposureDays: number;
  narrativeHeadline: string;
  dragLine: string;
  protectionCostLine: string;
  disclaimer: string;
  provenance?: DataProvenance;
  summary?: DragSummary;
}

/** User-supplied outcome after the payment date — required to call it a post-payment report. */
export interface PaymentOutcome {
  confirmedAt: string;
  /** Local-currency amount actually paid (all-in). */
  achievedLocalAmount: number;
  /** Local units per 1 USD (or target) if known. */
  achievedRate?: number;
  /** Fees paid in local currency, if known. */
  achievedFeesLocal?: number;
  notes?: string;
}

export interface PurchaseCycleRecord {
  id: string;
  userAddress: string;
  label: string;
  localCurrency: string;
  targetCurrency: string;
  /** ISO date YYYY-MM-DD */
  paymentDate: string;
  targetAmountUsd: number;
  monitoringEnabled: boolean;
  cycleProtectionExecutionStatus?: 'claimed' | 'executed' | 'failed';
  cycleProtectionExecutedAt?: string;
  cycleProtectionTxHash?: string;
  cycleProtectionError?: string;
  status: PurchaseCycleStatus;
  lastReport?: CycleReportSnapshot;
  postEventReport?: CycleReportSnapshot;
  paymentOutcome?: PaymentOutcome;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseCycleInput {
  userAddress: string;
  label?: string;
  localCurrency: string;
  targetCurrency?: string;
  paymentDate: string;
  targetAmountUsd: number;
  monitoringEnabled?: boolean;
  lastReport?: CycleReportSnapshot;
}
