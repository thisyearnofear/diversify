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

const profileState = {
  riskTolerance: "Balanced" as "Conservative" | "Balanced" | "Aggressive",
};
const mockSetRiskTolerance = vi.fn();
vi.mock("@/hooks/use-protection-profile", () => ({
  consumeRetiredPhilosophyNotice: () => false,
  useProtectionProfile: () => ({
    mode: "view" as const,
    currentStep: 0,
    config: {
      userGoal: "inflation_protection",
      riskTolerance: profileState.riskTolerance,
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
    setRiskTolerance: mockSetRiskTolerance,
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
const mockNavigateToGuardian = vi.fn();
const mockConsumeCompareRequest = vi.fn();
const navState = { compareRequested: false };
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    navigateToSwap: mockNavigateToSwap,
    navigateToGuardian: mockNavigateToGuardian,
    compareRequested: navState.compareRequested,
    consumeCompareRequest: mockConsumeCompareRequest,
  }),
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

vi.mock("@/components/tabs/protect/ProtectionPlanRing", async () => {
  const { ARCHETYPES, strategyToArchetype } = await import(
    "@/components/protection-cards/tokens"
  );
  return {
    SLEEVE_ID: "sleeve",
    VAULT_SLICE_PREFIX: "vault:",
    isSleeveSelection: (id: string | null | undefined) =>
      id === "sleeve" || Boolean(id?.startsWith("vault:")),
    ProtectionPlanRing: ({
      strategyKey,
      selectedToken,
      onSelectToken,
      alignmentScore,
      holeHintOverride,
      onHoleTap,
    }: {
      strategyKey: string | null;
      selectedToken: string | null;
      onSelectToken: (token: string | null) => void;
      alignmentScore?: number | null;
      holeHintOverride?: string;
      onHoleTap?: () => void;
    }) => {
      const archetypeId = strategyToArchetype(strategyKey);
      const name = archetypeId ? ARCHETYPES[archetypeId].name : "";
      const hole =
        onHoleTap && !selectedToken
          ? React.createElement(
              "button",
              {
                type: "button",
                "data-testid": "ring-hole",
                onClick: onHoleTap,
              },
              React.createElement("span", null, name),
              holeHintOverride
                ? React.createElement("span", null, holeHintOverride)
                : null,
              alignmentScore != null
                ? React.createElement("span", null, `${alignmentScore}%`)
                : null,
            )
          : null;
      const selectButton = (token: string, testid: string) =>
        React.createElement(
          "button",
          {
            type: "button",
            "data-testid": testid,
            onClick: () =>
              onSelectToken(selectedToken === token ? null : token),
          },
          token.toLowerCase(),
        );
      const badge = onHoleTap
        ? React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "plan-badge",
              onClick: onHoleTap,
            },
            name,
          )
        : null;
      return React.createElement(
        "div",
        { "data-testid": "protection-plan-ring" },
        badge,
        hole,
        React.createElement(
          "div",
          null,
          selectButton("KESm", "ring-select-kesm"),
          selectButton("WETH", "ring-select-weth"),
          selectButton("PAXG", "ring-select-paxg"),
          selectButton("cREAL", "ring-select-creal"),
        ),
      );
    },
  };
});

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

// Mutable reduced-motion flag — flipped per-test, not globally (the fold
// animation's mid-exit styles are part of an existing assertion).
const reducedMotionState = { on: false };
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => reducedMotionState.on };
});

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
            React.Fragment,
            null,
            React.createElement(
              "button",
              {
                type: "button",
                "data-testid": "inspect-africapitalism",
                onClick: () => onInspect("africapitalism"),
              },
              "Inspect Africapitalism",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                "data-testid": "plan-card-buen_vivir",
                onClick: () => onInspect("buen_vivir"),
              },
              "Inspect Buen Vivir",
            ),
          )
        : null,
    ),
}));

vi.mock("@/components/agent/GuardianMobileWizard", () => ({
  GuardianMobileWizard: () =>
    React.createElement("div", { "data-testid": "guardian-mobile-wizard" }),
}));

