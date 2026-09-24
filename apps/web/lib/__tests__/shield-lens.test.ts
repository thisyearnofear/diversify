import { describe, expect, it } from "vitest";
import { strongerFloorOffer } from "../shield-lens";
import type { PlanLeg } from "@/components/protection-cards/plan-preview";

const legs = (entries: Array<[string, number]>): PlanLeg[] =>
  entries.map(([token, percent]) => ({ token, percent, region: "", why: "" }));

const held = (entries: Array<[string, number]>) => new Map(entries);

describe("strongerFloorOffer", () => {
  const plan = legs([["cUSD", 30], ["KESm", 50], ["cREAL", 20]]);

  it("returns null below the 10-point surplus", () => {
    // plan floor 30, held 39 → 9-point gap
    expect(
      strongerFloorOffer({
        savedRisk: "Balanced",
        planLegs: plan,
        heldPctByToken: held([["cUSD", 39]]),
      }),
    ).toBeNull();
  });

  it("offers at exactly a 10-point surplus", () => {
    const offer = strongerFloorOffer({
      savedRisk: "Balanced",
      planLegs: plan,
      heldPctByToken: held([["cUSD", 35], ["USDC", 5]]),
    });
    expect(offer).toEqual({ next: "Conservative", heldFloor: 40, planFloor: 30 });
  });

  it("never offers on Conservative — the floor is already strongest", () => {
    expect(
      strongerFloorOffer({
        savedRisk: "Conservative",
        planLegs: plan,
        heldPctByToken: held([["cUSD", 90]]),
      }),
    ).toBeNull();
  });

  it("Aggressive steps to Balanced, not all the way to Conservative", () => {
    const offer = strongerFloorOffer({
      savedRisk: "Aggressive",
      planLegs: plan,
      heldPctByToken: held([["USDC", 60]]),
    });
    expect(offer?.next).toBe("Balanced");
  });

  it("an unset risk tolerance counts as Balanced → Conservative", () => {
    const offer = strongerFloorOffer({
      savedRisk: null,
      planLegs: plan,
      heldPctByToken: held([["cUSD", 80]]),
    });
    expect(offer?.next).toBe("Conservative");
  });

  it("an under-reserved wallet is the gap CTA's job — no offer", () => {
    expect(
      strongerFloorOffer({
        savedRisk: "Balanced",
        planLegs: plan,
        heldPctByToken: held([["cUSD", 10]]),
      }),
    ).toBeNull();
  });
});
