import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

let mockRouterQuery: Record<string, string> = {};
vi.mock("next/router", () => ({
  useRouter: () => ({ isReady: true, query: mockRouterQuery }),
}));

const mockVisibility = vi.hoisted(() => ({ current: "quiet" as "quiet" | "informed" }));
vi.mock("@/context/app/GuardianVisibilityContext", () => ({
  useGuardianVisibility: () => ({
    visibility: mockVisibility.current,
    origin: "persona",
    setVisibility: vi.fn(),
  }),
}));

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
const mockTrackFunnelEvent = vi.fn();
vi.mock("@/lib/analytics", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/analytics")>();
  return {
    ...mod,
    trackFunnelEvent: (...args: unknown[]) =>
      mockTrackFunnelEvent(...(args as [string, Record<string, string>?])),
  };
});
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
const mockConsumeIntent = vi.fn();
const navState: {
  pendingIntent: { tab: string; intent: { source: string; region?: string; asset?: string; lens?: "compare" | "netting" } } | null;
} = { pendingIntent: null };
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    navigateToSwap: mockNavigateToSwap,
    navigateToGuardian: mockNavigateToGuardian,
    pendingIntent: navState.pendingIntent,
    consumeIntent: mockConsumeIntent,
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

const mockSessionInfo = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/hooks/use-session-key", () => ({
  useSessionKey: () => ({
    requestPermission: vi.fn(),
    signedPermission: null,
    sessionInfo: mockSessionInfo.current,
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
      legs,
      balancePreview,
      savedLegs,
      sinceHint,
      controls,
    }: {
      strategyKey: string | null;
      selectedToken: string | null;
      onSelectToken: (token: string | null) => void;
      alignmentScore?: number | null;
      holeHintOverride?: string;
      onHoleTap?: () => void;
      legs?: { token: string; percent: number }[];
      balancePreview?: boolean;
      savedLegs?: { token: string; percent: number }[];
      sinceHint?: string;
      controls?: React.ReactNode;
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
        {
          "data-testid": "protection-plan-ring",
          "data-balance-preview": String(Boolean(balancePreview)),
          "data-legs": JSON.stringify((legs ?? []).map((l) => [l.token, l.percent])),
          "data-saved-legs": JSON.stringify((savedLegs ?? []).map((l) => [l.token, l.percent])),
          "data-selected": selectedToken ?? "",
        },
        badge,
        hole,
        sinceHint
          ? React.createElement(
              "span",
              { "data-testid": "shield-since-last-visit" },
              sinceHint,
            )
          : null,
        React.createElement(
          "div",
          null,
          selectButton("KESm", "ring-select-kesm"),
          selectButton("WETH", "ring-select-weth"),
          selectButton("PAXG", "ring-select-paxg"),
          selectButton("cREAL", "ring-select-creal"),
        ),
        controls,
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
    navState.pendingIntent = null;
    mockRouterQuery = {};
    mockSessionInfo.current = null;
    mockVisibility.current = "quiet";
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

  it("?sleeve=rwa&serv=1 opens the sleeve inspector with SERV armed — the /rwa-vaults doorway lands walletless", () => {
    mockRouterQuery = { sleeve: "rwa", serv: "1" };
    // No wallet, no plan — the doorway still opens the sleeve inspector.
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);

    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("rwa-vault-sleeve")).toBeInTheDocument();
    // SERV armed: the rail is in-flight or honestly degraded — never the
    // "Get a deeper allocation →" opt-in affordance.
    expect(screen.getByTestId("serv-rail").textContent).toMatch(
      /deeper|unavailable/i,
    );
  });

  it("?sleeve=rwa alone opens the sleeve with SERV off — free heuristic first", () => {
    mockRouterQuery = { sleeve: "rwa" };
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);

    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("rwa-vault-sleeve")).toBeInTheDocument();
    expect(screen.getByTestId("serv-enhance")).toBeInTheDocument();
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

  it("opens compare mode when a compare-lens intent arrives", () => {
    mockFinancialStrategy = "africapitalism";
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", lens: "compare" },
    };
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    expect(screen.getByTestId("shield-compare")).toBeInTheDocument();
    expect(screen.getByTestId("shield-ring")).toHaveAttribute("data-comparing", "true");
    expect(mockConsumeIntent).toHaveBeenCalled();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
  });

  it("consumes a compare-lens intent without entering compare when there is no plan", () => {
    mockFinancialStrategy = null;
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", lens: "compare" },
    };
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    expect(screen.getByTestId("shield-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
    expect(mockConsumeIntent).toHaveBeenCalled();
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

  it("balance dial previews in the same ring; only Use this balance commits", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    const dial = screen.getByTestId("plan-floor-control");
    // Under the ring, above the status tier — inside the object column.
    expect(screen.getByTestId("protection-plan-ring").contains(dial)).toBe(true);
    expect(dial).toHaveTextContent("Dollar reserve · 25%");
    expect(
      screen.getByRole("radio", { name: "Balanced" }),
    ).toHaveAttribute("aria-checked", "true");
    const ring = screen.getByTestId("protection-plan-ring");
    expect(ring).toHaveAttribute("data-balance-preview", "false");
    expect(ring).toHaveAttribute(
      "data-legs",
      JSON.stringify([["KESm", 60], ["cUSD", 25], ["cEUR", 15]]),
    );

    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
    expect(profileState.riskTolerance).toBe("Balanced");
    expect(ring).toHaveAttribute("data-balance-preview", "true");
    expect(ring).toHaveAttribute(
      "data-legs",
      JSON.stringify([["KESm", 48], ["cUSD", 40], ["cEUR", 12]]),
    );
    expect(dial).toHaveTextContent("Dollar reserve 25% → 40%");
    expect(screen.queryByTestId("shield-biggest-gap-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shield-fund")).not.toBeInTheDocument();
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    expect(mockNavigateToSwap).not.toHaveBeenCalled();
    expect(mockNavigateToGuardian).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(ring).toHaveAttribute("data-selected", "KESm");
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    expect(mockNavigateToSwap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Use this balance" }));
    expect(mockSetRiskTolerance).toHaveBeenCalledTimes(1);
    expect(mockSetRiskTolerance).toHaveBeenCalledWith("Conservative");
    expect(mockShowToast).toHaveBeenCalledWith(
      "Balance saved. Your holdings have not moved.",
      "success",
    );
    cleanup();

    // After the profile updates, the caption follows the adjusted legs.
    profileState.riskTolerance = "Conservative";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "false",
    );
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-legs",
      JSON.stringify([["KESm", 48], ["cUSD", 40], ["cEUR", 12]]),
    );
    expect(screen.getByTestId("plan-floor-control")).toHaveTextContent(
      "Dollar reserve · 40%",
    );
    profileState.riskTolerance = "Balanced";
  });

  it("Keep current balance discards the draft and restores the saved ring", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep current balance" }));
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
    const ring = screen.getByTestId("protection-plan-ring");
    expect(ring).toHaveAttribute("data-balance-preview", "false");
    expect(ring).toHaveAttribute(
      "data-legs",
      JSON.stringify([["KESm", 60], ["cUSD", 25], ["cEUR", 15]]),
    );
    expect(screen.getByTestId("shield-biggest-gap-cta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this balance" })).not.toBeInTheDocument();
  });

  it("an external saved balance discards the draft", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    const { rerender } = render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "true",
    );

    profileState.riskTolerance = "Conservative";
    rerender(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "false",
    );
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
    profileState.riskTolerance = "Balanced";
  });

  it("a wallet switch discards the draft — returning to the same wallet never resurrects it", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    const { rerender } = render(
      <ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "true",
    );

    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xdef",
      chainId: 42220,
    } as any);
    rerender(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "false",
    );
    expect(screen.getByRole("radio", { name: "Balanced" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();

    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    rerender(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "false",
    );
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
  });

  it("a philosophy switch discards the draft — switching back never resurrects it", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    const { rerender } = render(
      <ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "true",
    );

    mockFinancialStrategy = "buen_vivir";
    rerender(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "false",
    );
    expect(screen.getByRole("radio", { name: "Balanced" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();

    mockFinancialStrategy = "africapitalism";
    rerender(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "false",
    );
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
  });

  it("a draft never feeds the saved-alignment memory", () => {
    window.localStorage.clear();
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    const key = "diversifi:last-visit:shield-alignment:africapitalism";
    const savedSnapshot = window.localStorage.getItem(key);
    expect(savedSnapshot).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(window.localStorage.getItem(key)).toBe(savedSnapshot);
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
    expect(mockNavigateToSwap).not.toHaveBeenCalled();
    expect(mockNavigateToGuardian).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(window.localStorage.getItem(key)).toBe(savedSnapshot);
  });

  it("demo preview never offers a save action", () => {
    demoState.isActive = true;
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Use this balance" })).not.toBeInTheDocument();
    expect(screen.getByText("Sample preview only — nothing will be saved.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep current balance" }));
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute(
      "data-balance-preview",
      "false",
    );
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

  describe("F1 — Guardian attribution (informed mode)", () => {
    const connected = () => {
      mockFinancialStrategy = "africapitalism";
      vi.mocked(useWalletContext).mockReturnValue({
        address: "0xabc",
        chainId: 42220,
      } as any);
    };

    it("shows the token-matched decline with its measured duration and hands the record to Ask Guardian", () => {
      mockVisibility.current = "informed";
      mockSessionInfo.current = {
        decisionLog: [
          {
            capturedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
            status: "daily_limit_reached",
            reason: "Daily budget spent",
            targetToken: "KESm",
            source: "guardian-loop",
            durationMs: 1180,
          },
        ],
      };
      connected();
      render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
      fireEvent.click(screen.getByTestId("ring-select-kesm"));

      const line = screen.getByTestId("guardian-attribution");
      expect(line.textContent).toContain("stood down on KESm");
      expect(line.textContent).toContain("5m ago");
      expect(line.textContent).toContain("decided in 1.2 s");

      fireEvent.click(line);
      const payload = mockNavigateToGuardian.mock.calls[0][0];
      expect(payload.summary).toContain("stood down on KESm");
      expect(payload.decisionRef).toMatchObject({
        kind: "decision",
        status: "daily_limit_reached",
        targetToken: "KESm",
        durationMs: 1180,
      });
    });

    it("stays silent in quiet mode even when a record exists", () => {
      mockSessionInfo.current = {
        decisionLog: [
          {
            capturedAt: new Date(Date.now() - 60_000).toISOString(),
            status: "daily_limit_reached",
            reason: "Daily budget spent",
            targetToken: "KESm",
          },
        ],
      };
      connected();
      render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
      fireEvent.click(screen.getByTestId("ring-select-kesm"));
      expect(screen.queryByTestId("guardian-attribution")).not.toBeInTheDocument();
    });

    it("falls back to the last execution with its on-chain receipt when no record names the token", () => {
      mockVisibility.current = "informed";
      mockSessionInfo.current = {
        latestAnchors: [
          {
            capturedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
            status: "confirmed",
            txHash: "0xfeed",
            explorerUrl: "https://celoscan.io/tx/0xfeed",
            durationMs: 4300,
          },
        ],
      };
      connected();
      render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
      fireEvent.click(screen.getByTestId("ring-select-kesm"));

      const line = screen.getByTestId("guardian-attribution");
      expect(line.textContent).toContain("Guardian's last execution");
      expect(line.textContent).toContain("2h ago");
      expect(line.textContent).toContain("took 4.3 s");
      const receipt = screen.getByTestId("guardian-attribution-receipt");
      expect(receipt).toHaveAttribute("href", "https://celoscan.io/tx/0xfeed");

      fireEvent.click(line);
      expect(mockNavigateToGuardian.mock.calls[0][0].decisionRef).toMatchObject({
        kind: "execution",
        txHash: "0xfeed",
        durationMs: 4300,
      });
    });

    it("omits the duration when the record predates instrumentation — never a fabricated 0", () => {
      mockVisibility.current = "informed";
      mockSessionInfo.current = {
        decisionLog: [
          {
            capturedAt: new Date(Date.now() - 60_000).toISOString(),
            status: "awaiting_confirmation",
            reason: "Waiting for first confirmation",
            targetToken: "KESm",
          },
        ],
      };
      connected();
      render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
      fireEvent.click(screen.getByTestId("ring-select-kesm"));
      const line = screen.getByTestId("guardian-attribution");
      expect(line.textContent).not.toContain("decided in");
    });
  });
});

describe("ProtectionTab — status tier budget + treasury intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialStrategy = "africapitalism";
    mockMoneyPurpose = "inflation_protection";
    mockGuardianState = "idle";
    demoState.isActive = false;
    navState.pendingIntent = null;
    mockRouterQuery = {};
    mockSessionInfo.current = null;
    mockVisibility.current = "quiet";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it("the status tier never exceeds three slots", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("status-tier")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-status-slot]").length).toBeLessThanOrEqual(3);
    expect(document.querySelector('[data-status-slot="trust"]')).not.toBeNull();
  });

  it("sleeve open: the back button owns the transition slot, the rail entry steps aside", () => {
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("rwa-sleeve-entry"));
    const transition = document.querySelector('[data-status-slot="transition"]');
    expect(transition?.querySelector('[data-testid="rwa-sleeve-back"]')).not.toBeNull();
    expect(screen.queryByTestId("rwa-sleeve-entry")).not.toBeInTheDocument();
  });

  it("region intent resolves to the in-region slice and consumes the intent", () => {
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", region: "Africa" },
    };
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    // africapitalism's only Africa leg is KESm — the slice inspector opens.
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute("data-selected", "KESm");
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByText("KESm position")).toBeInTheDocument();
    expect(mockConsumeIntent).toHaveBeenCalledTimes(1);
  });

  it("consumes the intent without focusing while a balance preview is open", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    // Arm the intent, then open the preview — the effect consumes on the
    // same render without touching the draft's focus.
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", region: "Africa" },
    };
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));

    expect(mockConsumeIntent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute("data-balance-preview", "true");
    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute("data-selected", "");
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
  });

  it("consumes the intent without focusing on the picker shape (no plan)", () => {
    mockFinancialStrategy = null;
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", region: "Africa" },
    };
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    expect(screen.getByTestId("shield-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    expect(mockConsumeIntent).toHaveBeenCalledTimes(1);
  });

  it("an asset intent from Exchange focuses that slice", () => {
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "exchange", asset: "KESm" },
    };
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    expect(screen.getByTestId("protection-plan-ring")).toHaveAttribute("data-selected", "KESm");
    expect(screen.getByText("KESm position")).toBeInTheDocument();
    expect(mockConsumeIntent).toHaveBeenCalledTimes(1);
  });
});

