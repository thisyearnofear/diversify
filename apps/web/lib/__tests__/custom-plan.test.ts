import { describe, expect, it } from "vitest";
import {
  STRATEGY_ALLOCATIONS,
  STRATEGY_PLANS,
  registerCustomPlan,
  resolvePlan,
  type CustomPlan,
} from "@/components/protection-cards/plan-preview";
import {
  CUSTOM_MAX_SLICES,
  addSlice,
  addableExposures,
  customFromHoldings,
  customFromLegs,
  normalizeCustomPlan,
  removeSlice,
  sliceIndexForLeg,
  stepSlice,
} from "@/lib/custom-plan";

const total = (p: CustomPlan) => p.slices.reduce((s, x) => s + x.target, 0);
const targets = (p: CustomPlan) => p.slices.map((s) => [s.exposure, s.target]);
const valid = (p: CustomPlan) => {
  expect(total(p)).toBe(100);
  expect(p.slices.length).toBeGreaterThanOrEqual(2);
  expect(p.slices.length).toBeLessThanOrEqual(CUSTOM_MAX_SLICES);
  for (const s of p.slices) expect(s.target % 5).toBe(0);
};

const panCaribbean = customFromLegs(STRATEGY_ALLOCATIONS.pan_caribbean, {}, "pan_caribbean");

describe("custom plan — starting points", () => {
  it("'Tweak this plan' copies the philosophy's exposures and targets", () => {
    expect(panCaribbean.from).toBe("pan_caribbean");
    expect(targets(panCaribbean)).toEqual([["USD", 50], ["XAU", 30], ["EUR", 20]]);
  });

  it("carries the philosophy's rules (Islamic stays no-yield)", () => {
    const islamic = customFromLegs(STRATEGY_ALLOCATIONS.islamic, STRATEGY_PLANS.islamic.rules, "islamic");
    expect(islamic.rules).toEqual({ excludeYield: true });
    expect(addableExposures(islamic).every((a) => a.exposure !== "US_EQUITY")).toBe(true);
  });

  it("keeps yield slices distinct from liquid ones", () => {
    const confucian = customFromLegs(STRATEGY_ALLOCATIONS.confucian, {}, "confucian");
    expect(confucian.slices).toEqual([
      { exposure: "USD", target: 70 },
      { exposure: "USD", target: 30, prefer: "yield" },
    ]);
  });

  it("choosing Custom directly starts from current exposures, aggregated across chains", () => {
    const plan = customFromHoldings([
      { symbol: "USDC", chainId: 42161, value: 300 },
      { symbol: "USDm", chainId: 42220, value: 300 },
      { symbol: "KESm", chainId: 42220, value: 200 },
      { symbol: "PAXG", chainId: 42161, value: 200 },
    ]);
    expect(plan?.from).toBeNull();
    expect(targets(plan!)).toEqual([["USD", 60], ["KES", 20], ["XAU", 20]]);
  });

  it("pads a single-exposure wallet to two slices and skips untradeable exposures", () => {
    const plan = customFromHoldings([
      { symbol: "USDC", chainId: 42161, value: 500 },
      { symbol: "WETH", chainId: 42161, value: 500 },
    ])!;
    valid(plan);
    expect(targets(plan)).toEqual([["USD", 95], ["EUR", 5]]);
  });

  it("an empty wallet has no starting exposures", () => {
    expect(customFromHoldings([])).toBeNull();
  });
});

