/**
 * FX drag math for import working-capital cycles. Pure functions, no I/O —
 * the CLI (scripts/fx-drag-report.ts) wires in rates and rendering.
 *
 * Model: a trader accumulates local-currency revenue, then pays a USD
 * supplier invoice. "Drag" is the local-currency difference between what
 * the payment actually cost and what it would have cost had each revenue
 * receipt been converted to USD-pegged value on arrival (the counterfactual
 * the Guardian's Importer archetype would automate). Decomposed into:
 *   timing  — depreciation during the exposure window, net of ramp cost
 *   spread  — achieved bank rate vs mid-market on payment day
 *   fees    — explicit charges the trader reported
 * Drag can be negative (currency appreciated / protection would have cost
 * money) — the report must say so plainly rather than hide it.
 */

export interface RevenueReceipt {
  /** ISO date the local-currency proceeds were in hand */
  date: string;
  amountLocal: number;
}

export interface SupplierPayment {
  /** ISO date the USD payment was made */
  date: string;
  amountUsd: number;
  /** Local-per-USD rate actually achieved (all-in bank rate) */
  achievedRate: number;
  /** Explicit charges (wire fees etc.) in local currency */
  feesLocal?: number;
}

export interface Cycle {
  label: string;
  revenues: RevenueReceipt[];
  payment: SupplierPayment;
}

export interface DragInput {
  business?: string;
  /** ISO 4217 code of the local currency, e.g. KES, GHS */
  currency: string;
  cycles: Cycle[];
}

/** Local-per-USD mid-market rate for an ISO date */
export type MidRateProvider = (isoDate: string) => number;

export interface DragOptions {
  /**
   * Assumed round-trip cost of converting local currency to USD-pegged
   * value (on-ramp spread + fees), in basis points. Applied to the
   * counterfactual so protection is never modeled as free.
   */
  rampCostBps: number;
}

export const DEFAULT_OPTIONS: DragOptions = { rampCostBps: 50 };

export interface CycleResult {
  label: string;
  windowStart: string;
  windowEnd: string;
  exposureDays: number;
  /** Exposure days weighted by how much local value sat in each window */
  weightedExposureDays: number;
  /** Mid-market move over the window; positive = local currency weakened */
  windowDepreciationPct: number;
  midAtPayment: number;
  counterfactualRate: number;
  actualLocalCost: number;
  counterfactualLocalCost: number;
  /** USD covered by early-converted revenue vs bought on payment day */
  coveredUsd: number;
  uncoveredUsd: number;
  dragLocal: number;
  /** Drag as % of the actual local cost of the payment */
  dragPct: number;
  decomposition: {
    timingLocal: number;
    spreadLocal: number;
    feesLocal: number;
  };
  warnings: string[];
}

export interface DragSummary {
  cycles: CycleResult[];
  totalUsdPaid: number;
  totalActualLocal: number;
  totalDragLocal: number;
  totalDragPct: number;
  totalTimingLocal: number;
  totalSpreadLocal: number;
  totalFeesLocal: number;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
}

function assertValidCycle(cycle: Cycle): void {
  if (!cycle.revenues.length) {
    throw new Error(`Cycle "${cycle.label}": at least one revenue receipt is required`);
  }
  if (cycle.payment.amountUsd <= 0 || cycle.payment.achievedRate <= 0) {
    throw new Error(`Cycle "${cycle.label}": payment amountUsd and achievedRate must be positive`);
  }
  for (const r of [...cycle.revenues.map((x) => x.date), cycle.payment.date]) {
    if (Number.isNaN(Date.parse(r))) {
      throw new Error(`Cycle "${cycle.label}": invalid date "${r}"`);
    }
  }
  const paymentTime = Date.parse(cycle.payment.date);
  if (cycle.revenues.some((r) => Date.parse(r.date) > paymentTime)) {
    throw new Error(`Cycle "${cycle.label}": revenue receipts must not be after the payment date`);
  }
}