describe("ProtectionTab — stronger-floor lens prompt", () => {
  const underReserved = {
    ...MOCK_PORTFOLIO,
    chains: [
      {
        chainId: 42220,
        chainName: "Celo",
        totalValue: 5000,
        tokenCount: 2,
        balances: [
          { symbol: "USDC", value: 1500, chainId: 42220 },
          { symbol: "KESm", value: 3500, chainId: 42220 },
        ],
      },
    ],
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialStrategy = "africapitalism";
    mockMoneyPurpose = "inflation_protection";
    mockGuardianState = "idle";
    demoState.isActive = false;
    navState.pendingIntent = null;
    mockRouterQuery = {};
    profileState.riskTolerance = "Balanced";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
  });

  afterEach(() => {
    cleanup();
    profileState.riskTolerance = "Balanced";
  });

  it("shows when the wallet's dollar share beats the plan floor by ≥10 points", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    const prompt = screen.getByTestId("shield-floor-prompt");
    expect(prompt).toHaveTextContent(
      "Your wallet keeps 64% in dollars — try a stronger floor",
    );
    expect(document.querySelectorAll("[data-status-slot]").length).toBeLessThanOrEqual(3);
  });

  it("stays hidden below the surplus, on Conservative, and while previewing", () => {
    render(<ProtectionTab userRegion="USA" portfolio={underReserved} />);
    expect(screen.queryByTestId("shield-floor-prompt")).not.toBeInTheDocument();
    cleanup();

    profileState.riskTolerance = "Conservative";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.queryByTestId("shield-floor-prompt")).not.toBeInTheDocument();
    cleanup();
    profileState.riskTolerance = "Balanced";

    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(screen.queryByTestId("shield-floor-prompt")).not.toBeInTheDocument();
  });

  it("hides while comparing and while a slice is focused", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-hole"));
    expect(screen.queryByTestId("shield-floor-prompt")).not.toBeInTheDocument();
    cleanup();

    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(screen.queryByTestId("shield-floor-prompt")).not.toBeInTheDocument();
  });

  it("opens the existing balance preview — nothing commits", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("shield-floor-prompt"));

    const ring = screen.getByTestId("protection-plan-ring");
    expect(ring).toHaveAttribute("data-balance-preview", "true");
    expect(ring).toHaveAttribute(
      "data-legs",
      JSON.stringify([["KESm", 48], ["cUSD", 40], ["cEUR", 12]]),
    );
    expect(screen.getByTestId("plan-floor-control")).toHaveTextContent(
      "Dollar reserve 25% → 40%",
    );
    expect(mockSetRiskTolerance).not.toHaveBeenCalled();
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith("lens_open", {
      tab: "protect",
      lens: "floor",
    });
  });

  it("fires lens_offered when the prompt renders — never in demo", () => {
    sessionStorage.clear();
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith("lens_offered", {
      tab: "protect",
      lens: "floor",
    });
    cleanup();
    mockTrackFunnelEvent.mockClear();
    sessionStorage.clear();

    demoState.isActive = true;
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(mockTrackFunnelEvent).not.toHaveBeenCalledWith(
      "lens_offered",
      expect.anything(),
    );
    if (screen.queryByTestId("shield-floor-prompt")) {
      fireEvent.click(screen.getByTestId("shield-floor-prompt"));
    }
    expect(mockTrackFunnelEvent).not.toHaveBeenCalledWith(
      "lens_open",
      expect.anything(),
    );
  });
});

