/**
 * Plan preview — single source for archetype allocation splits and
 * onboarding "your plan" simulator math.
 *
 * Percent splits also power the Guardian vault wizard preview bar.
 */
import { ARCHETYPES, archetypeToStrategy, strategyToArchetype, type ArchetypeId } from './tokens';
import { canonicalToken, displayToken } from '@/lib/plan-legs';
import { NETWORKS } from '@/config';
import {
  exposureLabel,
  exposureOf,
  instrumentsFor,
  isYieldBearing,
  type Exposure,
} from '@diversifi/shared/src/config/exposures';

export type { Exposure };

/**
 * One ring slice. `token` is the slice id and the instrument the resolver
 * would buy to fill it; the slice itself is an exposure — any token with the
 * same exposure counts toward it (plan-alignment).
 */
export interface PlanLeg {
  token: string;
  region: string;
  percent: number;
  /** One line about the user's money — never the taxonomy. */
  why: string;
  exposure?: Exposure;
  prefer?: SlicePreference;
  /** Exposure name for the ring ("Gold", "Dollar"). */
  label?: string;
}

export type SlicePreference = 'yield' | 'liquid';

export interface PlanSlice {
  exposure: Exposure;
  target: number;
  region: string;
  why: string;
  prefer?: SlicePreference;
}

export interface PlanRules {
  /** No yield-bearing instruments (riba). */
  excludeYield?: boolean;
}

export interface ExposurePlan {
  slices: PlanSlice[];
  rules: PlanRules;
}

/** Financial-strategy ids (StrategyContext / GuardianPlanSwitcher). */
export const STRATEGY_PLANS: Record<string, ExposurePlan> = {
  africapitalism: {
    rules: {},
    slices: [
      { exposure: 'KES', target: 60, region: 'Kenya', why: 'Kenyan shilling — wealth stays home' },
      { exposure: 'USD', target: 25, region: 'US', why: 'Dollar floor for the plan' },
      { exposure: 'EUR', target: 15, region: 'EU', why: 'Euro leg — a second anchor' },
    ],
  },
  buen_vivir: {
    rules: {},
    slices: [
      { exposure: 'BRL', target: 45, region: 'Brazil', why: "Brazil's real — the LatAm anchor" },
      { exposure: 'COP', target: 35, region: 'Colombia', why: 'Colombian peso — the second LatAm leg' },
      { exposure: 'USD', target: 20, region: 'US', why: 'Dollar floor for the plan' },
    ],
  },
  pan_caribbean: {
    rules: {},
    slices: [
      { exposure: 'USD', target: 50, region: 'US', why: 'USD-pegged core against imported inflation' },
      { exposure: 'XAU', target: 30, region: 'Global', why: 'Gold — hedge for food and fuel shocks' },
      { exposure: 'EUR', target: 20, region: 'EU', why: 'Euro leg — a second anchor' },
    ],
  },
  confucian: {
    rules: {},
    slices: [
      { exposure: 'USD', target: 70, region: 'Savings core', why: 'Liquid dollar savings core' },
      { exposure: 'USD', target: 30, region: 'Treasury yield', why: 'Treasury yield, low volatility', prefer: 'yield' },
    ],
  },
  gotong_royong: {
    rules: {},
    slices: [
      { exposure: 'USD', target: 50, region: 'Savings core', why: 'Liquid dollar savings core' },
      { exposure: 'PHP', target: 30, region: 'Philippines', why: 'Philippine peso — local leg' },
      { exposure: 'USD', target: 20, region: 'Treasury yield', why: 'Treasury yield, shared upside', prefer: 'yield' },
    ],
  },
  global: {
    rules: {},
    slices: [
      { exposure: 'USD', target: 25, region: 'Global', why: 'Global liquid core' },
      { exposure: 'EUR', target: 20, region: 'EU', why: 'Europe' },
      { exposure: 'KES', target: 20, region: 'Kenya', why: 'Africa' },
      { exposure: 'BRL', target: 15, region: 'Brazil', why: 'Latin America' },
      { exposure: 'COP', target: 10, region: 'Colombia', why: 'Latin America — second leg' },
      { exposure: 'PHP', target: 10, region: 'Philippines', why: 'Asia' },
    ],
  },
  islamic: {
    rules: { excludeYield: true },
    slices: [
      { exposure: 'XAU', target: 50, region: 'Global', why: 'Gold — asset-backed, no riba' },
      { exposure: 'USD', target: 50, region: 'US', why: 'Dollar floor, no interest' },
    ],
  },
};

