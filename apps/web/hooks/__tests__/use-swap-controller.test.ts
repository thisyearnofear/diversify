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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSwapController } from "../use-swap-controller";

// The underlying hook's step is mutable so tests can drive the
// controller's status-sync effect through its real code path.
let mockSwapStep = "idle";
const mockSwapReset = vi.fn(() => {
  mockSwapStep = "idle";
});

vi.mock("../use-swap", () => ({
  useSwap: () => ({
    swap: vi.fn(),
    error: null,
    txHash: null,
    step: mockSwapStep,
    reset: mockSwapReset,
  }),
}));

// Mutable so tests can drive quote states (provider attribution, noRoute).
const mockQuote: {
  expectedOutput: string | null;
  provider: string | null;
  noRoute: boolean;
} = { expectedOutput: null, provider: null, noRoute: false };

vi.mock("../use-expected-amount-out", () => ({
  useExpectedAmountOut: () => ({
    expectedOutput: mockQuote.expectedOutput,
    provider: mockQuote.provider,
    noRoute: mockQuote.noRoute,
    isLoading: false,
  }),
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

beforeEach(() => {
  mockSwapStep = "idle";
  mockSwapReset.mockClear();
  mockQuote.expectedOutput = null;
  mockQuote.provider = null;
  mockQuote.noRoute = false;
  sessionStorage.clear();
});

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

describe("useSwapController — initial amount + completion", () => {
  it("starts with an empty amount — any amount forces the ticket", () => {
    // Regression: the "10" default meant forcedTicket in SwapInterface
    // was true for every visitor, so nobody ever saw the pair stage.
    const { result } = renderController();
    expect(result.current.amount).toBe("");
  });

  it("acknowledgeCompletion holds idle — the hook step is reset, not just status", () => {
    const { result, rerender } = renderController();

    // Drive the real sync path: hook step 'completed' → status completed.
    act(() => {
      mockSwapStep = "completed";
    });
    rerender();
    expect(result.current.status).toBe("completed");

    act(() => {
      result.current.acknowledgeCompletion();
    });
    rerender();
    expect(result.current.status).toBe("idle");
    expect(mockSwapReset).toHaveBeenCalled();

    // The hook no longer reports 'completed', so the sync effect cannot
    // bounce the controller back on the next render.
    rerender();
    expect(result.current.status).toBe("idle");
  });
});

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

describe("useSwapController — unsupported wallet chain", () => {
  // Repro of the production failure: wallet on Ethereum mainnet (chainId
  // 1) got adopted into the ticket's from/to chains, then execution sent
  // Celo token addresses (KESm/COPm) to 1inch on chain 1 → UNKNOWN_TOKEN.
  it("does not adopt an unsupported wallet chain into the ticket", () => {
    const { result } = renderController({ chainId: 1 });

    expect(result.current.fromChainId).toBe(CELO_CHAIN_ID);
    expect(result.current.toChainId).toBe(CELO_CHAIN_ID);
  });

  it("still serves the available (Celo-fallback) token list on an unsupported chain", () => {
    const { result } = renderController({ chainId: 1 });

    // availableTokens is what getChainAssets() produced for the wallet —
    // the Celo fallback list for unknown chains. The ticket chain is
    // Celo, so the from/to lists should be that list verbatim (native
    // CELO stays selectable), not the cross-chain registry.
    expect(result.current.availableFromTokens).toEqual(CELO_TOKENS);
    expect(result.current.availableToTokens).toEqual(CELO_TOKENS);
  });

  it("follows the wallet when it later moves to a supported chain", () => {
    const { result, rerender } = renderHook(
      ({ chainId }: { chainId: number }) =>
        useSwapController({
          address: "0xtest",
          chainId,
          availableTokens: CELO_TOKENS,
          enableCrossChain: true,
        }),
      { initialProps: { chainId: 1 } },
    );

    expect(result.current.fromChainId).toBe(CELO_CHAIN_ID);

    rerender({ chainId: 42161 }); // Arbitrum — supported

    expect(result.current.fromChainId).toBe(42161);
    expect(result.current.toChainId).toBe(42161);
  });
});

describe("useSwapController — session pair persistence", () => {
  const KEY = "diversifi.exchange.pair";

  it("restores a stored pair in canonical list casing", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ fromToken: "usdm", toToken: "brlm" }),
    );
    const { result } = renderController();

    expect(result.current.fromToken).toBe("USDm");
    expect(result.current.toToken).toBe("BRLm");
  });

  it("ignores a stored pair whose symbols aren't both in the list", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ fromToken: "USDm", toToken: "ZZZ" }),
    );
    const { result } = renderController();

    // Falls back to the defaults and the sync effect repairs, not the
    // stored pair.
    expect(result.current.toToken).not.toBe("ZZZ");
    expect(result.current.fromToken).not.toBe(result.current.toToken);
  });

  it("persists the pair on every change", () => {
    const { result } = renderController();

    act(() => {
      result.current.setFromToken("BRLm");
      result.current.setToToken("USDm");
    });

    expect(sessionStorage.getItem(KEY)).toBe(
      JSON.stringify({ fromToken: "BRLm", toToken: "USDm" }),
    );
  });

  it("a setTokens-style override beats the stored pair", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ fromToken: "USDm", toToken: "BRLm" }),
    );
    const { result } = renderController();

    act(() => {
      result.current.setFromToken("CELO");
      result.current.setToToken("USDm");
    });

    expect(result.current.fromToken).toBe("CELO");
    expect(result.current.toToken).toBe("USDm");
  });

  it("restores the stored pair when the token list arrives after mount", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ fromToken: "BRLm", toToken: "USDm" }),
    );
    const { result, rerender } = renderHook(
      ({ tokens }: { tokens: typeof CELO_TOKENS }) =>
        useSwapController({ address: "0xtest", chainId: CELO_CHAIN_ID, availableTokens: tokens }),
      { initialProps: { tokens: [] as unknown as typeof CELO_TOKENS } },
    );
    // The empty first render must not overwrite the stored pair.
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({ fromToken: "BRLm", toToken: "USDm" });

    rerender({ tokens: CELO_TOKENS });
    expect(result.current.fromToken).toBe("BRLm");
    expect(result.current.toToken).toBe("USDm");
  });

  it("the sync effect keeps a valid restored pair across rerenders", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ fromToken: "USDm", toToken: "BRLm" }),
    );
    const { result, rerender } = renderController();

    rerender();
    rerender();
    expect(result.current.fromToken).toBe("USDm");
    expect(result.current.toToken).toBe("BRLm");
  });
});

