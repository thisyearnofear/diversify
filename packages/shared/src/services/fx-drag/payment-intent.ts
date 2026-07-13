/**
 * Build a synthetic FX drag cycle from a simple payment intent.
 *
 * Used for the free in-app "upcoming payment" report — not a full importer
 * ledger. Assumes local-currency proceeds were held from an exposure start
 * date until the payment date.
 */

import type { Cycle, DragInput } from './calc';

export interface PaymentIntentInput {
  /** ISO 4217 local currency code, e.g. GHS */
  localCurrency: string;
  /** ISO 4217 target currency — currently USD-only in the calc engine */
  targetCurrency: string;
  /** ISO date when the supplier payment is due */
  paymentDate: string;
  /** Expected payment amount in target currency */
  targetAmount: number;
  /**
   * ISO date exposure began (defaults to ~60 days before payment, not before today).
   * Caller should pass today's date when building client-side.
   */
  exposureStartDate?: string;
  /** Assumed all-in bank spread over mid on payment day, in basis points */
  bankSpreadBps?: number;
  /** Optional wire/transfer fees in local currency */
  feesLocal?: number;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
}

export function defaultExposureStart(paymentDate: string, todayIso: string): string {
  const paymentMs = Date.parse(paymentDate);
  const todayMs = Date.parse(todayIso);
  const sixtyDaysBefore = paymentMs - 60 * MS_PER_DAY;
  const startMs = Math.max(todayMs, sixtyDaysBefore);
  return new Date(startMs).toISOString().slice(0, 10);
}

export function buildPaymentIntentDragInput(
  intent: PaymentIntentInput,
  midRateAtExposureStart: number,
  midRateAtPayment: number,
): DragInput {
  if (intent.targetCurrency.toUpperCase() !== 'USD') {
    throw new Error('Payment intent reports currently support USD target amounts only');
  }
  if (intent.targetAmount <= 0) {
    throw new Error('Target amount must be positive');
  }

  const exposureStart =
    intent.exposureStartDate ??
    defaultExposureStart(intent.paymentDate, new Date().toISOString().slice(0, 10));

  if (daysBetween(exposureStart, intent.paymentDate) < 0) {
    throw new Error('Payment date must be on or after exposure start');
  }

  const spreadBps = intent.bankSpreadBps ?? 150;
  const achievedRate = midRateAtPayment * (1 + spreadBps / 10_000);
  const amountLocal = intent.targetAmount * midRateAtExposureStart;

  const cycle: Cycle = {
    label: 'Upcoming payment',
    revenues: [{ date: exposureStart, amountLocal }],
    payment: {
      date: intent.paymentDate,
      amountUsd: intent.targetAmount,
      achievedRate,
      feesLocal: intent.feesLocal ?? 0,
    },
  };

  return {
    business: 'Payment readiness scenario',
    currency: intent.localCurrency.toUpperCase(),
    cycles: [cycle],
  };
}
