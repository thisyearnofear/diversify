import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
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
  anchorCurrency: null as string | null,
  customPlan: null as unknown,
};
const mockSetRiskTolerance = vi.fn();
const mockSetCustomPlan = vi.fn();
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
      anchorCurrency: profileState.anchorCurrency,
      customPlan: profileState.customPlan,
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
    setCustomPlan: mockSetCustomPlan,
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

const mockLatestAdvice: { current: unknown } = { current: null };
vi.mock("@/hooks/use-agent-analysis", () => ({
  useLatestAdvice: () => mockLatestAdvice.current,
}));

vi.mock("@/hooks/use-agent-status", () => ({
  useAgentStatus: () => ({ isLoading: false }),
}));

const mockNavigateToSwap = vi.fn();
const mockNavigateToGuardian = vi.fn();
const mockConsumeIntent = vi.fn();
const navState: {
  pendingIntent: { tab: string; intent: { source: string; region?: string; asset?: string; lens?: "compare" | "netting" | "cycle" } } | null;
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

const vaultState = vi.hoisted(() => ({
  vault: null as { strategy: string } | null,
  updateStrategy: (() => Promise.resolve()) as (...args: unknown[]) => Promise<void>,
  cachedProof: null as { message: string; signature: string } | null,
}));
vi.mock("@/hooks/use-vault", () => ({
  useVault: () => ({
    vault: vaultState.vault,
    refresh: vi.fn(),
    updateStrategy: vaultState.updateStrategy,
  }),
}));
vi.mock("@/lib/wallet-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wallet-auth")>()),
  getCachedWalletAuth: () => vaultState.cachedProof,
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
      holeOverride,
      holeActionLabel,
      compact,
      forcePlanLegs,
      ghostLegs,
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
      holeOverride?: { label: React.ReactNode; hint?: string };
      holeActionLabel?: string;
      compact?: boolean;
      forcePlanLegs?: boolean;
      ghostLegs?: { token: string; percent: number }[];
    }) => {
      const archetypeId = strategyToArchetype(strategyKey);
      const name = archetypeId ? ARCHETYPES[archetypeId].name : "";
      const holeContent = holeOverride
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("span", null, holeOverride.label as string),
            holeOverride.hint
              ? React.createElement("span", null, holeOverride.hint)
              : null,
          )
        : null;
      const hole =
        onHoleTap && !selectedToken
          ? React.createElement(
              "button",
              {
                type: "button",
                "data-testid": "ring-hole",
                "aria-label": holeActionLabel ?? "Compare philosophies",
                onClick: onHoleTap,
              },
              holeOverride
                ? holeContent
                : React.createElement(
                    React.Fragment,
                    null,
                    React.createElement("span", null, name),
                    holeHintOverride
                      ? React.createElement("span", null, holeHintOverride)
                      : null,
                    alignmentScore != null
                      ? React.createElement("span", null, `${alignmentScore}%`)
                      : null,
                  ),
            )
          : holeContent
            ? React.createElement("div", { "data-testid": "ring-hole-static" }, holeContent)
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
          "data-compact": String(Boolean(compact)),
          "data-force-plan-legs": String(Boolean(forcePlanLegs)),
          "data-ghost-legs": JSON.stringify((ghostLegs ?? []).map((l) => [l.token, l.percent])),
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
  useExperience: () => ({ experienceMode: "full" }),
}));

