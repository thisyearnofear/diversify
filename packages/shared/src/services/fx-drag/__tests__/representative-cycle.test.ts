import { describe, expect, it } from 'vitest';
import {
  LAST_CYCLE_DAYS,
  RATE_LAG_DAYS,
  lastCycleWindow,
  representativeCycleInput,
} from '../representative-cycle';
import { requiredDates } from '../calc';

describe('lastCycleWindow', () => {
  it('ends RATE_LAG_DAYS before today and spans LAST_CYCLE_DAYS', () => {
    const w = lastCycleWindow(new Date('2026-10-01T15:30:00Z'));
    expect(w.end).toBe('2026-09-29');
    expect(w.start).toBe('2026-07-18');
    expect(w.mid).toBe('2026-09-01');
  });

  it('crosses a year boundary in UTC', () => {
    const w = lastCycleWindow(new Date('2026-01-10T00:00:00Z'));
    expect(w.end).toBe('2026-01-08');
    expect(w.mid).toBe('2025-12-11');
    expect(w.start).toBe('2025-10-27');
  });
});

describe('representativeCycleInput', () => {
  const input = {
    currency: 'GHS',
    earningsLocal: 100_000,
    paymentUsd: 12_500,
    achievedRate: 15.2,
    feesLocal: 300,
  };

  it('splits revenue 40/35/25 across start/mid/end, summing to earnings', () => {
    const drag = representativeCycleInput(input, new Date('2026-10-01T12:00:00Z'));
    const cycle = drag.cycles[0];
    expect(cycle.label).toBe('Last cycle');
    expect(cycle.revenues.map((r) => r.date)).toEqual([
      '2026-07-18',
      '2026-09-01',
      '2026-09-29',
    ]);
    expect(cycle.revenues.map((r) => r.amountLocal)).toEqual([40_000, 35_000, 25_000]);
    expect(cycle.revenues.reduce((s, r) => s + r.amountLocal, 0)).toBe(input.earningsLocal);
  });

  it('places the payment at the window end with the achieved terms', () => {
    const drag = representativeCycleInput(input, new Date('2026-10-01T12:00:00Z'));
    expect(drag.cycles[0].payment).toEqual({
      date: '2026-09-29',
      amountUsd: 12_500,
      achievedRate: 15.2,
      feesLocal: 300,
    });
    expect(drag.currency).toBe('GHS');
  });

  it('produces exactly the dates a rate provider must answer', () => {
    const drag = representativeCycleInput(input, new Date('2026-10-01T12:00:00Z'));
    expect(requiredDates(drag)).toEqual(['2026-07-18', '2026-09-01', '2026-09-29']);
  });
});

describe('window constants', () => {
  it('keeps the documented shape (73-day window, 2-day rate lag)', () => {
    expect(LAST_CYCLE_DAYS).toBe(73);
    expect(RATE_LAG_DAYS).toBe(2);
  });
});
