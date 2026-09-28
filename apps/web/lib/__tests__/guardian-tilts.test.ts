import { describe, expect, it } from "vitest";
import { instrumentOn } from "@diversifi/shared/src/config/exposures";
import { resolvePlan } from "@/components/protection-cards/plan-preview";
import {
  applyTilt,
  bandFor,
  buildPlanContext,
  describeRejection,
  formatPlanContext,
  resolveInstrument,
  sanitizePlanContext,
  validateGuardianPlan,
  type Holding,
} from "../guardian-tilts";

const CELO = 42220;
const ARB = 42161;

function ctxFor(strategy: string, holdings: Holding[], risk: "Conservative" | "Balanced" | "Aggressive" = "Balanced") {
  const { legs, rules } = resolvePlan({ strategy, riskTolerance: risk });
  return buildPlanContext({ strategy, legs, rules, risk, anchor: "USD", holdings });
}

describe("resolveInstrument", () => {
  it("gold resolves to PAXG on Arbitrum; Hyperliquid GOLD is never picked", () => {
    expect(resolveInstrument("XAU")).toEqual({ symbol: "PAXG", chainId: ARB });
    expect(
      resolveInstrument("XAU", { holdings: [{ symbol: "GOLD", chainId: 999, value: 1000 }] }),
    ).toEqual({ symbol: "PAXG", chainId: ARB });
  });

  it("prefers the chain the user already funds, then a token already held", () => {
    const onArb = resolveInstrument("USD", { holdings: [{ symbol: "WETH", chainId: ARB, value: 500 }] });
    expect(onArb?.chainId).toBe(ARB);
    const onCelo = resolveInstrument("USD", { holdings: [{ symbol: "KESm", chainId: CELO, value: 500 }] });
    expect(onCelo?.chainId).toBe(CELO);
    const heldUsdt = resolveInstrument("USD", { holdings: [{ symbol: "USDT", chainId: CELO, value: 500 }] });
    expect(heldUsdt).toEqual({ symbol: "USDT", chainId: CELO });
  });

  it("rules hold: an Islamic plan never resolves to a yield-bearing dollar", () => {
    const pick = resolveInstrument("USD", { rules: { excludeYield: true }, prefer: "yield" });
    expect(pick).not.toBeNull();
    expect(instrumentOn(pick!.symbol, pick!.chainId)?.yieldBearing).toBe(false);
  });

  it("a yield slice resolves to a yield-bearing instrument", () => {
    const pick = resolveInstrument("USD", { prefer: "yield" });
    expect(instrumentOn(pick!.symbol, pick!.chainId)?.yieldBearing).toBe(true);
  });

  it("every pick is executable and never tracked-only", () => {
    for (const exposure of ["USD", "EUR", "KES", "BRL", "XAU"] as const) {
      const pick = resolveInstrument(exposure);
      const inst = pick && instrumentOn(pick.symbol, pick.chainId);
      expect(inst?.executable, exposure).toBe(true);
      expect(inst?.trackedOnly, exposure).toBe(false);
    }
  });
});

describe("buildPlanContext", () => {
  it("bands follow risk: Conservative ±5, Balanced ±10, Aggressive ±15", () => {
    expect([bandFor("Conservative"), bandFor("Balanced"), bandFor("Aggressive"), bandFor(null)]).toEqual([5, 10, 15, 10]);
  });

  it("carries held and gap per exposure across chains, and stays under 1 KB", () => {
    const ctx = ctxFor("africapitalism", [
      { symbol: "USDC", chainId: ARB, value: 500 },
      { symbol: "cKES", chainId: CELO, value: 300 },
      { symbol: "KESm", chainId: CELO, value: 200 },
    ]);
    const kes = ctx.slices.find((s) => s.exposure === "KES")!;
    expect(kes.held).toBe(50);
    expect(kes.gap).toBe(kes.target - 50);
    expect(ctx.candidates.KES).toMatch(/@42220$/);
    expect(JSON.stringify(ctx).length).toBeLessThan(1024);
    expect(formatPlanContext(ctx).length).toBeLessThan(1024);
  });

  it("sanitizePlanContext drops forged candidates", () => {
    const ctx = ctxFor("africapitalism", []);
    const forged = sanitizePlanContext({ ...ctx, candidates: { ...ctx.candidates, KES: "PAXG@42161", USD: "GOLD@999" } });
    expect(forged?.candidates.KES).toBeUndefined();
    expect(forged?.candidates.USD).toBeUndefined();
    expect(forged?.candidates.EUR).toBe(ctx.candidates.EUR);
    expect(sanitizePlanContext({ anchor: "XYZ", slices: [] })).toBeNull();
  });
});

