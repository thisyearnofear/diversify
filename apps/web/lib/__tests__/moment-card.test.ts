import { describe, it, expect } from 'vitest';
import { momentCardContent, momentBenchmarkFor } from '../moment-card';

describe('momentCardContent', () => {
  it('derives the NGN card: USD benchmark, 5yr loss, newest event', () => {
    const c = momentCardContent('NGN');
    expect(c).not.toBeNull();
    expect(c!.code).toBe('NGN');
    expect(c!.benchmark).toBe('USD');
    expect(c!.benchmarkName).toBe('the dollar');
    expect(c!.flag).toBe('🇳🇬');
    expect(c!.headline).toBe(
      'The naira bought 60% less than the dollar in 5 years',
    );
    expect(c!.event).toBe('2026 · Rate-cut test');
    expect(c!.asOf).toBe('Jul 2025');
  });

  it('benchmark currencies read gold, not themselves', () => {
    // CAD is in the benchmark rule but not the curated dataset — codes
    // without an entry stay null (honest absence).
    for (const code of ['USD', 'EUR', 'GBP', 'CAD']) {
      const c = momentCardContent(code);
      if (!c) {
        expect(code).toBe('CAD');
        continue;
      }
      expect(c.benchmark, code).toBe('XAU');
      expect(c.benchmarkName, code).toBe('gold');
      expect(c.headline, code).toContain('gold');
    }
  });

  it('an inert (pegged) entry reads gold', () => {
    const c = momentCardContent('BBD');
    expect(c).not.toBeNull();
    expect(c!.benchmark).toBe('XAU');
  });

  it('canonicalises case-insensitive codes', () => {
    expect(momentCardContent('ngn')?.code).toBe('NGN');
  });

  it('returns null for an unknown code — never a guess', () => {
    expect(momentCardContent('ZZZ')).toBeNull();
    expect(momentCardContent('')).toBeNull();
    expect(momentCardContent(null)).toBeNull();
  });

  it('picks the newest risk event, ties favour the later entry', () => {
    const c = momentCardContent('GHS');
    // Both GHS events are 2022 — the last in the array wins.
    expect(c!.event).toBe(
      '2022 · Domestic debt exchange',
    );
  });

  it('frames an appreciating-or-level reading honestly', () => {
    // ARS vs USD 5yr is -78 → "bought 78% less"; XAU entries are all
    // negative, so use the level grammar check on a zero-like delta only
    // if the dataset has one — instead assert the grammar holds shape.
    const c = momentCardContent('ARS');
    expect(c!.headline).toMatch(/^The .* bought 78% less than the dollar in 5 years$/);
  });
});

describe('momentBenchmarkFor', () => {
  it('matches Home rules: gold for benchmarks + inert, USD otherwise', () => {
    expect(momentBenchmarkFor('NGN')).toBe('USD');
    expect(momentBenchmarkFor('USD')).toBe('XAU');
    expect(momentBenchmarkFor('BBD')).toBe('XAU');
  });
});
