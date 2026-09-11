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

// ============================================================================
// Dollar-floor dial — riskTolerance shapes the plan legs (one truth: ring,
// score, learn mix, Guardian feedback all read the adjusted legs).
// ============================================================================

/** Legs that count as the plan's dollar floor. */
export const FLOOR_TOKENS = new Set(['cUSD', 'USDC']);

export type RiskTolerance = 'Conservative' | 'Balanced' | 'Aggressive';

const FLOOR_SHIFT: Record<RiskTolerance, number> = {
  Conservative: 15,
  Balanced: 0,
  Aggressive: -15,
};

/** Sum of dollar-floor legs in a plan. */
export function floorPercent(legs: PlanLeg[]): number {
  return legs.reduce((sum, leg) => sum + (FLOOR_TOKENS.has(leg.token) ? leg.percent : 0), 0);
}

/**
 * Re-slice a plan for a risk tolerance: shift weight between the dollar
 * floor and the identity legs, preserving order and proportions inside
 * each group. Balanced/unset returns the same reference.
 */
export function legsForRisk(
  legs: PlanLeg[],
  risk: RiskTolerance | null | undefined,
): PlanLeg[] {
  const shift = risk ? FLOOR_SHIFT[risk] : undefined;
  if (shift == null || shift === 0) return legs;
  const floorLegs = legs.filter((l) => FLOOR_TOKENS.has(l.token));
  const identityLegs = legs.filter((l) => !FLOOR_TOKENS.has(l.token));
  if (floorLegs.length === 0 || identityLegs.length === 0) return legs;

  const baseFloor = floorPercent(legs);
  const targetFloor = Math.min(90, Math.max(10, baseFloor + shift));
  const floorScale = targetFloor / baseFloor;
  const identityScale = (100 - targetFloor) / (100 - baseFloor);

  const adjusted = legs.map((leg) => ({
    ...leg,
    percent: Math.round(
      leg.percent * (FLOOR_TOKENS.has(leg.token) ? floorScale : identityScale),
    ),
  }));
  const drift = 100 - adjusted.reduce((sum, l) => sum + l.percent, 0);
  if (drift !== 0) {
    const largest = adjusted.reduce((a, b) => (b.percent > a.percent ? b : a));
    largest.percent += drift;
  }
  return adjusted;
}

/**
 * One line describing what changes between two plans — token swaps and
 * the dollar-floor shift. "Same mix as your current plan" when identical.
 */
export function describePlanDelta(current: PlanLeg[], preview: PlanLeg[]): string {
  const currentTokens = new Set(current.map((l) => l.token));
  const previewTokens = new Set(preview.map((l) => l.token));
  const removed = current.filter((l) => !previewTokens.has(l.token)).map((l) => l.token);
  const added = preview.filter((l) => !currentTokens.has(l.token)).map((l) => l.token);

  const parts: string[] = [];
  if (removed.length > 0 && added.length > 0) {
    parts.push(`Swaps ${removed.join(', ')} → ${added.join(', ')}`);
  } else if (added.length > 0) {
    parts.push(`Adds ${added.join(', ')}`);
  } else if (removed.length > 0) {
    parts.push(`Drops ${removed.join(', ')}`);
  }
  const floorFrom = floorPercent(current);
  const floorTo = floorPercent(preview);
  if (floorFrom !== floorTo) {
    parts.push(`dollar floor ${floorFrom}% → ${floorTo}%`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Same mix as your current plan';
}

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
  riskTolerance?: RiskTolerance | null;
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
  riskTolerance = null,
}: PlanPreviewInput): PlanPreview {
  const archetype = ARCHETYPES[archetypeId];
  const shieldAmount = savingsAmount * (shieldPercent / 100);
  const allocations = legsForRisk(getArchetypeAllocations(archetypeId), riskTolerance);

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
