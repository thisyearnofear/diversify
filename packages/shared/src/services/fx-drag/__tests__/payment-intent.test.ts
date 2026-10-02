import { describe, expect, it } from 'vitest';
import {
  buildPaymentIntentDragInput,
  defaultExposureStart,
  paymentScenarioComparison,
} from '../payment-intent';
import { analyzeCycles } from '../calc';

describe('payment-intent', () => {
  const summaryFor = (paymentRate: number) => {
    const input = buildPaymentIntentDragInput({
      localCurrency: 'GHS', targetCurrency: 'USD', paymentDate: '2026-10-30',
      targetAmount: 10000, exposureStartDate: '2026-10-03',
    }, 15, paymentRate);
    return analyzeCycles(input, (date) => date === '2026-10-03' ? 15 : paymentRate);
  };

  it('derives both comparison costs from the same modeled summary', () => {
    const summary = summaryFor(16);
    expect(paymentScenarioComparison(summary)).toMatchObject({
      waitScenarioLocal: summary.totalActualLocal,
      convertEarlyLocal: summary.totalActualLocal - summary.totalDragLocal,
      differenceLocal: summary.totalDragLocal,
      direction: 'more',
    });
  });

  it('preserves an advantage to waiting rather than forcing early conversion', () => {
    expect(paymentScenarioComparison(summaryFor(14))?.direction).toBe('less');
  });

  it('does not invent costs from invalid or missing totals', () => {
    const summary = summaryFor(16);
    expect(paymentScenarioComparison({ ...summary, totalActualLocal: Number.NaN })).toBeNull();
    expect(paymentScenarioComparison({ ...summary, totalDragLocal: Number.POSITIVE_INFINITY })).toBeNull();
    expect(paymentScenarioComparison({ ...summary, totalActualLocal: 0 })).toBeNull();
  });

  it('shows similar costs instead of a signed zero difference', () => {
    expect(paymentScenarioComparison({ ...summaryFor(16), totalDragLocal: -0.01 })?.direction).toBe('similar');
  });
  it('builds a synthetic cycle from payment intent', () => {
    const input = buildPaymentIntentDragInput(
      {
        localCurrency: 'GHS',
        targetCurrency: 'USD',
        paymentDate: '2026-09-30',
        targetAmount: 10_000,
        exposureStartDate: '2026-07-01',
      },
      15,
      16,
    );

    expect(input.currency).toBe('GHS');
    expect(input.cycles).toHaveLength(1);
    expect(input.cycles[0].payment.amountUsd).toBe(10_000);
    expect(input.cycles[0].revenues[0].amountLocal).toBe(150_000);
  });

  it('defaults exposure start to max(today, payment-60d)', () => {
    const start = defaultExposureStart('2026-12-01', '2026-07-13');
    expect(start).toBe('2026-10-02');
  });
});
