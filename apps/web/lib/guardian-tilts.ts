/**
 * Guardian tilts — Guardian picks exposures and sizes; code bounds them and
 * picks the instrument.
 *
 * `buildPlanContext` is the compact plan the model sees (per slice: target,
 * band, held, gap; rules; anchor; resolver-filtered candidates).
 * `validateGuardianPlan` is the server gate: a tilt ships only when it names
 * a plan exposure with an executable candidate, moves ≤ MAX_TILT points,
 * stays inside the risk band, and cites evidence that matches the market
 * snapshot. Anything else is returned as a rejection (observation-only).
 * `resolveInstrument` is deterministic: rules → executable rail → the chain
 * the user already funds → a token already held → registry order.
 */
import {
  EXPOSURE_LABELS,
  instrumentOn,
  instrumentsFor,
  exposureLabel,
  type Exposure,
} from "@diversifi/shared/src/config/exposures";
import {
  legExposure,
  type PlanLeg,
  type PlanRules,
  type RiskTolerance,
} from "@/components/protection-cards/plan-preview";
import { canonicalToken } from "@/lib/plan-legs";
import { scorePlanAlignment } from "@/lib/plan-alignment";

export const MAX_TILT = 5;

function isExposure(value: string): value is Exposure {
  return Object.prototype.hasOwnProperty.call(EXPOSURE_LABELS, value);
}

export const BAND_BY_RISK: Record<RiskTolerance, number> = {
  Conservative: 5,
  Balanced: 10,
  Aggressive: 15,
};

export function bandFor(risk: RiskTolerance | null | undefined): number {
  return BAND_BY_RISK[risk ?? "Balanced"] ?? BAND_BY_RISK.Balanced;
}

export interface Holding {
  symbol: string;
  chainId: number;
  value: number;
}

export interface ResolvedInstrument {
  symbol: string;
  chainId: number;
}

export function resolveInstrument(
  exposure: Exposure,
  {
    rules = {},
    holdings = [],
    prefer,
  }: { rules?: PlanRules; holdings?: readonly Holding[]; prefer?: PlanLeg["prefer"] } = {},
): ResolvedInstrument | null {
  let pool = instrumentsFor(exposure, { executableOnly: true }).filter(
    (i) => !i.trackedOnly && !i.testnet && !(rules.excludeYield && i.yieldBearing),
  );
  const wanted = pool.filter((i) => (prefer === "yield" ? i.yieldBearing : !i.yieldBearing));
  if (wanted.length > 0) pool = wanted;
  if (pool.length === 0) return null;

  const fundsByChain = new Map<number, number>();
  const heldValue = new Map<string, number>();
  for (const h of holdings) {
    if (!(h.value > 0)) continue;
    fundsByChain.set(h.chainId, (fundsByChain.get(h.chainId) ?? 0) + h.value);
    const key = `${canonicalToken(h.symbol)}@${h.chainId}`;
    heldValue.set(key, (heldValue.get(key) ?? 0) + h.value);
  }
  const ranked = pool
    .map((i, order) => ({
      i,
      order,
      funds: fundsByChain.get(i.chainId) ?? 0,
      held: heldValue.get(`${canonicalToken(i.symbol)}@${i.chainId}`) ?? 0,
    }))
    .sort((a, b) => b.funds - a.funds || b.held - a.held || a.order - b.order);
  const best = ranked[0].i;
  return { symbol: best.symbol, chainId: best.chainId };
}

export interface PlanContextSlice {
  exposure: Exposure;
  target: number;
  held: number;
  gap: number;
  prefer?: PlanLeg["prefer"];
}

export interface PlanContext {
  strategy: string | null;
  anchor: Exposure;
  band: number;
  rules: PlanRules;
  slices: PlanContextSlice[];
  /** Exposure → "SYMBOL@chainId", only for exposures the resolver can fill. */
  candidates: Partial<Record<Exposure, string>>;
  totalUsd: number;
}

