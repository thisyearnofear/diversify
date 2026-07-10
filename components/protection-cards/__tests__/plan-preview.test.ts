import { describe, expect, it } from 'vitest';
import { getPlanPreview, getArchetypeAllocations } from '../plan-preview';

describe('getPlanPreview', () => {
  it('splits shield amount across archetype allocation percents', () => {
    const preview = getPlanPreview({
      archetypeId: 'africapitalism',
      savingsAmount: 10000,
      shieldPercent: 20,
      preservedValue: 400,
    });

    expect(preview.shieldAmount).toBe(2000);
    expect(preview.slices).toHaveLength(3);
    expect(preview.slices[0]).toMatchObject({ token: 'KESm', percent: 60, amount: 1200 });
    expect(preview.slices[1]).toMatchObject({ token: 'cUSD', percent: 25, amount: 500 });
    expect(preview.preservedValue).toBe(400);
  });

  it('returns empty slices for custom archetype without tradable tokens', () => {
    const preview = getPlanPreview({
      archetypeId: 'custom',
      savingsAmount: 5000,
      shieldPercent: 10,
    });

    expect(preview.shieldAmount).toBe(500);
    expect(preview.slices).toHaveLength(0);
  });
});

describe('getArchetypeAllocations', () => {
  it('maps islamic_finance archetype to islamic strategy splits', () => {
    const allocations = getArchetypeAllocations('islamic_finance');
    expect(allocations[0]?.token).toBe('PAXG');
    expect(allocations.reduce((s, a) => s + a.percent, 0)).toBe(100);
  });
});
