import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

let mockFinancialStrategy: string | null = null;
let mockMoneyPurpose = "inflation_protection";
let mockGuardianState = "idle";
const mockAdvisor = vi.fn();
const mockSetFinancialStrategy = vi.fn();
vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ askAdvisor: mockAdvisor }),
}));

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    mode: "view" as const,
    currentStep: 0,
    config: {
      userGoal: "inflation_protection",
      riskTolerance: "medium",
      timeHorizon: "medium",
      moneyPurpose: mockMoneyPurpose,
    },
    isComplete: false,
    currentGoalLabel: "Inflation Protection",
    currentGoalIcon: "🛡️",
    currentRiskLabel: "Medium",
    currentTimeHorizonLabel: "Medium",
    startEditing: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    skipToEnd: vi.fn(),
    completeEditing: vi.fn(),
    setUserGoal: vi.fn(),
    setRiskTolerance: vi.fn(),
    setTimeHorizon: vi.fn(),
  }),
  USER_GOALS: [
    { value: "inflation_protection", label: "Inflation Hedge", icon: "🛡️" },
    {
      value: "geographic_diversification",
      label: "Geographic Diversification",
      icon: "🌍",
    },
  ],
}));

vi.mock("@/hooks/use-streak-rewards", () => ({
  useStreakRewards: () => ({
    streak: 0,
    canClaim: false,
    isWhitelisted: false,
    estimatedReward: "0",
    recordActivity: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/useFinancialStrategies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useFinancialStrategies")>();
  return {
    ...actual,
    useFinancialStrategies: () => ({
      strategies: actual.STRATEGIES,
      selectedStrategy: null,
      getStrategyById: vi.fn(() => null),
    }),
  };
});

vi.mock("@diversifi/shared", () => ({
  StrategyService: {
    calculateScore: vi.fn(() => ({ score: 75, feedback: [] })),
    getRecommendedAssets: vi.fn(() => []),
    getConfig: vi.fn(() => ({ targetAllocations: [] })),
  },
  GUARDIAN_TIER_STATE_LABELS: {
    idle: "Not Started",
    authorized: "Approved",
    funded: "Funded",
    monitoring: "Active",
  },
  GUARDIAN_USER_FACING_LABELS: {
    setup: "Not protecting yet",
    active: "Protection on",
  },
  collapseGuardianTierForUser: (state: string) =>
    state === "monitoring" ? "active" : "setup",
  GUARDIAN_USER_COPY: {
    idle: { headline: "Set up", description: "Start", cta: "Set up", hint: "" },
    authorized: { headline: "Add funds", description: "Deposit", cta: "Deposit", hint: "" },
    funded: { headline: "Turn on", description: "Enable", cta: "Turn on", hint: "" },
    monitoring: { headline: "On", description: "Active", cta: "View", hint: "" },
  },
  WALLET_CONNECT_COPY: {
    activatePlan: (name: string) => `Connect to activate ${name}`,
    generic: "Connect your wallet",
    startProtecting: "Connect to start",
  },
}));

vi.mock("@/hooks/use-agent-status", () => ({
  useAgentStatus: () => ({ isLoading: false }),
}));

const mockNavigateToSwap = vi.fn();
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({ navigateToSwap: mockNavigateToSwap }),
}));

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({
    financialStrategy: mockFinancialStrategy,
    setFinancialStrategy: mockSetFinancialStrategy,
  }),
}));

vi.mock("@/components/agent/AgentTierStatus", () => ({
  GuardianStatusChip: () =>
    React.createElement("div", { "data-testid": "guardian-status-chip" }),
  useGuardianTierSnapshotFrom: () => ({ guardianState: mockGuardianState }),
  AgentTierStatus: () => null,
}));

vi.mock("@/hooks/use-vault", () => ({
  useVault: () => ({
    vault: null,
    refresh: vi.fn(),
    createVault: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-session-key", () => ({
  useSessionKey: () => ({
    requestPermission: vi.fn(),
    signedPermission: null,
    sessionInfo: null,
    deriveGuardianState: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-currency-risk", () => ({
  useCurrencyRisk: () => ({ riskData: null, primaryDepreciation: 0 }),
}));

vi.mock("@/components/tabs/protect/ProtectionPlanRing", () => ({
  ProtectionPlanRing: ({
    selectedToken,
    onSelectToken,
  }: {
    selectedToken: string | null;
    onSelectToken: (token: string | null) => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "protection-plan-ring" },
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "ring-select-kesm",
          onClick: () => onSelectToken(selectedToken === "KESm" ? null : "KESm"),
        },
        selectedToken ? `ring:${selectedToken}` : "ring:idle",
      ),
    ),
}));

// Mutable demo flag for the demo-honesty tests below.
const demoState = { isActive: false };
vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({
    demoMode: demoState,
    enableDemoMode: vi.fn(() => {
      demoState.isActive = true;
    }),
    disableDemoMode: vi.fn(() => {
      demoState.isActive = false;
    }),
  }),
}));

