/**
 * Custom plans — edited as exposures on the ring.
 *
 * Every edit keeps the plan valid: 5-point steps, 2–6 slices, total 100.
 * Stepping one slice rebalances the others proportionally; stepping to 0
 * removes it. A Custom plan never starts empty — it starts from a
 * philosophy ("Tweak this plan") or from the wallet's current exposures.
 */
import {
  EXPOSURE_LABELS,
  exposureLabel,
  exposureOf,
  isYieldBearing,
  type Exposure,
} from "@diversifi/shared/src/config/exposures";
import {
  instrumentForSlice,
  legExposure,
  type CustomPlan,
  type PlanLeg,
  type PlanRules,
  type SlicePreference,
} from "@/components/protection-cards/plan-preview";
import { resolveInstrument, type Holding } from "@/lib/guardian-tilts";

export const CUSTOM_STEP = 5;
export const CUSTOM_MIN_SLICES = 2;
export const CUSTOM_MAX_SLICES = 6;
const UNITS = 100 / CUSTOM_STEP;

const CHAIN_HINT: Record<number, string> = { 42220: "Celo", 42161: "Arbitrum" };

type Slice = CustomPlan["slices"][number];

function isExposure(value: unknown): value is Exposure {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EXPOSURE_LABELS, value);
}

function sameSlice(a: Pick<Slice, "exposure" | "prefer">, b: Pick<Slice, "exposure" | "prefer">): boolean {
  return a.exposure === b.exposure && (a.prefer ?? null) === (b.prefer ?? null);
}

function fillable(slice: Pick<Slice, "exposure" | "prefer">, rules: PlanRules): boolean {
  return instrumentForSlice({ ...slice, target: 0, region: "", why: "" }, rules) !== null;
}

/** Split `units` over `weights` proportionally (largest remainder), each at least 1. */
function apportion(weights: readonly number[], units: number): number[] {
  const clean = weights.map((w) => Math.max(0, w));
  const total = clean.reduce((a, b) => a + b, 0);
  const raw = clean.map((w) => (total > 0 ? (w / total) * units : units / weights.length));
  const out = raw.map(Math.floor);
  let left = units - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ frac: r - out[i], i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].i] += 1;
  out.forEach((u, i) => {
    if (u > 0) return;
    const largest = out.indexOf(Math.max(...out));
    out[largest] -= 1;
    out[i] = 1;
  });
  return out;
}

function withTargets(plan: CustomPlan, slices: readonly Omit<Slice, "target">[], units: number[]): CustomPlan {
  return {
    ...plan,
    slices: slices.map((s, i) => ({ ...s, target: units[i] * CUSTOM_STEP })),
  };
}

function fromWeights(
  weighted: Array<{ exposure: Exposure; prefer?: SlicePreference; weight: number }>,
  rules: PlanRules,
  from: string | null,
): CustomPlan {
  const kept = weighted
    .filter((w) => w.weight > 0 && fillable(w, rules))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, CUSTOM_MAX_SLICES);
  for (const pad of ["USD", "EUR"] as const) {
    if (kept.length >= CUSTOM_MIN_SLICES) break;
    if (!kept.some((k) => sameSlice(k, { exposure: pad })) && fillable({ exposure: pad }, rules)) {
      kept.push({ exposure: pad, weight: 0 });
    }
  }
  const units = apportion(kept.map((k) => k.weight), UNITS);
  return {
    from,
    rules,
    slices: kept.map((k, i) => ({
      exposure: k.exposure,
      target: units[i] * CUSTOM_STEP,
      ...(k.prefer ? { prefer: k.prefer } : {}),
    })),
  };
}

/** "Tweak this plan": the philosophy's (unshifted) legs as a Custom plan. */
export function customFromLegs(legs: readonly PlanLeg[], rules: PlanRules, from: string | null): CustomPlan {
  const weighted: Array<{ exposure: Exposure; prefer?: SlicePreference; weight: number }> = [];
  for (const leg of legs) {
    const exposure = legExposure(leg);
    if (!exposure) continue;
    const key = { exposure, ...(leg.prefer ? { prefer: leg.prefer } : {}) };
    const hit = weighted.find((w) => sameSlice(w, key));
    if (hit) hit.weight += leg.percent;
    else weighted.push({ ...key, weight: leg.percent });
  }
  return fromWeights(weighted, rules, from);
}

/** Custom chosen directly: the wallet's current exposures; null for an empty wallet. */
export function customFromHoldings(holdings: readonly Holding[]): CustomPlan | null {
  const weighted: Array<{ exposure: Exposure; prefer?: SlicePreference; weight: number }> = [];
  for (const h of holdings) {
    const exposure = exposureOf(h.symbol);
    if (!exposure || !(h.value > 0)) continue;
    const key = { exposure, ...(isYieldBearing(h.symbol) ? { prefer: "yield" as const } : {}) };
    const hit = weighted.find((w) => sameSlice(w, key));
    if (hit) hit.weight += h.value;
    else weighted.push({ ...key, weight: h.value });
  }
  if (!weighted.some((w) => w.weight > 0 && fillable(w, {}))) return null;
  return fromWeights(weighted, {}, null);
}