export function buildPlanContext({
  strategy,
  legs,
  rules,
  risk,
  anchor,
  holdings,
}: {
  strategy: string | null;
  legs: readonly PlanLeg[];
  rules: PlanRules;
  risk: RiskTolerance | null | undefined;
  anchor: Exposure;
  holdings: readonly Holding[];
}): PlanContext {
  const totalUsd = holdings.reduce((sum, h) => sum + (h.value > 0 ? h.value : 0), 0);
  const heldPct = new Map<string, number>();
  if (totalUsd > 0) {
    for (const h of holdings) {
      if (h.value > 0) heldPct.set(h.symbol, (heldPct.get(h.symbol) ?? 0) + (h.value / totalUsd) * 100);
    }
  }
  const aligned = scorePlanAlignment([...legs], heldPct, totalUsd, rules).legs;
  const slices: PlanContextSlice[] = [];
  const candidates: Partial<Record<Exposure, string>> = {};
  legs.forEach((leg, i) => {
    const exposure = legExposure(leg);
    if (!exposure) return;
    const held = Math.round(aligned[i]?.held ?? 0);
    slices.push({
      exposure,
      target: leg.percent,
      held,
      gap: leg.percent - held,
      ...(leg.prefer ? { prefer: leg.prefer } : {}),
    });
    if (candidates[exposure]) return;
    const instrument = resolveInstrument(exposure, { rules, holdings, prefer: leg.prefer });
    if (instrument) candidates[exposure] = `${instrument.symbol}@${instrument.chainId}`;
  });
  return {
    strategy,
    anchor,
    band: bandFor(risk),
    rules,
    slices,
    candidates,
    totalUsd: Math.round(totalUsd),
  };
}

/** One compact block for the prompt (and the chat's plan line). */
export function formatPlanContext(ctx: PlanContext): string {
  const head = `anchor=${ctx.anchor} band=±${ctx.band} max_tilt=±${MAX_TILT}${ctx.rules.excludeYield ? " rules=no_yield" : ""}`;
  const rows = ctx.slices.map(
    (s) =>
      `${s.exposure}${s.prefer === "yield" ? "(yield)" : ""} target ${s.target} held ${s.held} gap ${s.gap > 0 ? "+" : ""}${s.gap}${ctx.candidates[s.exposure] ? ` → ${ctx.candidates[s.exposure]}` : " (no executable instrument)"}`,
  );
  return [head, ...rows].join("\n");
}

export interface TiltEvidence {
  signal: string;
  value: number;
}

export interface GuardianTilt {
  exposure: Exposure;
  delta: number;
  reason: string;
  evidence: TiltEvidence[];
}

export type MarketSnapshot = Partial<Record<string, number>>;

export type TiltRejection =
  | "malformed"
  | "not_in_plan"
  | "no_candidate"
  | "over_max"
  | "outside_band"
  | "no_evidence"
  | "evidence_mismatch"
  | "amount_invalid";

export interface ValidatedTilt extends GuardianTilt {
  instrument: ResolvedInstrument | null;
}

export interface ValidatedNextMove {
  exposure: Exposure;
  amountAnchor: number;
  amountUsd: number;
  instrument: ResolvedInstrument;
}

export interface ValidatedGuardianPlan {
  strategy: string | null;
  anchor: Exposure;
  tilts: ValidatedTilt[];
  nextMove: ValidatedNextMove | null;
  offPlan?: { reason: string };
  rejected: Array<{ exposure: string; delta: number; reason: TiltRejection; kind: "tilt" | "nextMove" }>;
}

const REJECTION_TEXT: Record<TiltRejection, string> = {
  malformed: "unreadable suggestion",
  not_in_plan: "not an exposure in this plan",
  no_candidate: "nothing executable fills it under this plan's rules",
  over_max: `more than ±${MAX_TILT} points`,
  outside_band: "outside this plan's band",
  no_evidence: "no evidence cited",
  evidence_mismatch: "cited evidence doesn't match market data",
  amount_invalid: "amount outside what the wallet holds",
};

export function describeRejection(r: ValidatedGuardianPlan["rejected"][number]): string {
  const sign = r.delta > 0 ? "+" : "";
  const what = r.kind === "tilt" ? `${sign}${r.delta} ${r.exposure}` : `next move into ${r.exposure}`;
  return `Guardian suggested ${what} — held back: ${REJECTION_TEXT[r.reason]}`;
}

function asExposure(value: unknown, ctx: PlanContext): Exposure | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return ctx.slices.some((s) => s.exposure === upper) ? (upper as Exposure) : null;
}

function evidenceHolds(evidence: unknown, snapshot: MarketSnapshot): TiltRejection | null {
  if (!Array.isArray(evidence) || evidence.length === 0) return "no_evidence";
  for (const item of evidence) {
    if (!item || typeof item !== "object") return "evidence_mismatch";
    const { signal, value } = item as { signal?: unknown; value?: unknown };
    if (typeof signal !== "string" || typeof value !== "number") return "evidence_mismatch";
    const actual = snapshot[signal];
    if (typeof actual !== "number" || !Number.isFinite(actual)) return "evidence_mismatch";
    if (Math.abs(value - actual) > Math.max(0.1, Math.abs(actual) * 0.05)) return "evidence_mismatch";
  }
  return null;
}