// Persona morph — flips Shield's status rail to the payment-cycle entry.
const adaptiveState = vi.hoisted(() => ({
  shieldMorph: "plan" as "plan" | "cycle",
}));
vi.mock("@/context/app/AdaptiveContext", () => ({
  useAdaptiveContext: () => ({
    config: { content: { shieldMorph: adaptiveState.shieldMorph } },
    isMobile: false,
    detectionMethod: "none",
  }),
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

vi.mock("@/components/tabs/protect/PhilosophyCoinRail", () => ({
  PhilosophyCoinRail: ({
    onSelect,
    onTapPoint,
  }: {
    selected?: string | null;
    onSelect: (id: string) => void;
    onTapPoint?: (x: number, y: number) => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "philosophy-coin-rail" },
      ["africapitalism", "buen_vivir", "custom"].map((id) =>
        React.createElement(
          "button",
          {
            key: id,
            type: "button",
            "data-testid": `coin-${id}`,
            onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
              const r = e.currentTarget.getBoundingClientRect();
              onTapPoint?.(r.left + r.width / 2, r.top + r.height / 2);
              onSelect(id);
            },
          },
          `Inspect ${id}`,
        ),
      ),
    ),
  FocusedPlanLine: ({ strategyId }: { strategyId: string | null }) =>
    React.createElement(
      "p",
      { "data-testid": "focused-plan-line" },
      strategyId ?? "none",
    ),
}));

vi.mock("@/components/tabs/protect/PaymentCycleReport", () => ({
  PaymentCycleReport: ({ initialMode }: { initialMode?: string }) =>
    React.createElement("div", {
      "data-testid": "payment-cycle-report",
      "data-mode": initialMode,
    }),
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
    // The picker IS the compact ring + coin rail walletless.
    expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
    expect(screen.getByTestId("shield-unconnected-object")).toBeInTheDocument();
  });

  it("shows the plan picker when connected with no philosophy", () => {
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.getByTestId("shield-picker")).toBeInTheDocument();
    expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
    expect(screen.queryByTestId("protection-plan-gallery")).not.toBeInTheDocument();
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

    // First coin tap only previews — the details sheet opens on the
    // second tap of the already-focused coin.
    fireEvent.click(screen.getByTestId("coin-africapitalism"));
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("picker-commit")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("coin-africapitalism"));
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("protection-calculator")).toBeInTheDocument();
    const sheet = screen.getByTestId("inspector-sheet");
    expect(within(sheet).getByRole("button", { name: "Use this plan" })).toBeInTheDocument();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Use this plan" }));
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
    expect(screen.getByText("Shilling position")).toBeInTheDocument();
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
    // One grant path: Shield hands off to the Guardian tab, it never signs.
    expect(mockNavigateToGuardian).toHaveBeenCalledTimes(1);
    expect(mockNavigateToGuardian.mock.calls[0][0]?.summary).toContain("daily limit");
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
    // The design-contract aside is gone (§3): the badge alone names it.
    expect(screen.queryByText(/not a module/)).not.toBeInTheDocument();
    // The slice inspector links out to the one cycle tool — it doesn't
    // embed a second copy under the slice.
    expect(screen.queryByTestId("payment-cycle-report")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("slice-cycle-entry"));
    expect(screen.getByTestId("payment-cycle-report")).toHaveAttribute("data-mode", "next");
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
    // Picker shape renders the compact ring + coin rail — the hole
    // carries the "choose" copy; no meta-lecture asides.
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.queryByText(/matches your worldview/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Same JSX renders here/)).not.toBeInTheDocument();
    expect(screen.getByText("Choose a philosophy")).toBeInTheDocument();
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
    expect(screen.getByText("Shilling position")).toBeInTheDocument();
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

  it("walletless: the lens leads with holdable assets and can be left and re-entered", () => {
    mockRouterQuery = { sleeve: "rwa" };
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);

    expect(screen.getByTestId("rwa-row-PAXG")).toBeInTheDocument();
    expect(screen.getByTestId("rwa-offapp")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("rwa-sleeve-back"));
    expect(screen.queryByTestId("rwa-vault-sleeve")).not.toBeInTheDocument();
    // The doorway is no longer URL-only: the status tier re-opens it.
    fireEvent.click(screen.getByTestId("rwa-sleeve-entry"));
    expect(screen.getByTestId("rwa-vault-sleeve")).toBeInTheDocument();
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
    // The coin rail slides in under the compact ring — no card row.
    expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
    expect(screen.queryByTestId("protection-plan-gallery")).not.toBeInTheDocument();
    const statusLine = screen.getByTestId("shield-compare-status");
    expect(statusLine.textContent).toContain("Keep Africapitalism");
    // Exactly the escape — no other CTA in the status tier.
    expect(screen.queryByTestId("shield-biggest-gap-cta")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up Guardian" })).not.toBeInTheDocument();
  });

  it("a coin tap re-slices the ring in place and 'Use this plan' commits", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    const hole = screen.getByTestId("ring-hole");
    expect(hole).toHaveAccessibleName("Exit compare");
    // Focus falls back to the current plan before a coin is tapped.
    expect(hole.textContent).toContain("Africapitalism");
    expect(hole.textContent).toContain("Your plan");

    // First tap previews only — name + compact delta in the hole, no sheet.
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    expect(hole.textContent).toContain("Buen Vivir");
    expect(hole.textContent).toMatch(/[+−]\d+%/);
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("compare-commit"));
    expect(mockSetFinancialStrategy).toHaveBeenCalledWith("buen_vivir");
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
  });

  it("a funded wallet in compare draws the previewed plan's legs, not its holdings", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    const ring = screen.getByTestId("protection-plan-ring");
    expect(ring).toHaveAttribute("data-compact", "true");
    expect(ring).toHaveAttribute("data-force-plan-legs", "true");

    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    // Buen Vivir is a cREAL/COPm mix — this wallet holds KESm/cUSD/cEUR.
    // The ring slices must follow the previewed plan, never the holdings.
    const legs = JSON.parse(ring.getAttribute("data-legs") ?? "[]") as [string, number][];
    const tokens = legs.map(([token]) => token);
    expect(tokens).toContain("cREAL");
    expect(tokens).not.toContain("KESm");
    // The current plan's outline rides along for contrast.
    const ghost = JSON.parse(ring.getAttribute("data-ghost-legs") ?? "[]") as [string, number][];
    expect(ghost.map(([token]) => token)).toContain("KESm");
  });

  it("a second coin tap opens the philosophy details sheet", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("protection-calculator")).toBeInTheDocument();
    // The delta moved to the ring hole — the sheet carries no plan-delta line.
    expect(screen.queryByTestId("plan-delta")).not.toBeInTheDocument();
  });

  it("tapping the hole again exits compare without committing", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    fireEvent.click(screen.getByTestId("ring-hole"));
    expect(screen.queryByTestId("shield-compare")).not.toBeInTheDocument();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
  });

  it("'Keep <Name>' exits compare mode without committing", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
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

  it("a cycle-lens intent opens the payment-cycle inspector — even with no plan", () => {
    mockFinancialStrategy = null;
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", lens: "cycle" },
    };
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    expect(screen.getByTestId("payment-cycle-report")).toBeInTheDocument();
    expect(mockConsumeIntent).toHaveBeenCalled();
  });

  it("?cycle=1 opens the payment-cycle inspector in next mode", () => {
    mockRouterQuery = { cycle: "1" };
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("payment-cycle-report")).toHaveAttribute("data-mode", "next");
  });

  it("?cycle=last opens the payment-cycle inspector in last mode (the /fx-drag-calculator doorway)", () => {
    mockRouterQuery = { cycle: "last" };
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("payment-cycle-report")).toHaveAttribute("data-mode", "last");
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

    // The badge lives in the header, hidden in compact mode — the hole
    // tap is the way back out.
    fireEvent.click(screen.getByTestId("ring-hole"));
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

  it("dial is hidden while comparing; hole delta + values + leg row in the inspector", () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42161, // Arbitrum — cREAL isn't deployed there
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);

    fireEvent.click(screen.getByTestId("ring-hole"));
    expect(screen.queryByTestId("plan-floor-control")).not.toBeInTheDocument();

    // First tap previews (delta rides in the hole); a second tap opens
    // the details sheet with the value chips.
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    expect(screen.getByTestId("ring-hole")).toHaveTextContent("Buen Vivir");
    expect(screen.getByTestId("ring-hole").textContent).toMatch(/[+−]\d+%/);
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
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
      fireEvent.click(screen.getByTestId("coin-buen_vivir"));
      expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("coin-buen_vivir"));
      expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
      expect(
        within(screen.getByTestId("inspector-sheet")).getByRole("button", {
          name: "Use this plan",
        }),
      ).toBeInTheDocument();
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
    expect(screen.getByText("Shilling position")).toBeInTheDocument();
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
    expect(screen.getByText("Shilling position")).toBeInTheDocument();
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
    profileState.anchorCurrency = null;
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
    profileState.anchorCurrency = "USD";
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

  it("a shilling-majority wallet keeps the dollar reserve — KES is only measured", () => {
    render(<ProtectionTab userRegion="USA" portfolio={underReserved} />);
    expect(screen.getByTestId("plan-floor-control")).toHaveTextContent("Dollar reserve · 25%");
    expect(screen.getByTestId("plan-floor-control")).not.toHaveTextContent(/Shilling/);
    // 30% dollars against a 25% dollar floor is under the 10-point surplus.
    expect(screen.queryByTestId("shield-floor-prompt")).not.toBeInTheDocument();
    cleanup();

    const shillingMajorityDollarSurplus = {
      ...underReserved,
      chains: [
        {
          ...underReserved.chains[0],
          balances: [
            { symbol: "USDC", value: 2000, chainId: 42220 },
            { symbol: "KESm", value: 3000, chainId: 42220 },
          ],
        },
      ],
    };
    render(<ProtectionTab userRegion="USA" portfolio={shillingMajorityDollarSurplus} />);
    const prompt = screen.getByTestId("shield-floor-prompt");
    expect(prompt).toHaveTextContent("Your wallet keeps 40% in dollars — try a stronger floor");
    expect(prompt).not.toHaveTextContent(/KES/);
    expect(screen.getByTestId("plan-floor-control")).toHaveTextContent("Dollar reserve");
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

describe("ProtectionTab — business morph (shieldMorph: cycle)", () => {
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
    adaptiveState.shieldMorph = "cycle";
    vi.mocked(useWalletContext).mockReturnValue({
      address: "0xabc",
      chainId: 42220,
    } as any);
  });

  afterEach(() => {
    adaptiveState.shieldMorph = "plan";
    cleanup();
  });

  it("connected: the status rail offers the cycle entry instead of the RWA rail", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("cycle-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("rwa-sleeve-entry")).not.toBeInTheDocument();
  });

  it("the cycle entry opens the payment-cycle inspector in next mode", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("cycle-entry"));
    expect(screen.getByTestId("payment-cycle-report")).toHaveAttribute(
      "data-mode",
      "next",
    );
    // While the inspector is open the rail steps aside.
    expect(screen.queryByTestId("cycle-entry")).not.toBeInTheDocument();
  });

  it("non-business personas keep the RWA rail", () => {
    adaptiveState.shieldMorph = "plan";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("rwa-sleeve-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-entry")).not.toBeInTheDocument();
  });

  it("payment purpose alone morphs the rail without an importer persona", () => {
    adaptiveState.shieldMorph = "plan";
    mockMoneyPurpose = "upcoming_payment";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("cycle-entry")).toBeInTheDocument();
  });

  it("walletless: the cycle entry replaces the tokenized-assets link", () => {
    vi.mocked(useWalletContext).mockReturnValue({
      address: null,
      chainId: null,
    } as any);
    render(<ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />);
    expect(screen.getByTestId("cycle-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("rwa-sleeve-entry")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-entry"));
    expect(screen.getByTestId("payment-cycle-report")).toHaveAttribute(
      "data-mode",
      "next",
    );
  });
});

