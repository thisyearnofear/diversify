import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { SwapPrefill } from "@/context/app/types";

// ──────────────────────────────────────────────────────────────────────────
// Mutable mock state — referenced by the vi.mock factories below. Tests
// update these variables and rerender the component to trigger the
// prefill useEffect under different scenarios.
// ──────────────────────────────────────────────────────────────────────────

let mockSwapPrefill: SwapPrefill | null = null;
let mockWalletChainId: number | null = 42161; // Arbitrum
let mockIsMiniPay = false;
let mockAddress: string | null = "0xtest";
let mockSwitchNetworkEnabled = true;
const mockSwitchNetwork = vi.fn(async (_chainId: number) => {});

const mockSetSwapPrefill = vi.fn((p: SwapPrefill | null) => {
  mockSwapPrefill = p;
});

// ──────────────────────────────────────────────────────────────────────────
// Hook + context mocks
// ──────────────────────────────────────────────────────────────────────────

vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    swapPrefill: mockSwapPrefill,
    setSwapPrefill: mockSetSwapPrefill,
    clearSwapPrefill: () => {
      mockSwapPrefill = null;
    },
    activeTab: "exchange",
    visitedTabs: ["exchange"],
    chainId: mockWalletChainId,
    setActiveTab: vi.fn(),
    setChainId: vi.fn(),
    initializeFromStorage: vi.fn(),
    focusedCycleId: null,
    setFocusedCycleId: vi.fn(),
    focusedYieldKey: null,
    setFocusedYieldKey: vi.fn(),
    navigateToSwap: vi.fn(),
  }),
  FOCUS_HIGHLIGHT_MS: 1500,
}));

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({
    address: mockAddress,
    chainId: mockWalletChainId,
    switchNetwork: mockSwitchNetworkEnabled ? mockSwitchNetwork : undefined,
    isMiniPay: mockIsMiniPay,
    isConnected: !!mockAddress,
    isConnecting: false,
    isFarcaster: false,
    farcasterContext: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signMessage: vi.fn(),
    formatAddress: vi.fn(),
    error: null,
  }),
}));

vi.mock("@/hooks/use-swap", () => ({
  useSwap: () => ({
    swap: vi.fn(),
    isLoading: false,
    error: null,
    txHash: null,
    step: "idle",
  }),
}));

vi.mock("@/hooks/use-streak-rewards", () => ({
  useStreakRewards: () => ({
    streak: 0,
    canClaim: false,
    isWhitelisted: false,
    estimatedReward: "0",
    recordSwap: vi.fn(),
    recordActivity: vi.fn(),
  }),
}));

vi.mock("@/hooks/claim-flow-context", () => ({
  useClaimFlowContext: () => ({
    flow: { handleClaim: vi.fn() },
    handleClaim: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: {
      userGoal: "inflation_protection",
      userRegion: "GHS",
      riskTolerance: "medium",
      timeHorizon: "medium",
    },
    isComplete: false,
  }),
}));

vi.mock("@/context/app/ExperienceContext", () => ({
  useExperience: () => ({
    experienceMode: "advanced",
    recordSwap: vi.fn(),
    shouldShowAdvancedFeatures: () => true,
    shouldShowIntermediateFeatures: () => true,
  }),
}));

vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({
    demoMode: { isActive: false },
    enableDemoMode: vi.fn(),
  }),
}));

vi.mock("@/context/app/PortfolioContext", () => ({
  useSharedMultichainBalances: () => ({
    chains: [],
    goalScores: { hedge: 0, diversify: 0, rwa: 0 },
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-tradeable-tokens", () => ({
  useTradeableTokens: () => ({ tradeableSymbols: [], isLoading: false }),
  filterTradeableTokens: (tokens: unknown) => tokens,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useMobile: () => false,
}));

vi.mock("@/hooks/use-in-view", () => ({
  useInView: () => ({ ref: { current: null }, inView: false }),
}));

vi.mock("@/hooks/use-social-resolve", () => ({
  useSocialResolve: () => ({ resolveIdentifier: vi.fn() }),
}));

vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ askAdvisor: vi.fn() }),
}));

vi.mock("@/hooks/useFinancialStrategies", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useFinancialStrategies")>();
  return {
    ...actual,
    useFinancialStrategies: () => ({
      strategies: [],
      selectedStrategy: null,
      getStrategyById: vi.fn(() => null),
    }),
    getPersistedStrategy: () => null,
  };
});

