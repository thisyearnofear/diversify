// @vitest-environment jsdom
/**
 * useSignalDetector — content routing: the only thing personas change in
 * the dock's world is which Shield surface leads. `shieldMorph` is "cycle"
 * for business personas (importer, BPO, payment-purpose) and "plan" for
 * everyone else — never a tab reorder.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

const m = vi.hoisted(() => ({
  countryCode: "GH" as string | null,
  moneyPurpose: null as string | null,
  currencyCode: "GHS",
}));

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({ address: null, chainId: null }),
}));

vi.mock("../use-user-region", () => ({
  useUserRegion: () => ({
    countryCode: m.countryCode,
    countryName: null,
    region: null,
    detectionMethod: "none",
  }),
}));

vi.mock("../use-currency-risk", () => ({
  useCurrencyRisk: () => ({
    riskData: { code: m.currencyCode, flag: "" },
  }),
}));

vi.mock("../use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: {
      philosophy: null,
      userGoal: null,
      moneyPurpose: m.moneyPurpose,
      riskTolerance: null,
    },
  }),
}));

import { useSignalDetector } from "../use-signal-detector";

beforeEach(() => {
  m.countryCode = "GH";
  m.moneyPurpose = null;
  m.currencyCode = "GHS";
});

describe("useSignalDetector — content.shieldMorph", () => {
  it("ghanaian_importer → cycle", () => {
    m.countryCode = "GH";
    const { result } = renderHook(() => useSignalDetector());
    expect(result.current.persona).toBe("ghanaian_importer");
    expect(result.current.config.content.shieldMorph).toBe("cycle");
  });

  it("philippine_bpo → cycle", () => {
    m.countryCode = "PH";
    m.currencyCode = "PHP";
    m.moneyPurpose = "upcoming_payment";
    const { result } = renderHook(() => useSignalDetector());
    expect(result.current.persona).toBe("philippine_bpo");
    expect(result.current.config.content.shieldMorph).toBe("cycle");
  });

  it("non-business personas → plan", () => {
    m.countryCode = "US";
    m.currencyCode = "USD";
    const { result } = renderHook(() => useSignalDetector());
    expect(result.current.persona).toBe("us_saver");
    expect(result.current.config.content.shieldMorph).toBe("plan");
  });

  it("upcoming_payment overrides a plan persona to cycle", () => {
    m.countryCode = "US";
    m.currencyCode = "USD";
    m.moneyPurpose = "upcoming_payment";
    const { result } = renderHook(() => useSignalDetector());
    expect(result.current.config.content.shieldMorph).toBe("cycle");
  });

  it("the config carries nothing but persona, contextualBanner and shieldMorph", () => {
    const { result } = renderHook(() => useSignalDetector());
    expect(Object.keys(result.current.config).sort()).toEqual(["content", "persona"]);
    expect(Object.keys(result.current.config.content).sort()).toEqual([
      "contextualBanner",
      "shieldMorph",
    ]);
  });
});