const CELO_MAINNET = NETWORKS.CELO_MAINNET.chainId;

/**
 * The instrument a slice is bought as: executable on a mainnet rail, yield
 * only when the slice prefers it and the rules allow, Celo before Arbitrum.
 * Returned under the plan-leg name (cUSD, cEUR, …).
 */
export function instrumentForSlice(slice: PlanSlice, rules: PlanRules = {}): string | null {
  const wantYield = slice.prefer === 'yield' && !rules.excludeYield;
  const pick = instrumentsFor(slice.exposure, { executableOnly: true })
    .filter((i) => i.yieldBearing === wantYield)
    .sort((a, b) => Number(b.chainId === CELO_MAINNET) - Number(a.chainId === CELO_MAINNET))[0];
  return pick ? canonicalToken(pick.symbol) : null;
}

export function sliceLabel(exposure: Exposure, prefer?: SlicePreference): string {
  return prefer === 'yield' ? `${exposureLabel(exposure)} · yield` : exposureLabel(exposure);
}

function legsFromPlan({ slices, rules }: ExposurePlan): PlanLeg[] {
  return slices.flatMap((slice) => {
    const token = instrumentForSlice(slice, rules);
    if (!token) return [];
    return [{
      token,
      region: slice.region,
      percent: slice.target,
      why: slice.why,
      exposure: slice.exposure,
      ...(slice.prefer ? { prefer: slice.prefer } : {}),
      label: sliceLabel(slice.exposure, slice.prefer),
    }];
  });
}

/** Balanced legs per strategy, derived from STRATEGY_PLANS. */
export const STRATEGY_ALLOCATIONS: Record<string, PlanLeg[]> = Object.fromEntries(
  Object.entries(STRATEGY_PLANS).map(([id, plan]) => [id, legsFromPlan(plan)]),
);

const TRADABLE_TOKEN = /^[A-Z][A-Za-z0-9]{1,5}$/;

// ============================================================================
// Dollar-floor dial — riskTolerance shapes the plan legs (one truth: ring,
// score, learn mix, Guardian feedback all read the adjusted legs).
// ============================================================================

export type RiskTolerance = 'Conservative' | 'Balanced' | 'Aggressive';

const FLOOR_SHIFT: Record<RiskTolerance, number> = {
  Conservative: 15,
  Balanced: 0,
  Aggressive: -15,
};

/** "Dollar", "Shilling" — how the reserve is named in the dial and hole. */
export function reserveLabel(floor: Exposure): string {
  return exposureLabel(floor);
}

export function legExposure(leg: Pick<PlanLeg, 'token' | 'exposure'>): Exposure | null {
  return leg.exposure ?? exposureOf(leg.token);
}

/**
 * Stable, low-inflation currencies that can stand in for the dollar reserve.
 * A soft home currency (KES, BRL, NGN, …) is what the saver is protecting
 * against, so it never becomes the reserve — it stays a measurement unit.
 */
export const STABLE_ANCHORS: readonly Exposure[] = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];

/**
 * The exposure the risk dial treats as the plan's reserve: the user's anchor
 * when it is a stable anchor the plan holds as a liquid leg, else the dollar.
 */
