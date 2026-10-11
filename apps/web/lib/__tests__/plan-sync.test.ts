import { describe, expect, it } from "vitest";
import { guardianPlanForShield, sameGuardianPlan } from "../plan-sync";
import { STRATEGY_PLANS } from "@diversifi/shared/src/config/allocation-plans";
import type { ExposurePlan } from "@/components/protection-cards/plan-preview";

const ISLAMIC_CUSTOM = {
  from: "islamic",
  rules: { excludeYield: true },
  slices: [
    { exposure: "USD" as const, target: 50 },
    { exposure: "XAU" as const, target: 50 },
  ],
};

describe("guardianPlanForShield", () => {
  it("a named plan syncs under its own id with a validated vector", () => {
    const target = guardianPlanForShield({ planId: "africapitalism" });
    expect(target?.strategy).toBe("africapitalism");
    expect(target?.allocationPlan.slices.map((s) => s.target)).toEqual([60, 25, 15]);
  });

  it("a custom plan seeded from named values syncs under the values id", () => {
    const target = guardianPlanForShield({
      planId: "custom",
      valuesPhilosophy: "islamic",
      customPlan: ISLAMIC_CUSTOM,
    });
    expect(target?.strategy).toBe("islamic");
    expect(target?.allocationPlan.rules.excludeYield).toBe(true);
    expect(target?.allocationPlan.slices.map((s) => s.target)).toEqual([50, 50]);
  });

  it("islamic values with a yield-allowed custom vector fail closed", () => {
    const target = guardianPlanForShield({
      planId: "custom",
      valuesPhilosophy: "islamic",
      customPlan: { ...ISLAMIC_CUSTOM, rules: {} },
    });
    expect(target).toBeNull();
  });

  it("a standalone custom plan syncs under 'custom'", () => {
    const target = guardianPlanForShield({
      planId: "custom",
      valuesPhilosophy: null,
      customPlan: {
        from: null,
        rules: {},
        slices: [
          { exposure: "USD", target: 60 },
          { exposure: "BRL", target: 40 },
        ],
      },
    });
    expect(target?.strategy).toBe("custom");
  });

  it("returns null without a plan or a resolvable vector", () => {
    expect(guardianPlanForShield({ planId: null })).toBeNull();
    expect(guardianPlanForShield({ planId: "custom" })).toBeNull();
  });
});

describe("sameGuardianPlan", () => {
  const target = guardianPlanForShield({ planId: "africapitalism" })!;

  it("matches the same strategy with the same normalized slices", () => {
    expect(
      sameGuardianPlan(
        { strategy: "africapitalism", allocationPlan: STRATEGY_PLANS.africapitalism },
        target,
      ),
    ).toBe(true);
  });

  it("flags unsynced when a target weight changed under the same strategy", () => {
    const drifted: ExposurePlan = {
      slices: [
        { exposure: "KES", target: 55, region: "x", why: "y" },
        { exposure: "USD", target: 30, region: "x", why: "y" },
        { exposure: "EUR", target: 15, region: "x", why: "y" },
      ],
      rules: {},
    };
    expect(
      sameGuardianPlan({ strategy: "africapitalism", allocationPlan: drifted }, target),
    ).toBe(false);
  });

  it("flags unsynced on strategy mismatch, missing plan, or rule drift", () => {
    expect(
      sameGuardianPlan(
        { strategy: "buen_vivir", allocationPlan: STRATEGY_PLANS.africapitalism },
        target,
      ),
    ).toBe(false);
    expect(sameGuardianPlan(null, target)).toBe(false);
    expect(
      sameGuardianPlan(
        { strategy: "africapitalism", allocationPlan: { ...STRATEGY_PLANS.africapitalism, rules: { excludeYield: true } } },
        target,
      ),
    ).toBe(false);
  });

  it("fails closed on a malformed saved vector, even one that would appear equal", () => {
    const withSlices = (slices: unknown, rules: Record<string, unknown> = {}) =>
      ({ strategy: "africapitalism", allocationPlan: { slices, rules } as unknown as ExposurePlan });
    expect(
      sameGuardianPlan(
        withSlices([
          { exposure: "KES", target: 60 },
          { exposure: "KES", target: 25 },
          { exposure: "EUR", target: 15 },
        ]),
        target,
      ),
    ).toBe(false);
    expect(
      sameGuardianPlan(
        withSlices([
          { exposure: "KES", target: 60 },
          { exposure: "USD", target: 25 },
          { exposure: "EUR", target: 10 },
        ]),
        target,
      ),
    ).toBe(false);
  });

  it("an islamic saved vector without the no-yield rule is never synced", () => {
    const islamicTarget = guardianPlanForShield({ planId: "islamic" })!;
    expect(
      sameGuardianPlan(
        { strategy: "islamic", allocationPlan: { slices: STRATEGY_PLANS.islamic.slices, rules: {} } },
        islamicTarget,
      ),
    ).toBe(false);
    expect(sameGuardianPlan({ strategy: "islamic", allocationPlan: STRATEGY_PLANS.islamic }, islamicTarget)).toBe(true);
    expect(
      sameGuardianPlan(
        {
          strategy: "islamic",
          allocationPlan: {
            rules: { excludeYield: true },
            slices: [
              { exposure: "XAU", target: 50, region: "x", why: "y" },
              { exposure: "USD", target: 50, region: "x", why: "y", prefer: "yield" },
            ],
          } as unknown as ExposurePlan,
        },
        islamicTarget,
      ),
    ).toBe(false);
  });
});
