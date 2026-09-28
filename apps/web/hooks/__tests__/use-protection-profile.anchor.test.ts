import { afterEach, describe, expect, it } from "vitest";
import { loadAnchorCurrency, loadPhilosophy } from "../use-protection-profile";

const KEY = "diversifi-protection-profile-v2";

afterEach(() => localStorage.clear());

describe("protection profile — anchorCurrency", () => {
  it("profiles saved before the field existed load unchanged, with no anchor", () => {
    localStorage.setItem(KEY, JSON.stringify({ philosophy: "africapitalism", riskTolerance: "Balanced" }));
    expect(loadAnchorCurrency()).toBeNull();
    expect(loadPhilosophy()).toBe("africapitalism");
  });

  it("reads a saved anchor from the same storage key", () => {
    localStorage.setItem(KEY, JSON.stringify({ philosophy: "africapitalism", anchorCurrency: "KES" }));
    expect(loadAnchorCurrency()).toBe("KES");
  });
});
