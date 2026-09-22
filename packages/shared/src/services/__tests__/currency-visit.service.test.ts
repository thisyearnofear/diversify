import { describe, expect, it } from 'vitest';
import { compareCurrencyVisits, formatCurrencyVisitPercent, type CurrencyVisitReading } from '../currency-visit.service';
const NOW = Date.parse('2026-09-22T12:00:00Z');
const AGE = 6 * 3600000;
const before: CurrencyVisitReading = { key: 'JM:JMD:USD:1yr', delta: -9.1, dataAsOf: '2026-09-19', source: 'feed' };
const current: CurrencyVisitReading = { ...before, delta: -8.4, dataAsOf: '2026-09-22' };
const snapshot = { value: before, at: Date.parse('2026-09-19T12:00:00Z') };
describe('currency visit comparisons', () => {
  it('compares rounded trailing readings in percentage points, not returns', () => {
    expect(compareCurrencyVisits(current, snapshot, NOW, AGE)).toMatchObject({ kind: 'updated', changePoints: 0.7 });
    expect(compareCurrencyVisits({ ...current, delta: -10.2 }, snapshot, NOW, AGE)).toMatchObject({ kind: 'updated', changePoints: -1.1 });
  });
  it('distinguishes new unchanged data, old data, and revisions', () => {
    expect(compareCurrencyVisits({ ...current, delta: -9.11 }, snapshot, NOW, AGE)).toMatchObject({ kind: 'unchanged', changePoints: 0 });
    expect(compareCurrencyVisits(before, snapshot, NOW, AGE)).toMatchObject({ kind: 'same-data', changePoints: 0 });
    expect(compareCurrencyVisits({ ...before, delta: -8.4 }, snapshot, NOW, AGE)).toMatchObject({ kind: 'revised', changePoints: 0.7 });
  });
  it('requires comparable identity, source, chronology, and a previous visit', () => {
    for (const previous of [null, { value: -9.1, at: snapshot.at }, { ...snapshot, at: NOW }, { ...snapshot, at: NOW + AGE }, { ...snapshot, at: NaN }, { ...snapshot, value: { ...before, key: 'GH:GHS:USD:1yr' } }, { ...snapshot, value: { ...before, source: 'curated' } }, { ...snapshot, value: { ...before, dataAsOf: '2026-09-23' } }, { ...snapshot, value: { ...before, delta: NaN } }, { ...snapshot, value: { ...before, delta: -101 } }, { ...snapshot, value: { ...before, dataAsOf: '2026-02-30' } }]) {
      expect(compareCurrencyVisits(current, previous, NOW, AGE)).toBeNull();
    }
    expect(compareCurrencyVisits({ ...current, dataAsOf: '2026-09-18' }, snapshot, NOW, AGE)).toBeNull();
    expect(compareCurrencyVisits({ ...current, dataAsOf: '2026-09-23' }, snapshot, NOW, AGE)).toBeNull();
    expect(compareCurrencyVisits({ ...current, delta: Infinity }, snapshot, NOW, AGE)).toBeNull();
    expect(compareCurrencyVisits(current, { ...snapshot, at: NOW - AGE }, NOW, AGE)).not.toBeNull();
  });
  it('formats readings consistently without signed zero', () => {
    expect(formatCurrencyVisitPercent(-9.1)).toBe('−9.1%');
    expect(formatCurrencyVisitPercent(2)).toBe('+2%');
    expect(formatCurrencyVisitPercent(-0.01)).toBe('0%');
    expect(formatCurrencyVisitPercent(0)).toBe('0%');
  });
});
