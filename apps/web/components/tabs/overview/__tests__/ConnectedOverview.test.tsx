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

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  createEmptyPortfolio,
  type MultichainPortfolio,
} from "@/hooks/use-multichain-balances";
import type { HomeSections } from "@/hooks/use-home-sections";

// ──────────────────────────────────────────────────────────────────────────
// Mutable mock state
// ──────────────────────────────────────────────────────────────────────────

let mockExperienceMode: "simple" | "full" = "full";
let mockProfileConfig: {
  userGoal: string | null;
  moneyPurpose: string | null;
  philosophy: string | null;
} = { userGoal: null, moneyPurpose: null, philosophy: null };
let mockProfileComplete = false;
// Default null → ConnectedOverview renders the legacy hero (what the
// regression tests below assert). Set to a moment to exercise the
// currency-moment hero + dial-focus seeding.
let mockMoment: import("@/lib/narrative/currency-moment").NarrativeMoment | null = null;
const mockTrackFunnelEvent = vi.fn();

// ──────────────────────────────────────────────────────────────────────────
// Hook + context mocks
// ──────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/analytics", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/analytics")>();
  return {
    ...mod,
    trackFunnelEvent: (...args: unknown[]) =>
      mockTrackFunnelEvent(...(args as [string, Record<string, string>?])),
  };
});

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

const mockNavigateToCompare = vi.fn();
const mockNavigateToNetting = vi.fn();
const mockNavigateWithIntent = vi.fn();
const mockNavigateToGuardian = vi.fn();
const mockConsumeSettlement = vi.fn();
const navState: {
  lastSettlement: { toToken: string; settledAt: number } | null;
} = { lastSettlement: null };
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    navigateToSwap: vi.fn(),
    navigateToCompare: mockNavigateToCompare,
    navigateToNetting: mockNavigateToNetting,
    navigateWithIntent: mockNavigateWithIntent,
    navigateToGuardian: mockNavigateToGuardian,
    lastSettlement: navState.lastSettlement,
    consumeSettlement: mockConsumeSettlement,
  }),
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

// The Home opening artifact hook — driven by mockMoment so tests can choose
// between the legacy hero (null) and the currency-moment hero (a moment).
vi.mock("@/hooks/use-currency-moment", () => ({
  useCurrencyMoment: () => ({
    moment: mockMoment,
    inflationMoment: null,
    isLoading: false,
    benchmark: "USD",
    setBenchmark: vi.fn(),
    horizon: "1yr",
    setHorizon: vi.fn(),
    savingsAmount: 10000,
    setSavingsAmount: vi.fn(),
    benchmarks: ["USD", "EUR", "XAU"],
    horizons: ["1yr", "3yr", "5yr"],
    onChangeCountry: vi.fn(),
    countryCode: mockMoment?.iso2 ?? null,
    frame: null,
  }),
}));

vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ openAdvisor: vi.fn(), askAdvisor: vi.fn() }),
}));