/**
 * Server gate for model output. `usdToAnchor` sizes the next move against
 * the wallet; the result's `rejected` list is what gets journaled.
 */
export function validateGuardianPlan(
  raw: unknown,
  ctx: PlanContext,
  snapshot: MarketSnapshot,
  usdToAnchor = 1,
): ValidatedGuardianPlan {
  const out: ValidatedGuardianPlan = {
    strategy: ctx.strategy,
    anchor: ctx.anchor,
    tilts: [],
    nextMove: null,
    rejected: [],
  };
  if (!raw || typeof raw !== "object") return out;
  const { tilts, nextMove, offPlan } = raw as {
    tilts?: unknown;
    nextMove?: unknown;
    offPlan?: unknown;
  };

  const netByExposure = new Map<Exposure, number>();
  for (const t of Array.isArray(tilts) ? tilts : []) {
    const tilt = (t ?? {}) as Partial<Record<keyof GuardianTilt, unknown>>;
    const delta = typeof tilt.delta === "number" && Number.isFinite(tilt.delta) ? Math.round(tilt.delta) : NaN;
    const label = typeof tilt.exposure === "string" ? tilt.exposure : "?";
    const reject = (reason: TiltRejection) =>
      out.rejected.push({ exposure: label, delta: Number.isNaN(delta) ? 0 : delta, reason, kind: "tilt" });
    if (Number.isNaN(delta) || delta === 0 || typeof tilt.reason !== "string" || !tilt.reason.trim()) {
      reject("malformed");
      continue;
    }
    const exposure = asExposure(tilt.exposure, ctx);
    if (!exposure) {
      reject("not_in_plan");
      continue;
    }
    if (Math.abs(delta) > Math.min(MAX_TILT, ctx.band)) {
      reject("over_max");
      continue;
    }
    const target = ctx.slices.find((s) => s.exposure === exposure)?.target ?? 0;
    const net = (netByExposure.get(exposure) ?? 0) + delta;
    if (Math.abs(net) > ctx.band || target + net < 0 || target + net > 100) {
      reject("outside_band");
      continue;
    }
    const candidate = ctx.candidates[exposure];
    if (delta > 0 && !candidate) {
      reject("no_candidate");
      continue;
    }
    const evidenceProblem = evidenceHolds(tilt.evidence, snapshot);
    if (evidenceProblem) {
      reject(evidenceProblem);
      continue;
    }
    netByExposure.set(exposure, net);
    const [symbol, chain] = candidate?.split("@") ?? [];
    out.tilts.push({
      exposure,
      delta,
      reason: tilt.reason.trim(),
      evidence: tilt.evidence as TiltEvidence[],
      instrument: delta > 0 && symbol ? { symbol, chainId: Number(chain) } : null,
    });
  }

  if (nextMove && typeof nextMove === "object") {
    const move = nextMove as { exposure?: unknown; amountAnchor?: unknown };
    const label = typeof move.exposure === "string" ? move.exposure : "?";
    const exposure = asExposure(move.exposure, ctx);
    const candidate = exposure ? ctx.candidates[exposure] : undefined;
    const amount = typeof move.amountAnchor === "number" ? move.amountAnchor : NaN;
    const maxAnchor = ctx.totalUsd * usdToAnchor;
    const reject = (reason: TiltRejection) =>
      out.rejected.push({ exposure: label, delta: 0, reason, kind: "nextMove" });
    const slice = exposure ? ctx.slices.find((s) => s.exposure === exposure) : undefined;
    const tilted = out.tilts.some((t) => t.exposure === exposure && t.delta > 0);
    if (!exposure || !slice) reject("not_in_plan");
    else if (!candidate) reject("no_candidate");
    else if (!tilted && slice.gap <= 0) reject("outside_band");
    else if (!(amount > 0) || !(usdToAnchor > 0) || amount > maxAnchor) reject("amount_invalid");
    else {
      const [symbol, chain] = candidate.split("@");
      out.nextMove = {
        exposure,
        amountAnchor: Math.round(amount * 100) / 100,
        amountUsd: Math.round((amount / usdToAnchor) * 100) / 100,
        instrument: { symbol, chainId: Number(chain) },
      };
    }
  }

  if (offPlan && typeof offPlan === "object") {
    const reason = (offPlan as { reason?: unknown }).reason;
    if (typeof reason === "string" && reason.trim()) out.offPlan = { reason: reason.trim() };
  }
  return out;
}

