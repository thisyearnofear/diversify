import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const mockAdvisor = vi.fn();
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

vi.mock("@/components/agent/AgentTierStatus", () => ({
  GuardianStatusChip: () =>
    React.createElement("div", { "data-testid": "guardian-status-chip" }),
  useGuardianTierSnapshotFrom: () => ({ guardianState: "idle" }),
  AgentTierStatus: () => null,
}));

const mockNavigateToSwap = vi.fn();
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({ navigateToSwap: mockNavigateToSwap }),
}));

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({
    financialStrategy: null,
    setFinancialStrategy: vi.fn(),
  }),
}));

vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({ demoMode: { isActive: false } }),
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
  ProtectionPlanGallery: () =>
    React.createElement("div", { "data-testid": "protection-plan-gallery" }),
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

vi.mock("@/components/onramp/DepositHub", () => ({
  default: ({ compact }: { compact?: boolean }) =>
    React.createElement("div", {
      "data-testid": "deposit-hub",
      "data-compact": compact,
    }),
}));

vi.mock("@/components/tabs/protect/RwaAssetCards", () => ({
  default: () => React.createElement("div", { "data-testid": "rwa-cards" }),
}));

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

describe("ProtectionTab Confetti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWalletContext).mockReturnValue({
      address: null,
      chainId: null,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders without connected wallet", () => {
    render(
      <ProtectionTab userRegion="USA" portfolio={EMPTY_PORTFOLIO} />,
    );
    expect(document.body).toBeTruthy();
  });
});
