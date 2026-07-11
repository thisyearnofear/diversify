import { describe, expect, it } from 'vitest';
import {
  computeResale,
  entryResale,
  getMarketplaceEntry,
  marketplaceByUseCase,
  CIRCLE_MARKETPLACE_CATALOG,
  DEFAULT_MARKUP_BPS,
} from '../circle-marketplace';

describe('computeResale', () => {
  it('applies the markup and reports margin', () => {
    const r = computeResale(0.008, 3000); // +30%
    expect(r.resaleUsd).toBeCloseTo(0.0104, 6);
    expect(r.marginUsd).toBeCloseTo(0.0024, 6);
  });

  it('never resells below wholesale (rounds up)', () => {
    const r = computeResale(0.05, 2000); // +20% = 0.06
    expect(r.resaleUsd).toBeGreaterThanOrEqual(0.05);
    expect(r.resaleUsd).toBeCloseTo(0.06, 6);
    expect(r.marginUsd).toBeCloseTo(0.01, 6);
  });

  it('handles zero markup (pass-through, no margin)', () => {
    const r = computeResale(0.008, 0);
    expect(r.resaleUsd).toBeCloseTo(0.008, 6);
    expect(r.marginUsd).toBeCloseTo(0, 6);
  });

  it('rejects negative inputs', () => {
    expect(() => computeResale(-1, 3000)).toThrow(/non-negative/);
    expect(() => computeResale(0.008, -1)).toThrow(/non-negative/);
  });
});

describe('catalog', () => {
  it('every entry produces a positive-margin resale at its markup', () => {
    for (const entry of CIRCLE_MARKETPLACE_CATALOG) {
      const r = entryResale(entry);
      expect(r.resaleUsd).toBeGreaterThan(entry.wholesaleUsd);
      expect(r.marginUsd).toBeGreaterThan(0);
    }
  });

  it('looks up by id and use-case', () => {
    expect(getMarketplaceEntry('blockrun-fx')?.useCase).toBe('fx-rate');
    expect(getMarketplaceEntry('nope')).toBeUndefined();
    const fx = marketplaceByUseCase('fx-rate');
    expect(fx.length).toBeGreaterThan(0);
    expect(fx.every((e) => e.useCase === 'fx-rate')).toBe(true);
  });

  it('uses the default markup where entries do not override', () => {
    expect(getMarketplaceEntry('blockrun-fx')?.markupBps).toBe(DEFAULT_MARKUP_BPS);
  });
});
