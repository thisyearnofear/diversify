import { describe, expect, it } from "vitest";
import { GUARDIAN_SCENARIOS, evaluateScenario } from "./guardian-scenarios.fixtures";

const byName = (name: string) => evaluateScenario(GUARDIAN_SCENARIOS.find((s) => s.name === name)!);

describe("Guardian scenario suite (canned replies through the server gate)", () => {
  it("has ~20 fixed scenarios", () => {
    expect(GUARDIAN_SCENARIOS.length).toBeGreaterThanOrEqual(20);
  });

  it.each(GUARDIAN_SCENARIOS.map((s) => [s.name, s] as const))("hard pass: %s", (_name, scenario) => {
    expect(evaluateScenario(scenario).hardFailures).toEqual([]);
  });

  it("guided: gold goes up in every shock scenario and never in calm ones", () => {
    const guided = GUARDIAN_SCENARIOS.map((s) => evaluateScenario(s)).filter((r) => r.guidedPass !== null);
    expect(guided.length).toBeGreaterThanOrEqual(6);
    expect(guided.filter((r) => !r.guidedPass).map((r) => r.name)).toEqual([]);
  });

  it("gold is an ordinary exposure that resolves to PAXG on Arbitrum — even from a Celo-only wallet", () => {
    const r = byName("Celo-only wallet · Pan-Caribbean gold");
    expect(r.plan.tilts[0].instrument).toEqual({ symbol: "PAXG", chainId: 42161 });
    expect(r.plan.nextMove?.instrument).toEqual({ symbol: "PAXG", chainId: 42161 });
  });

  it("Celo-only wallet fills a euro tilt on Celo", () => {
    expect(byName("Celo-only wallet · Africapitalism euro").plan.tilts[0].instrument?.chainId).toBe(42220);
  });

  it("Islamic plan with yield signals: the dollar tilt resolves to a non-yield dollar", () => {
    const r = byName("Islamic with yield signals present");
    expect(r.plan.tilts[0].instrument?.symbol).not.toMatch(/USDY|SYRUP/i);
  });

  it("oversized, invented, off-plan and ticker tilts become observations", () => {
    expect(byName("shock · model oversizes gold (+10)").plan.rejected.map((x) => x.reason)).toEqual(["over_max"]);
    expect(byName("shock · model invents the gold move").plan.rejected.map((x) => x.reason)).toEqual(["evidence_mismatch"]);
    const offPlan = byName("model tilts off-plan (JPY)").plan;
    expect(offPlan.rejected.map((x) => x.reason)).toEqual(["not_in_plan"]);
    expect(offPlan.offPlan).toEqual({ reason: "Yen carry unwind" });
    expect(byName("model names a ticker instead of an exposure").plan.rejected.map((x) => x.reason)).toEqual(["not_in_plan"]);
  });

  it("a next move larger than the wallet is held back; the tilts still ship", () => {
    const r = byName("devaluation · Africapitalism · Celo-only").plan;
    expect(r.tilts.map((t) => t.exposure)).toEqual(["KES", "USD"]);
    expect(r.nextMove).toBeNull();
    expect(r.rejected).toEqual([expect.objectContaining({ kind: "nextMove", reason: "amount_invalid" })]);
  });

  it("model failure: nothing ships, nothing is rejected", () => {
    const r = byName("model returns nothing (failure)").plan;
    expect([r.tilts, r.rejected, r.nextMove]).toEqual([[], [], null]);
  });
});
