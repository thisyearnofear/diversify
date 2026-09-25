/**
 * The Celo quote path must be honest: it calls the swap orchestrator and,
 * on failure, surfaces noRoute + a null output — never a static-rate
 * fallback number.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getEstimate: vi.fn(),
}));

vi.mock("@diversifi/shared/src/services/swap/swap-orchestrator.service", () => ({
  SwapOrchestratorService: { getEstimate: mocks.getEstimate },
}));

vi.mock("@diversifi/shared/src/services/swap/provider-factory.service", () => ({
  ProviderFactoryService: {
    isWalletConnected: vi.fn(async () => true),
    // Mutable — tests pick the chain the hook reports.
    getCurrentChainId: vi.fn(async () => (globalThis as any).__testChainId ?? null),
  },
}));

import { useExpectedAmountOut } from "../use-expected-amount-out";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle(ms = 600) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  // flush the quote promise + state updates
  await act(async () => {});
}

describe("useExpectedAmountOut — Celo honest quotes", () => {
  it("returns the orchestrator's output and provider", async () => {
    mocks.getEstimate.mockResolvedValue({
      expectedOutput: "121.8",
      provider: "Uniswap V3",
      priceImpact: 0.3,
    });
    const { result } = renderHook(() =>
      useExpectedAmountOut({ fromToken: "CELO", toToken: "KESm", amount: "10" }),
    );
    await settle();
    expect(mocks.getEstimate).toHaveBeenCalledWith(
      expect.objectContaining({
        fromToken: "CELO",
        toToken: "KESm",
        amount: "10",
        fromChainId: 42220,
        toChainId: 42220,
      }),
    );
    expect(result.current.expectedOutput).toBe("121.8");
    expect(result.current.provider).toBe("Uniswap V3");
    expect(result.current.noRoute).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("a no-route failure yields a null output and noRoute — no fabricated number", async () => {
    const err = new Error("Not enough liquidity for CELO/KESm on Uniswap V3 at this size");
    (err as { errorClass?: string }).errorClass = "no-route";
    mocks.getEstimate.mockRejectedValue(err);
    const { result } = renderHook(() =>
      useExpectedAmountOut({ fromToken: "CELO", toToken: "KESm", amount: "1000" }),
    );
    await settle();
    expect(result.current.expectedOutput).toBeNull();
    expect(result.current.noRoute).toBe(true);
    expect(result.current.error).toContain("Not enough liquidity");
  });

  it("a market-closed failure yields null output + marketClosed, never noRoute", async () => {
    const err = new Error("Mento FX market is closed — quotes resume when FX markets reopen.");
    (err as { errorClass?: string }).errorClass = "market_closed";
    mocks.getEstimate.mockRejectedValue(err);
    const { result } = renderHook(() =>
      useExpectedAmountOut({ fromToken: "USDm", toToken: "KESm", amount: "10" }),
    );
    await settle();
    expect(result.current.expectedOutput).toBeNull();
    expect(result.current.marketClosed).toBe(true);
    expect(result.current.noRoute).toBe(false);
  });

  it("a non-route failure still yields null output but noRoute stays false", async () => {
    mocks.getEstimate.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() =>
      useExpectedAmountOut({ fromToken: "USDm", toToken: "KESm", amount: "10" }),
    );
    await settle();
    expect(result.current.expectedOutput).toBeNull();
    expect(result.current.noRoute).toBe(false);
  });
});

describe("useExpectedAmountOut — Arbitrum honest quotes", () => {
  it("calls the orchestrator on the connected chain — no price-based math", async () => {
    (globalThis as any).__testChainId = 42161;
    mocks.getEstimate.mockResolvedValue({
      expectedOutput: "0.02298",
      provider: "Uniswap V3",
      priceImpact: 0.4,
    });
    const { result } = renderHook(() =>
      useExpectedAmountOut({ fromToken: "USDC", toToken: "PAXG", amount: "100" }),
    );
    await settle();
    expect(mocks.getEstimate).toHaveBeenCalledWith(
      expect.objectContaining({
        fromToken: "USDC",
        toToken: "PAXG",
        fromChainId: 42161,
        toChainId: 42161,
      }),
    );
    expect(result.current.expectedOutput).toBe("0.02298");
    expect(result.current.provider).toBe("Uniswap V3");
    (globalThis as any).__testChainId = null;
  });

  it("Arbitrum no-route (USDC -> USDY) yields null output + noRoute", async () => {
    (globalThis as any).__testChainId = 42161;
    const err = new Error("No swap routes found");
    (err as { errorClass?: string }).errorClass = "no-route";
    mocks.getEstimate.mockRejectedValue(err);
    const { result } = renderHook(() =>
      useExpectedAmountOut({ fromToken: "USDC", toToken: "USDY", amount: "100" }),
    );
    await settle();
    expect(result.current.expectedOutput).toBeNull();
    expect(result.current.noRoute).toBe(true);
    (globalThis as any).__testChainId = null;
  });
});