const WIDE_TOKENS = [
  { symbol: "CELO", name: "Celo", region: "Global" },
  { symbol: "USDm", name: "Mento Dollar", region: "USA" },
  { symbol: "BRLm", name: "Mento Brazilian Real", region: "LatAm" },
  { symbol: "KESm", name: "Mento Kenyan Shilling", region: "Africa" },
];

describe("useSwapController — quote-driven routing", () => {
  it("a resolved quote's provider is authoritative for routeProvider", () => {
    mockQuote.expectedOutput = "1.5";
    mockQuote.provider = "Uniswap V3";
    const { result } = renderController();
    expect(result.current.routeProvider).toBe("Uniswap V3");
  });

  it("quoteNoRoute offers via-hub for CELO -> KESm (only KESm is a Mento asset)", () => {
    mockQuote.noRoute = true;
    const { result } = renderController({ availableTokens: WIDE_TOKENS });
    act(() => {
      result.current.setFromToken("CELO");
      result.current.setToToken("KESm");
    });
    expect(result.current.quoteNoRoute).toBe(true);
    expect(result.current.viaHub).toBe("USDm");
  });

  it("quoteNoRoute does NOT offer via-hub for KESm -> BRLm (both Mento assets)", () => {
    mockQuote.noRoute = true;
    const { result } = renderController({ availableTokens: WIDE_TOKENS });
    act(() => {
      result.current.setFromToken("KESm");
      result.current.setToToken("BRLm");
    });
    expect(result.current.quoteNoRoute).toBe(true);
    expect(result.current.viaHub).toBeNull();
  });

  it("no via-hub offer without a failure — a healthy quote stands", () => {
    const { result } = renderController({ availableTokens: WIDE_TOKENS });
    act(() => {
      result.current.setFromToken("CELO");
      result.current.setToToken("KESm");
    });
    expect(result.current.viaHub).toBeNull();
  });
});