/**
 * Plan legs with one exposure tilted by `delta` points; the other legs give
 * or take proportionally so the plan still sums to 100 (largest remainder).
 */
export function applyTilt(legs: readonly PlanLeg[], exposure: Exposure, delta: number): PlanLeg[] {
  const idx = (() => {
    const matches = legs.map((l, i) => ({ l, i })).filter(({ l }) => legExposure(l) === exposure);
    return (matches.find(({ l }) => l.prefer !== "yield") ?? matches[0])?.i ?? -1;
  })();
  if (idx < 0 || delta === 0) return [...legs];
  const target = Math.max(0, Math.min(100, legs[idx].percent + delta));
  const othersTotal = legs.reduce((sum, l, i) => (i === idx ? sum : sum + l.percent), 0);
  const remaining = 100 - target;
  if (othersTotal <= 0) return legs.map((l, i) => ({ ...l, percent: i === idx ? 100 : 0 }));
  const raw = legs.map((l, i) => (i === idx ? target : (l.percent / othersTotal) * remaining));
  const floors = raw.map((r, i) => (i === idx ? r : Math.floor(r)));
  let short = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: i === idx ? -1 : r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (short <= 0) break;
    if (i === idx) continue;
    floors[i] += 1;
    short -= 1;
  }
  return legs.map((l, i) => ({ ...l, percent: floors[i] }));
}

export function tiltLabel(tilt: Pick<GuardianTilt, "exposure" | "delta">): string {
  return `${tilt.delta > 0 ? "+" : ""}${tilt.delta} ${exposureLabel(tilt.exposure)}`;
}

/**
 * The plan context arrives from the browser — re-check its shape and every
 * candidate against the registry (executable, right exposure, rules) before
 * the server lets the model or the gate lean on it.
 */
export function sanitizePlanContext(raw: unknown): PlanContext | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<Record<keyof PlanContext, unknown>>;
  const anchor = typeof c.anchor === "string" && isExposure(c.anchor) ? c.anchor : null;
  if (!anchor || !Array.isArray(c.slices)) return null;
  const rules: PlanRules =
    c.rules && typeof c.rules === "object" && (c.rules as PlanRules).excludeYield === true
      ? { excludeYield: true }
      : {};
  const slices: PlanContextSlice[] = [];
  for (const s of c.slices.slice(0, 8)) {
    const slice = (s ?? {}) as Partial<Record<keyof PlanContextSlice, unknown>>;
    if (typeof slice.exposure !== "string" || !isExposure(slice.exposure)) continue;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);
    const target = Math.max(0, Math.min(100, num(slice.target)));
    const held = Math.max(0, Math.min(100, num(slice.held)));
    slices.push({
      exposure: slice.exposure,
      target,
      held,
      gap: target - held,
      ...(slice.prefer === "yield" || slice.prefer === "liquid" ? { prefer: slice.prefer } : {}),
    });
  }
  if (slices.length === 0) return null;
  const candidates: Partial<Record<Exposure, string>> = {};
  const rawCandidates = c.candidates && typeof c.candidates === "object" ? (c.candidates as Record<string, unknown>) : {};
  for (const slice of slices) {
    const value = rawCandidates[slice.exposure];
    if (typeof value !== "string") continue;
    const [symbol, chain] = value.split("@");
    const instrument = symbol ? instrumentOn(symbol, Number(chain)) : undefined;
    if (
      instrument &&
      instrument.exposure === slice.exposure &&
      instrument.executable &&
      !instrument.trackedOnly &&
      !(rules.excludeYield && instrument.yieldBearing)
    ) {
      candidates[slice.exposure] = `${instrument.symbol}@${instrument.chainId}`;
    }
  }
  const band = typeof c.band === "number" && [5, 10, 15].includes(c.band) ? c.band : BAND_BY_RISK.Balanced;
  const totalUsd = typeof c.totalUsd === "number" && c.totalUsd > 0 ? Math.round(c.totalUsd) : 0;
  return {
    strategy: typeof c.strategy === "string" ? c.strategy.slice(0, 40) : null,
    anchor,
    band,
    rules,
    slices,
    candidates,
    totalUsd,
  };
}
