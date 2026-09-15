/**
 * Tests for useSwapController's token-selection synchronization.
 *
 * Regression coverage for the "Different destination needed" deadlock:
 * imperative prefills (Shield → Exchange "Protect" flow) passed symbols
 * through `toUpperCase()`, producing "BRLM"/"USDM" that matched nothing in
 * the mixed-case token lists. The sync effect then rewrote both sides —
 * and its different-token search compared against the *stale* fromToken,
 * so both resets could land on the same list head and lock the CTA.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSwapController } from "../use-swap-controller";

vi.mock("../use-swap", () => ({
  useSwap: () => ({
    swap: vi.fn(),
    error: null,
    txHash: null,
    step: "idle",
  }),
}));

vi.mock("../use-expected-amount-out", () => ({
  useExpectedAmountOut: () => ({ expectedOutput: null, isLoading: false }),
}));

vi.mock("../../context/app/PortfolioContext", () => ({
  useSharedMultichainBalances: () => ({
    tokenMap: {},
    refresh: vi.fn(),
  }),
}));

vi.mock("../use-inflation-data", () => ({
  useInflationData: () => ({
    getInflationRateForStablecoin: () => 0,
    getRegionForStablecoin: () => "",
    dataSource: "static",
  }),
}));

vi.mock("../use-streak-rewards", () => ({
  useStreakRewards: () => ({ recordSwap: vi.fn() }),
}));

const CELO_CHAIN_ID = 42220;

// CELO first — mirroring the held-first ordering real wallets produce
// (SwapTab sorts tokens the user holds to the top of the list).
const CELO_TOKENS = [
  { symbol: "CELO", name: "Celo", region: "Global" },
  { symbol: "USDm", name: "Mento Dollar", region: "USA" },
  { symbol: "BRLm", name: "Mento Brazilian Real", region: "LatAm" },
];

function renderController(overrides: Partial<Parameters<typeof useSwapController>[0]> = {}) {
  return renderHook(() =>
    useSwapController({
      address: "0xtest",
      chainId: CELO_CHAIN_ID,
      availableTokens: CELO_TOKENS,
      enableCrossChain: true,
      ...overrides,
    }),
  );
}

describe("useSwapController — token sync", () => {
  it("heals uppercased prefill symbols to canonical list casing", () => {
    // The Shield → Exchange prefill uppercased "BRLm" into "BRLM", which
    // failed the strict === existence check and got silently rewritten.
    const { result } = renderController();

    act(() => {
      result.current.setFromToken("CELO");
      result.current.setToToken("BRLM");
    });

    expect(result.current.fromToken).toBe("CELO");
    expect(result.current.toToken).toBe("BRLm");
  });

  it("does not collide when both prefilled symbols miss the list", () => {
    // Repro of the reported deadlock: both "USDM" and "BRLM" failed the
    // strict check. The from reset picked list[0] (CELO) and the to reset —
    // comparing ≠ the *stale* "USDM" — picked list[0] too: CELO → CELO.
    const { result } = renderController();

    act(() => {
      result.current.setFromToken("USDM");
      result.current.setToToken("BRLM");
    });

    expect(result.current.fromToken).toBe("USDm");
    expect(result.current.toToken).toBe("BRLm");
    expect(result.current.fromToken).not.toBe(result.current.toToken);
  });

  it("falls back to a destination different from the effective from-token", () => {
    // Unknown symbols on both sides: the to-side fallback must exclude the
    // token the from side just reset to, not the stale prefill value.
    const { result } = renderController();

    act(() => {
      result.current.setFromToken("NOPE");
      result.current.setToToken("ALSO_NOPE");
    });

    expect(result.current.fromToken).toBe("CELO"); // list[0]
    expect(result.current.toToken).not.toBe("CELO"); // ≠ effective from
    expect(result.current.toToken).toBe("USDm");
  });

  it("keeps a valid destination when only the from-token needed reset", () => {
    const { result } = renderController();

    act(() => {
      result.current.setFromToken("USDM");
      result.current.setToToken("BRLm");
    });

    expect(result.current.fromToken).toBe("USDm");
    expect(result.current.toToken).toBe("BRLm");
  });
});
