import { describe, expect, it } from 'vitest';
import { resolveIntentFocus } from '../resolve-intent-focus';
import type { TreasuryIntent } from '@/context/app/NavigationContext';

const intent = (over: Partial<TreasuryIntent> = {}): TreasuryIntent => ({
  source: 'home',
  ...over,
});

describe('resolveIntentFocus', () => {
  const legs = [
    { token: 'USDm', percent: 40 },
    { token: 'KESm', percent: 30 },
    { token: 'NGNm', percent: 30 },
  ];
  const held = new Map<string, number>([
    ['USDm', 50],
    ['KESm', 10],
    ['EURm', 0],
  ]);

  it('returns the plan leg matching intent.asset (case-insensitive)', () => {
    expect(resolveIntentFocus(intent({ asset: 'kesm' }), legs, held)).toBe('KESm');
  });

  it('falls back to a held token matching intent.asset when not in the plan', () => {
    const h = new Map(held).set('PAXG', 5);
    expect(resolveIntentFocus(intent({ asset: 'paxg' }), legs, h)).toBe('PAXG');
  });

  it('ignores a held match with zero share', () => {
    expect(
      resolveIntentFocus(intent({ asset: 'EURm' }), legs, held),
    ).toBeNull();
  });

  it('asset beats region', () => {
    expect(
      resolveIntentFocus(intent({ asset: 'USDm', region: 'Africa' }), legs, held),
    ).toBe('USDm');
  });

  it('region picks the plan leg with the largest |plan − held| gap', () => {
    // KESm gap = |30−10| = 20, NGNm gap = |30−0| = 30 → NGNm wins.
    expect(resolveIntentFocus(intent({ region: 'africa' }), legs, held)).toBe('NGNm');
  });

  it('ties on gap break toward the larger plan percent, then original order', () => {
    const tieLegs = [
      { token: 'KESm', percent: 20 },
      { token: 'NGNm', percent: 30 },
      { token: 'ZARm', percent: 30 },
    ];
    // All held 0: gaps = 20, 30, 30 → first of the 30s (NGNm) by original order.
    expect(resolveIntentFocus(intent({ region: 'Africa' }), tieLegs, new Map())).toBe('NGNm');
    const h = new Map<string, number>([['NGNm', 5], ['ZARm', 5]]);
    // gaps: 20, 25, 25 → NGNm still first.
    expect(resolveIntentFocus(intent({ region: 'Africa' }), tieLegs, h)).toBe('NGNm');
  });

  it('falls back to the largest held token in the region when no plan leg matches', () => {
    const noRegionLegs = [{ token: 'USDm', percent: 100 }];
    const h = new Map<string, number>([
      ['KESm', 12],
      ['NGNm', 30],
      ['ZARm', 0],
    ]);
    expect(resolveIntentFocus(intent({ region: 'Africa' }), noRegionLegs, h)).toBe('NGNm');
  });

  it('returns null when nothing in the intent matches', () => {
    expect(resolveIntentFocus(intent({ region: 'Antarctica' }), legs, held)).toBeNull();
    expect(resolveIntentFocus(intent(), legs, held)).toBeNull();
  });

  it('honours a custom regionOf vocabulary', () => {
    const regionOf = (s: string) => (s === 'FOO' ? 'Bar' : 'Elsewhere');
    expect(
      resolveIntentFocus(
        intent({ region: 'bar' }),
        [{ token: 'FOO', percent: 10 }],
        new Map(),
        regionOf,
      ),
    ).toBe('FOO');
  });
});
