/**
 * Tests for useMacroSignals.
 *
 * The hook wraps useProofFeed (mocked here) and:
 *   1. Filters for `action.startsWith("MACRO_SIGNAL:")` entries
 *   2. Maps the signal type → { type, impact } per the lookup table
 *   3. Extracts the title from the ledger `reasoning` field
 *      (format: "<oneLiner>. Source: <url>")
 *   4. Strips `impactAsset` so signals are universal (bypass the
 *      TradeIntelligence asset filter)
 *   5. Converts the unix `timestamp` to ISO `emittedAt` for the
 *      freshness check
 *
 * We mock useProofFeed so the test runs without the upstream API.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../use-proof-feed", () => ({
  useProofFeed: vi.fn(),
}));

import { useProofFeed } from "../use-proof-feed";
import { useMacroSignals } from "../use-macro-signals";
import type { LedgerRecommendation } from "../use-proof-feed";

const mockUseProofFeed = useProofFeed as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);

const ledgerEntry = (overrides: Partial<LedgerRecommendation> = {}): LedgerRecommendation => ({
  id: 1,
  user: "0x0000000000000000000000000000000000000000",
  action: "MACRO_SIGNAL:RATE_HIKE",
  targetToken: "cEUR",
  reasoning: "ECB raised rates 25bps. Source: https://ecb.example.eu",
  evidenceCid: "",
  servingModel: "firecrawl-monitor",
  settlementTxHash: "0xabc",
  timestamp: now,
  confidence: 0.85,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseProofFeed.mockReturnValue({
    data: null,
    isLoading: false,
    isStale: false,
    error: null,
    refresh: vi.fn(),
  });
});

describe("useMacroSignals", () => {
  it("returns an empty array when the proof feed has no data", () => {
    mockUseProofFeed.mockReturnValue({
      data: null,
      isLoading: true,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("excludes non-macro recommendations (e.g. REBALANCE actions)", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 2, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [
          ledgerEntry({ id: 1, action: "REBALANCE" }),
          ledgerEntry({ id: 2, action: "GUARDIAN_REVIEW" }),
        ],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals).toEqual([]);
  });

  it("maps MACRO_SIGNAL:RATE_HIKE to a negative alert", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [ledgerEntry({ id: 1, action: "MACRO_SIGNAL:RATE_HIKE" })],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals).toHaveLength(1);
    const item = result.current.macroSignals[0];
    expect(item.type).toBe("alert");
    expect(item.impact).toBe("negative");
  });

  it("maps MACRO_SIGNAL:RATE_CUT to a positive alert", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [ledgerEntry({ id: 1, action: "MACRO_SIGNAL:RATE_CUT" })],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals[0].impact).toBe("positive");
    expect(result.current.macroSignals[0].type).toBe("alert");
  });

  it("maps MACRO_SIGNAL:YIELD_CHANGE to a positive impact", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [ledgerEntry({ id: 1, action: "MACRO_SIGNAL:YIELD_CHANGE" })],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals[0].type).toBe("impact");
    expect(result.current.macroSignals[0].impact).toBe("positive");
  });

  it("maps MACRO_SIGNAL:DEPEG_RISK to a negative alert", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [ledgerEntry({ id: 1, action: "MACRO_SIGNAL:DEPEG_RISK" })],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals[0].type).toBe("alert");
    expect(result.current.macroSignals[0].impact).toBe("negative");
  });

  it("extracts the title from the reasoning field (split at '. Source:')", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [
          ledgerEntry({
            id: 1,
            action: "MACRO_SIGNAL:RATE_HIKE",
            reasoning: "ECB raised rates 25bps. Source: https://ecb.example.eu",
          }),
        ],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals[0].title).toBe("ECB raised rates 25bps");
  });

  it("falls back to a humanised signal type when the reasoning has no '. Source:'", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [
          ledgerEntry({
            id: 1,
            action: "MACRO_SIGNAL:INFLATION_SHIFT",
            reasoning: "no source here", // no ". Source:" delimiter
          }),
        ],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals[0].title).toBe("Inflation Shift");
  });

  it("strips impactAsset so signals are universal (bypass the asset filter)", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [ledgerEntry({ id: 1, action: "MACRO_SIGNAL:RATE_HIKE", targetToken: "cEUR" })],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    // Universal: impactAsset is undefined regardless of the ledger targetToken
    expect(result.current.macroSignals[0].impactAsset).toBeUndefined();
  });

  it("converts the unix timestamp to an ISO emittedAt string", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 1, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [ledgerEntry({ id: 1, action: "MACRO_SIGNAL:RATE_HIKE", timestamp: now })],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    const emitted = result.current.macroSignals[0].emittedAt;
    expect(emitted).toBeDefined();
    // Should be parseable as a valid ISO date
    expect(new Date(emitted!).toString()).not.toBe("Invalid Date");
    // Should be within 1s of `now`
    expect(Math.abs(new Date(emitted!).getTime() / 1000 - now)).toBeLessThan(1);
  });

  it("returns isStale from the upstream proof feed", () => {
    mockUseProofFeed.mockReturnValue({
      data: null,
      isLoading: false,
      isStale: true,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.isStale).toBe(true);
  });

  it("maps multiple macro signals and preserves order from the proof feed", () => {
    mockUseProofFeed.mockReturnValue({
      data: {
        stats: { totalRecommendations: 3, contractAddress: "0x", chainId: 1, isDeployed: true },
        recent: [
          ledgerEntry({ id: 1, action: "MACRO_SIGNAL:RATE_HIKE" }),
          ledgerEntry({ id: 2, action: "MACRO_SIGNAL:RATE_CUT" }),
          ledgerEntry({ id: 3, action: "MACRO_SIGNAL:YIELD_CHANGE" }),
        ],
        capturedAt: new Date().toISOString(),
        explorerBase: "https://explorer.example",
        contractExplorer: "https://explorer.example/contract",
      },
      isLoading: false,
      isStale: false,
      error: null,
      refresh: vi.fn(),
    });
    const { result } = renderHook(() => useMacroSignals());
    expect(result.current.macroSignals).toHaveLength(3);
    expect(result.current.macroSignals.map((s) => s.id)).toEqual(["1", "2", "3"]);
    expect(result.current.macroSignals[0].type).toBe("alert");
    expect(result.current.macroSignals[0].impact).toBe("negative");
    expect(result.current.macroSignals[1].impact).toBe("positive");
    expect(result.current.macroSignals[2].type).toBe("impact");
  });
});
