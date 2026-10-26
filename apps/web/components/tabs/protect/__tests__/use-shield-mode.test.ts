import { describe, expect, it } from "vitest";
import type { CustomPlan } from "@/components/protection-cards/plan-preview";
import { REST, shieldModeReducer, type ShieldMode } from "../use-shield-mode";
import { SLEEVE_ID, VAULT_SLICE_PREFIX } from "../ProtectionPlanRing";

const CUSTOM: CustomPlan = {
  from: null,
  slices: [],
  rules: {},
} as CustomPlan;

const startCustom = {
  type: "startCustom",
  draft: CUSTOM,
  seed: CUSTOM,
  seedLabel: null,
  seededFromWallet: false,
  resume: null,
} as const;

describe("shieldModeReducer", () => {
  it("moves rest → slice → rest on slice taps", () => {
    const slice = shieldModeReducer(REST, { type: "selectSlice", token: "USDm" });
    expect(slice).toEqual({ kind: "slice", token: "USDm" });
    expect(shieldModeReducer(slice, { type: "selectSlice", token: null })).toBe(REST);
  });

  it("steps a vault slice back to the sleeve instead of closing", () => {
    const vault: ShieldMode = { kind: "slice", token: `${VAULT_SLICE_PREFIX}ixs-1` };
    expect(shieldModeReducer(vault, { type: "selectSlice", token: null })).toEqual({
      kind: "slice",
      token: SLEEVE_ID,
    });
  });

  it("toggles compare on and off, and toggles a compare slice token", () => {
    const compare = shieldModeReducer(REST, { type: "toggleCompare" });
    expect(compare).toEqual({
      kind: "compare",
      focus: { id: null, details: false },
      token: null,
    });
    const picked = shieldModeReducer(compare, { type: "selectSlice", token: "PAXG" });
    expect(picked).toMatchObject({ kind: "compare", token: "PAXG" });
    // Same token again clears the selection but stays in compare.
    expect(shieldModeReducer(picked, { type: "selectSlice", token: "PAXG" })).toMatchObject({
      kind: "compare",
      token: null,
    });
    expect(shieldModeReducer(picked, { type: "toggleCompare" })).toBe(REST);
  });

  it("opens details on the second tap of the same philosophy", () => {
    const first = shieldModeReducer(REST, { type: "focusPhilosophy", id: "global" });
    expect(first).toEqual({ kind: "rest", focus: { id: "global", details: false } });
    const second = shieldModeReducer(first, { type: "focusPhilosophy", id: "global" });
    expect(second).toEqual({ kind: "rest", focus: { id: "global", details: true } });
    // A different coin drops details and previews instead.
    const third = shieldModeReducer(second, { type: "focusPhilosophy", id: "islamic" });
    expect(third).toEqual({ kind: "rest", focus: { id: "islamic", details: false } });
  });

  it("starts the custom editor from compare", () => {
    const compare = shieldModeReducer(REST, { type: "toggleCompare" });
    const custom = shieldModeReducer(compare, startCustom);
    expect(custom).toMatchObject({
      kind: "custom",
      draft: CUSTOM,
      addingSlice: false,
      token: null,
    });
    // Cancel returns to the coin the editor was opened from (the
    // walletless picker reads it as resumeFocus on remount); a
    // standalone build resumes nowhere.
    expect(shieldModeReducer(custom, { type: "cancelCustom" })).toEqual(REST);
    const resumed = shieldModeReducer(compare, { ...startCustom, resume: "islamic" });
    expect(shieldModeReducer(resumed, { type: "cancelCustom" })).toEqual({
      kind: "rest",
      focus: { id: "islamic", details: false },
    });
  });

  it("ignores slice taps while the cycle report owns the shell", () => {
    const cycle = shieldModeReducer(REST, { type: "openCycle", report: "next" });
    expect(cycle).toEqual({ kind: "cycle", report: "next" });
    expect(shieldModeReducer(cycle, { type: "selectSlice", token: "USDm" })).toBe(cycle);
    expect(shieldModeReducer(cycle, { type: "closeCycle" })).toBe(REST);
  });

  it("never discards a floor draft for the cycle intent", () => {
    const floor = shieldModeReducer(REST, { type: "previewFloor", risk: "Aggressive" });
    expect(floor).toEqual({ kind: "floor", draft: "Aggressive" });
    expect(shieldModeReducer(floor, { type: "openCycle", report: "next" })).toBe(floor);
  });

  it("arms the floor preview straight from rest", () => {
    const floor = shieldModeReducer(REST, { type: "previewFloor", risk: "Conservative" });
    expect(floor).toEqual({ kind: "floor", draft: "Conservative" });
    expect(shieldModeReducer(floor, { type: "closeFloor" })).toBe(REST);
  });
});
