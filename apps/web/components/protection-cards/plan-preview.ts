/**
 * Plan preview — single source for archetype allocation splits and
 * onboarding "your plan" simulator math.
 *
 * Percent splits also power the Guardian vault wizard preview bar.
 */
import { ARCHETYPES, archetypeToStrategy, type ArchetypeId } from './tokens';

export interface PlanLeg {
  token: string;
  region: string;
  percent: number;
  /** One line about the user's money — never the taxonomy. */
  why: string;
}

/** Financial-strategy ids (StrategyContext / GuardianMobileWizard). */
export const STRATEGY_ALLOCATIONS: Record<string, PlanLeg[]> = {
  africapitalism: [
    { token: 'KESm', region: 'Kenya', percent: 60, why: 'Kenyan shilling — wealth stays home' },
    { token: 'cUSD', region: 'US', percent: 25, why: 'Dollar floor for the plan' },
    { token: 'cEUR', region: 'EU', percent: 15, why: 'Euro leg — a second anchor' },
  ],
  buen_vivir: [
    { token: 'cREAL', region: 'Brazil', percent: 45, why: "Brazil's real — the LatAm anchor" },
    { token: 'COPm', region: 'Colombia', percent: 35, why: 'Colombian peso — the second LatAm leg' },
    { token: 'cUSD', region: 'US', percent: 20, why: 'Dollar floor for the plan' },
  ],
  pan_caribbean: [
    { token: 'cUSD', region: 'US', percent: 50, why: 'USD-pegged core against imported inflation' },
    { token: 'PAXG', region: 'Global', percent: 30, why: 'Gold — hedge for food and fuel shocks' },
    { token: 'cEUR', region: 'EU', percent: 20, why: 'Euro leg — a second anchor' },
  ],
  confucian: [
    { token: 'USDC', region: 'APAC savings (HashKey)', percent: 70, why: 'Regulated APAC savings core' },
    { token: 'USDY', region: 'Yield (Arbitrum)', percent: 30, why: 'Treasury yield, low volatility' },
  ],
  gotong_royong: [
    { token: 'USDC', region: 'APAC savings (HashKey)', percent: 50, why: 'Regulated APAC savings core' },
    { token: 'PHPm', region: 'Philippines', percent: 30, why: 'Philippine peso — local leg' },
    { token: 'USDY', region: 'Yield (Arbitrum)', percent: 20, why: 'Treasury yield, shared upside' },
  ],
  global: [
    { token: 'USDC', region: 'Global', percent: 25, why: 'Global liquid core' },
    { token: 'cEUR', region: 'EU', percent: 20, why: 'Europe' },
    { token: 'KESm', region: 'Kenya', percent: 20, why: 'Africa' },
    { token: 'cREAL', region: 'Brazil', percent: 15, why: 'Latin America' },
    { token: 'COPm', region: 'Colombia', percent: 10, why: 'Latin America — second leg' },
    { token: 'PHPm', region: 'Philippines', percent: 10, why: 'Asia' },
  ],
  islamic: [
    { token: 'PAXG', region: 'Global', percent: 50, why: 'Gold — asset-backed, no riba' },
    { token: 'cUSD', region: 'US', percent: 30, why: 'Dollar floor, no interest' },
    { token: 'USDC', region: 'US', percent: 20, why: 'Liquid reserve, no interest' },
  ],
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

export function getArchetypeAllocations(archetypeId: ArchetypeId): PlanLeg[] {
  return STRATEGY_ALLOCATIONS[archetypeToStrategy(archetypeId)] ?? [];
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