vi.mock("@/context/app/ExperienceContext", () => ({
  useExperience: () => ({ experienceMode: "advanced" }),
}));

const mockShowToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    const Dummy = () => React.createElement("div", null, "DynamicComponent");
    Dummy.displayName = "DynamicMock";
    return Dummy;
  },
}));

vi.mock("../../shared/GuardianMascot", () => ({
  GuardianMascot: ({
    mood,
  }: {
    size: number;
    mood?: string;
  }) =>
    React.createElement("div", {
      "data-testid": "guardian-mascot",
      "data-mood": mood,
    }),
}));

vi.mock("@/components/tabs/protect/ProtectionPlanGallery", () => ({
  ProtectionPlanGallery: ({
    onInspect,
  }: {
    onInspect?: (id: string) => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "protection-plan-gallery" },
      onInspect
        ? React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "inspect-africapitalism",
              onClick: () => onInspect("africapitalism"),
            },
            "Inspect Africapitalism",
          )
        : null,
    ),
}));

vi.mock("@/components/tabs/protect/ProfileWizard", () => ({
  default: () => React.createElement("div", { "data-testid": "profile-wizard" }),
}));

vi.mock("@/components/portfolio/MultichainPortfolioBreakdown", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "portfolio-breakdown" }),
}));

vi.mock("@/components/earn/YieldDiscoverySection", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "yield-discovery" }),
}));

vi.mock("@/components/tabs/protect/RwaAssetCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/tabs/protect/RwaAssetCards")>();
  return {
    ...actual,
    default: () => React.createElement("div", { "data-testid": "rwa-cards" }),
  };
});

vi.mock("@/components/tabs/protect/OptimizationInsight", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "optimization-insight" }),
}));

vi.mock("@/components/portfolio/PortfolioRecommendations", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "portfolio-recommendations" }),
}));

vi.mock("@/components/ui/EmptyState", () => ({
  default: () => React.createElement("div", { "data-testid": "empty-state" }),
}));

vi.mock("@/components/ui/skeletons/ProtectionSkeleton", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "protection-skeleton" }),
}));

vi.mock("@/components/shared/DashboardCard", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dashboard-card" }, children),
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: ({
    variant,
  }: {
    variant: string;
  }) =>
    React.createElement("div", {
      "data-testid": "wallet-button",
      "data-variant": variant,
    }),
}));

import { useWalletContext } from "../../wallet/WalletProvider";
vi.mock("../../wallet/WalletProvider", () => ({
  useWalletContext: vi.fn(),
}));

import ProtectionTab from "../ProtectionTab";

const EMPTY_PORTFOLIO = {
  totalValue: 0,
  chainCount: 0,
  chains: [],
  regionData: [],
  isLoading: false,
  isStale: false,
  rebalancingOpportunities: [],
  diversificationScore: 0,
  weightedInflationRisk: 0,
  tokenCount: 0,
} as any;

const MOCK_PORTFOLIO = {
  totalValue: 5000,
  chainCount: 2,
  chains: [
    {
      chainId: 42220,
      chainName: "Celo",
      totalValue: 3000,
      tokenCount: 3,
      balances: [
        { symbol: "USDC", value: 1500, chainId: 42220 },
        { symbol: "KESm", value: 1000, chainId: 42220 },
        { symbol: "cUSD", value: 500, chainId: 42220 },
      ],
    },
    {
      chainId: 42161,
      chainName: "Arbitrum",
      totalValue: 2000,
      tokenCount: 2,
      balances: [
        { symbol: "USDC", value: 1200, chainId: 42161 },
        { symbol: "WETH", value: 800, chainId: 42161 },
      ],
    },
  ],
  regionData: [
    { region: "USA", usdValue: 2000, value: 2000, color: "#6366f1" },
    { region: "ke", usdValue: 1000, value: 1000, color: "#a855f7" },
    { region: "global", usdValue: 2000, value: 2000, color: "#ec4899" },
  ],
  isLoading: false,
  isStale: false,
  rebalancingOpportunities: [],
  diversificationScore: 65,
  weightedInflationRisk: 5,
  tokenCount: 5,
} as any;