describe("custom plan — editing", () => {
  it("+5 on one slice rebalances the others proportionally", () => {
    const next = stepSlice(panCaribbean, 1, 1);
    valid(next);
    expect(targets(next)).toEqual([["USD", 45], ["XAU", 35], ["EUR", 20]]);
  });

  it("−5 gives the weight back proportionally", () => {
    const next = stepSlice(panCaribbean, 0, -1);
    valid(next);
    expect(targets(next)).toEqual([["USD", 45], ["XAU", 35], ["EUR", 20]]);
  });

  it("stepping a slice to zero removes it", () => {
    let plan = panCaribbean;
    for (let i = 0; i < 3; i++) plan = stepSlice(plan, 2, -1);
    expect(plan.slices[2]).toEqual({ exposure: "EUR", target: 5 });
    expect(plan.slices.map((s) => s.exposure)).toEqual(["USD", "XAU", "EUR"]);
    plan = stepSlice(plan, 2, -1);
    valid(plan);
    expect(plan.slices.map((s) => s.exposure)).toEqual(["USD", "XAU"]);
  });

  it("never drops below two slices or squeezes another slice to zero", () => {
    const two: CustomPlan = { from: null, rules: {}, slices: [{ exposure: "USD", target: 95 }, { exposure: "XAU", target: 5 }] };
    expect(stepSlice(two, 1, -1)).toBe(two);
    expect(stepSlice(two, 0, 1)).toBe(two);
    expect(removeSlice(two, 0)).toBe(two);
  });

  it("+ Add takes 5% proportionally and caps at six slices", () => {
    let plan = addSlice(panCaribbean, "KES");
    valid(plan);
    expect(plan.slices.at(-1)).toEqual({ exposure: "KES", target: 5 });
    for (const e of ["BRL", "PHP", "COP"] as const) plan = addSlice(plan, e);
    expect(plan.slices).toHaveLength(6);
    valid(plan);
    expect(addSlice(plan, "CHF" as never)).toBe(plan);
    expect(addableExposures(plan)).toEqual([]);
  });

  it("offers only executable exposures, with the chain they'd fill on", () => {
    const options = addableExposures(panCaribbean, [{ symbol: "USDm", chainId: 42220, value: 10 }]);
    const exposures = options.map((o) => o.exposure);
    expect(exposures).not.toContain("USD");
    expect(exposures).not.toContain("XAU");
    expect(exposures).not.toContain("US_EQUITY");
    expect(options.find((o) => o.exposure === "KES")?.chain).toBe("Celo");
    for (const o of options) expect(["Celo", "Arbitrum"]).toContain(o.chain);
  });

  it("maps a ring leg back to its slice", () => {
    const { legs } = resolvePlan({ strategy: "custom", customPlan: panCaribbean });
    expect(legs.map((l) => sliceIndexForLeg(panCaribbean, l))).toEqual([0, 1, 2]);
  });
});

describe("custom plan — resolvePlan and storage", () => {
  it("resolves Custom like any plan: exposures, labels, rules, risk dial and anchor floor", () => {
    const plan = resolvePlan({ strategy: "custom", customPlan: panCaribbean });
    expect(plan.strategy).toBe("custom");
    expect(plan.legs.map((l) => [l.exposure, l.percent, l.label])).toEqual([
      ["USD", 50, "Dollar"],
      ["XAU", 30, "Gold"],
      ["EUR", 20, "Euro"],
    ]);
    const conservative = resolvePlan({ strategy: "custom", customPlan: panCaribbean, riskTolerance: "Conservative" });
    expect(conservative.legs[0].percent).toBe(65);
    const eurAnchor = resolvePlan({ strategy: "custom", customPlan: panCaribbean, anchorCurrency: "EUR" });
    expect(eurAnchor.floor).toBe("EUR");
  });

  it("falls back to the registered (saved) Custom plan, and is empty without one", () => {
    registerCustomPlan(null);
    expect(resolvePlan({ strategy: "custom" }).legs).toEqual([]);
    registerCustomPlan(panCaribbean);
    expect(resolvePlan({ strategy: "custom" }).legs).toHaveLength(3);
    registerCustomPlan(null);
  });

  it("normalizeCustomPlan accepts a valid plan and drops malformed ones", () => {
    expect(normalizeCustomPlan(JSON.parse(JSON.stringify(panCaribbean)))).toEqual(panCaribbean);
    expect(normalizeCustomPlan(null)).toBeNull();
    expect(normalizeCustomPlan({ slices: [{ exposure: "USD", target: 100 }] })).toBeNull();
    expect(normalizeCustomPlan({ slices: [{ exposure: "USD", target: 50 }, { exposure: "XAU", target: 45 }] })).toBeNull();
    expect(normalizeCustomPlan({ slices: [{ exposure: "USD", target: 52 }, { exposure: "XAU", target: 48 }] })).toBeNull();
    expect(normalizeCustomPlan({ slices: [{ exposure: "DOGE", target: 50 }, { exposure: "XAU", target: 50 }] })).toBeNull();
    expect(normalizeCustomPlan({ slices: [{ exposure: "USD", target: 50 }, { exposure: "USD", target: 50 }] })).toBeNull();
  });
});