export function floorExposure(
  legs: readonly PlanLeg[],
  anchor: Exposure | null | undefined,
): Exposure {
  if (
    anchor &&
    anchor !== 'USD' &&
    STABLE_ANCHORS.includes(anchor) &&
    legs.some((leg) => isFloorLeg(leg, anchor))
  ) {
    return anchor;
  }
  return 'USD';
}

/** Liquid legs of the floor exposure form the plan's reserve; yield legs don't. */
export function isFloorLeg(leg: PlanLeg, floor: Exposure = 'USD'): boolean {
  return legExposure(leg) === floor && leg.prefer !== 'yield' && !isYieldBearing(leg.token);
}

/** A held token that counts toward the reserve (any issuer, any chain). */
export function isFloorHolding(symbol: string, floor: Exposure = 'USD'): boolean {
  return exposureOf(symbol) === floor && !isYieldBearing(symbol);
}

/** Sum of reserve legs in a plan. */
export function floorPercent(legs: readonly PlanLeg[], floor: Exposure = 'USD'): number {
  return legs.reduce((sum, leg) => sum + (isFloorLeg(leg, floor) ? leg.percent : 0), 0);
}

/**
 * Re-slice a plan for a risk tolerance: shift weight between the reserve
 * and the identity legs, preserving order and proportions inside each
 * group. Balanced/unset returns the same reference.
 */
export function legsForRisk(
  legs: PlanLeg[],
  risk: RiskTolerance | null | undefined,
  floor: Exposure = 'USD',
): PlanLeg[] {
  const shift = risk ? FLOOR_SHIFT[risk] : undefined;
  if (shift == null || shift === 0) return legs;
  const isFloor = (leg: PlanLeg) => isFloorLeg(leg, floor);
  const floorLegs = legs.filter(isFloor);
  const identityLegs = legs.filter((l) => !isFloor(l));
  if (floorLegs.length === 0 || identityLegs.length === 0) return legs;

  const baseFloor = floorPercent(legs, floor);
  const targetFloor = Math.min(90, Math.max(10, baseFloor + shift));
  const floorScale = targetFloor / baseFloor;
  const identityScale = (100 - targetFloor) / (100 - baseFloor);

  const adjusted = legs.map((leg) => ({
    ...leg,
    percent: Math.round(leg.percent * (isFloor(leg) ? floorScale : identityScale)),
  }));
  const drift = 100 - adjusted.reduce((sum, l) => sum + l.percent, 0);
  if (drift !== 0) {
    const largest = adjusted.reduce((a, b) => (b.percent > a.percent ? b : a));
    largest.percent += drift;
  }
  return adjusted;
}

// ============================================================================
// resolvePlan — the one reader of "what plan is this user on".
// ============================================================================

/**
 * A user-built plan: exposures and targets only (5-point steps, 2–6 slices,
 * sums to 100). Rules carry over from the philosophy it was tweaked from.
 */
export interface CustomPlan {
  /** Strategy id it was tweaked from; null when started from holdings. */
  from: string | null;
  slices: Array<{ exposure: Exposure; target: number; prefer?: SlicePreference }>;
  rules: PlanRules;
}

let savedCustomPlan: CustomPlan | null = null;

/** The profile's saved Custom plan — the fallback for readers that don't pass one. */
export function registerCustomPlan(plan: CustomPlan | null | undefined): void {
  savedCustomPlan = plan ?? null;
}

export function customPlanToExposurePlan(plan: CustomPlan): ExposurePlan {
  return {
    rules: plan.rules,
    slices: plan.slices.map((slice) => ({
      exposure: slice.exposure,
      target: slice.target,
      region: exposureLabel(slice.exposure),
      why: 'Your custom slice',
      ...(slice.prefer ? { prefer: slice.prefer } : {}),
    })),
  };
}

export interface PlanProfile {
  /** Strategy id or archetype id (either spelling resolves). */
  strategy?: string | null;
  /** Custom plan to resolve when strategy is `custom` (defaults to the saved one). */
  customPlan?: CustomPlan | null;
  riskTolerance?: RiskTolerance | null;
  /** The user's anchor currency; the risk dial's reserve only when it is a stable anchor the plan holds. */
  anchorCurrency?: Exposure | null;
}