describe("ProtectionTab — live line", () => {
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

  it("resting Shield shows the line under the full ring", () => {
    // Monitoring suppresses the gap CTA — the line owns the resting state.
    mockGuardianState = "monitoring";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    const line = screen.getByTestId("shield-live-line");
    // Directly under the full ring, inside the same object.
    expect(screen.getByTestId("shield-ring").contains(line)).toBe(true);
    // KESm is the plan's largest non-USD leg — its watch cadence carries.
    expect(line.textContent).toContain("Watch 🇰🇪:");
  });

  it("the biggest-gap CTA hides the line — two lines never compete", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("shield-biggest-gap-cta")).toBeInTheDocument();
    expect(screen.queryByTestId("shield-live-line")).not.toBeInTheDocument();
  });

  it("the line vanishes while comparing", () => {
    // Monitoring removes the gap CTA so only `comparing` can hide it.
    mockGuardianState = "monitoring";
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-hole"));
    expect(screen.getByTestId("shield-compare")).toBeInTheDocument();
    expect(screen.queryByTestId("shield-live-line")).not.toBeInTheDocument();
  });
});

describe("ProtectionTab — Guardian tilt on the ring", () => {
  const instrument = { symbol: "EURm", chainId: 42220 };
  const advice = (strategy: string) => ({
    guardianPlan: {
      strategy,
      anchor: "USD",
      tilts: [{ exposure: "EUR", delta: 5, reason: "Euro steadier than the shilling", evidence: [], instrument }],
      nextMove: { exposure: "EUR", amountAnchor: 40, amountUsd: 40, instrument },
      rejected: [],
      fx: { rate: 1, source: "identity" },
    },
  });
  const connected = () => {
    mockFinancialStrategy = "africapitalism";
    vi.mocked(useWalletContext).mockReturnValue({ address: "0xabc", chainId: 42220 } as any);
  };
  afterEach(() => {
    mockLatestAdvice.current = null;
  });

  it("shows the suggestion as a ghost arc, previews the reshaped ring, and hands off to Exchange", () => {
    mockLatestAdvice.current = advice("africapitalism");
    connected();
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    const ring = screen.getByTestId("protection-plan-ring");
    const saved = ring.getAttribute("data-legs");
    const chip = screen.getByTestId("guardian-tilt-chip");
    expect(chip.textContent).toContain("Guardian suggests +5 Euro");
    expect(ring.getAttribute("data-ghost-legs")).not.toBe("[]");

    fireEvent.click(chip);
    const previewRing = screen.getByTestId("protection-plan-ring");
    expect(previewRing.getAttribute("data-legs")).not.toBe(saved);
    expect(previewRing.getAttribute("data-ghost-legs")).toBe(saved);
    expect(screen.getByText("Guardian suggestion · not saved")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("guardian-tilt-review"));
    expect(mockNavigateToSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        toToken: "EURm",
        toChainId: 42220,
        amount: "40",
        reason: "Euro steadier than the shilling",
        origin: { source: "guardian" },
      }),
    );
  });

  it("stays silent when the suggestion was made for a different plan, or there is none", () => {
    mockLatestAdvice.current = advice("pan_caribbean");
    connected();
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.queryByTestId("guardian-tilt-chip")).not.toBeInTheDocument();
    expect(screen.getByTestId("protection-plan-ring").getAttribute("data-ghost-legs")).toBe("[]");
  });
});