export function analyzeCycle(
  cycle: Cycle,
  midRate: MidRateProvider,
  options: DragOptions = DEFAULT_OPTIONS,
): CycleResult {
  assertValidCycle(cycle);
  const warnings: string[] = [];
  const ramp = options.rampCostBps / 10_000;
  const { payment } = cycle;

  const revenues = [...cycle.revenues].sort((a, b) => a.date.localeCompare(b.date));
  const midAtPayment = midRate(payment.date);
  const feesLocal = payment.feesLocal ?? 0;
  const actualLocalCost = payment.amountUsd * payment.achievedRate + feesLocal;

  // Counterfactual: convert each receipt on arrival (net of ramp cost),
  // chronologically, until the USD obligation is covered.
  let usdNeeded = payment.amountUsd;
  let localUsed = 0;
  let coveredUsd = 0;
  let weightedDayNumerator = 0;
  for (const receipt of revenues) {
    if (usdNeeded <= 0) break;
    const rate = midRate(receipt.date);
    const usdAvailable = (receipt.amountLocal * (1 - ramp)) / rate;
    const usdTaken = Math.min(usdAvailable, usdNeeded);
    const localTaken = receipt.amountLocal * (usdTaken / usdAvailable);
    localUsed += localTaken;
    coveredUsd += usdTaken;
    usdNeeded -= usdTaken;
    weightedDayNumerator += daysBetween(receipt.date, payment.date) * localTaken;
  }

  const uncoveredUsd = usdNeeded;
  if (uncoveredUsd > 0.005) {
    warnings.push(
      `Reported revenue covers only $${coveredUsd.toFixed(0)} of the $${payment.amountUsd.toFixed(0)} payment; ` +
        `the remainder is modeled as converted on payment day (no timing benefit).`,
    );
  }
  const uncoveredLocal = (uncoveredUsd * midAtPayment) / (1 - ramp);
  const counterfactualLocalCost = localUsed + uncoveredLocal;
  const counterfactualRate = counterfactualLocalCost / payment.amountUsd;

  const spreadLocal = (payment.achievedRate - midAtPayment) * payment.amountUsd;
  if (spreadLocal < 0) {
    warnings.push(
      `Achieved rate ${payment.achievedRate} beat the mid-market rate ${midAtPayment.toFixed(2)} on payment day — ` +
        `worth double-checking the recorded rate or date.`,
    );
  }

  const dragLocal = actualLocalCost - counterfactualLocalCost;
  const timingLocal = dragLocal - spreadLocal - feesLocal;
  if (dragLocal < 0) {
    warnings.push(
      `Negative drag: converting early would have cost more this cycle (currency held steady or strengthened). ` +
        `Protection is not free money — this report measures, it does not prescribe.`,
    );
  }

  const windowStart = revenues[0].date;
  const midAtStart = midRate(windowStart);
  return {
    label: cycle.label,
    windowStart,
    windowEnd: payment.date,
    exposureDays: daysBetween(windowStart, payment.date),
    weightedExposureDays: localUsed > 0 ? weightedDayNumerator / localUsed : 0,
    windowDepreciationPct: ((midAtPayment - midAtStart) / midAtStart) * 100,
    midAtPayment,
    counterfactualRate,
    actualLocalCost,
    counterfactualLocalCost,
    coveredUsd,
    uncoveredUsd,
    dragLocal,
    dragPct: (dragLocal / actualLocalCost) * 100,
    decomposition: { timingLocal, spreadLocal, feesLocal },
    warnings,
  };
}

export function analyzeCycles(
  input: DragInput,
  midRate: MidRateProvider,
  options: DragOptions = DEFAULT_OPTIONS,
): DragSummary {
  const cycles = input.cycles.map((c) => analyzeCycle(c, midRate, options));
  const totalActualLocal = cycles.reduce((s, c) => s + c.actualLocalCost, 0);
  const totalDragLocal = cycles.reduce((s, c) => s + c.dragLocal, 0);
  return {
    cycles,
    totalUsdPaid: input.cycles.reduce((s, c) => s + c.payment.amountUsd, 0),
    totalActualLocal,
    totalDragLocal,
    totalDragPct: totalActualLocal > 0 ? (totalDragLocal / totalActualLocal) * 100 : 0,
    totalTimingLocal: cycles.reduce((s, c) => s + c.decomposition.timingLocal, 0),
    totalSpreadLocal: cycles.reduce((s, c) => s + c.decomposition.spreadLocal, 0),
    totalFeesLocal: cycles.reduce((s, c) => s + c.decomposition.feesLocal, 0),
  };
}

/** Every date the rate provider must be able to answer for this input */
export function requiredDates(input: DragInput): string[] {
  const dates = new Set<string>();
  for (const cycle of input.cycles) {
    for (const r of cycle.revenues) dates.add(r.date);
    dates.add(cycle.payment.date);
  }
  return [...dates].sort();
}
