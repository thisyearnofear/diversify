/**
 * Regression coverage for a real production incident: `buildTips()` is
 * defined near the top of `ConnectedOverview` and reads
 * `activePortfolio.diversificationTips`, but until 2026-07-14 that
 * destructuring happened ~100 lines further down the component body,
 * AFTER `buildTips()` was already invoked. Any render path that reached
 * `diversificationTips` before its declaration line executed threw
 * "Cannot access 'diversificationTips' before initialization" (a real
 * temporal-dead-zone ReferenceError, not a minification artifact) — which
 * crashed the Overview tab in production for every non-goal-complete user
 * (the default state for most first-time users).
 *
 * These tests render the real component (all hooks + child components
 * mocked, matching the pattern in SwapTab.test.tsx) across every branch of
 * `buildTips()` that reads `diversificationTips`, so a future refactor that
 * reintroduces a use-before-declare ordering bug fails loudly instead of
 * only surfacing in the browser console in prod.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { createEmptyAnalysis } from "@diversifi/shared/src/utils/portfolio-analysis";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { HomeSections } from "@/hooks/use-home-sections";

// ──────────────────────────────────────────────────────────────────────────
// Mutable mock state
// ──────────────────────────────────────────────────────────────────────────

let mockExperienceMode: "beginner" | "standard" | "advanced" = "standard";
let mockProfileConfig: {
  userGoal: string | null;
  moneyPurpose: string | null;
  philosophy: string | null;
} = { userGoal: null, moneyPurpose: null, philosophy: null };
let mockProfileComplete = false;

// ──────────────────────────────────────────────────────────────────────────
// Hook + context mocks
// ──────────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-analytics", () => ({
  useAnalytics: () => ({
    trackAssetDetailsToggle: vi.fn(),
    trackRegimeTip: vi.fn(),
  }),
}));

vi.mock("@/context/app/ExperienceContext", () => ({
  useExperience: () => ({ experienceMode: mockExperienceMode }),
}));

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: mockProfileConfig,
    isComplete: mockProfileComplete,
  }),
}));

// Returning null skips every marketRegime-dependent branch in buildTips()
// (classifyAssets / getRegimeTip) so tests stay focused on the
// diversificationTips ordering bug.
vi.mock("@/hooks/use-market-regime", () => ({
  useMarketRegime: () => null,
}));

vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({ navigateToSwap: vi.fn() }),
}));

vi.mock("@/lib/market-regime", () => ({
  getRegimeTip: () => null,
}));

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({ isMiniPay: false }),
}));

vi.mock("@/hooks/use-macro-signals", () => ({
  useMacroSignals: () => ({ macroSignals: [] }),
}));

vi.mock("@/hooks/use-currency-risk", () => ({
  useCurrencyRisk: () => ({ currencyCode: "USD" }),
}));

vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ openAdvisor: vi.fn(), askAdvisor: vi.fn() }),
}));

vi.mock("@/hooks/use-graduation-signal", () => ({
  useGraduationSignal: () => ({
    data: null,
    isDismissed: false,
    dismiss: vi.fn(),
  }),
}));

vi.mock("@diversifi/shared/src/services/strategy/strategy.service", () => ({
  StrategyService: {
    calculateScore: vi.fn(() => ({ score: 0, feedback: [] })),
    getRecommendedAssets: vi.fn(() => []),
    getConfig: vi.fn(() => ({ targetAllocations: [] })),
  },
}));

vi.mock("@diversifi/shared/src/services/vault/guardian-tier-state", () => ({
  getBeginnerPrimaryTip: () => null,
}));

const defaultHomeSections: HomeSections = {
  mode: "standard",
  isBeginner: false,
  isStandard: true,
  isAdvanced: false,
  banner: null,
  heroVariant: "detailed",
  sections: [
    { id: "smart-tips", title: "Smart Tips", defaultOpen: false },
  ],
  showProtectionMix: true,
  showRegionSelector: false,
  showTwoChainsBanner: false,
  showAgentCommandCenter: false,
  showRewards: false,
  showMarketIntel: false,
  showSmartTips: true,
  showInsightAccordion: true,
  showProtectionScorecard: false,
  showGuardianChip: false,
  showStrategyMetrics: false,
  showZakat: false,
  showRegionalInsights: false,
  showBusinessDashboard: false,
  primaryTip: null,
  primarySectionId: "protection-mix",
  dismissFxCorridorHint: vi.fn(),
};

let mockHomeSections: HomeSections = defaultHomeSections;

vi.mock("@/hooks/use-home-sections", () => ({
  useHomeSections: () => mockHomeSections,
}));

// ──────────────────────────────────────────────────────────────────────────
// Child component mocks — trivial stubs so the test exercises
// ConnectedOverview's own render logic, not its descendants' internals.
// ──────────────────────────────────────────────────────────────────────────

vi.mock("@/components/wallet/WalletButton", () => ({ default: () => null }));
vi.mock("@/components/portfolio/CurrencyPerformanceChart", () => ({ default: () => null }));
vi.mock("@/components/portfolio/ProtectionAnalysis", () => ({ default: () => null }));
vi.mock("@/components/inflation/InflationProtectionInfo", () => ({ default: () => null }));
vi.mock("@/components/trade/DiversificationHealthCard", () => ({ default: () => null, DiversificationHealthCard: () => null }));
vi.mock("@/components/rewards/StreakRewardsCard", () => ({
  StreakRewardsCard: () => null,
  RewardsStats: () => null,
}));
vi.mock("@/components/portfolio/SimplePieChart", () => ({ default: () => null }));
vi.mock("@/components/portfolio/AssetInventory", () => ({ AssetInventory: () => null }));
vi.mock("@/components/shared/TabComponents", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Section: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DataError: () => null,
  HeroValue: ({ value, label }: { value: React.ReactNode; label: React.ReactNode }) => (
    <div data-testid="hero-value">
      <span data-testid="hero-value-value">{value}</span>
      <span data-testid="hero-value-label">{label}</span>
    </div>
  ),
}));
vi.mock("@/components/agent/AgentTierStatus", () => ({
  AgentTierStatus: () => null,
  GuardianStatusChip: () => null,
}));
vi.mock("@/components/shared/Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/agent/GuardianPulse", () => ({ GuardianPulse: () => null }));
vi.mock("@/components/shared/ContextualBanner", () => ({ ContextualBanner: () => null }));
vi.mock("@/components/shared/HomeSection", () => ({
  HomeSection: ({ children }: { children: React.ReactNode }) => <div data-testid="home-section">{children}</div>,
}));
vi.mock("@/components/shared/HomeNav", () => ({ HomeNav: () => null }));
vi.mock("@/components/shared/MoreOptions", () => ({ MoreOptions: () => null }));
vi.mock("@/components/business/BusinessPromptCard", () => ({ BusinessPromptCard: () => null }));
vi.mock("@/components/tabs/overview/ProtectionScorecard", () => ({ ProtectionScorecard: () => null }));
vi.mock("@/components/tabs/protect/PaymentCycleReport", () => ({ PaymentCycleReport: () => null }));
vi.mock("@/components/portfolio/ZakatCalculator", () => ({ default: () => null }));
vi.mock("@/components/portfolio/StrategyMetrics", () => ({ default: () => null }));
vi.mock("@/components/regional/RegionalRecommendations", () => ({ default: () => null }));
vi.mock("@/components/enterprise-fx/EmergingMarketsTracker", () => ({ default: () => null }));
vi.mock("@/components/enterprise-fx/PortfolioRiskWidget", () => ({ default: () => null }));
vi.mock("@/components/enterprise-fx/RiskMetrics", () => ({ default: () => null }));
vi.mock("@/components/enterprise-fx/TradeIntelligence", () => ({ default: () => null }));

// ──────────────────────────────────────────────────────────────────────────
// Import the component under test AFTER all mocks
// ──────────────────────────────────────────────────────────────────────────

import { ConnectedOverview } from "../ConnectedOverview";

// ──────────────────────────────────────────────────────────────────────────
// Test data builders
// ──────────────────────────────────────────────────────────────────────────

function buildPortfolio(overrides: Partial<MultichainPortfolio> = {}): MultichainPortfolio {
  return {
    ...createEmptyAnalysis(),
    chainCount: 1,
    chains: [],
    allTokens: [],
    tokenMap: {},
    regionData: [{ region: "Africa", value: 500, color: "#000", usdValue: 500 }],
    isLoading: false,
    isStale: false,
    errors: [],
    lastUpdated: Date.now(),
    totalValue: 1000,
    diversificationScore: 72,
    diversificationRating: "Good",
    diversificationTips: ["Add PAXG on Arbitrum for inflation coverage."],
    goalScores: { hedge: 55, diversify: 55, rwa: 0 },
    missingRegions: ["Europe"],
    ...overrides,
  } as MultichainPortfolio;
}

function renderOverview(props: Partial<React.ComponentProps<typeof ConnectedOverview>> = {}) {
  const portfolio = props.portfolio ?? buildPortfolio();
  const activePortfolio = props.activePortfolio ?? portfolio;
  return render(
    <ConnectedOverview
      portfolio={portfolio}
      activePortfolio={activePortfolio}
      address="0xtest"
      chainId={42220}
      isDemo={false}
      userRegion="USA"
      setUserRegion={vi.fn()}
      REGIONS={["USA", "Africa", "Europe"] as any}
      setActiveTab={vi.fn()}
      onDisableDemo={vi.fn()}
      onEnableDemo={vi.fn()}
      {...props}
    />,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe("ConnectedOverview — diversificationTips ordering regression", () => {
  afterEach(() => {
    cleanup();
    mockExperienceMode = "standard";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
  });

  it("renders without throwing when the profile is incomplete (the exact crash path: falls through to `tips = diversificationTips`)", () => {
    mockProfileComplete = false;
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };

    expect(() => renderOverview()).not.toThrow();
  });

  it("renders without throwing when the goal is 'exploring' (also falls through to the diversificationTips branch)", () => {
    mockProfileComplete = true;
    mockProfileConfig = { userGoal: "exploring", moneyPurpose: null, philosophy: null };

    expect(() => renderOverview()).not.toThrow();
  });

  it("renders without throwing for the inflation_protection goal (spreads diversificationTips.filter(...))", () => {
    mockProfileComplete = true;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: null };

    expect(() => renderOverview()).not.toThrow();
  });

  it("renders without throwing for the geographic_diversification goal (spreads diversificationTips.filter(...))", () => {
    mockProfileComplete = true;
    mockProfileConfig = { userGoal: "geographic_diversification", moneyPurpose: null, philosophy: null };

    expect(() => renderOverview()).not.toThrow();
  });

  it("renders without throwing for the rwa_access goal (does not read diversificationTips, kept for parity)", () => {
    mockProfileComplete = true;
    mockProfileConfig = { userGoal: "rwa_access", moneyPurpose: null, philosophy: null };

    expect(() => renderOverview()).not.toThrow();
  });

  it("renders without throwing in beginner mode with a complete profile (takes the early-return branch, still declares diversificationTips first)", () => {
    mockExperienceMode = "beginner";
    mockProfileComplete = true;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: null };
    mockHomeSections = { ...defaultHomeSections, isBeginner: true, mode: "beginner" };

    expect(() => renderOverview()).not.toThrow();
  });

  it("actually surfaces activePortfolio data in the hero (not just a silent no-op render)", () => {
    mockProfileComplete = false;
    renderOverview({
      activePortfolio: buildPortfolio({ diversificationScore: 91, totalValue: 4200 }),
    });

    // Standard (non-beginner) mode shows total value in the hero.
    expect(screen.getByTestId("hero-value-value")).toHaveTextContent("$4200");
  });
});