describe("validateGuardianPlan — server gate", () => {
  const snapshot = { goldChange24h: 2.1, realYield: -1.2, inflation: 6.4 };
  const ctx = ctxFor("pan_caribbean", [{ symbol: "USDC", chainId: ARB, value: 1000 }]);

  it("accepts an in-band, evidenced tilt and resolves its instrument", () => {
    const out = validateGuardianPlan(
      {
        tilts: [{ exposure: "XAU", delta: 5, reason: "Gold up on debasement", evidence: [{ signal: "goldChange24h", value: 2.1 }] }],
        nextMove: { exposure: "XAU", amountAnchor: 50 },
      },
      ctx,
      snapshot,
    );
    expect(out.rejected).toEqual([]);
    expect(out.tilts[0].instrument).toEqual({ symbol: "PAXG", chainId: ARB });
    expect(out.nextMove).toMatchObject({ exposure: "XAU", amountAnchor: 50, amountUsd: 50 });
  });

  it("rejects oversize, off-plan, unevidenced and mismatched tilts — each reason recorded", () => {
    const out = validateGuardianPlan(
      {
        tilts: [
          { exposure: "XAU", delta: 8, reason: "x", evidence: [{ signal: "goldChange24h", value: 2.1 }] },
          { exposure: "BRL", delta: 3, reason: "x", evidence: [{ signal: "inflation", value: 6.4 }] },
          { exposure: "EUR", delta: 3, reason: "x", evidence: [] },
          { exposure: "EUR", delta: 3, reason: "x", evidence: [{ signal: "inflation", value: 9 }] },
          { exposure: "EUR", delta: 3, reason: "x", evidence: [{ signal: "vibes", value: 1 }] },
          { exposure: "XAU", delta: "big", reason: "x", evidence: [] },
        ],
      },
      ctx,
      snapshot,
    );
    expect(out.tilts).toEqual([]);
    expect(out.rejected.map((r) => r.reason)).toEqual([
      "over_max",
      "not_in_plan",
      "no_evidence",
      "evidence_mismatch",
      "evidence_mismatch",
      "malformed",
    ]);
    expect(describeRejection(out.rejected[0])).toBe("Guardian suggested +8 XAU — held back: more than ±5 points");
  });

  it("repeated tilts can't walk an exposure out of its band", () => {
    const conservative = ctxFor("pan_caribbean", [], "Conservative");
    const tilt = { exposure: "XAU", delta: 5, reason: "x", evidence: [{ signal: "goldChange24h", value: 2.1 }] };
    const out = validateGuardianPlan({ tilts: [tilt, tilt] }, conservative, snapshot);
    expect(out.tilts).toHaveLength(1);
    expect(out.rejected[0].reason).toBe("outside_band");
  });

  it("a next move must be fundable and on plan", () => {
    const tooBig = validateGuardianPlan({ nextMove: { exposure: "XAU", amountAnchor: 5000 } }, ctx, snapshot);
    expect(tooBig.nextMove).toBeNull();
    expect(tooBig.rejected[0]).toMatchObject({ kind: "nextMove", reason: "amount_invalid" });
    const noFx = validateGuardianPlan({ nextMove: { exposure: "XAU", amountAnchor: 5 } }, ctx, snapshot, Number.NaN);
    expect(noFx.nextMove).toBeNull();
  });

  it("the model failing leaves nothing to ship and nothing to journal", () => {
    for (const raw of [undefined, null, "oops", {}]) {
      const out = validateGuardianPlan(raw, ctx, snapshot);
      expect(out.tilts).toEqual([]);
      expect(out.nextMove).toBeNull();
      expect(out.rejected).toEqual([]);
    }
  });
});

describe("applyTilt", () => {
  it("adds the delta and gives it back proportionally — still 100", () => {
    const { legs } = resolvePlan({ strategy: "pan_caribbean" });
    const tilted = applyTilt(legs, "XAU", 5);
    const gold = tilted.find((l) => l.exposure === "XAU" || l.token === "PAXG")!;
    const before = legs.find((l) => l.exposure === "XAU" || l.token === "PAXG")!;
    expect(gold.percent).toBe(before.percent + 5);
    expect(tilted.reduce((s, l) => s + l.percent, 0)).toBe(100);
    expect(applyTilt(legs, "JPY", 5)).toEqual(legs);
  });
});