export interface ResolvedPlan {
  strategy: string | null;
  archetypeId: ArchetypeId | null;
  /** Risk-adjusted legs — the ring, score, and Guardian all read these. */
  legs: PlanLeg[];
  rules: PlanRules;
  /** Exposure the risk dial shifts weight into and out of. */
  floor: Exposure;
}

const EMPTY_PLAN: ResolvedPlan = { strategy: null, archetypeId: null, legs: [], rules: {}, floor: 'USD' };
const resolved = new Map<string, ResolvedPlan>();

/** Memoised: the same profile always returns the same object (stable React deps). */
export function resolvePlan({ strategy, customPlan, riskTolerance, anchorCurrency }: PlanProfile): ResolvedPlan {
  const archetypeId = strategy
    ? strategyToArchetype(strategy) ?? (strategy in ARCHETYPES ? (strategy as ArchetypeId) : null)
    : null;
  if (!archetypeId) return EMPTY_PLAN;
  const strategyId = archetypeToStrategy(archetypeId);
  const custom = archetypeId === 'custom' ? customPlan ?? savedCustomPlan : null;
  if (archetypeId === 'custom' && !custom) return EMPTY_PLAN;
  const exposurePlan = custom ? customPlanToExposurePlan(custom) : STRATEGY_PLANS[strategyId];
  const base = custom ? legsFromPlan(exposurePlan) : STRATEGY_ALLOCATIONS[strategyId] ?? [];
  const floor = floorExposure(base, anchorCurrency);
  const key = `${archetypeId}|${riskTolerance ?? ''}|${floor}${custom ? `|${JSON.stringify(custom)}` : ''}`;
  const hit = resolved.get(key);
  if (hit) return hit;
  const plan: ResolvedPlan = {
    strategy: strategyId,
    archetypeId,
    legs: legsForRisk(base, riskTolerance, floor),
    rules: exposurePlan?.rules ?? {},
    floor,
  };
  if (resolved.size > 200) resolved.clear();
  resolved.set(key, plan);
  return plan;
}

/**
 * One line describing what changes between two plans — token swaps and
 * the dollar-floor shift. "Same mix as your current plan" when identical.
 */
export function describePlanDelta(
  current: PlanLeg[],
  preview: PlanLeg[],
  floor: Exposure = 'USD',
): string {
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
  const floorFrom = floorPercent(current, floor);
  const floorTo = floorPercent(preview, floor);
  if (floorFrom !== floorTo) {
    parts.push(`${reserveLabel(floor).toLowerCase()} floor ${floorFrom}% → ${floorTo}%`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Same mix as your current plan';
}

/**
 * The compare hole's delta line — the largest absolute leg changes first,
 * signed with a real minus, canonical tickers. `"+15% PAXG · −10% KESm"`;
 * "Same mix" when nothing differs.
 */
export function compactPlanDelta(current: PlanLeg[], preview: PlanLeg[], max = 2): string {
  const currentPct = new Map(current.map((l) => [l.token, l.percent]));
  const previewPct = new Map(preview.map((l) => [l.token, l.percent]));
  const deltas = [...new Set([...currentPct.keys(), ...previewPct.keys()])]
    .map((token) => ({ token, delta: (previewPct.get(token) ?? 0) - (currentPct.get(token) ?? 0) }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, max);
  if (deltas.length === 0) return 'Same mix';
  return deltas
    .map((d) => `${d.delta > 0 ? '+' : '−'}${Math.abs(d.delta)}% ${displayToken(d.token)}`)
    .join(' · ');
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
  return resolvePlan({ strategy: archetypeId }).legs;
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
  const allocations = resolvePlan({ strategy: archetypeId, riskTolerance }).legs;

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