describe("ProtectionTab — instrument shapes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialStrategy = null;
    mockMoneyPurpose = "inflation_protection";
    mockGuardianState = "idle";
    demoState.isActive = false;
    vi.mocked(useWalletContext).mockReturnValue({
      address: null,
      chainId: null,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it("unconnected: the philosophy picker is still the object (§5 rail 5 morph)", () => {
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(document.body).toBeTruthy();
    // Rail 5: unconnected is a morph — the picker stays the object walletless
    // and the connect CTA attaches to it. No hero-card stack.
    expect(screen.getByTestId("shield-picker")).toBeInTheDocument();
    expect(screen.getByTestId("shield-unconnected-object")).toBeInTheDocument();
  });

  it("shows the plan picker when connected with no philosophy", () => {
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.getByTestId("shield-picker")).toBeInTheDocument();
    expect(screen.getByTestId("protection-plan-gallery")).toBeInTheDocument();
    expect(screen.queryByTestId("shield-ring")).not.toBeInTheDocument();
    expect(screen.queryByTestId("yield-discovery")).not.toBeInTheDocument();
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
  });

  it("inspects a plan then commits with Use this plan", () => {
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("inspect-africapitalism"));
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("protection-calculator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this plan" })).toBeInTheDocument();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Use this plan" }));
    expect(mockSetFinancialStrategy).toHaveBeenCalledWith("africapitalism");
  });

  it("nudges the wallet when a plan exists but the wallet is empty", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.getByTestId("shield-ring")).toBeInTheDocument();
    expect(screen.getByTestId("shield-fund")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy address" })).toBeInTheDocument();
    expect(screen.queryByTestId("shield-picker")).not.toBeInTheDocument();
  });

  it("shows the ring, not a feature catalog, when holdings exist", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("shield-ring")).toBeInTheDocument();
    expect(screen.queryByTestId("shield-picker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("yield-discovery")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rwa-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("portfolio-recommendations")).not.toBeInTheDocument();
  });

  it("selection rewrites the artefact: slice tap opens the gap inspector with the one CTA (§5 rail 2)", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    // Idle: sheet closed — empty selection is a closed sheet, not closed rows.
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();

    // Select the KESm slice: 20% held vs 60% plan → 40pts light.
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByText("KESm position")).toBeInTheDocument();
    expect(screen.getByText(/40 points light/)).toBeInTheDocument();
    // The one CTA: a single review action carrying the gap magnitude.
    const review = screen.getByRole("button", { name: /Review move to KESm/ });
    expect(review).toBeInTheDocument();
    expect(review.textContent).toContain("~$2,000");
    expect(screen.getAllByRole("button", { name: /Review move to/ })).toHaveLength(1);

    // Tap the slice again: selection clears — the sheet unmounts, or (mid-exit
    // fold in jsdom) is collapsed to nothing. Both are "closed" to the user.
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    const sheetAfterDeselect = screen.queryByTestId("inspector-sheet");
    if (sheetAfterDeselect) {
      expect(sheetAfterDeselect.style.height).toBe("0px");
      expect(sheetAfterDeselect.style.opacity).toBe("0");
    }
  });

  it("persona morphs the inspector: payment cycle rides the selected slice, no module meta-talk (§5 rail 4)", () => {
    mockMoneyPurpose = "upcoming_payment";
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(screen.getByText("Payment cycle")).toBeInTheDocument();
    // The design-contract aside is gone (§3): the badge alone names it.
    expect(screen.queryByText(/not a module/)).not.toBeInTheDocument();
  });

  it("is quiet when aligned and Guardian is monitoring", () => {
    mockFinancialStrategy = "africapitalism";
    mockGuardianState = "monitoring";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(
      <ProtectionTab
        userRegion="USA"
        portfolio={{
          ...MOCK_PORTFOLIO,
          diversificationScore: 95,
          weightedInflationRisk: 0,
        }}
      />,
    );
    expect(screen.getByTestId("shield-quiet")).toBeInTheDocument();
  });

  it("no meta-lectures: the pipeline footer and design-contract asides are gone (§3)", () => {
    // Picker shape renders the real gallery (not the test stub) — the only
    // way to assert its internal chrome is absent.
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.queryByText(/matches your worldview/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Same JSX renders here/)).not.toBeInTheDocument();
    expect(screen.getByText("Choose a protection philosophy")).toBeInTheDocument();
  });

  it("freshness is the shell's DRY slot, rendered exactly once (§5 rail 6)", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(
      <ProtectionTab
        userRegion="USA"
        portfolio={{ ...MOCK_PORTFOLIO, lastUpdated: Date.now() }}
      />,
    );
    expect(screen.getAllByTestId("data-freshness")).toHaveLength(1);
    expect(screen.getByText("Wallet data live")).toBeInTheDocument();
  });

  it("demo mode never claims live wallet data — the badge reads 'Sample data' (honesty rail)", () => {
    demoState.isActive = true;
    render(
      <ProtectionTab
        userRegion="USA"
        portfolio={{ ...MOCK_PORTFOLIO, lastUpdated: Date.now() }}
      />,
    );
    const badge = screen.getByTestId("data-freshness");
    expect(badge.textContent).toContain("Sample data");
    expect(badge.textContent).not.toContain("live");
    // No refresh affordance on data that is not real.
    expect(badge.querySelector("button")).toBeNull();
  });

  it("connected mode still claims live data (demo marker does not leak)", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(
      <ProtectionTab
        userRegion="USA"
        portfolio={{ ...MOCK_PORTFOLIO, lastUpdated: Date.now() }}
      />,
    );
    expect(screen.getByText("Wallet data live")).toBeInTheDocument();
  });
});
