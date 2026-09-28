/**
 * Shield lens triggers — pure, testable. A stronger floor RAISES the
 * plan's dollar reserve, so it only helps when the wallet already holds
 * more dollars than the plan asks for. An under-reserved wallet is the
 * gap CTA's job, never this prompt's.
 */
import {
  floorPercent,
  isFloorHolding,
  type PlanLeg,
  type RiskTolerance,
} from "@/components/protection-cards/plan-preview";

export interface StrongerFloorOffer {
  /** The tolerance one step stronger than the saved one. */
  next: RiskTolerance;
  /** Wallet's dollar share, rounded for display. */
  heldFloor: number;
  planFloor: number;
}

/** Wallet dollar share minus the plan floor ≥ 10 points → offer. */
export function strongerFloorOffer({
  savedRisk,
  planLegs,
  heldPctByToken,
}: {
  savedRisk: RiskTolerance | null;
  planLegs: PlanLeg[];
  /** Held % by token; every liquid dollar token (any issuer/chain) counts. */
  heldPctByToken: ReadonlyMap<string, number>;
}): StrongerFloorOffer | null {
  const risk = savedRisk ?? "Balanced";
  if (risk === "Conservative") return null;
  let heldFloor = 0;
  for (const [symbol, pct] of heldPctByToken) {
    if (isFloorHolding(symbol)) heldFloor += pct;
  }
  const planFloor = floorPercent(planLegs);
  if (heldFloor - planFloor < 10) return null;
  return {
    next: risk === "Aggressive" ? "Balanced" : "Conservative",
    heldFloor: Math.round(heldFloor),
    planFloor,
  };
}
