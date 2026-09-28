import { describe, expect, it } from 'vitest';
import {
  floorExposure,
  compactPlanDelta,
  describePlanDelta,
  floorPercent,
  getPlanPreview,
  getArchetypeAllocations,
  instrumentForSlice,
  legsForRisk,
  resolvePlan,
  STABLE_ANCHORS,
  STRATEGY_ALLOCATIONS,
  STRATEGY_PLANS,
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

  // Updated for exposure plans: the old "USDC (HashKey)" leg is plain USD
  // (HashKey isn't executable in-app), filled on Celo by default.
  it('maps confucian archetype to a USD core + USD-yield split', () => {
    const allocations = getArchetypeAllocations('confucian');
    expect(allocations[0]).toMatchObject({ token: 'cUSD', exposure: 'USD', label: 'Dollar', percent: 70 });
    expect(allocations[1]).toMatchObject({ token: 'USDY', exposure: 'USD', prefer: 'yield', label: 'Dollar · yield', percent: 30 });
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

  // Updated for exposure plans: islamic's cUSD 30 + USDC 20 legs were the
  // same exposure and are now one USD 50 slice.
  it('Conservative raises the floor by 15 (islamic: XAU 35 / USD 65)', () => {
    expect(legsForRisk(islamic, 'Conservative')).toMatchObject([
      { token: 'PAXG', exposure: 'XAU', percent: 35, why: 'Gold — asset-backed, no riba' },
      { token: 'cUSD', exposure: 'USD', percent: 65, why: 'Dollar floor, no interest' },
    ]);
  });

  it('Aggressive lowers the floor with a 10% clamp (buen_vivir: cREAL 51 / COPm 39 / cUSD 10)', () => {
    expect(legsForRisk(buenVivir, 'Aggressive')).toMatchObject([
      { token: 'cREAL', region: 'Brazil', percent: 51, why: "Brazil's real — the LatAm anchor" },
      { token: 'COPm', region: 'Colombia', percent: 39, why: 'Colombian peso — the second LatAm leg' },
      { token: 'cUSD', region: 'US', percent: 10, why: 'Dollar floor for the plan' },
    ]);
  });

  it('yield dollars are not part of the floor', () => {
    expect(floorPercent(STRATEGY_ALLOCATIONS.confucian)).toBe(70);
    expect(floorPercent(STRATEGY_ALLOCATIONS.gotong_royong)).toBe(50);
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

describe('compactPlanDelta', () => {
  it('signs the largest absolute changes first with canonical tickers', () => {
    const current: PlanLeg[] = [
      { token: 'KESm', region: 'Kenya', percent: 60, why: 'x' },
      { token: 'cUSD', region: 'Global', percent: 40, why: 'x' },
    ];
    const preview: PlanLeg[] = [
      { token: 'KESm', region: 'Kenya', percent: 45, why: 'x' },
      { token: 'cUSD', region: 'Global', percent: 30, why: 'x' },
      { token: 'PAXG', region: 'Global', percent: 25, why: 'x' },
    ];
    // +25 PAXG, −15 KESm, −10 USDm — the default max keeps the top two.
    expect(compactPlanDelta(current, preview)).toBe('+25% PAXG · −15% KESm');
  });

  it('uses the canonical display ticker (cUSD → USDm)', () => {
    const current: PlanLeg[] = [{ token: 'cUSD', region: 'Global', percent: 100, why: 'x' }];
    const preview: PlanLeg[] = [
      { token: 'cUSD', region: 'Global', percent: 80, why: 'x' },
      { token: 'cEUR', region: 'Europe', percent: 20, why: 'x' },
    ];
    // Ties keep leg order — the existing leg speaks first.
    expect(compactPlanDelta(current, preview)).toBe('−20% USDm · +20% EURm');
  });

  it('honours max', () => {
    const current: PlanLeg[] = [
      { token: 'KESm', region: 'Kenya', percent: 50, why: 'x' },
      { token: 'cUSD', region: 'Global', percent: 50, why: 'x' },
    ];
    const preview: PlanLeg[] = [
      { token: 'KESm', region: 'Kenya', percent: 20, why: 'x' },
      { token: 'cUSD', region: 'Global', percent: 40, why: 'x' },
      { token: 'PAXG', region: 'Global', percent: 40, why: 'x' },
    ];
    expect(compactPlanDelta(current, preview, 1)).toBe('+40% PAXG');
    expect(compactPlanDelta(current, preview, 3)).toBe('+40% PAXG · −30% KESm · −10% USDm');
  });

  it('reports an identical mix', () => {
    const legs: PlanLeg[] = [{ token: 'PAXG', region: 'Global', percent: 100, why: 'x' }];
    expect(compactPlanDelta(legs, legs)).toBe('Same mix');
    expect(compactPlanDelta([], [])).toBe('Same mix');
  });
});

describe('resolvePlan — exposure plans', () => {
  it('accepts strategy and archetype ids and memoises', () => {
    const a = resolvePlan({ strategy: 'islamic', riskTolerance: 'Balanced' });
    const b = resolvePlan({ strategy: 'islamic_finance', riskTolerance: 'Balanced' });
    expect(a).toBe(b);
    expect(a.rules.excludeYield).toBe(true);
    expect(resolvePlan({ strategy: null }).legs).toEqual([]);
  });

  it('every named philosophy converts to executable exposures summing to 100', () => {
    for (const [id, plan] of Object.entries(STRATEGY_PLANS)) {
      const legs = STRATEGY_ALLOCATIONS[id];
      expect(legs).toHaveLength(plan.slices.length);
      expect(legs.reduce((s, l) => s + l.percent, 0)).toBe(100);
      for (const leg of legs) expect(leg.exposure).toBeTruthy();
    }
  });

  it('pan_caribbean = USD 50 / XAU 30 / EUR 20', () => {
    expect(STRATEGY_ALLOCATIONS.pan_caribbean.map((l) => [l.exposure, l.percent])).toEqual([
      ['USD', 50], ['XAU', 30], ['EUR', 20],
    ]);
  });

  it('never picks a yield instrument under Islamic rules', () => {
    expect(
      instrumentForSlice({ exposure: 'USD', target: 50, region: 'US', why: 'x', prefer: 'yield' }, { excludeYield: true }),
    ).toBe('cUSD');
  });

  it('fills gold with executable PAXG, never Hyperliquid GOLD', () => {
    expect(instrumentForSlice({ exposure: 'XAU', target: 30, region: 'Global', why: 'x' })).toBe('PAXG');
  });

  it('labels slices by exposure', () => {
    expect(STRATEGY_ALLOCATIONS.africapitalism.map((l) => l.label)).toEqual(['Shilling', 'Dollar', 'Euro']);
  });
});

describe('anchor currency — the risk dial reserve', () => {
  it('a USD anchor, or an anchor the plan does not hold, keeps the dollar floor', () => {
    expect(floorExposure(STRATEGY_ALLOCATIONS.africapitalism, 'USD')).toBe('USD');
    expect(floorExposure(STRATEGY_ALLOCATIONS.africapitalism, null)).toBe('USD');
    expect(floorExposure(STRATEGY_ALLOCATIONS.africapitalism, 'BRL')).toBe('USD');
    expect(
      resolvePlan({ strategy: 'africapitalism', riskTolerance: 'Conservative', anchorCurrency: 'BRL' }),
    ).toBe(resolvePlan({ strategy: 'africapitalism', riskTolerance: 'Conservative' }));
  });

  it('a KES anchor does not make the shilling leg the reserve — soft anchors keep the dollar floor', () => {
    expect(floorExposure(STRATEGY_ALLOCATIONS.africapitalism, 'KES')).toBe('USD');
    const plan = resolvePlan({
      strategy: 'africapitalism',
      riskTolerance: 'Conservative',
      anchorCurrency: 'KES',
    });
    expect(plan.floor).toBe('USD');
    expect(plan).toBe(resolvePlan({ strategy: 'africapitalism', riskTolerance: 'Conservative' }));
    expect(plan.legs).toBe(
      resolvePlan({ strategy: 'africapitalism', riskTolerance: 'Conservative' }).legs,
    );
    expect(plan.legs.reduce((sum, l) => sum + l.percent, 0)).toBe(100);
  });

  it('a stable EUR anchor the plan holds becomes the reserve the dial shifts', () => {
    const plan = resolvePlan({
      strategy: 'africapitalism',
      riskTolerance: 'Conservative',
      anchorCurrency: 'EUR',
    });
    expect(plan.floor).toBe('EUR');
    expect(plan.legs.reduce((sum, l) => sum + l.percent, 0)).toBe(100);
  });

  it('only stable anchors can replace the dollar floor', () => {
    expect(STABLE_ANCHORS).toEqual(['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD']);
    for (const soft of ['KES', 'BRL', 'COP', 'PHP', 'NGN', 'GHS', 'ZAR', 'XOF', 'MXN'] as const) {
      expect(floorExposure(STRATEGY_ALLOCATIONS.africapitalism, soft)).toBe('USD');
      expect(floorExposure(STRATEGY_ALLOCATIONS.buen_vivir, soft)).toBe('USD');
    }
  });

  it('describes a reserve shift in the anchor', () => {
    const base = STRATEGY_ALLOCATIONS.africapitalism;
    const conservative = legsForRisk(base, 'Conservative', 'KES');
    expect(describePlanDelta(base, conservative, 'KES')).toBe('shilling floor 60% → 75%');
  });
});
