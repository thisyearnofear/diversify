import { describe, expect, it } from 'vitest';
import {
  describePlanDelta,
  floorPercent,
  getPlanPreview,
  getArchetypeAllocations,
  legsForRisk,
  STRATEGY_ALLOCATIONS,
  type PlanLeg,
} from '../plan-preview';

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

  it('applies riskTolerance — Conservative buen_vivir shows the raised floor', () => {
    const preview = getPlanPreview({
      archetypeId: 'buen_vivir',
      savingsAmount: 10000,
      shieldPercent: 20,
      riskTolerance: 'Conservative',
    });

    // Balanced cUSD 20 → Conservative floor 35.
    expect(preview.slices.find((s) => s.token === 'cUSD')?.percent).toBe(35);
    const total = preview.slices.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(preview.shieldAmount, 6);
    expect(preview.slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });
});

describe('getArchetypeAllocations', () => {
  it('maps islamic_finance archetype to islamic strategy splits', () => {
    const allocations = getArchetypeAllocations('islamic_finance');
    expect(allocations[0]?.token).toBe('PAXG');
    expect(allocations.reduce((s, a) => s + a.percent, 0)).toBe(100);
  });

  it('maps confucian archetype to APAC savings + Arbitrum yield split', () => {
    const allocations = getArchetypeAllocations('confucian');
    expect(allocations[0]).toMatchObject({ token: 'USDC', region: 'APAC savings (HashKey)', percent: 70 });
    expect(allocations[1]).toMatchObject({ token: 'USDY', region: 'Yield (Arbitrum)', percent: 30 });
  });
});

describe('floorPercent / legsForRisk — the dollar-floor dial', () => {
  const islamic = STRATEGY_ALLOCATIONS.islamic;
  const buenVivir = STRATEGY_ALLOCATIONS.buen_vivir;

  it('floorPercent sums only dollar legs', () => {
    expect(floorPercent(islamic)).toBe(50);
    expect(floorPercent(buenVivir)).toBe(20);
  });

  it('Balanced and null return the same legs unchanged (same reference)', () => {
    expect(legsForRisk(islamic, 'Balanced')).toBe(islamic);
    expect(legsForRisk(islamic, null)).toBe(islamic);
    expect(legsForRisk(islamic, undefined)).toBe(islamic);
  });

  it('Conservative raises the floor by 15 (islamic: PAXG 35 / cUSD 39 / USDC 26)', () => {
    expect(legsForRisk(islamic, 'Conservative')).toEqual([
      { token: 'PAXG', region: 'Global', percent: 35, why: 'Gold — asset-backed, no riba' },
      { token: 'cUSD', region: 'US', percent: 39, why: 'Dollar floor, no interest' },
      { token: 'USDC', region: 'US', percent: 26, why: 'Liquid reserve, no interest' },
    ]);
  });

  it('Aggressive lowers the floor with a 10% clamp (buen_vivir: cREAL 51 / COPm 39 / cUSD 10)', () => {
    expect(legsForRisk(buenVivir, 'Aggressive')).toEqual([
      { token: 'cREAL', region: 'Brazil', percent: 51, why: "Brazil's real — the LatAm anchor" },
      { token: 'COPm', region: 'Colombia', percent: 39, why: 'Colombian peso — the second LatAm leg' },
      { token: 'cUSD', region: 'US', percent: 10, why: 'Dollar floor for the plan' },
    ]);
  });

  it('every strategy × every risk still sums to exactly 100', () => {
    for (const legs of Object.values(STRATEGY_ALLOCATIONS)) {
      for (const risk of ['Conservative', 'Balanced', 'Aggressive'] as const) {
        const adjusted = legsForRisk(legs, risk);
        expect(adjusted.reduce((s, l) => s + l.percent, 0)).toBe(100);
      }
    }
  });

  it('legs with no floor or no identity group are returned unchanged', () => {
    const noFloor: PlanLeg[] = [
      { token: 'KESm', region: 'Kenya', percent: 60, why: 'x' },
      { token: 'COPm', region: 'Colombia', percent: 40, why: 'x' },
    ];
    const allFloor: PlanLeg[] = [
      { token: 'cUSD', region: 'US', percent: 70, why: 'x' },
      { token: 'USDC', region: 'US', percent: 30, why: 'x' },
    ];
    expect(legsForRisk(noFloor, 'Conservative')).toBe(noFloor);
    expect(legsForRisk(allFloor, 'Aggressive')).toBe(allFloor);
  });
});

describe('describePlanDelta', () => {
  it('names swapped tokens and the floor shift (buen_vivir → africapitalism)', () => {
    expect(
      describePlanDelta(STRATEGY_ALLOCATIONS.buen_vivir, STRATEGY_ALLOCATIONS.africapitalism),
    ).toBe('Swaps cREAL, COPm → KESm, cEUR · dollar floor 20% → 25%');
  });

  it('reports an identical mix', () => {
    expect(
      describePlanDelta(STRATEGY_ALLOCATIONS.islamic, STRATEGY_ALLOCATIONS.islamic),
    ).toBe('Same mix as your current plan');
  });

  it('floor-only change still speaks (islamic Balanced → Conservative)', () => {
    expect(
      describePlanDelta(
        STRATEGY_ALLOCATIONS.islamic,
        legsForRisk(STRATEGY_ALLOCATIONS.islamic, 'Conservative'),
      ),
    ).toBe('dollar floor 50% → 65%');
  });

  it('adds-only phrasing', () => {
    const current: PlanLeg[] = [{ token: 'KESm', region: 'Kenya', percent: 100, why: 'x' }];
    const preview: PlanLeg[] = [
      { token: 'KESm', region: 'Kenya', percent: 60, why: 'x' },
      { token: 'PAXG', region: 'Global', percent: 40, why: 'x' },
    ];
    expect(describePlanDelta(current, preview)).toBe('Adds PAXG');
  });
});