describe("ProtectionTab — Custom plan editor on the ring", () => {
  const legsOf = () =>
    JSON.parse(screen.getByTestId("protection-plan-ring").getAttribute("data-legs") ?? "[]") as [string, number][];
  const sum = (legs: [string, number][]) => legs.reduce((s, [, p]) => s + p, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialStrategy = "africapitalism";
    mockMoneyPurpose = "inflation_protection";
    mockGuardianState = "idle";
    mockLatestAdvice.current = null;
    demoState.isActive = false;
    navState.pendingIntent = null;
    profileState.customPlan = null;
    vi.mocked(useWalletContext).mockReturnValue({ address: "0xabc", chainId: 42220 } as any);
  });

  afterEach(() => {
    cleanup();
    profileState.customPlan = null;
  });

  it("'Tweak this plan' opens the philosophy as a Custom draft on the same ring", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("custom-tweak"));
    expect(screen.getByTestId("shield-custom-editor")).toBeInTheDocument();
    expect(screen.getByTestId("ring-hole-static").textContent).toContain("Custom · from Africapitalism");
    expect(legsOf()).toEqual([["KESm", 60], ["cUSD", 25], ["cEUR", 15]]);
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
  });

  it("the slice stepper moves 5 points and the rest rebalance to 100", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("custom-tweak"));
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    expect(screen.getByTestId("custom-slice-stepper").textContent).toContain("Shilling 60%");
    fireEvent.click(screen.getByTestId("custom-step-up"));
    expect(legsOf()).toEqual([["KESm", 65], ["cUSD", 20], ["cEUR", 15]]);
    fireEvent.click(screen.getByTestId("custom-step-down"));
    fireEvent.click(screen.getByTestId("custom-step-down"));
    expect(sum(legsOf())).toBe(100);
    expect(legsOf()[0]).toEqual(["KESm", 55]);
  });

  it("stepping a slice to zero removes it", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("custom-tweak"));
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    for (let i = 0; i < 12; i++) fireEvent.click(screen.getByTestId("custom-step-down"));
    expect(legsOf().map(([t]) => t)).toEqual(["cUSD", "cEUR"]);
    expect(sum(legsOf())).toBe(100);
    expect(screen.queryByTestId("custom-slice-stepper")).not.toBeInTheDocument();
  });

  it("+ Add offers exposures with a chain hint and adds a 5% slice", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("custom-tweak"));
    fireEvent.click(screen.getByTestId("custom-add"));
    expect(screen.getByTestId("custom-add-XAU").textContent).toBe("Gold · Arbitrum");
    expect(screen.queryByTestId("custom-add-KES")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("custom-add-XAU"));
    expect(legsOf()).toContainEqual(["PAXG", 5]);
    expect(sum(legsOf())).toBe(100);
  });

  it("Save plan commits into customPlan and switches to Custom", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("custom-tweak"));
    fireEvent.click(screen.getByTestId("ring-select-kesm"));
    fireEvent.click(screen.getByTestId("custom-step-up"));
    fireEvent.click(screen.getByTestId("custom-save"));
    expect(mockSetCustomPlan).toHaveBeenCalledWith({
      from: "africapitalism",
      rules: {},
      slices: [
        { exposure: "KES", target: 65 },
        { exposure: "USD", target: 20 },
        { exposure: "EUR", target: 15 },
      ],
    });
    expect(mockSetFinancialStrategy).toHaveBeenCalledWith("custom");
    expect(screen.queryByTestId("shield-custom-editor")).not.toBeInTheDocument();
  });

  it("saving a Custom plan never repoints the server Guardian, even with a cached proof", () => {
    const updateStrategy = vi.fn(() => Promise.resolve());
    vaultState.vault = { strategy: "africapitalism" };
    vaultState.updateStrategy = updateStrategy;
    vaultState.cachedProof = { message: "m", signature: "0xsig" };
    try {
      render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
      fireEvent.click(screen.getByTestId("custom-tweak"));
      fireEvent.click(screen.getByTestId("ring-select-kesm"));
      fireEvent.click(screen.getByTestId("custom-step-up"));
      fireEvent.click(screen.getByTestId("custom-save"));
      expect(mockSetFinancialStrategy).toHaveBeenCalledWith("custom");
      expect(updateStrategy).not.toHaveBeenCalled();
    } finally {
      vaultState.vault = null;
      vaultState.updateStrategy = () => Promise.resolve();
      vaultState.cachedProof = null;
    }
  });

  it("Cancel leaves the saved plan untouched", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("custom-tweak"));
    fireEvent.click(screen.getByTestId("custom-cancel"));
    expect(screen.queryByTestId("shield-custom-editor")).not.toBeInTheDocument();
    expect(mockSetCustomPlan).not.toHaveBeenCalled();
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
  });

  it("choosing Custom directly starts from the wallet's current exposures", () => {
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    fireEvent.click(screen.getByTestId("ring-hole"));
    fireEvent.click(screen.getByTestId("coin-custom"));
    expect(screen.getByTestId("ring-hole-static").textContent).toContain("Custom · from your wallet");
    // $3,200 dollars across Celo + Arbitrum, $1,000 shillings; WETH has no plan exposure.
    expect(legsOf()).toEqual([["cUSD", 75], ["KESm", 25]]);
  });

  it("a saved Custom plan draws on the ring and reopens in the editor", () => {
    mockFinancialStrategy = "custom";
    profileState.customPlan = {
      from: "pan_caribbean",
      rules: {},
      slices: [
        { exposure: "USD", target: 50 },
        { exposure: "XAU", target: 30 },
        { exposure: "EUR", target: 20 },
      ],
    };
    render(<ProtectionTab userRegion="USA" portfolio={MOCK_PORTFOLIO} />);
    expect(screen.getByTestId("shield-ring")).toBeInTheDocument();
    expect(legsOf()).toEqual([["cUSD", 50], ["PAXG", 30], ["cEUR", 20]]);
    expect(screen.getByTestId("custom-tweak").textContent).toBe("Edit custom plan");
    fireEvent.click(screen.getByTestId("custom-tweak"));
    expect(screen.getByTestId("shield-custom-editor")).toBeInTheDocument();
    expect(legsOf()).toEqual([["cUSD", 50], ["PAXG", 30], ["cEUR", 20]]);
  });
});
