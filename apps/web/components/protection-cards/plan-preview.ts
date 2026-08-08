/**
 * Plan preview — single source for archetype allocation splits and
 * onboarding "your plan" simulator math.
 *
 * Percent splits also power the Guardian vault wizard preview bar.
 */
import { ARCHETYPES, type ArchetypeId } from './tokens';

export interface AllocationSlice {
  token: string;
  percent: number;
  region: string;
}

/** Financial-strategy ids (StrategyContext / GuardianMobileWizard). */
export const STRATEGY_ALLOCATIONS: Record<string, AllocationSlice[]> = {
  africapitalism: [
    { token: 'KESm', region: 'Kenya', percent: 60 },
    { token: 'cUSD', region: 'US', percent: 25 },
    { token: 'cEUR', region: 'EU', percent: 15 },
  ],
  buen_vivir: [
    { token: 'cREAL', region: 'Brazil', percent: 45 },
    { token: 'COPm', region: 'Colombia', percent: 35 },
    { token: 'cUSD', region: 'US', percent: 20 },
  ],
  pan_caribbean: [
    { token: 'cUSD', region: 'US', percent: 50 },
    { token: 'PAXG', region: 'Global', percent: 30 },
    { token: 'cEUR', region: 'EU', percent: 20 },
  ],
  confucian: [
    { token: 'USDC', region: 'APAC savings (HashKey)', percent: 70 },
    { token: 'USDY', region: 'Yield (Arbitrum)', percent: 30 },
  ],
  gotong_royong: [
    { token: 'USDC', region: 'APAC savings (HashKey)', percent: 50 },
    { token: 'PHPm', region: 'Philippines', percent: 30 },
    { token: 'USDY', region: 'Yield (Arbitrum)', percent: 20 },
  ],
  islamic: [
    { token: 'PAXG', region: 'Global', percent: 50 },
    { token: 'cUSD', region: 'US', percent: 30 },
    { token: 'cEUR', region: 'EU', percent: 20 },
  ],
  global: [
    { token: 'cUSD', region: 'US', percent: 25 },
    { token: 'cEUR', region: 'EU', percent: 20 },
    { token: 'KESm', region: 'Kenya', percent: 20 },
    { token: 'cREAL', region: 'Brazil', percent: 15 },
    { token: 'COPm', region: 'Colombia', percent: 10 },
    { token: 'PHPm', region: 'Philippines', percent: 10 },
  ],
  halo: [
    { token: 'PAXG', region: 'Global', percent: 50 },
    { token: 'USDY', region: 'US', percent: 30 },
    { token: 'cUSD', region: 'US', percent: 20 },
  ],
  taco: [
    { token: 'USDC', region: 'Global', percent: 60 },
    { token: 'cEUR', region: 'EU', percent: 20 },
    { token: 'cUSD', region: 'US', percent: 20 },
  ],
};

const ARCHETYPE_TO_STRATEGY: Record<ArchetypeId, string> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  pan_caribbean: 'pan_caribbean',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic_finance: 'islamic',
  global_diversification: 'global',
  custom: 'custom',
};

const TRADABLE_TOKEN = /^[A-Z][A-Za-z0-9]{1,5}$/;

export interface PlanPreviewSlice {
  token: string;
  percent: number;
  amount: number;
}

export interface PlanPreview {
  archetypeId: ArchetypeId;
  archetypeName: string;
  savingsAmount: number;
  shieldPercent: number;
  shieldAmount: number;
  preservedValue: number | null;
  slices: PlanPreviewSlice[];
}

export interface PlanPreviewInput {
  archetypeId: ArchetypeId;
  savingsAmount: number;
  shieldPercent?: number;
  preservedValue?: number | null;
}

export function getArchetypeAllocations(archetypeId: ArchetypeId): AllocationSlice[] {
  const strategyId = ARCHETYPE_TO_STRATEGY[archetypeId];
  return STRATEGY_ALLOCATIONS[strategyId] ?? [];
}

function equalSplitFallback(tokens: string[], shieldAmount: number): PlanPreviewSlice[] {
  const tradable = tokens.filter((t) => TRADABLE_TOKEN.test(t));
  if (tradable.length === 0) return [];
  const percent = Math.round(100 / tradable.length);
  const remainder = 100 - percent * tradable.length;
  return tradable.map((token, i) => {
    const slicePercent = percent + (i === 0 ? remainder : 0);
    return {
      token,
      percent: slicePercent,
      amount: shieldAmount * (slicePercent / 100),
    };
  });
}

/** Read-only plan simulator for onboarding and unconnected surfaces. */
export function getPlanPreview({
  archetypeId,
  savingsAmount,
  shieldPercent = 20,
  preservedValue = null,
}: PlanPreviewInput): PlanPreview {
  const archetype = ARCHETYPES[archetypeId];
  const shieldAmount = savingsAmount * (shieldPercent / 100);
  const allocations = getArchetypeAllocations(archetypeId);

  const slices: PlanPreviewSlice[] =
    allocations.length > 0
      ? allocations.map((a) => ({
          token: a.token,
          percent: a.percent,
          amount: shieldAmount * (a.percent / 100),
        }))
      : equalSplitFallback(archetype.allocation, shieldAmount);

  return {
    archetypeId,
    archetypeName: archetype.name,
    savingsAmount,
    shieldPercent,
    shieldAmount,
    preservedValue,
    slices,
  };
}