// NOTE: SwapTab imports the deep paths (@diversifi/shared/src/services/...)
// directly, NOT the barrel. So the barrel mock was dead weight — the
// mocks below are the ones that actually intercept.
vi.mock("@diversifi/shared/src/services/swap/chain-detection.service", () => ({
  ChainDetectionService: {
    isArbitrum: (id: number | null) => id === 42161,
    isCelo: (id: number | null) => id === 42220,
    isCrossChain: (from: number | null, to: number | null) =>
      from !== null && to !== null && from !== to,
    isSupported: () => true,
    getNetworkName: () => "Network",
    getChainType: () => "evm",
  },
}));

vi.mock("@diversifi/shared/src/services/strategy/strategy.service", () => ({
  StrategyService: {
    calculateScore: vi.fn(() => ({ score: 0, feedback: [] })),
    getRecommendedAssets: vi.fn(() => []),
    getConfig: vi.fn(() => ({ targetAllocations: [] })),
  },
}));

// ──────────────────────────────────────────────────────────────────────────
// Child component mocks
// ──────────────────────────────────────────────────────────────────────────

// SwapInterface is a forwardRef — the prefill useEffect calls ref.setTokens.
// We need to populate the ref so the useEffect's guard passes.
vi.mock("@/components/swap/SwapInterface", () => {
  // The factory runs after top-level imports are evaluated, so React is
  // in scope. Use the typed forwardRef generic instead of `any` to keep
  // the mock strongly typed.
  const MockSwapInterface = React.forwardRef<unknown, unknown>(
    (_props, ref) => {
      React.useImperativeHandle(ref, () => ({
        refreshBalances: vi.fn(),
        getSelectedTokens: () => ({ fromToken: "cUSD", toToken: "USDC" }),
        setTokens: vi.fn(),
      }));
      return React.createElement("div", {
        "data-testid": "mock-swap-interface",
      });
    },
  );
  MockSwapInterface.displayName = "MockSwapInterface";
  return { default: MockSwapInterface };
});

vi.mock("@/components/swap/ChainBalancesHeader", () => ({
  default: () => null,
}));

vi.mock("@/components/swap/NetworkSwitcher", () => ({
  default: () => null,
}));

vi.mock("@/components/swap/SwapStatusPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/swap/GoalAlignmentBanner", () => ({
  default: () => null,
}));

vi.mock("@/components/earn/YieldDiscoverySection", () => ({
  default: () => null,
}));

vi.mock("@/components/swap/YieldBridgePrompt", () => ({
  default: () => null,
}));

vi.mock("@/components/swap/SwapInsightsPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/swap/SocialContactPicker", () => ({
  SocialContactPicker: () => null,
}));

vi.mock("@/components/swap/SwapSuccessCelebration", () => ({
  default: () => null,
}));

vi.mock("@/components/rewards/StreakRewardsCard", () => ({
  StreakRewardsSection: () => null,
}));

vi.mock("@/components/ui/ExperienceModeNotification", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/MobileCollapsible", () => ({
  MobileCollapsible: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/ErrorBoundary", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/onramp/DepositHub", () => ({
  default: () => null,
}));

vi.mock("@/components/shared/TabComponents", () => ({
  TabHeader: () => null,
  Card: ({ children }: { children: React.ReactNode }) => children,
  ConnectWalletPrompt: () => null,
  Skeleton: () => null,
  Section: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: () => null,
}));

// ──────────────────────────────────────────────────────────────────────────
// Import the component under test AFTER all mocks
// ──────────────────────────────────────────────────────────────────────────

