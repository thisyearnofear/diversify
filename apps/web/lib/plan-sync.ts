import {
  allocationPlanFromResolved,
  resolvePlan,
  type CustomPlan,
  type ExposurePlan,
  type RiskTolerance,
} from "@/components/protection-cards/plan-preview";
import type { Exposure } from "@diversifi/shared/src/config/exposures";
import { validateAllocationPlan } from "@diversifi/shared/src/services/guardian/allocation-plan-validation";
import type { NamedPhilosophy } from "@/hooks/use-protection-profile";

export interface GuardianPlan {
  strategy: string;
  allocationPlan: ExposurePlan;
}

export function guardianPlanForShield({
  planId,
  valuesPhilosophy = null,
  customPlan = null,
  riskTolerance = null,
  anchorCurrency = null,
}: {
  planId: string | null;
  valuesPhilosophy?: NamedPhilosophy | null;
  customPlan?: CustomPlan | null;
  riskTolerance?: RiskTolerance | null;
  anchorCurrency?: Exposure | null;
}): GuardianPlan | null {
  if (!planId) return null;
  const strategy = planId === "custom" ? valuesPhilosophy ?? "custom" : planId;
  const resolved = resolvePlan({
    strategy: planId,
    customPlan,
    riskTolerance,
    anchorCurrency,
  });
  if (resolved.legs.length === 0) return null;
  const allocationPlan = validateAllocationPlan(
    allocationPlanFromResolved(resolved),
    strategy,
  );
  return allocationPlan ? { strategy, allocationPlan } : null;
}

function sliceKey(slice: {
  exposure: string;
  prefer?: string;
  target: number;
}): string {
  return `${slice.exposure}|${slice.prefer ?? ""}|${slice.target}`;
}

export function sameGuardianPlan(
  saved: { strategy: string | null | undefined; allocationPlan?: ExposurePlan | null } | null | undefined,
  target: GuardianPlan | null,
): boolean {
  const savedPlan = saved?.allocationPlan;
  if (!saved?.strategy || !savedPlan || !target) return false;
  if (saved.strategy !== target.strategy) return false;
  const validated = validateAllocationPlan(savedPlan, saved.strategy);
  if (!validated) return false;
  if (Boolean(validated.rules?.excludeYield) !== Boolean(target.allocationPlan.rules?.excludeYield)) {
    return false;
  }
  const a = validated.slices.map(sliceKey).sort();
  const b = target.allocationPlan.slices.map(sliceKey).sort();
  return a.length === b.length && a.every((key, i) => key === b[i]);
}
