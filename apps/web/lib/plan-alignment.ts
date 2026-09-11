/**
 * Plan alignment — the Shield ring's one truth.
 *
 * Pure token-overlap metric: the ring's slices (STRATEGY_ALLOCATIONS via
 * getArchetypeAllocations) are the plan; the score is how much of the
 * wallet's value already sits in plan tokens. Exact fill → 100; an empty
 * wallet is unscorable (null), not a zero.
 */

import type { PlanLeg } from '@/components/protection-cards/plan-preview';

export interface PlanAlignmentLeg {
  token: string;
  target: number;
  held: number;
  /** target − held; positive means under-allocated. */
  gap: number;
  why: string;
}

export interface PlanAlignment {
  /** 0–100, or null when there is nothing to score. */
  score: number | null;
  legs: PlanAlignmentLeg[];
  /** Largest positive gap (> 2 pts), else null. */
  biggestGap: PlanAlignmentLeg | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function scorePlanAlignment(
  legs: PlanLeg[],
  heldPctByToken: ReadonlyMap<string, number>,
  totalValue: number,
): PlanAlignment {
  const alignedLegs: PlanAlignmentLeg[] = legs.map((leg) => {
    const held = totalValue > 0 ? heldPctByToken.get(leg.token) ?? 0 : 0;
    return { token: leg.token, target: leg.percent, held, gap: leg.percent - held, why: leg.why };
  });

  const biggestGap =
    alignedLegs
      .filter((leg) => leg.gap > 2)
      .sort((a, b) => b.gap - a.gap)[0] ?? null;

  if (totalValue <= 0 || legs.length === 0) {
    return { score: null, legs: alignedLegs, biggestGap: null };
  }

  const planTokens = new Set(legs.map((leg) => leg.token));
  let heldInPlan = 0;
  for (const [token, pct] of heldPctByToken) {
    if (planTokens.has(token)) heldInPlan += pct;
  }
  const heldOutsidePlan = Math.max(0, 100 - heldInPlan);
  const gapSum = alignedLegs.reduce((sum, leg) => sum + Math.abs(leg.gap), 0);
  const score = clamp(Math.round(100 - 0.5 * (gapSum + heldOutsidePlan)));

  return { score, legs: alignedLegs, biggestGap };
}