import SwapTab from "../SwapTab";

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe("SwapTab prefill — wallet auto-switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSwapPrefill = null;
    mockWalletChainId = 42161; // Arbitrum (the "current" chain)
    mockIsMiniPay = false;
    mockAddress = "0xtest";
    mockSwitchNetworkEnabled = true;
  });

  afterEach(() => {
    cleanup();
  });

  it("switches the wallet to fromChainId when a bridge prefill arrives (not toChainId)", () => {
    // Render with no prefill.
    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );
    expect(mockSwitchNetwork).not.toHaveBeenCalled();

    // Dispatch a cross-chain bridge prefill: source Celo, destination
    // Arbitrum. Wallet is currently on Arbitrum — must move to Celo to
    // sign the bridge.
    mockSwapPrefill = {
      fromToken: "cUSD",
      toToken: "USDC",
      fromChainId: 42220, // Celo (source)
      toChainId: 42161, // Arbitrum (destination)
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    expect(mockSwitchNetwork).toHaveBeenCalledTimes(1);
    expect(mockSwitchNetwork).toHaveBeenCalledWith(42220); // fromChainId
    expect(mockSwitchNetwork).not.toHaveBeenCalledWith(42161); // NOT toChainId
  });

  it("does NOT switch the wallet when only toChainId is set (yield-review case)", () => {
    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );

    // Yield-review prefill: only the destination chain is set. The
    // wallet is already the source for a bridge from the current
    // chain to the yield's chain. Switching to the destination
    // would strand the user with no source balance.
    mockSwapPrefill = {
      toChainId: 42161, // Arbitrum (destination)
      // No fromChainId — the wallet's current chain stays as source.
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    expect(mockSwitchNetwork).not.toHaveBeenCalled();
  });

  it("does NOT switch the wallet when fromChainId equals walletChainId (no-op)", () => {
    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );

    // Same-chain prefill: fromChainId == walletChainId, so no switch.
    mockSwapPrefill = {
      fromToken: "USDC",
      toToken: "EURm",
      fromChainId: 42161,
      toChainId: 42161,
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    expect(mockSwitchNetwork).not.toHaveBeenCalled();
  });

  it("does NOT switch the wallet for MiniPay users (Celo-only)", () => {
    mockIsMiniPay = true;
    mockWalletChainId = 42220; // Celo — MiniPay native

    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );

    // Bridge prefill pointing off Celo — but MiniPay can't switch.
    mockSwapPrefill = {
      fromChainId: 42161, // Arbitrum — MiniPay cannot switch to this
      toChainId: 42161,
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    expect(mockSwitchNetwork).not.toHaveBeenCalled();
  });

  it("does NOT switch the wallet when the wallet is disconnected (address null, ref not populated)", () => {
    // Disconnected wallet: no address, no chain. The SwapInterface
    // doesn't render, so swapInterfaceRef.current is null, and the
    // outer useEffect guard `swapInterfaceRef.current?.setTokens` is
    // false — so the entire block (including the wallet switch) is
    // skipped. The wallet switch cannot fire without the form being
    // pre-filled.
    mockAddress = null;
    mockWalletChainId = null;

    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );

    mockSwapPrefill = {
      fromToken: "cUSD",
      toToken: "USDC",
      fromChainId: 42220, // Celo
      toChainId: 42161, // Arbitrum
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    expect(mockSwitchNetwork).not.toHaveBeenCalled();
  });

  it("does NOT call switchNetwork when it is undefined (defensive guard)", () => {
    // Some wallet providers may not expose switchNetwork (e.g. certain
    // embedded wallets, or before the SDK is ready). The inner
    // `&& switchNetwork` guard should prevent the call rather than
    // crash with "Cannot read property of undefined".
    mockSwitchNetworkEnabled = false; // makes switchNetwork undefined in the context

    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );

    mockSwapPrefill = {
      fromChainId: 42220, // Celo
      toChainId: 42161, // Arbitrum
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    expect(mockSwitchNetwork).not.toHaveBeenCalled();
  });

  it("calls setSwapPrefill(null) after consuming the prefill (one-shot)", () => {
    // The useEffect ends with `setSwapPrefill(null)` so the same
    // prefill doesn't re-trigger on subsequent renders. Verify the
    // setter was called with null after the prefill arrives.
    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );

    expect(mockSetSwapPrefill).not.toHaveBeenCalledWith(null);

    mockSwapPrefill = {
      fromToken: "cUSD",
      toToken: "USDC",
      fromChainId: 42220,
      toChainId: 42161,
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    // Confirm the setter was actually called (not just that *if* it was
    // called, the argument was null). This catches a regression where
    // the implementation accidentally drops the `setSwapPrefill(null)`
    // line — `toHaveBeenCalledWith(null)` alone would still pass in
    // that case if the mock had been called with null in a prior test.
    expect(mockSetSwapPrefill).toHaveBeenCalled();
    expect(mockSetSwapPrefill).toHaveBeenCalledWith(null);
  });

  it("logs a console.warn and still consumes the prefill when switchNetwork rejects", async () => {
    // The implementation's fire-and-forget catch logs a warning but
    // doesn't re-throw — the prefill should still be consumed (one-
    // shot, form still pre-filled). This documents the best-effort
    // contract so a future refactor doesn't silently break it.
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    mockSwitchNetwork.mockRejectedValueOnce(
      new Error("User rejected wallet prompt"),
    );

    const { rerender } = render(
      <SwapTab userRegion="USA" inflationData={{}} />,
    );

    mockSwapPrefill = {
      fromToken: "cUSD",
      toToken: "USDC",
      fromChainId: 42220, // Celo
      toChainId: 42161, // Arbitrum
    };
    rerender(<SwapTab userRegion="USA" inflationData={{}} />);

    // setSwapPrefill(null) is called synchronously after the effect
    // runs — verify immediately.
    expect(mockSetSwapPrefill).toHaveBeenCalledWith(null);

    // The .catch handler runs asynchronously; wait for it.
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[SwapTab] auto-switch to fromChainId failed:"),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