vi.mock("@/components/tabs/protect/ProfileWizard", () => ({
  default: () => React.createElement("div", { "data-testid": "profile-wizard" }),
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
import { createEmptyPortfolio } from "@/hooks/use-multichain-balances";

const EMPTY_PORTFOLIO = createEmptyPortfolio();

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
    navState.compareRequested = false;
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

  it("on-target slice: the CTA is Guardian monitoring, not a dead end", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    // KESm 600/1000 = 60% held vs 60% plan → on target.
    const onTarget = {
      ...MOCK_PORTFOLIO,
      totalValue: 1000,
      chains: [
        {
          chainId: 42220,
          chainName: "Celo",
          totalValue: 1000,
          tokenCount: 1,
          balances: [{ symbol: "KESm", value: 600, chainId: 42220 }],
        },
      ],
    } as any;
    render(<ProtectionTab userRegion="USA" portfolio={onTarget} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    const cta = screen.getByRole("button", { name: "Have Guardian keep this aligned" });
    fireEvent.click(cta);
    expect(screen.getByTestId("guardian-mobile-wizard")).toBeInTheDocument();
  });

  it("on-target slice while monitoring: the CTA carries the slice into Guardian", () => {
    mockFinancialStrategy = "africapitalism";
    mockGuardianState = "monitoring";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    const onTarget = {
      ...MOCK_PORTFOLIO,
      totalValue: 1000,
      chains: [
        {
          chainId: 42220,
          chainName: "Celo",
          totalValue: 1000,
          tokenCount: 1,
          balances: [{ symbol: "KESm", value: 600, chainId: 42220 }],
        },
      ],
    } as any;
    render(<ProtectionTab userRegion="USA" portfolio={onTarget} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    fireEvent.click(screen.getByRole("button", { name: "See Guardian activity" }));
    expect(mockNavigateToGuardian).toHaveBeenCalledTimes(1);
    expect(mockNavigateToGuardian.mock.calls[0][0]?.summary).toContain("KESm");
    expect(mockNavigateToGuardian.mock.calls[0][0]?.prompt).toContain("KESm");
  });

  it("outside-plan slice: the primary CTA asks Guardian what to do", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-select-weth"));
    expect(screen.getByText(/Outside the plan/)).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: "Ask Guardian what to do with WETH" });
    fireEvent.click(cta);
    expect(mockAdvisor).toHaveBeenCalledWith(expect.stringContaining("WETH"));
  });

  it("empty-wallet slice: the CTA is fund-the-plan, not a dead end", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(
      screen.getByRole("button", { name: /Fund this plan/ }),
    ).toBeInTheDocument();
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
    // Aligned = the wallet's token split matches the plan legs
    // (africapitalism: KESm 60 / cUSD 25 / cEUR 15).
    render(
      <ProtectionTab
        userRegion="USA"
        portfolio={{
          ...MOCK_PORTFOLIO,
          totalValue: 1000,
          chains: [
            {
              chainId: 42220,
              chainName: "Celo",
              totalValue: 1000,
              tokenCount: 3,
              balances: [
                { symbol: "KESm", value: 600, chainId: 42220 },
                { symbol: "cUSD", value: 250, chainId: 42220 },
                { symbol: "cEUR", value: 150, chainId: 42220 },
              ],
            },
          ],
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

  it("gap idle: one CTA beneath the ring — close the biggest gap — none in the status tier", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    // MOCK_PORTFOLIO vs africapitalism (KESm 60 / cUSD 25 / cEUR 15):
    // KESm is 20% held → the 40pt gap is the biggest.
    const cta = screen.getByTestId("shield-biggest-gap-cta");
    expect(cta.textContent).toContain("KESm");
    expect(cta.textContent).toContain("$2,000");
    // The CTA belongs to the object, not the status tier.
    expect(
      screen.getByTestId("shield-ring").contains(cta),
    ).toBe(true);
    // The CTA names the job — no duplicate sentence, no second CTA.
    expect(screen.queryByText("Tap a slice to close the gap.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up Guardian" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardian activity" })).not.toBeInTheDocument();

    // Selecting it opens the inspector with that slice's CTA; the
    // object's CTA steps aside (the button says the job — §3).
    fireEvent.click(cta);
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByText("KESm position")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review move to KESm/ })).toBeInTheDocument();
    expect(screen.queryByTestId("shield-biggest-gap-cta")).not.toBeInTheDocument();
  });

  it("scores a live wallet's config ticker (USDm) against the cUSD leg", () => {
    mockFinancialStrategy = "buen_vivir";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    // Live Celo balances report USDm — the same contract as the plan's cUSD leg.
    const usdmPortfolio = {
      ...MOCK_PORTFOLIO,
      chains: [
        {
          chainId: 42220,
          chainName: "Celo",
          totalValue: 1000,
          tokenCount: 1,
          balances: [{ symbol: "USDm", value: 1000, chainId: 42220 }],
        },
      ],
    };
    render(<ProtectionTab userRegion="USA" portfolio={usdmPortfolio} />);

    // 100% USDm vs buen_vivir (cUSD 20 leg) scores exactly like 100% cUSD: 20.
    // Before canonicalisation this scored 0 — the wallet's whole balance read
    // as outside the plan.
    const hole = screen.getByTestId("ring-hole");
    expect(hole.textContent).toContain("20%");
  });

  it("leg-why explains a plan slice but not an RWA slice (which explains itself)", () => {
    mockFinancialStrategy = "islamic";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    // PAXG is an islamic plan leg AND an RWA asset — its own copy wins.
    fireEvent.click(screen.getByTestId("ring-select-paxg"));
    expect(screen.getByTestId("rwa-leg")).toBeInTheDocument();
    expect(screen.queryByTestId("leg-why")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ring-select-paxg"));

    mockFinancialStrategy = "africapitalism";
    cleanup();
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(screen.getByTestId("leg-why")).toHaveTextContent(
      "Kenyan shilling — wealth stays home",
    );
  });

  it("tapping the ring centre enters compare mode without committing", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    expect(screen.getByTestId("shield-compare")).toBeInTheDocument();
    expect(screen.getByTestId("shield-ring")).toHaveAttribute("data-comparing", "true");
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
    const statusLine = screen.getByTestId("shield-compare-status");
    expect(statusLine.textContent).toContain("Keep Africapitalism");
    // Exactly the escape — no other CTA in the status tier.
    expect(screen.queryByTestId("shield-biggest-gap-cta")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up Guardian" })).not.toBeInTheDocument();
  });

  it("inspecting a card re-slices the ring preview and 'Use this plan' commits", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    const hole = screen.getByTestId("ring-hole");
    expect(hole.textContent).toContain("Africapitalism");
    // Committed plan scores 30 on this wallet.
    expect(hole.textContent).toContain("30%");

    fireEvent.click(screen.getByTestId("plan-card-buen_vivir"));
    expect(hole.textContent).toContain("Buen Vivir");
    expect(hole.textContent).toContain("under this plan");
    // Buen Vivir (cREAL/COPm/cUSD) overlaps this wallet less — score differs.
    expect(hole.textContent).toContain("10%");

    fireEvent.click(screen.getByRole("button", { name: "Use this plan" }));
    expect(mockSetFinancialStrategy).toHaveBeenCalledWith("buen_vivir");
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
  });

  it("'Keep <Name>' exits compare mode without committing", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    fireEvent.click(screen.getByTestId("plan-card-buen_vivir"));
    fireEvent.click(screen.getByRole("button", { name: /Keep Africapitalism/ }));
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
  });

  it("opens compare mode when a Home deep link requested it", () => {
    mockFinancialStrategy = "africapitalism";
    navState.compareRequested = true;
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    expect(screen.getByTestId("shield-compare")).toBeInTheDocument();
    expect(screen.getByTestId("shield-ring")).toHaveAttribute("data-comparing", "true");
    expect(mockConsumeCompareRequest).toHaveBeenCalled();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
  });

  it("consumes a compare request without entering compare when there is no plan", () => {
    mockFinancialStrategy = null;
    navState.compareRequested = true;
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    expect(screen.getByTestId("shield-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
    expect(mockConsumeCompareRequest).toHaveBeenCalled();
  });

  it("header plan badge enters compare and exits it again", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    const badge = screen.getByTestId("plan-badge");
    fireEvent.click(badge);
    expect(screen.getByTestId("shield-compare")).toBeInTheDocument();
    expect(screen.getByTestId("shield-ring")).toHaveAttribute("data-comparing", "true");

    fireEvent.click(screen.getByTestId("plan-badge"));
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
  });

  it("fund shape: compare mode replaces the fund block, exit restores it", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.getByTestId("shield-fund")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ring-hole"));
    expect(screen.getByTestId("shield-compare")).toBeInTheDocument();
    expect(screen.queryByTestId("shield-fund")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Keep Africapitalism/ }));
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
    expect(screen.getByTestId("shield-fund")).toBeInTheDocument();
  });

  it("dollar-floor dial sits under the ring and drives setRiskTolerance", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    const dial = screen.getByTestId("plan-floor-control");
    // Under the ring, above the status tier — inside the object column.
    expect(screen.getByTestId("shield-ring").contains(dial)).toBe(true);
    expect(dial).toHaveTextContent("Dollar floor · 25%");
    expect(
      screen.getByRole("radio", { name: "Balanced" }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: "Conservative" }));
    expect(mockSetRiskTolerance).toHaveBeenCalledWith("Conservative");
    cleanup();

    // After the profile updates, the caption follows the adjusted legs.
    profileState.riskTolerance = "Conservative";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("plan-floor-control")).toHaveTextContent(
      "Dollar floor · 40%",
    );
    profileState.riskTolerance = "Balanced";
  });

  it("dial is hidden while comparing; delta + values + leg row in the inspector", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42161, // Arbitrum — cREAL isn't deployed there
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    expect(screen.queryByTestId("plan-floor-control")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("plan-card-buen_vivir"));
    expect(screen.getByTestId("plan-delta")).toHaveTextContent(
      "Swaps KESm, cEUR → cREAL, COPm · dollar floor 25% → 20%",
    );
    const values = screen.getByTestId("plan-values");
    expect(values).toHaveTextContent("Collective prosperity");
    expect(values.querySelectorAll("span").length).toBe(3);

    // Slice tap while comparing reads the previewed leg — no CTA.
    fireEvent.click(screen.getByTestId("ring-select-creal"));
    const legRow = screen.getByTestId("compare-leg");
    expect(legRow).toHaveTextContent("cREAL · 45% — Brazil's real — the LatAm anchor");
    // cREAL isn't deployed on Celo — honesty line, not a block.
    expect(screen.getByTestId("leg-unfillable")).toHaveTextContent(
      "Not on this network — needs a bridge",
    );
  });

  it("leg-unfillable shows on the slice inspector for a token absent on this chain", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42161, // Arbitrum — KESm isn't there
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(screen.getByTestId("leg-unfillable")).toBeInTheDocument();
    cleanup();

    // On Celo the same leg IS fillable — no honesty line.
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(screen.queryByTestId("leg-unfillable")).not.toBeInTheDocument();
  });

  it("reduced motion: compare mode renders the same instrument ids", () => {
    reducedMotionState.on = true;
    try {
      mockFinancialStrategy = "africapitalism";
      vi.mocked(useWalletContext).mockReturnValue({
        address: "0xabc",
        chainId: 42220,
      } as any);
      render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
      fireEvent.click(screen.getByTestId("ring-hole"));
      expect(screen.getByTestId("shield-compare")).toBeInTheDocument();
      expect(screen.getByTestId("shield-compare-status")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("plan-card-buen_vivir"));
      expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use this plan" })).toBeInTheDocument();
    } finally {
      reducedMotionState.on = false;
    }
  });
});
