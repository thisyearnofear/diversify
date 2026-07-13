import { describe, expect, it } from 'vitest';
import {
  buildPaymentIntentDragInput,
  defaultExposureStart,
} from '../payment-intent';

describe('payment-intent', () => {
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
