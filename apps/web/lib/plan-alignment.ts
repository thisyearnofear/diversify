/**
 * Plan alignment — the Shield ring's one truth.
 *
 * Exposure-against-exposure: each plan leg is an exposure (USD, EUR, XAU…)
 * and any held token with that exposure counts toward it, whatever its
 * issuer or chain (USDC on Arbitrum and USDm on Celo both fill a Dollar
 * slice; Hyperliquid GOLD fills Gold). Exact fill → 100; an empty wallet is
 * unscorable (null), not a zero.
 */

import {
  legExposure,
  type PlanLeg,
  type PlanRules,
} from '@/components/protection-cards/plan-preview';
import { canonicalToken } from '@/lib/plan-legs';
import { exposureOf, isYieldBearing } from '@diversifi/shared/src/config/exposures';

export interface HeldAs {
  symbol: string;
  percent: number;
}

export interface PlanAlignmentLeg {
  token: string;
  target: number;
  held: number;
  /** target − held; positive means under-allocated. */
  gap: number;
  why: string;
  /** Held tokens counted toward this leg, largest first. */
  heldAs: HeldAs[];
}

export interface PlanAlignment {
  /** 0–100, or null when there is nothing to score. */
  score: number | null;
  legs: PlanAlignmentLeg[];
  /** Largest positive gap (> 2 pts), else null. */
  biggestGap: PlanAlignmentLeg | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * The plan leg a held token counts toward, or -1 when it sits outside the
 * plan. Two legs of one exposure (Confucian's USD core + USD yield) split by
 * instrument: yield-bearing holdings fill the yield leg. Rules apply —
 * a yield-bearing token never counts toward an Islamic plan.
 */
export function planLegIndexFor(
  symbol: string,
  legs: readonly PlanLeg[],
  rules: PlanRules = {},
): number {
  const canonical = canonicalToken(symbol);
  const exposure = exposureOf(canonical);
  if (!exposure) return legs.findIndex((leg) => canonicalToken(leg.token) === canonical);
  const yieldBearing = isYieldBearing(canonical);
  if (yieldBearing && rules.excludeYield) return -1;
  const matches = legs
    .map((leg, i) => ({ leg, i }))
    .filter(({ leg }) => legExposure(leg) === exposure);
  if (matches.length <= 1) return matches[0]?.i ?? -1;
  const wantsYield = (leg: PlanLeg) => leg.prefer === 'yield';
  return (matches.find(({ leg }) => wantsYield(leg) === yieldBearing) ?? matches[0]).i;
}

export function scorePlanAlignment(
  legs: PlanLeg[],
  heldPctByToken: ReadonlyMap<string, number>,
  totalValue: number,
  rules: PlanRules = {},
): PlanAlignment {
  // Held balances arrive under config tickers (USDm), legacy demo names
  // (cKES) and other issuers/chains (USDC, USDT); canonicalise, then bucket
  // by exposure so the same money always lands in one leg.
  const heldPct = new Map<string, number>();
  for (const [symbol, pct] of heldPctByToken) {
    const key = canonicalToken(symbol);
    heldPct.set(key, (heldPct.get(key) ?? 0) + pct);
  }

  const heldAsByLeg = legs.map(() => [] as HeldAs[]);
  let heldInPlan = 0;
  if (totalValue > 0) {
    for (const [symbol, pct] of heldPct) {
      const i = planLegIndexFor(symbol, legs, rules);
      if (i < 0) continue;
      heldAsByLeg[i].push({ symbol, percent: pct });
      heldInPlan += pct;
    }
  }

  const alignedLegs: PlanAlignmentLeg[] = legs.map((leg, i) => {
    const heldAs = heldAsByLeg[i].sort((a, b) => b.percent - a.percent);
    const held = heldAs.reduce((sum, h) => sum + h.percent, 0);
    return { token: leg.token, target: leg.percent, held, gap: leg.percent - held, why: leg.why, heldAs };
  });

  const biggestGap =
    alignedLegs
      .filter((leg) => leg.gap > 2)
      .sort((a, b) => b.gap - a.gap)[0] ?? null;

  if (totalValue <= 0 || legs.length === 0) {
    return { score: null, legs: alignedLegs, biggestGap: null };
  }

  const heldOutsidePlan = Math.max(0, 100 - heldInPlan);
  const gapSum = alignedLegs.reduce((sum, leg) => sum + Math.abs(leg.gap), 0);
  const score = clamp(Math.round(100 - 0.5 * (gapSum + heldOutsidePlan)));

  return { score, legs: alignedLegs, biggestGap };
}
