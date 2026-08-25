import { describe, it, expect } from 'vitest';
import { buildIndexedSeries } from '../fx-rate.service';

describe('buildIndexedSeries', () => {
  it('indexes a weakening currency to a declining series starting at 100', () => {
    // Local-per-USD rises 100 → 130 → 160: the currency buys less USD.
    const out = buildIndexedSeries(
      ['2025-01-01', '2025-06-01', '2026-01-01'],
      [100, 130, 160],
    );
    expect(out).not.toBeNull();
    expect(out!.values[0]).toBe(100);
    // (100/130)*100 ≈ 76.92
    expect(out!.values[1]).toBeCloseTo(76.92, 1);
    // (100/160)*100 = 62.5
    expect(out!.values[2]).toBe(62.5);
    expect(out!.dates).toEqual(['2025-01-01', '2025-06-01', '2026-01-01']);
  });

  it('indexes a strengthening currency to a rising series', () => {
    const out = buildIndexedSeries(
      ['2025-01-01', '2026-01-01'],
      [160, 100],
    );
    expect(out!.values[0]).toBe(100);
    expect(out!.values[1]).toBe(160);
  });

  it('returns a flat 100 series for a stable currency', () => {
    const out = buildIndexedSeries(
      ['2025-01-01', '2025-06-01', '2026-01-01'],
      [15, 15, 15],
    );
    expect(out!.values).toEqual([100, 100, 100]);
  });

  it('returns null for mismatched lengths', () => {
    expect(buildIndexedSeries(['2025-01-01'], [100, 110])).toBeNull();
  });

  it('returns null for fewer than two points', () => {
    expect(buildIndexedSeries(['2025-01-01'], [100])).toBeNull();
    expect(buildIndexedSeries([], [])).toBeNull();
  });

  it('returns null when the first rate is missing or non-positive', () => {
    expect(buildIndexedSeries(['a', 'b'], [0, 100])).toBeNull();
    expect(buildIndexedSeries(['a', 'b'], [-1, 100])).toBeNull();
  });

  it('does not mutate its inputs', () => {
    const dates = ['2025-01-01', '2026-01-01'];
    const rates = [100, 200];
    buildIndexedSeries(dates, rates);
    expect(dates).toEqual(['2025-01-01', '2026-01-01']);
    expect(rates).toEqual([100, 200]);
  });
});
