/**
 * Builds the "last cycle" FX-drag scenario: a representative cycle over a
 * trailing window anchored to today, instead of a hard-coded date range.
 * Pure — the caller wires a rate provider for the dates it produces.
 */

import type { DragInput } from './calc';

export interface LastCycleInput {
  currency: string;
  earningsLocal: number;
  paymentUsd: number;
  achievedRate: number;
  feesLocal: number;
}

/** Length of the representative exposure window, in days. */
export const LAST_CYCLE_DAYS = 73;
/** The open currency dataset publishes with a lag — the window ends this
 *  many days before today so every rate actually resolves. */
export const RATE_LAG_DAYS = 2;

const MID_RECEIPT_LAG_DAYS = 28;
const MS_PER_DAY = 86_400_000;

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * MS_PER_DAY);

/** The trailing window ending RATE_LAG_DAYS before `today` (UTC ISO dates). */
export function lastCycleWindow(today: Date): { start: string; mid: string; end: string } {
  const end = addDays(today, -RATE_LAG_DAYS);
  return {
    start: iso(addDays(end, -LAST_CYCLE_DAYS)),
    mid: iso(addDays(end, -MID_RECEIPT_LAG_DAYS)),
    end: iso(end),
  };
}

/**
 * One cycle, labelled "Last cycle": 40% of earnings land at `start`, 35% at
 * `mid`, 25% at `end`, and the USD supplier payment settles at `end` at the
 * achieved bank rate plus any explicit fees.
 */
export function representativeCycleInput(input: LastCycleInput, today: Date): DragInput {
  const { start, mid, end } = lastCycleWindow(today);
  return {
    currency: input.currency,
    cycles: [
      {
        label: 'Last cycle',
        revenues: [
          { date: start, amountLocal: input.earningsLocal * 0.4 },
          { date: mid, amountLocal: input.earningsLocal * 0.35 },
          { date: end, amountLocal: input.earningsLocal * 0.25 },
        ],
        payment: {
          date: end,
          amountUsd: input.paymentUsd,
          achievedRate: input.achievedRate,
          feesLocal: input.feesLocal,
        },
      },
    ],
  };
}
