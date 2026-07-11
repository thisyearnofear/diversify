import { describe, expect, it } from 'vitest';
import {
  analyzeCycle,
  analyzeCycles,
  requiredDates,
  type Cycle,
  type MidRateProvider,
} from '../fx-drag/calc';

/** Currency slides from 100 to 110 local-per-USD across the window */
const depreciatingRates: MidRateProvider = (date) =>
  ({ '2025-01-01': 100, '2025-02-01': 105, '2025-03-01': 110 })[date] ?? 110;

const NO_RAMP = { rampCostBps: 0 };

function cycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    label: 'test',
    revenues: [{ date: '2025-01-01', amountLocal: 1_000_000 }],
    payment: { date: '2025-03-01', amountUsd: 5000, achievedRate: 112, feesLocal: 1000 },
    ...overrides,
  };
}

describe('analyzeCycle', () => {
  it('measures positive drag when the currency depreciates during the window', () => {
    // Revenue converts at 100 → $5000 costs 500,000 local early vs 560,000 at
    // the achieved 112 (+1000 fees). Drag = 61,000.
    const result = analyzeCycle(cycle(), depreciatingRates, NO_RAMP);
    expect(result.actualLocalCost).toBe(5000 * 112 + 1000);
    expect(result.counterfactualLocalCost).toBeCloseTo(500_000, 6);
    expect(result.dragLocal).toBeCloseTo(61_000, 6);
    expect(result.uncoveredUsd).toBeCloseTo(0, 6);
  });

  it('decomposition sums exactly to total drag', () => {
    const result = analyzeCycle(cycle(), depreciatingRates, { rampCostBps: 50 });
    const { timingLocal, spreadLocal, feesLocal } = result.decomposition;
    expect(timingLocal + spreadLocal + feesLocal).toBeCloseTo(result.dragLocal, 8);
  });

  it('separates bank spread from timing', () => {
    // Achieved 112 vs mid 110 on payment day → spread = 2 × 5000 = 10,000
    const result = analyzeCycle(cycle(), depreciatingRates, NO_RAMP);
    expect(result.decomposition.spreadLocal).toBeCloseTo(10_000, 6);
    expect(result.decomposition.feesLocal).toBe(1000);
    expect(result.decomposition.timingLocal).toBeCloseTo(50_000, 6);
  });

  it('ramp cost reduces the measured benefit of protecting', () => {
    const free = analyzeCycle(cycle(), depreciatingRates, NO_RAMP);
    const costed = analyzeCycle(cycle(), depreciatingRates, { rampCostBps: 100 });
    expect(costed.dragLocal).toBeLessThan(free.dragLocal);
  });

  it('covers the USD obligation chronologically across receipts', () => {
    // 300k at 100 → $3000, then 210k at 105 → $2000: exactly covers $5000
    const result = analyzeCycle(
      cycle({
        revenues: [
          { date: '2025-01-01', amountLocal: 300_000 },
          { date: '2025-02-01', amountLocal: 900_000 },
        ],
      }),
      depreciatingRates,
      NO_RAMP,
    );
    expect(result.coveredUsd).toBeCloseTo(5000, 6);
    expect(result.counterfactualLocalCost).toBeCloseTo(300_000 + 210_000, 6);
  });

  it('models uncovered remainder at the payment-day rate with a warning', () => {
    // Only $1000 of revenue reported against a $5000 payment
    const result = analyzeCycle(
      cycle({ revenues: [{ date: '2025-01-01', amountLocal: 100_000 }] }),
      depreciatingRates,
      NO_RAMP,
    );
    expect(result.coveredUsd).toBeCloseTo(1000, 6);
    expect(result.uncoveredUsd).toBeCloseTo(4000, 6);
    expect(result.counterfactualLocalCost).toBeCloseTo(100_000 + 4000 * 110, 6);
    expect(result.warnings.some((w) => w.includes('covers only'))).toBe(true);
  });

  it('reports negative drag honestly when the currency appreciates', () => {
    const appreciating: MidRateProvider = (date) => (date === '2025-01-01' ? 110 : 100);
    const result = analyzeCycle(
      cycle({ payment: { date: '2025-03-01', amountUsd: 5000, achievedRate: 100.2 } }),
      appreciating,
      NO_RAMP,
    );
    expect(result.dragLocal).toBeLessThan(0);
    expect(result.warnings.some((w) => w.includes('Negative drag'))).toBe(true);
  });

  it('warns when the achieved rate beats mid-market (likely data issue)', () => {
    const result = analyzeCycle(
      cycle({ payment: { date: '2025-03-01', amountUsd: 5000, achievedRate: 108 } }),
      depreciatingRates,
      NO_RAMP,
    );
    expect(result.warnings.some((w) => w.includes('beat the mid-market'))).toBe(true);
  });

  it('computes exposure windows from the first receipt to the payment', () => {
    const result = analyzeCycle(cycle(), depreciatingRates, NO_RAMP);
    expect(result.exposureDays).toBe(59);
    expect(result.weightedExposureDays).toBeCloseTo(59, 6);
    expect(result.windowDepreciationPct).toBeCloseTo(10, 6);
  });

  it('rejects revenue receipts dated after the payment', () => {
    expect(() =>
      analyzeCycle(
        cycle({ revenues: [{ date: '2025-04-01', amountLocal: 1000 }] }),
        depreciatingRates,
        NO_RAMP,
      ),
    ).toThrow(/must not be after/);
  });
});

describe('analyzeCycles', () => {
  it('totals across cycles and keeps the decomposition additive', () => {
    const summary = analyzeCycles(
      { currency: 'KES', cycles: [cycle(), cycle({ label: 'second' })] },
      depreciatingRates,
      NO_RAMP,
    );
    expect(summary.totalUsdPaid).toBe(10_000);
    expect(summary.totalDragLocal).toBeCloseTo(122_000, 6);
    expect(
      summary.totalTimingLocal + summary.totalSpreadLocal + summary.totalFeesLocal,
    ).toBeCloseTo(summary.totalDragLocal, 8);
  });
});

describe('requiredDates', () => {
  it('collects unique sorted dates across revenues and payments', () => {
    const dates = requiredDates({
      currency: 'KES',
      cycles: [
        cycle(),
        cycle({ revenues: [{ date: '2025-02-01', amountLocal: 1 }] }),
      ],
    });
    expect(dates).toEqual(['2025-01-01', '2025-02-01', '2025-03-01']);
  });
});