describe("ProtectionTab — shared plan card + provenance flip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialStrategy = null;
    mockMoneyPurpose = "inflation_protection";
    mockGuardianState = "idle";
    demoState.isActive = false;
    navState.pendingIntent = null;
    mockRouterQuery = {};
    mockSessionInfo.current = null;
    mockVisibility.current = "quiet";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it("?plan=africapitalism previews the philosophy — never commits", () => {
    mockRouterQuery = { plan: "africapitalism" };
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);

    const sheet = screen.getByTestId("inspector-sheet");
    expect(sheet).toHaveAttribute("aria-label", "Africapitalism");
    // Preview only — no commit, no persist.
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
    // The share line rides the same sheet, same grammar as the pair card.
    expect(
      screen.getByRole("button", { name: /Share this plan/ }),
    ).toBeInTheDocument();
  });

  it("tapping the share line fires share_open for plan_card", async () => {
    mockRouterQuery = { plan: "africapitalism" };
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    fireEvent.click(screen.getByRole("button", { name: /Share this plan/ }));
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith("share_open", {
      source: "plan_card",
    });
  });

  it("the share title names the plan — name · tagline, not the raw id", async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: shareSpy,
    });
    mockRouterQuery = { plan: "africapitalism" };
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    fireEvent.click(screen.getByRole("button", { name: /Share this plan/ }));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(shareSpy).toHaveBeenCalledWith({
      title: "Africapitalism · Build the motherland",
      url: expect.stringContaining("/plan/africapitalism"),
    });
    delete (window.navigator as { share?: unknown }).share;
  });

  it("an unknown ?plan= previews nothing", () => {
    mockRouterQuery = { plan: "mooncoin" };
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
  });

  it("a token with provenance flips to its coin-back; one without stays a plain icon", () => {
    mockFinancialStrategy = "africapitalism";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    // KESm has a curated provenance entry → the icon is a flip button.
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    const flip = screen.getByRole("button", { name: "About KESm" });
    expect(flip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(flip);
    expect(
      screen.getByRole("button", { name: "About KESm" }),
    ).toHaveAttribute("aria-pressed", "true");
    // The back names the issuer (ProvenanceCoinBack, non-compact).
    expect(screen.getByTestId("inspector-sheet").textContent).toContain(
      "Mento",
    );

    // WETH has no curated provenance → plain icon, not a button.
    fireEvent.click(screen.getByTestId("ring-select-weth"));
    expect(screen.getByText("WETH position")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "About WETH" }),
    ).not.toBeInTheDocument();
  });
});