const graduationMock = vi.hoisted(() => ({
  data: null as null | {
    shouldShow: boolean;
    confidence: number;
    signals: { cyclical: boolean; corridor: boolean; largerBalance: boolean; hasSavedCycle: boolean };
    promptHeadline: string;
  },
  isDismissed: false,
  dismiss: vi.fn(),
}));
vi.mock("@/hooks/use-graduation-signal", () => ({
  useGraduationSignal: () => graduationMock,
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
  mode: "full",
  isSimple: false,
  banner: null,
  heroVariant: "detailed",
  showDial: true,
  showZakat: false,
  isPaymentCycle: false,
  primaryTip: null,
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
// Guardian visibility surfaces ride these reads — default quiet so the
// existing tier assertions see the classic layout.
let mockGuardianVisibility: "quiet" | "informed" = "quiet";
let mockSessionInfo: {
  activityStats: { week: string; evaluated: number; executed: number; declined: number } | null;
  decisionLog: Array<{ capturedAt: string; status: string; reason: string }>;
} | null = null;
vi.mock("@/context/app/GuardianVisibilityContext", () => ({
  useGuardianVisibility: () => ({
    visibility: mockGuardianVisibility,
    origin: "persona",
    setVisibility: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-guardian-telemetry", () => ({
  useGuardianTelemetry: () => ({ data: null, isStale: false, refresh: vi.fn() }),
}));
vi.mock("@/hooks/use-guardian-session-info", () => ({
  useGuardianSessionInfo: (enabled: boolean) => (enabled ? mockSessionInfo : null),
}));
vi.mock("@/components/shared/LiveProofCard", () => ({
  GuardianCadenceLine: () => <div data-testid="guardian-cadence-line" />,
}));
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
vi.mock("@/components/shared/ContextualBanner", () => ({
  ContextualBanner: ({ kind }: { kind: string | null }) =>
    kind ? <div data-testid="contextual-banner" data-kind={kind} /> : null,
}));
vi.mock("@/components/shared/DataFreshnessIndicator", () => ({
  DataFreshnessIndicator: (props: { lastUpdated: number | null; isStale?: boolean; isLoading?: boolean; onRefresh?: () => void }) => (
    <div data-testid="freshness-indicator" data-stale={String(Boolean(props.isStale))} data-loading={String(Boolean(props.isLoading))}>
      {props.onRefresh && <button type="button" onClick={props.onRefresh}>Refresh balances</button>}
    </div>
  ),
}));
vi.mock("@/components/shared/HomeSection", () => ({
  HomeSection: ({ children }: { children: React.ReactNode }) => <div data-testid="home-section">{children}</div>,
}));
vi.mock("@/components/shared/HomeNav", () => ({ HomeNav: () => null }));
vi.mock("@/components/shared/MoreOptions", () => ({ MoreOptions: () => null }));
vi.mock("@/components/tabs/protect/PaymentCycleReport", () => ({ PaymentCycleReport: () => null }));
vi.mock("@/components/portfolio/ZakatCalculator", () => ({
  default: () => <div data-testid="zakat-calculator" />,
}));
vi.mock("@/components/enterprise-fx/TradeIntelligence", () => ({ default: () => null }));
vi.mock("../CountryPicker", () => ({
  CountryPicker: () => <div data-testid="country-override-select" />,
}));
vi.mock("../InflationMomentCard", () => ({
  InflationMomentCard: () => <div data-testid="inflation-moment-card" />,
}));
vi.mock("../CurrencyMomentCard", () => ({
  CurrencyMomentCard: ({ moment }: { moment: { delta: number; currencyCode: string } }) => (
    <div data-testid="currency-moment-card">
      {moment.delta}% {moment.currencyCode}
    </div>
  ),
}));
vi.mock("../HomeExposureDial", () => ({
  HomeExposureDial: ({ selectedRegion }: { selectedRegion: string | null }) => (
    <div data-testid="exposure-dial" data-selected={selectedRegion ?? "none"} />
  ),
}));
vi.mock("../HomeRiskTheater", () => ({
  HomeRiskTheater: ({ moment, inflationMoment, regionData, focusedRegion, isActive, onSelectRegion, sealedRegion, inspection, onInspectCurrency }: { moment: unknown; inflationMoment: unknown; regionData: unknown[]; focusedRegion: string | null; isActive?: boolean; onSelectRegion?: (region: string | null) => void; sealedRegion?: string | null; inspection?: React.ReactNode; onInspectCurrency?: () => void }) => {
    if (moment) {
      return (
        <div data-testid="home-risk-theater" data-focused={focusedRegion ?? "none"} data-holdings={Array.isArray(regionData) ? regionData.length : 0} data-active={String(isActive)} data-sealed={sealedRegion ?? "none"}>
          <div data-testid="currency-moment-card" />
          <button type="button" data-testid="inspect-currency" onClick={() => onInspectCurrency?.()} />
          {inspection}
          {Array.isArray(regionData) && regionData.length > 0 && (
            <div data-testid="holdings-strip" />
          )}
          <button type="button" data-testid="select-region" onClick={() => onSelectRegion?.("Africa")} />
        </div>
      );
    }
    if (inflationMoment) {
      return (
        <div data-testid="home-risk-theater" data-focused={focusedRegion ?? "none"}>
          <div data-testid="inflation-moment-card" />
          {inspection}
        </div>
      );
    }
    return <div data-testid="home-risk-theater-empty" />;
  },
}));

// ──────────────────────────────────────────────────────────────────────────
// Import the component under test AFTER all mocks
// ──────────────────────────────────────────────────────────────────────────

import { ConnectedOverview } from "../ConnectedOverview";

// ──────────────────────────────────────────────────────────────────────────
// Test data builders
// ──────────────────────────────────────────────────────────────────────────

function buildPortfolio(overrides: Partial<MultichainPortfolio> = {}): MultichainPortfolio {
  return {
    ...createEmptyPortfolio(),
    chainCount: 1,
    // Three regions, top share 40% — below the concentration lens trigger
    // so existing transition-slot tests aren't outranked by the prompt.
    regionData: [
      { region: "Africa", value: 400, color: "#000", usdValue: 400 },
      { region: "USA", value: 350, color: "#111", usdValue: 350 },
      { region: "Europe", value: 250, color: "#222", usdValue: 250 },
    ],
    lastUpdated: Date.now(),
    totalValue: 1000,
    diversificationScore: 72,
    diversificationRating: "Good",
    diversificationTips: ["Add PAXG on Arbitrum for inflation coverage."],
    goalScores: { hedge: 55, diversify: 55, rwa: 0 },
    missingRegions: ["Europe"],
    ...overrides,
  };
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
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
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
    mockExperienceMode = "simple";
    mockProfileComplete = true;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: null };
    mockHomeSections = { ...defaultHomeSections, isSimple: true, mode: "simple", showDial: false };

    expect(() => renderOverview()).not.toThrow();
  });

  it("shows one shared freshness indicator for the wallet instrument", async () => {
    const refreshBalances = vi.fn().mockResolvedValue(undefined);
    renderOverview({
      portfolio: buildPortfolio({ isStale: true, hasEstimates: true }),
      refreshBalances,
    });

    expect(screen.getByTestId("freshness-indicator")).toHaveAttribute("data-stale", "true");
    await act(async () => {
      screen.getByRole("button", { name: "Refresh balances" }).click();
    });
    expect(refreshBalances).toHaveBeenCalledTimes(1);
  });

  it("actually surfaces activePortfolio data in the hero (not just a silent no-op render)", () => {
    mockProfileComplete = false;
    // With no currency moment, legacy hero renders (holdings alone don't force theater)
    renderOverview({
      activePortfolio: buildPortfolio({ diversificationScore: 91, totalValue: 4200 }),
    });

    expect(screen.getByTestId("hero-value")).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Currency-moment hero + dial focus seeding
// ──────────────────────────────────────────────────────────────────────────

const GHANA_MOMENT: import("@/lib/narrative/currency-moment").NarrativeMoment = {
  currencyCode: "GHS",
  countryName: "Ghana",
  iso2: "GH",
  flag: "🇬🇭",
  benchmark: "USD",
  benchmarkLabel: "US Dollar",
  horizon: "1yr",
  delta: -18,
  savingsAmount: 100000,
  personalImpact: 18000,
  retainedRatio: 0.82,
  state: "review",
  isLive: false,
  dataAsOf: "2025-07-01",
  goods: null,
};

describe("ConnectedOverview — currency-moment hero", () => {
  afterEach(() => {
    cleanup();
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
  });

  it("replaces the legacy hero with the Risk Theater when a currency moment is detected", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();

    expect(screen.getByTestId("home-risk-theater")).toBeInTheDocument();
    expect(screen.getByTestId("currency-moment-card")).toBeInTheDocument();
    expect(screen.queryByTestId("hero-value")).not.toBeInTheDocument();
    // Theater owns coins; dial is not a hero — strip is the holdings affordance
    expect(screen.getByTestId("holdings-strip")).toBeInTheDocument();
    expect(screen.queryByTestId("exposure-dial")).not.toBeInTheDocument();
  });

  it("forwards isActive to the Risk Theater's visit memory", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview({ isActive: false });
    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-active", "false");
  });

  it("shows holdings strip as quiet bar with no pre-selected region", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();

    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-focused", "none");
    expect(screen.getByTestId("holdings-strip")).toBeInTheDocument();
  });

  it("demotes the protection-mix analysis when Risk Theater is the holdings object", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();

    expect(screen.getByTestId("home-risk-theater")).toBeInTheDocument();
    expect(screen.queryByTestId("protection-analysis")).not.toBeInTheDocument();
  });

  it("shows the legacy hero when no currency moment is detected (holdings alone don't force theater)", () => {
    mockMoment = null;
    renderOverview();

    expect(screen.getByTestId("hero-value")).toBeInTheDocument();
    expect(screen.queryByTestId("home-risk-theater")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protection-analysis")).not.toBeInTheDocument();
  });

  it("shows Risk Theater for beginners with holdings — coin stage is universal", () => {
    mockExperienceMode = "simple";
    mockHomeSections = { ...defaultHomeSections, isSimple: true, mode: "simple", showDial: true };
    mockMoment = GHANA_MOMENT;
    renderOverview();

    expect(screen.getByTestId("home-risk-theater")).toBeInTheDocument();
    expect(screen.getByTestId("currency-moment-card")).toBeInTheDocument();
  });

  it("shows Risk Theater without holdings strip when the wallet is empty", () => {
    mockHomeSections = { ...defaultHomeSections, showDial: false };
    mockMoment = GHANA_MOMENT;
    renderOverview({
      portfolio: buildPortfolio({ totalValue: 0, regionData: [] }),
      activePortfolio: buildPortfolio({ totalValue: 0, regionData: [] }),
    });

    expect(screen.getByTestId("home-risk-theater")).toBeInTheDocument();
    expect(screen.getByTestId("currency-moment-card")).toBeInTheDocument();
    expect(screen.queryByTestId("holdings-strip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("exposure-dial")).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Geo-failure fallback + compare deep link (Wave 18)
// ──────────────────────────────────────────────────────────────────────────

describe("ConnectedOverview — geo-failure fallback and compare link", () => {
  afterEach(() => {
    cleanup();
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
    mockNavigateToCompare.mockClear();
    mockNavigateToNetting.mockClear();
  });

  it("fallback shows the country picker — the same actionable affordance as the unconnected morph", () => {
    mockMoment = null;
    mockHomeSections = { ...defaultHomeSections, isSimple: true, mode: "simple", showDial: false };
    renderOverview();

    expect(screen.getByTestId("home-fallback-hero")).toBeInTheDocument();
    expect(screen.getByTestId("country-override-select")).toBeInTheDocument();
    expect(screen.getByText(/could not detect your country/i)).toBeInTheDocument();
  });

  it("fallback CTA names the committed philosophy and goes to Shield — never Exchange", () => {
    mockMoment = null;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = { ...defaultHomeSections, isSimple: true, mode: "simple", showDial: false };
    const setActiveTab = vi.fn();
    renderOverview({ setActiveTab });

    const cta = screen.getByRole("button", { name: "See your Buen Vivir shield" });
    fireEvent.click(cta);
    expect(setActiveTab).toHaveBeenCalledWith("protect");
    expect(screen.queryByText("Review Your Shield")).not.toBeInTheDocument();
    expect(screen.queryByText(/exchange/i)).not.toBeInTheDocument();
  });

  it("fallback CTA says 'Set up your plan' when no philosophy is committed", () => {
    mockMoment = null;
    mockHomeSections = { ...defaultHomeSections, isSimple: true, mode: "simple", showDial: false };
    renderOverview();

    expect(screen.getByRole("button", { name: "Set up your plan" })).toBeInTheDocument();
    expect(screen.queryByText("Review Your Shield")).not.toBeInTheDocument();
  });

  it("status tier shows 'Compare philosophies →' only when a philosophy is committed, and it deep-links", () => {
    mockMoment = GHANA_MOMENT;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    renderOverview();

    const link = screen.getByTestId("home-compare-link");
    fireEvent.click(link);
    expect(mockNavigateToCompare).toHaveBeenCalledTimes(1);
    cleanup();

    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    renderOverview();
    expect(screen.queryByTestId("home-compare-link")).not.toBeInTheDocument();
  });

  it("a payment cycle wins the one transition line — compare link steps aside", () => {
    mockMoment = GHANA_MOMENT;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = { ...defaultHomeSections, isPaymentCycle: true };
    renderOverview();

    const link = screen.getByRole("button", { name: /See what FX timing costs this payment/ });
    expect(link).toBeInTheDocument();
    expect(screen.queryByTestId("home-compare-link")).not.toBeInTheDocument();
    fireEvent.click(link);
    // The signature business surface: Shield's per-cycle report, not netting.
    expect(mockNavigateWithIntent).toHaveBeenCalledWith("protect", { source: "home", lens: "cycle" });
    expect(mockNavigateToNetting).not.toHaveBeenCalled();
  });

  it("graduation: a detected pattern owns the transition line, opens the cycle, and can be dismissed", () => {
    mockMoment = GHANA_MOMENT;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = { ...defaultHomeSections, banner: null, isPaymentCycle: false };
    graduationMock.data = {
      shouldShow: true,
      confidence: 0.35,
      signals: { cyclical: false, corridor: true, largerBalance: false, hasSavedCycle: false },
      promptHeadline: "Patterns in your recent activity.",
    };
    mockNavigateWithIntent.mockClear();
    try {
      renderOverview();
      const slots = document.querySelectorAll('[data-status-slot="transition"]');
      expect(slots).toHaveLength(1);
      expect(screen.getByTestId("home-graduation")).toBeInTheDocument();
      expect(screen.queryByTestId("home-compare-link")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Moving local savings into dollars often/ }));
      expect(mockNavigateWithIntent).toHaveBeenCalledWith("protect", { source: "home", lens: "cycle" });
      fireEvent.click(screen.getByRole("button", { name: "Not a business — hide this" }));
      expect(graduationMock.dismiss).toHaveBeenCalledTimes(1);
    } finally {
      graduationMock.data = null;
    }
  });

  it("graduation never doubles the declared payment-cycle line", () => {
    mockMoment = GHANA_MOMENT;
    mockHomeSections = { ...defaultHomeSections, banner: null, isPaymentCycle: true };
    graduationMock.data = {
      shouldShow: true,
      confidence: 0.5,
      signals: { cyclical: false, corridor: false, largerBalance: false, hasSavedCycle: true },
      promptHeadline: "Patterns in your recent activity.",
    };
    try {
      renderOverview();
      expect(screen.queryByTestId("home-graduation")).not.toBeInTheDocument();
      expect(screen.getByTestId("home-cycle-link")).toBeInTheDocument();
    } finally {
      graduationMock.data = null;
    }
  });

  it("with no payment cycle and no tip, the compare link is the one transition line", () => {
    mockMoment = GHANA_MOMENT;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = { ...defaultHomeSections, isPaymentCycle: false, primaryTip: null };
    renderOverview();

    expect(screen.getByTestId("home-compare-link")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Match this payment/ })).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// StatusTier budget + Home→Shield region intent
// ──────────────────────────────────────────────────────────────────────────

describe("ConnectedOverview — status tier budget and region intent", () => {
  afterEach(() => {
    cleanup();
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
    mockNavigateToCompare.mockClear();
    mockNavigateToNetting.mockClear();
    mockNavigateWithIntent.mockClear();
  });

  it("when banner + payment-cycle + tip + philosophy all apply, exactly one transition slot renders and it's the banner", () => {
    mockMoment = GHANA_MOMENT;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = {
      ...defaultHomeSections,
      banner: "currency-risk",
      isPaymentCycle: true,
      primaryTip: "Add BRLm for LatAm coverage.",
    };
    renderOverview();

    const slots = document.querySelectorAll('[data-status-slot="transition"]');
    expect(slots).toHaveLength(1);
    expect(slots[0].querySelector('[data-testid="contextual-banner"]')).not.toBeNull();
    expect(screen.queryByTestId("home-compare-link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Match this payment/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-status-slot]").length).toBeLessThanOrEqual(3);
  });

  it("with no banner and a payment cycle, the netting button wins the transition slot", () => {
    mockMoment = GHANA_MOMENT;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = {
      ...defaultHomeSections,
      banner: null,
      isPaymentCycle: true,
      primaryTip: "Add BRLm for LatAm coverage.",
    };
    renderOverview();

    const slots = document.querySelectorAll('[data-status-slot="transition"]');
    expect(slots).toHaveLength(1);
    expect(slots[0].textContent).toContain("See what FX timing costs this payment");
    expect(screen.queryByTestId("home-compare-link")).not.toBeInTheDocument();
  });

  it("never renders more than three status slots", () => {
    mockMoment = GHANA_MOMENT;
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = { ...defaultHomeSections, banner: "currency-risk", isPaymentCycle: true };
    renderOverview();
    expect(document.querySelectorAll("[data-status-slot]").length).toBeLessThanOrEqual(3);
    expect(document.querySelector('[data-status-slot="trust"]')).toBeNull();
  });

  it("the region inspector CTA hands the region to Shield via navigateWithIntent", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();

    fireEvent.click(screen.getByTestId("select-region"));
    const cta = screen.getByRole("button", { name: "Review in Shield" });
    fireEvent.click(cta);
    expect(mockNavigateWithIntent).toHaveBeenCalledWith("protect", {
      source: "home",
      region: "Africa",
    });
  });
});

describe("ConnectedOverview — currency story inspector", () => {
  afterEach(() => {
    cleanup();
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
  });

  it("the coin tap opens the story sheet with the dated trail and share line", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();

    fireEvent.click(screen.getByTestId("inspect-currency"));
    const sheet = screen.getByTestId("inspector-sheet");
    expect(sheet).toHaveAttribute("aria-label", "🇬🇭 Ghana — GHS");
    expect(sheet.textContent).toContain("Cedi crisis");
    expect(sheet.textContent).toContain("Share this currency's story");
    expect(sheet.textContent).toContain("Ask Guardian about the GHS");
  });

  it("region and currency sheets are mutually exclusive", async () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();

    // Mid-fold a closing sheet may still be mounted — the open sheet is
    // the one not collapsed to 0 height (or the last mounted).
    const openSheet = () => {
      const sheets = screen.getAllByTestId("inspector-sheet");
      return sheets.find((s) => s.style.opacity !== "0") ?? sheets.at(-1);
    };

    fireEvent.click(screen.getByTestId("select-region"));
    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-focused", "Africa");
    expect(openSheet()).toHaveAttribute("aria-label", "Africa");

    fireEvent.click(screen.getByTestId("inspect-currency"));
    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-focused", "none");
    expect(openSheet()).toHaveAttribute("aria-label", "🇬🇭 Ghana — GHS");

    // …and a region pick sends the currency sheet back down — selection
    // state is exclusive even while the exit fold still has it mounted.
    fireEvent.click(screen.getByTestId("select-region"));
    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-focused", "Africa");
    await vi.waitFor(() => {
      expect(
        screen
          .getAllByTestId("inspector-sheet")
          .filter((s) => s.getAttribute("aria-label") === "🇬🇭 Ghana — GHS")
          .every((s) => s.style.opacity === "0"),
      ).toBe(true);
    });
  });

  it("a second tap on the coin closes the sheet", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();
    fireEvent.click(screen.getByTestId("inspect-currency"));
    expect(screen.getByTestId("inspector-sheet")).toHaveAttribute("aria-label", "🇬🇭 Ghana — GHS");
    fireEvent.click(screen.getByTestId("inspect-currency"));
    const sheet = screen.queryByTestId("inspector-sheet");
    if (sheet) {
      expect(sheet.style.opacity).toBe("0");
    }
  });

  it("closing the sheet un-flips the coin", () => {
    mockMoment = GHANA_MOMENT;
    renderOverview();
    fireEvent.click(screen.getByTestId("inspect-currency"));
    fireEvent.click(screen.getByLabelText("Close inspector"));
    const sheet = screen.queryByTestId("inspector-sheet");
    if (sheet) {
      expect(sheet.style.opacity).toBe("0");
    }
  });
});

describe("ConnectedOverview — the settled-move seal", () => {
  const portfolioWithKESm = () =>
    buildPortfolio({
      allTokens: [
        { symbol: "KESm", name: "Kenyan Shilling", value: 120, region: "Africa" },
      ] as any,
    });

  beforeEach(() => {
    mockMoment = GHANA_MOMENT;
  });

  afterEach(() => {
    cleanup();
    navState.lastSettlement = null;
    mockConsumeSettlement.mockClear();
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
  });

  it("seals the region the settled token landed in once refreshed balances show it", () => {
    navState.lastSettlement = { toToken: "KESm", settledAt: Date.now() - 1000 };
    renderOverview({ portfolio: portfolioWithKESm(), isActive: true });

    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-sealed", "Africa");
    expect(mockConsumeSettlement).toHaveBeenCalledTimes(1);
  });

  it("waits while the portfolio's clock hasn't passed the settlement — never seals on stale balances", () => {
    navState.lastSettlement = { toToken: "KESm", settledAt: Date.now() + 60_000 };
    renderOverview({ portfolio: portfolioWithKESm(), isActive: true });

    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-sealed", "none");
    expect(mockConsumeSettlement).not.toHaveBeenCalled();
  });

  it("consumes without sealing when the settled token isn't in the refreshed balances", () => {
    navState.lastSettlement = { toToken: "NGNm", settledAt: Date.now() - 1000 };
    renderOverview({ portfolio: portfolioWithKESm(), isActive: true });

    expect(screen.getByTestId("home-risk-theater")).toHaveAttribute("data-sealed", "none");
    expect(mockConsumeSettlement).toHaveBeenCalledTimes(1);
  });

  it("does not claim a move while Home is inactive", () => {
    navState.lastSettlement = { toToken: "KESm", settledAt: Date.now() - 1000 };
    renderOverview({ portfolio: portfolioWithKESm(), isActive: false });

    expect(mockConsumeSettlement).not.toHaveBeenCalled();
  });
});

describe("ConnectedOverview — inline inspection", () => {
  const concentrated = () =>
    buildPortfolio({
      regionData: [
        { region: "Africa", value: 700, color: "#000", usdValue: 700 },
        { region: "USA", value: 300, color: "#111", usdValue: 300 },
      ] as any,
      totalValue: 1000,
    });

  beforeEach(() => {
    sessionStorage.clear();
    mockMoment = GHANA_MOMENT;
    mockTrackFunnelEvent.mockClear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
    mockGuardianVisibility = "quiet";
    mockSessionInfo = null;
    window.localStorage.clear();
  });

  it("renders no concentration prompt even at ≥50%, and a legacy session key stays inert", () => {
    sessionStorage.setItem("diversifi.home.lens", "concentration");
    renderOverview({ portfolio: concentrated() });
    expect(screen.queryByTestId("home-concentration-link")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-lens-back")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-risk-theater")).not.toHaveAttribute("data-lens");
  });

  it("carries no Verified / Evidence mirrored line anywhere on Home", () => {
    renderOverview();
    expect(screen.queryByText(/Verified|Evidence mirrored/i)).not.toBeInTheDocument();
    cleanup();
    renderOverview({ portfolio: concentrated() });
    expect(screen.queryByText(/Verified|Evidence mirrored/i)).not.toBeInTheDocument();
  });

  it("region selection opens a stage inspector — headline, one meaning, one Shield hand-off", () => {
    renderOverview({ portfolio: concentrated() });
    fireEvent.click(screen.getByTestId("select-region"));
    const sheet = screen.getByTestId("inspector-sheet");
    expect(sheet).toHaveAttribute("aria-label", "Africa");
    expect(sheet.className).not.toContain("bg-surface");
    expect(screen.queryByTestId("inspector-sheet-handle")).not.toBeInTheDocument();
    expect(sheet.textContent).toContain("70%");
    expect(sheet.textContent).toContain("Africa");
    expect(sheet.textContent).toMatch(/One region's currency risk carries most of your plan/);
    const cta = screen.getByRole("button", { name: "Review in Shield" });
    fireEvent.click(cta);
    expect(mockNavigateWithIntent).toHaveBeenCalledWith("protect", {
      source: "home",
      region: "Africa",
    });
    expect(
      screen.getByRole("button", { name: /Ask Guardian about this region/ }),
    ).toBeInTheDocument();
  });

  it("suppresses transition prompts while inspecting and restores them on close", async () => {
    mockGuardianVisibility = "informed";
    mockSessionInfo = {
      activityStats: { week: "2026-W39", evaluated: 15, executed: 3, declined: 2 },
      decisionLog: [],
    };
    window.localStorage.setItem(
      "diversifi:last-visit:guardian-activity",
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * 24 * 3600 * 1000 }),
    );
    renderOverview({ portfolio: concentrated() });
    await screen.findByTestId("home-guardian-activity-link");
    fireEvent.click(screen.getByTestId("select-region"));
    await vi.waitFor(() =>
      expect(
        screen.queryByTestId("home-guardian-activity-link"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText("Close inspector"));
    await vi.waitFor(() =>
      expect(
        screen.getByTestId("home-guardian-activity-link"),
      ).toBeInTheDocument(),
    );
  });

  it("Zakat selection replaces the exposure body rather than stacking it", () => {
    mockHomeSections = { ...defaultHomeSections, showZakat: true };
    renderOverview({ portfolio: concentrated() });
    fireEvent.click(screen.getByTestId("select-region"));
    const sheet = screen.getByTestId("inspector-sheet");
    expect(sheet.textContent).toContain("Review in Shield");
    fireEvent.click(screen.getByRole("button", { name: "Zakat" }));
    expect(screen.getByTestId("zakat-calculator")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review in Shield" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exposure" }));
    expect(screen.getByRole("button", { name: "Review in Shield" })).toBeInTheDocument();
    expect(screen.queryByTestId("zakat-calculator")).not.toBeInTheDocument();
  });

  it("never mounts the shell's side inspector slot for Home's stages", () => {
    renderOverview({ portfolio: concentrated() });
    fireEvent.click(screen.getByTestId("select-region"));
    expect(document.querySelector(".instrument-inspector")).toBeNull();
    const sheet = screen.getByTestId("inspector-sheet");
    expect(
      sheet.closest(".instrument-workbench")?.querySelector(".instrument-inspector"),
    ).toBeNull();
    expect(
      document
        .querySelector(".instrument-object")
        ?.contains(sheet),
    ).toBe(true);
  });
});


describe("ConnectedOverview — while you were away (Guardian activity)", () => {
  const ACTIVITY_KEY = "diversifi:last-visit:guardian-activity";
  const DAY = 24 * 3600 * 1000;

  beforeEach(() => {
    window.localStorage.clear();
    mockMoment = GHANA_MOMENT;
    mockGuardianVisibility = "quiet";
    mockSessionInfo = null;
    mockNavigateToGuardian.mockReset();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    mockExperienceMode = "full";
    mockProfileConfig = { userGoal: null, moneyPurpose: null, philosophy: null };
    mockProfileComplete = false;
    mockHomeSections = defaultHomeSections;
    mockMoment = null;
    mockGuardianVisibility = "quiet";
    mockSessionInfo = null;
  });

  function informedSession(week: string, evaluated: number, executed: number, declined: number) {
    mockGuardianVisibility = "informed";
    mockSessionInfo = {
      activityStats: { week, evaluated, executed, declined },
      decisionLog: [
        { capturedAt: new Date(Date.now() - DAY).toISOString(), status: "declined", reason: "within bounds" },
      ],
    };
  }

  it("renders the same-week delta as ONE quiet link — counters stay behind the tap", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    renderOverview();
    const link = await screen.findByTestId("home-guardian-activity-link");
    expect(link).toHaveTextContent("Review Guardian activity");
    const slot = document.querySelector('[data-status-slot="transition"]')!;
    expect(slot.textContent).not.toContain("ran 5 checks");
    expect(screen.queryByText(/Guardian ran/)).not.toBeInTheDocument();

    fireEvent.click(link);
    expect(mockNavigateToGuardian).toHaveBeenCalledTimes(1);
    const payload = mockNavigateToGuardian.mock.calls[0][0];
    expect(payload.summary).toContain("Since your last visit (3d ago)");
    expect(payload.summary).toContain("ran 5 checks");
    expect(payload.summary).toContain("1 move");
    expect(payload.summary).toContain("1 stand-down");
    expect(payload.prompt).toContain("Recent decisions:");
    expect(payload.prompt).toContain("within bounds");
  });

  it("quotes 'this week' totals when the snapshot is from an earlier week", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W38|10|2|1", at: Date.now() - 8 * DAY }),
    );
    renderOverview();
    const link = await screen.findByTestId("home-guardian-activity-link");
    fireEvent.click(link);
    const payload = mockNavigateToGuardian.mock.calls[0][0];
    expect(payload.summary).toContain("This week: Guardian ran 15 checks");
    expect(payload.summary).not.toContain("Since your last visit");
  });

  it("stays silent in quiet mode", async () => {
    informedSession("2026-W39", 15, 3, 2);
    mockGuardianVisibility = "quiet";
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    renderOverview();
    await screen.findByTestId("home-risk-theater");
    expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
  });

  it("stays silent when the session doc predates activity counters", async () => {
    mockGuardianVisibility = "informed";
    mockSessionInfo = { activityStats: null, decisionLog: [] };
    renderOverview();
    await screen.findByTestId("home-risk-theater");
    expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
  });

  it("never fabricates a line — no snapshot, no counters, no zeros", async () => {
    informedSession("2026-W39", 0, 0, 0);
    renderOverview();
    await screen.findByTestId("home-risk-theater");
    expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
  });

  it("stays silent for same-session snapshots (younger than 6h)", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 30 * 60 * 1000 }),
    );
    renderOverview();
    await screen.findByTestId("home-risk-theater");
    expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
  });

  it("fetches nothing in demo mode", async () => {
    informedSession("2026-W39", 15, 3, 2);
    renderOverview({ isDemo: true });
    await screen.findByTestId("home-risk-theater");
    expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
  });

  it("occupies the one transition slot — ahead of the tip and compare", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    mockProfileConfig = { userGoal: "inflation_protection", moneyPurpose: null, philosophy: "buen_vivir" };
    mockHomeSections = { ...defaultHomeSections, primaryTip: "Add BRLm for LatAm coverage." };
    renderOverview();
    await screen.findByTestId("home-guardian-activity-link");
    const slots = document.querySelectorAll('[data-status-slot="transition"]');
    expect(slots).toHaveLength(1);
    expect(screen.queryByText("Add BRLm for LatAm coverage.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-compare-link")).not.toBeInTheDocument();
    cleanup();

    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    renderOverview({
      portfolio: buildPortfolio({
        regionData: [
          { region: "Africa", value: 700, color: "#000", usdValue: 700 },
          { region: "USA", value: 300, color: "#111", usdValue: 300 },
        ] as any,
        totalValue: 1000,
      }),
    });
    expect(await screen.findByTestId("home-guardian-activity-link")).toBeInTheDocument();
    expect(screen.queryByTestId("home-concentration-link")).not.toBeInTheDocument();
  });

  it("banner, payment-cycle, and graduation each outrank the activity link", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );

    mockHomeSections = { ...defaultHomeSections, banner: "currency-risk" };
    renderOverview();
    await screen.findByTestId("contextual-banner");
    expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
    cleanup();

    mockHomeSections = { ...defaultHomeSections, banner: null, isPaymentCycle: true };
    renderOverview();
    await screen.findByRole("button", { name: /See what FX timing costs this payment/ });
    expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
    cleanup();

    mockHomeSections = { ...defaultHomeSections, banner: null, isPaymentCycle: false };
    graduationMock.data = {
      shouldShow: true,
      confidence: 0.35,
      signals: { cyclical: false, corridor: true, largerBalance: false, hasSavedCycle: false },
      promptHeadline: "Patterns in your recent activity.",
    };
    try {
      renderOverview();
      await screen.findByTestId("home-graduation");
      expect(screen.queryByTestId("home-guardian-activity-link")).not.toBeInTheDocument();
    } finally {
      graduationMock.data = null;
    }
  });

  it("the Home trust line carries no Guardian cadence, even informed", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    renderOverview();
    await screen.findByTestId("home-guardian-activity-link");
    expect(screen.queryByTestId("guardian-cadence-line")).not.toBeInTheDocument();
  });
});