/** ±5 on one slice; the others absorb it proportionally. Stepping to 0 removes the slice. */
export function stepSlice(plan: CustomPlan, index: number, direction: 1 | -1): CustomPlan {
  const units = plan.slices.map((s) => Math.round(s.target / CUSTOM_STEP));
  if (index < 0 || index >= units.length) return plan;
  const next = units[index] + direction;
  if (next <= 0) return removeSlice(plan, index);
  if (next > UNITS - (units.length - 1)) return plan;
  const others = units.map((_, i) => i).filter((i) => i !== index);
  const rebalanced = apportion(others.map((i) => units[i]), UNITS - next);
  const out = [...units];
  out[index] = next;
  others.forEach((i, k) => {
    out[i] = rebalanced[k];
  });
  return withTargets(plan, plan.slices, out);
}

export function removeSlice(plan: CustomPlan, index: number): CustomPlan {
  if (plan.slices.length <= CUSTOM_MIN_SLICES || index < 0 || index >= plan.slices.length) return plan;
  const rest = plan.slices.filter((_, i) => i !== index);
  const units = apportion(rest.map((s) => s.target / CUSTOM_STEP), UNITS);
  return withTargets(plan, rest, units);
}

/** "+ Add": a new 5% slice taken proportionally from the rest. */
export function addSlice(plan: CustomPlan, exposure: Exposure, prefer?: SlicePreference): CustomPlan {
  const key = { exposure, ...(prefer ? { prefer } : {}) };
  if (plan.slices.length >= CUSTOM_MAX_SLICES || plan.slices.some((s) => sameSlice(s, key))) return plan;
  if (!fillable(key, plan.rules)) return plan;
  const units = apportion(plan.slices.map((s) => s.target / CUSTOM_STEP), UNITS - 1);
  return withTargets(plan, [...plan.slices, key], [...units, 1]);
}

export interface AddableExposure {
  exposure: Exposure;
  label: string;
  /** Where the resolver would fill it, e.g. "Arbitrum". */
  chain: string | null;
}

/** Exposures that can join this plan — executable, rule-compliant, not already in it. */
export function addableExposures(plan: CustomPlan, holdings: readonly Holding[] = []): AddableExposure[] {
  if (plan.slices.length >= CUSTOM_MAX_SLICES) return [];
  return (Object.keys(EXPOSURE_LABELS) as Exposure[])
    .filter((exposure) => !plan.slices.some((s) => sameSlice(s, { exposure })) && fillable({ exposure }, plan.rules))
    .map((exposure) => {
      const pick = resolveInstrument(exposure, { rules: plan.rules, holdings });
      return { exposure, label: exposureLabel(exposure), chain: pick ? CHAIN_HINT[pick.chainId] ?? null : null };
    });
}

/** Index of the slice a ring leg draws. */
export function sliceIndexForLeg(plan: CustomPlan, leg: PlanLeg): number {
  const exposure = legExposure(leg);
  if (!exposure) return -1;
  return plan.slices.findIndex((s) => sameSlice(s, { exposure, ...(leg.prefer ? { prefer: leg.prefer } : {}) }));
}

/** Parse a stored Custom plan; anything malformed is dropped. */
export function normalizeCustomPlan(raw: unknown): CustomPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const { from, slices, rules } = raw as { from?: unknown; slices?: unknown; rules?: unknown };
  if (!Array.isArray(slices)) return null;
  if (slices.length < CUSTOM_MIN_SLICES || slices.length > CUSTOM_MAX_SLICES) return null;
  const cleanRules: PlanRules =
    rules && typeof rules === "object" && (rules as PlanRules).excludeYield === true ? { excludeYield: true } : {};
  const clean: Slice[] = [];
  for (const s of slices) {
    if (!s || typeof s !== "object") return null;
    const { exposure, target, prefer } = s as { exposure?: unknown; target?: unknown; prefer?: unknown };
    if (!isExposure(exposure) || typeof target !== "number") return null;
    if (target <= 0 || target % CUSTOM_STEP !== 0) return null;
    if (prefer !== undefined && prefer !== "yield" && prefer !== "liquid") return null;
    const slice: Slice = { exposure, target, ...(prefer ? { prefer } : {}) };
    if (clean.some((c) => sameSlice(c, slice))) return null;
    clean.push(slice);
  }
  if (clean.reduce((sum, s) => sum + s.target, 0) !== 100) return null;
  return { from: typeof from === "string" ? from : null, slices: clean, rules: cleanRules };
}
