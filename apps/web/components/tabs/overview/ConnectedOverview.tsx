import React, { useEffect, useRef } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";
import { useAnalytics } from "@/hooks/use-analytics";
import { useExperience } from "../../../context/app/ExperienceContext";
import { useProtectionProfile } from "../../../hooks/use-protection-profile";
import { useMarketRegime } from "@/hooks/use-market-regime";
import { useNavigation } from "@/context/app/NavigationContext";
import { getRegimeTip } from "@/lib/market-regime";
import { classifyAssets } from "../../portfolio/asset-classification";
import WalletButton from "../../wallet/WalletButton";
import CurrencyPerformanceChart from "../../portfolio/CurrencyPerformanceChart";
import ProtectionAnalysis from "../../portfolio/ProtectionAnalysis";
import InflationProtectionInfo from "../../inflation/InflationProtectionInfo";
import DiversificationHealthCard from "../../trade/DiversificationHealthCard";
import { StreakRewardsCard, RewardsStats } from "../../rewards/StreakRewardsCard";
import SimplePieChart from "../../portfolio/SimplePieChart";
import { AssetInventory } from "../../portfolio/AssetInventory";
import { Card, Section, DataError, HeroValue } from "../../shared/TabComponents";
import { AgentTierStatus, GuardianStatusChip } from "../../agent/AgentTierStatus";
import { GuardianPulse } from "../../agent/GuardianPulse";
import { useWalletContext } from "../../wallet/WalletProvider";
import { ContextualBanner } from "../../shared/ContextualBanner";
import { HomeSection } from "../../shared/HomeSection";
import { HomeNav } from "../../shared/HomeNav";
import { MoreOptions } from "../../shared/MoreOptions";
import { useHomeSections } from "@/hooks/use-home-sections";
import { useMacroSignals } from "@/hooks/use-macro-signals";
import { useAdvisor } from "@/hooks/use-advisor";
import { useGraduationSignal } from "@/hooks/use-graduation-signal";
import { BusinessPromptCard } from "@/components/business/BusinessPromptCard";
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import { getBeginnerPrimaryTip, type ProtectionUserGoal } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import { ProtectionScorecard } from "./ProtectionScorecard";
import ZakatCalculator from "../../portfolio/ZakatCalculator";
import StrategyMetrics from "../../portfolio/StrategyMetrics";
import RegionalRecommendations from "../../regional/RegionalRecommendations";
import EmergingMarketsTracker from "../../enterprise-fx/EmergingMarketsTracker";
import PortfolioRiskWidget from "../../enterprise-fx/PortfolioRiskWidget";
import RiskMetrics from "../../enterprise-fx/RiskMetrics";
import TradeIntelligence from "../../enterprise-fx/TradeIntelligence";
import CaribbeanFxNetCard from "../../business/CaribbeanFxNetCard";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import DisclosureSection from "../../shared/DisclosureSection";
import { HomeExposureDial } from "./HomeExposureDial";
import { trackFunnelEvent } from "@/lib/analytics";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { InflationMomentCard } from "./InflationMomentCard";
import type { Benchmark, Horizon } from "@/constants/currency-risk";

interface ConnectedOverviewProps {
  portfolio: MultichainPortfolio;
  activePortfolio: MultichainPortfolio;
  address: string;
  chainId: number | null;
  isDemo: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  setActiveTab: (tab: TabId) => void;
  refreshBalances?: () => Promise<void>;
  /**
   * Refreshes the wallet's current chain id. Returns the new chain id on
   * success, or `null` if the wallet isn't connected / the chain couldn't
   * be read. Matches the real signature exposed by `useAppShell()`.
   */
  refreshChainId?: () => Promise<number | null>;
  onDisableDemo: () => void;
  onEnableDemo: () => void;
  currencyPerformanceData?: {
    dates: string[];
    currencies: {
      symbol: string;
      name: string;
      region: Region;
      values: number[];
      percentChange: number;
    }[];
    baseCurrency: string;
    source?: "api" | "cache" | "fallback" | "unavailable";
  };
}

export function ConnectedOverview({
  portfolio,
  activePortfolio,
  address,
  chainId,
  isDemo,
  userRegion,
  setUserRegion,
  REGIONS,
  setActiveTab,
  refreshBalances,
  refreshChainId,
  onDisableDemo,
  onEnableDemo,
  currencyPerformanceData,
}: ConnectedOverviewProps) {
  const { experienceMode } = useExperience();
  const { config: adaptiveConfig } = useAdaptiveContext();
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();
  const marketRegime = useMarketRegime();
  const { trackAssetDetailsToggle, trackRegimeTip } = useAnalytics();
  const hasTrackedRegimeTip = useRef(false);
  const { isMiniPay } = useWalletContext();
  const { openAdvisor, askAdvisor } = useAdvisor();
  const { navigateToSwap } = useNavigation();
  const [showAssetDetails, setShowAssetDetails] = React.useState(false);

  // ── Home marquee focus state ────────────────────────────────────────
  // Selection is user-initiated only. Auto-seeding a region opened a
  // second Shield CTA under the moment's "Protect this" — two buttons,
  // same destination. The dial still shows every region; tapping one
  // is the reveal. First selection fires a coarse `marquee_select`.
  const [focusedRegion, setFocusedRegion] = React.useState<string | null>(null);
  const handleDialSelect = React.useCallback((region: string | null) => {
    setFocusedRegion(region);
    if (region) {
      trackFunnelEvent("marquee_select", { region, source: "home_dial" });
    }
  }, []);

  // ── The personal currency moment ────────────────────────────────────
  // The Home hero's opening artifact: the visitor's own currency against a
  // benchmark, one delta, one personal consequence. Selections radiate a
  // marquee_select event (source home_moment) like the other marquees.
  const {
    moment,
    inflationMoment,
    benchmarks,
    horizons,
    setBenchmark,
    setHorizon,
    setSavingsAmount,
    onChangeCountry,
    frame,
  } = useCurrencyMoment();
  const handleMomentBenchmark = React.useCallback(
    (b: Benchmark) => {
      setBenchmark(b);
      trackFunnelEvent("marquee_select", { benchmark: b, source: "home_moment" });
    },
    [setBenchmark],
  );
  const handleMomentHorizon = React.useCallback(
    (h: Horizon) => {
      setHorizon(h);
      trackFunnelEvent("marquee_select", { horizon: h, source: "home_moment" });
    },
    [setHorizon],
  );

  // Destructured before `buildTips` below — `buildTips()` reads
  // `diversificationTips` synchronously (not just inside a callback), so it
  // must be declared before that call, not after. Declaring it later throws
  // "Cannot access 'diversificationTips' before initialization" (TDZ) the
  // instant a render path skips the goal-specific tips and falls through to
  // `tips = diversificationTips`.
  const {
    diversificationScore,
    diversificationRating,
    totalValue,
    regionData,
    diversificationTips,
  } = activePortfolio;

  // ── Build the full tip list (used by the Smart Tips accordion section) ─
  // Defined BEFORE `useHomeSections` is called so the IA hook can accept
  // `tipsCount` and gate the smart-tips section entirely when the list is
  // empty (0px-when-empty per the density-first pass).
  //
  // Uses `experienceMode` directly (not `home.isBeginner`) so the function
  // doesn't depend on `home` — `home` is declared further down. The two
  // are equivalent: `home.isBeginner === experienceMode === "beginner"`.
  const buildTips = (): string[] => {
    const gs = activePortfolio.goalScores;
    const missing = activePortfolio.missingRegions;
    const goal = profileConfig.userGoal;
    const isBeginner = experienceMode === "beginner";
    let tips: string[] = [];

    if (isBeginner && profileComplete && goal && goal !== "exploring") {
      const plain = getBeginnerPrimaryTip(
        goal as ProtectionUserGoal,
        gs,
        missing ?? [],
      );
      return plain ? [plain] : [];
    }

    if (profileComplete && goal && goal !== "exploring") {
      if (goal === "inflation_protection") {
        if (gs.hedge < 60)
          tips.push(`Your hedge score is ${Math.round(gs.hedge)}%. Swap high-inflation tokens to USDm or EURm to improve it.`);
        else if (gs.hedge >= 80) {
          if (isMiniPay) {
            tips.push(`Excellent inflation protection (${Math.round(gs.hedge)}%)! Your Celo stablecoins are well-diversified.`);
          } else {
            tips.push(`Excellent inflation protection (${Math.round(gs.hedge)}%)! Consider adding PAXG on Arbitrum for long-term coverage.`);
          }
        } else
          tips.push(`Good hedge score (${Math.round(gs.hedge)}%). Reducing your most concentrated region exposure would improve it further.`);
        tips.push(...diversificationTips.filter((t) => t.includes("PAXG") || t.includes("inflation")));
      } else if (goal === "geographic_diversification") {
        if (gs.diversify < 60)
          tips.push(`Diversification score: ${Math.round(gs.diversify)}%. Add ${missing.slice(0, 2).join(" and ")} exposure to improve it.`);
        else if (gs.diversify >= 80)
          tips.push(`Excellent diversification (${Math.round(gs.diversify)}%)! You're well-spread across regions.`);
        else
          tips.push(`Good diversification (${Math.round(gs.diversify)}%). ${missing.length > 0 ? `Adding ${missing[0]} would push you above 80%.` : "Keep rebalancing as markets move."}`);
        tips.push(...diversificationTips.filter((t) => t.includes("region")));
      } else if (goal === "rwa_access") {
        if (isMiniPay) {
          tips.push("MiniPay is Celo-native. Use Celo for regional stablecoin protection; connect a full wallet for Arbitrum RWA assets.");
        } else if (gs.rwa === 0) {
          tips.push("No real-world assets detected. Use Arbitrum when your goal is tokenized gold, Treasuries, or structured yield.");
        } else if (gs.rwa < 80) {
          tips.push(`RWA score: ${Math.round(gs.rwa)}%. Add PAXG, USDY, or SYRUPUSDC on Arbitrum if RWA exposure is your priority.`);
        } else {
          tips.push(`Strong RWA position (${Math.round(gs.rwa)}%). Your Arbitrum assets are providing real-world exposure.`);
        }
      }
    } else {
      tips = diversificationTips;
    }

    if (marketRegime) {
      const groups = classifyAssets(activePortfolio.allTokens || []);
      const totalValue = groups.totalValue;
      const stableRatio = totalValue > 0 ? groups.trackedValue / totalValue : 0;
      const regimeTip = getRegimeTip(marketRegime.regime, stableRatio);
      if (regimeTip) tips = [regimeTip, ...tips];
    }

    return tips;
  };

  // ── Single source of truth for what the home page should show ──────────
  // `tipsCount` gates the smart-tips section per the density-first pass:
  // when the buildTips() result is empty, the section is filtered entirely
  // (0px) instead of showing an empty-state message inside a 1-line header.
  const tips = buildTips();
  const home = useHomeSections({
    portfolio,
    isDemo,
    userRegion,
    chainId,
    tipsCount: tips.length,
  });

  // ── Macro signals (Firecrawl-monitored central banks, yield trackers,
  // depeg monitors) for the TradeIntelligence pill. Reuses the proof
  // feed's cache — no new global fetch. Items are universal (impactAsset
  // stripped to undefined), so the pill surfaces the latest fresh signal
  // regardless of the user's corridor. The user gets screen space back
  // 99% of the time; a 1-line pill appears when a fresh signal exists.
  const { macroSignals } = useMacroSignals();

  // ── Graduation-funnel signal (Phase 4) — surfacing the retail→business
  // graduation prompt for users whose on-chain activity looks like
  // trader-pattern behaviour (cyclical deposits, local→USD corridor
  // swaps, larger balance activity, or already-saved cycles). Non-
  // prescriptive: shows a card with evidence chips and a "Why am I
  // seeing this?" disclosure; the explore CTA scrolls to the FX
  // Corridor section. SME-graduated users (moneyPurpose =
  // upcoming_payment) already see the FX Corridor section, so the
  // prompt is suppressed for them — the prompt is for the bridge, not
  // a duplicate of the destination. Density-aware: returns null when
  // no signal exists or the user already dismissed.
  const {
    data: graduationData,
    isDismissed: graduationDismissed,
    dismiss: dismissGraduationPrompt,
  } = useGraduationSignal(address);

  const hasHoldings = totalValue > 0;
  const hasMomentHero = Boolean(moment || inflationMoment);

  // The Home marquee: the regional exposure dial is the holdings object
  // for non-beginner users. It replaces Protection Mix (one-in-one-out) —
  // same regional story, one surface. Beginner mode keeps the pie.
  const showExposureDial =
    !home.isBeginner && hasHoldings && regionData.length > 0;

  // Graduation prompt only renders for: (a) a connected wallet, (b) a
  // non-SME-graduated user (they already see the FX Corridor section),
  // (c) server-confirmed shouldShow, (d) user has not dismissed, and
  // (e) real signals parsed from data. Density-first: when all-true is
  // not satisfied, the prompt is 0px — there's no empty placeholder.
  const showGraduationPrompt =
    Boolean(address) &&
    profileConfig.moneyPurpose !== "upcoming_payment" &&
    graduationData?.shouldShow === true &&
    !graduationDismissed &&
    graduationData.signals != null;

  // Track regime tip once per session (unchanged behaviour)
  useEffect(() => {
    if (marketRegime && !hasTrackedRegimeTip.current) {
      const groups = classifyAssets(activePortfolio.allTokens || []);
      const totalVal = groups.totalValue;
      const stableRatio = totalVal > 0 ? groups.trackedValue / totalVal : 0;
      const tip = getRegimeTip(marketRegime.regime, stableRatio);
      if (tip) {
        hasTrackedRegimeTip.current = true;
        trackRegimeTip(marketRegime.regime, stableRatio);
      }
    }
  }, [marketRegime, activePortfolio, trackRegimeTip]);

  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  // Build the full tip list (used by the Smart Tips accordion section).
  // Kept intact for parity with the original behaviour — `primaryTip` from
  // the hook is what the hero shows, this list is what Smart Tips shows.
  const chainErrors = activePortfolio.errors ?? [];

  // Resolve a one-line drift summary for the goal-drift banner.
  const goalDriftMessage = React.useMemo(() => {
    if (!profileComplete || !profileConfig.userGoal) return undefined;
    const goal = profileConfig.userGoal;
    const gs = activePortfolio.goalScores;
    if (goal === "inflation_protection" && gs.hedge < 60) {
      return `Hedge score ${Math.round(gs.hedge)}% — below your 60% goal.`;
    }
    if (goal === "geographic_diversification" && gs.diversify < 60) {
      return `Diversification ${Math.round(gs.diversify)}% — below your 60% goal.`;
    }
    if (goal === "rwa_access" && gs.rwa === 0) {
      return "No real-world assets yet — your RWA goal isn't being met.";
    }
    return undefined;
  }, [profileComplete, profileConfig.userGoal, activePortfolio.goalScores]);

  return (
    <div className="space-y-4">
      {/* Sticky in-page nav — appears once user scrolls past the hero.
          Hidden when there are fewer than 2 nav items (e.g. beginner mode). */}
      <HomeNav
        sections={home.sections}
        moreOptionsId="home-more-options"
      />

      {/* Chain RPC errors — compact inline banner, one per failed chain */}
      {chainErrors.length > 0 && (
        <div className="space-y-1">
          {chainErrors.map((err, i) => (
            <DataError key={i} message={err} onRetry={refreshBalances} compact />
          ))}
        </div>
      )}

      {/* ── 1. CONTEXTUAL BANNER (single slot, 4 variants) ────────────
          Replaces the previous 4 competing full-bleed banners. */}
      <ContextualBanner
        kind={home.banner}
        isDemo={isDemo}
        demoValue={hasHoldings ? totalValue : undefined}
        goalDriftMessage={goalDriftMessage}
        goalDriftActionLabel="Rebalance"
        dailyClaimText={
          portfolio.goalScores && home.banner === "daily-claim"
            ? "Tap to claim — keeps your streak alive"
            : undefined
        }
        userRegion={userRegion}
        chainId={chainId}
        address={address}
        setActiveTab={setActiveTab}
        onDisableDemo={onDisableDemo}
        onEnableDemo={onEnableDemo}
        onDismissFxCorridorHint={() => {
          // Dismiss + scroll the FX Corridor section into view. The
          // dismiss callback persists the dismissal in localStorage so
          // the hint never reappears on this device.
          home.dismissFxCorridorHint();
          if (typeof document !== "undefined") {
            const el = document.getElementById("business");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
      />

      {/* ── 2. HERO ─────────────────────────────────────────────────────
          Opening artifact: currency moment (or honest inflation fallback,
          or the legacy score/total). Holdings geography sits under it as
          a quiet second beat — never a second coloured hero. */}
      <section
        id="home-hero"
        data-home-section="home-hero"
        aria-labelledby="home-hero-title"
        className="scroll-mt-20 space-y-4"
      >
        {moment ? (
          <>
            <h2 id="home-hero-title" className="sr-only">
              Your currency this year
            </h2>
            <CurrencyMomentCard
              moment={moment}
              benchmarks={benchmarks}
              horizons={horizons}
              onSelectBenchmark={handleMomentBenchmark}
              onSelectHorizon={handleMomentHorizon}
              onAmountChange={setSavingsAmount}
              onProtect={() => setActiveTab("protect")}
              onChangeCountry={onChangeCountry}
              frame={frame}
            />
          </>
        ) : inflationMoment ? (
          <InflationMomentCard
            moment={inflationMoment}
            onAmountChange={setSavingsAmount}
            onChangeCountry={onChangeCountry}
            onProtect={() => setActiveTab("protect")}
          />
        ) : (
          <Card className="text-center">
            <div
              id="home-hero-title"
              className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400"
            >
              {home.isBeginner
                ? "Home Overview"
                : adaptiveConfig.content.hero.icon && `${adaptiveConfig.content.hero.icon} ` + adaptiveConfig.content.hero.type}
            </div>
            <HeroValue
              value={home.isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
              label={home.isBeginner ? "Protection Score" : "Total Value"}
            />
            <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
              {diversificationRating}
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center items-center">
              {(() => {
                const ctaLabel = home.isBeginner
                  ? (hasHoldings ? "Review Your Shield" : "Set Up Your Plan")
                  : adaptiveConfig.content.hero.ctaLabel;
                const ctaTab = home.isBeginner
                  ? (hasHoldings ? "exchange" : "protect")
                  : (adaptiveConfig.content.hero.ctaTab as TabId | null);
                if (!ctaLabel) return null;
                return (
                  <button
                    onClick={() => setActiveTab(ctaTab ?? (hasHoldings ? "exchange" : "protect"))}
                    className="min-h-[44px] px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
                  >
                    {ctaLabel}
                  </button>
                );
              })()}
            </div>
          </Card>
        )}

        {/* Holdings geography — quiet card, one job the opening artifact
            doesn't name. Standard/advanced with holdings only. */}
        {showExposureDial && (
          <Card>
            <HomeExposureDial
              regionData={regionData}
              totalValue={totalValue}
              selectedRegion={focusedRegion}
              onSelectRegion={handleDialSelect}
              onProtect={() => setActiveTab("protect")}
              onAskGuardian={(region) =>
                askAdvisor(
                  `How exposed am I to ${region}? Review my ${region} holdings and tell me whether that concentration fits my goal.`,
                )
              }
            />
          </Card>
        )}

        {home.isBeginner && home.primaryTip && hasHoldings && (
          <div className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Next Best Move
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {home.primaryTip}
            </p>
          </div>
        )}
      </section>

      {/* ── 2.5. PROTECTION SCORECARD (philosophy-aware) ──────────────
          When the moment is the opening artifact, this is the same
          "where you stand" job in more dimensions — demote it (one-in-
          one-out). Legacy hero (no moment) keeps it always-open. */}
      {home.showProtectionScorecard && hasHoldings && (
        hasMomentHero ? (
          <DisclosureSection
            id="home-protection-standing"
            title="Protection standing"
            summary="Currency exposure, plan alignment, Guardian readiness"
            icon="🛡️"
          >
            <ProtectionScorecard
              portfolio={portfolio}
              activePortfolio={activePortfolio}
              setActiveTab={setActiveTab}
            />
          </DisclosureSection>
        ) : (
          <ProtectionScorecard
            portfolio={portfolio}
            activePortfolio={activePortfolio}
            setActiveTab={setActiveTab}
          />
        )
      )}

      {/*
        ── 2.55. STRATEGY METRICS + ZAKAT (philosophy-aware) ────────────
        StrategyMetrics renders philosophy-aligned metrics (Pan-African
        exposure, Sharia compliance, Buen Vivir harmony, etc.) right
        below the scorecard. Zakat calculator augments the Islamic
        Finance philosophy with the 2.5% nisab obligation — the
        natural deliverable for a user who picked that philosophy.

        `strategyMetricsData` converts `activePortfolio` (pie-chart
        shape: region + value + color) into the percentage-exposure +
        chains + tokens shape StrategyMetrics expects.
      */}
      {home.showStrategyMetrics && hasHoldings && (
        <DisclosureSection
          id="home-philosophy-alignment"
          title="Philosophy alignment"
          summary="How your holdings align with your values lens"
          icon="🧭"
        >
          <StrategyMetrics
            portfolioData={{
              regions: regionData.reduce<Record<string, number>>(
                (acc, r) => {
                  acc[r.region] = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
                  return acc;
                },
                {},
              ),
              chains: Array.isArray((activePortfolio as { chains?: unknown }).chains)
                ? ((activePortfolio as { chains: unknown[] }).chains
                    .map((c) => (typeof c === "string" ? c : (c as { name?: string })?.name))
                    .filter((c): c is string => typeof c === "string"))
                : [],
              tokens: (activePortfolio.allTokens ?? []).map((t) => ({
                symbol: t.symbol,
                balance: t.balance,
                value: t.value,
              })),
            }}
          />
        </DisclosureSection>
      )}

      {home.showZakat && hasHoldings && (
        <DisclosureSection
          id="home-zakat"
          title="Zakat calculator"
          summary="2.5% nisab obligation on your current holdings"
          icon="🕌"
        >
          <ZakatCalculator totalPortfolioValue={totalValue} />
        </DisclosureSection>
      )}

      {/* NOTE (Wave 9 anti-duplication): PaymentCycleReport has ONE home — the
          Shield tab. It rendered on both tabs before; the Home copy was
          removed so no text block names a job another block already names. */}

      {/* ── GRADUATION PROMPT (Phase 4) ───────────────────────────────
          Detected trader pattern surfaces here. Density-aware: 0px when
          no signal OR user is SME-graduated OR dismissed. The explore
          CTA scrolls to the FX Corridor section in the Insight Accordion
          (the business section). The dismiss CTA is persistent — the
          user's GuardianState is updated cross-device.
          Gated: only shown when the business surface is enabled for this
          persona (adaptiveConfig.content.showBusiness). */}
      {adaptiveConfig.content.showBusiness &&
        showGraduationPrompt && graduationData && (
        <BusinessPromptCard
          confidence={graduationData.confidence}
          signals={graduationData.signals}
          onDismiss={dismissGraduationPrompt}
          onExplore={() => {
            // Find the FX Corridor HomeSection (its `id="business"` is
            // bound by `sections.id`). If it's collapsed, the user can
            // tap to expand after the scroll completes. Scrolling into
            // view is enough — we don't force-open because that's
            // opinionated state manipulation.
            if (typeof document !== "undefined") {
              const el = document.getElementById("business");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        />
      )}

      {home.showGuardianChip && (
        <GuardianStatusChip
          onSetup={() => setActiveTab("protect")}
          onDeposit={() => setActiveTab("exchange")}
          onViewActivity={openAdvisor}
        />
      )}

      {/* ── 3. PROTECTION MIX ─────────────────────────────────────────
          One-in-one-out: the exposure dial already is the regional mix
          for standard/advanced with holdings. Beginners (no dial) keep
          the pie. Deep analysis stays as its own collapsed section. */}
      {home.showProtectionMix && !showExposureDial && (
        <section
          id="protection-mix"
          data-home-section="protection-mix"
          aria-labelledby="protection-mix-title"
          className="scroll-mt-20"
        >
          {home.isBeginner ? (
            <Section>
              <div className="flex items-center justify-between mb-4">
                <h3 id="protection-mix-title" className="text-sm font-bold text-gray-900 dark:text-white">
                  Your Protection Mix
                </h3>
                <span className="text-xs font-bold text-gray-500">{regionData.length} Regions</span>
              </div>
              <SimplePieChart data={regionData} />
              <div className="mt-4 flex flex-wrap justify-center gap-2 mb-6">
                {regionData.map((r) => (
                  <div
                    key={r.region}
                    className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-full"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                      {r.region}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setActiveTab("protect")}
                    className="w-full min-h-[44px] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
                  >
                    Start Protecting
                  </button>
                  <button
                    onClick={() => {
                      const newVal = !showAssetDetails;
                      setShowAssetDetails(newVal);
                      trackAssetDetailsToggle(newVal);
                    }}
                    className="w-full min-h-[44px] flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <span>{showAssetDetails ? "Hide" : "View"} Asset Details</span>
                    <span>{showAssetDetails ? "↑" : "↓"}</span>
                  </button>
                </div>
                {showAssetDetails && (
                  <div className="mt-4">
                    <AssetInventory tokens={activePortfolio.allTokens || []} />
                  </div>
                )}
              </div>
            </Section>
          ) : (
            <ProtectionAnalysis
              regionData={regionData}
              totalValue={totalValue}
              goalScores={portfolio.goalScores}
              diversificationScore={diversificationScore}
              diversificationRating={diversificationRating}
              onOptimize={() => setActiveTab("protect")}
              onSwap={() => setActiveTab("exchange")}
              chainId={chainId}
              onNetworkChange={refreshChainId ? handleRefresh : undefined}
              refreshBalances={refreshBalances}
              yieldSummary={portfolio}
            />
          )}
        </section>
      )}

      {!home.isBeginner && hasHoldings && (
        <DisclosureSection
          id="home-deep-analysis"
          title="Deep analysis"
          summary="Risk, concentration and portfolio health breakdowns"
          icon="🔬"
        >
          <DiversificationHealthCard
            analysis={activePortfolio}
            isLoading={activePortfolio.isLoading}
            onTakeAction={(opp) =>
              navigateToSwap({
                fromToken: opp.fromToken,
                toToken: opp.toToken,
                amount: String(opp.suggestedAmount),
                reason: `Rebalance ${opp.fromRegion} → ${opp.toRegion}`,
              })
            }
          />
        </DisclosureSection>
      )}

      {/*
        ── 3.5. REGIONAL INSIGHTS (geo-specific recommendations) ──────────
        Compares the user's current regional allocation to the typical
        pattern for their region (Africa / USA / Europe / LatAm / Asia).
        Hidden in beginner mode to keep the page scannable; the
        home-section flag ensures the gate is centralized alongside
        every other visibility decision in `useHomeSections`.
      */}
      {home.showRegionalInsights && (
        <section
          id="regional-insights"
          data-home-section="regional-insights"
          className="scroll-mt-20"
        >
          <DisclosureSection
            id="home-regional-insights"
            title="Regional insights"
            summary="How your allocation compares to your region's pattern"
            icon="🌍"
          >
            <RegionalRecommendations
              userRegion={userRegion}
              currentAllocations={regionData.reduce<Record<string, number>>(
                (acc, r) => {
                  acc[r.region] = totalValue > 0 ? r.value / totalValue : 0;
                  return acc;
                },
                {},
              )}
              onSelectToken={(token) =>
                navigateToSwap({ fromToken: token, reason: `Add ${token} exposure` })
              }
            />
          </DisclosureSection>
        </section>
      )}

      {!home.isBeginner && hasHoldings && (
        <section id="inflation-protection" data-home-section="inflation-protection" className="scroll-mt-20">
          <DisclosureSection
            id="home-inflation-protection"
            title="Inflation protection"
            summary="How your home currency's inflation shapes the plan"
            icon="🛡️"
          >
            <InflationProtectionInfo
              homeRegion={userRegion}
              currentRegions={regionData
                .filter((r) => REGIONS.includes(r.region as any))
                .map((r) => r.region as Region)}
              onChangeHomeRegion={setUserRegion}
            />
          </DisclosureSection>
        </section>
      )}

      {/* ── 4. INSIGHT ACCORDION (deep sections, default-collapsed) ────
          The user can pick which section to expand based on what they
          came to the home page for: market context, personal tips, or
          rewards. The teasers help them decide without expanding. */}
      {home.showInsightAccordion &&
        home.sections.map((section) => (
          <HomeSection
            key={section.id}
            id={section.id}
            title={section.title}
            icon={section.icon}
            teaser={section.teaser}
            defaultOpen={section.defaultOpen}
            badge={
              section.id === "smart-tips" && tips.length > 0
                ? (() => {
                    const totalTips = tips.length;
                    return (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                        {totalTips}
                      </span>
                    );
                  })()
                : undefined
            }
          >
            {section.id === "market-intel" && <GuardianPulse />}
            {section.id === "smart-tips" && (
              <div className="space-y-2">
                {tips.slice(0, 3).map((tip, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg"
                  >
                    <span className="text-amber-600 dark:text-amber-400 font-bold text-sm mt-0.5">
                      •
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                      {tip}
                    </span>
                  </div>
                ))}
                {tips.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    No tips right now. Check back as the market shifts.
                  </p>
                )}
              </div>
            )}
            {section.id === "rewards" && (
              <div className="space-y-4">
                <StreakRewardsCard onSaveClick={() => setActiveTab("exchange")} />
                <RewardsStats />
              </div>
            )}
            {section.id === "agent" && (
              <AgentTierStatus
                showActivityFeed={true}
                onNavigateToAgent={() => setActiveTab("agent")}
                onNavigateToFund={() => setActiveTab("exchange")}
              />
            )}
            {section.id === "business" && adaptiveConfig.content.showBusiness && (
              /*
                FX Corridor — the SME-graduated surface. Mounts the 4
                staged enterprise-fx components:

                - EmergingMarketsTracker: real-time corridor prices
                  (uses its own hooks — useEmergingMarketsPrices,
                  useWatchlist). No props needed.
                - PortfolioRiskWidget: working-capital risk dashboard
                  (uses its own useRiskAssessment hook). No props.
                - RiskMetrics: pure-props card showing liquidation
                  risk, IV, sentiment, vol trend for a single asset.
                - TradeIntelligence: macro-signal pill. Smart-empty —
                  returns null (0px) when no fresh signal exists. The
                  items come from `useMacroSignals()` which wraps the
                  proof feed (no extra fetch) and filters for
                  `MACRO_SIGNAL:*` actions. Items are universal
                  (impactAsset stripped), so the pill shows the
                  latest fresh signal regardless of corridor.

                The 4 components are framed as "FX corridor" / "SME
                working capital" tools, not crypto-trading. This is
                the retail-to-business graduation moment per
                docs/strategy.md §4 — the visible hand-off.
              */
              <div className="space-y-3" data-testid="business-dashboard">
                <EmergingMarketsTracker showFictionalCTA={false} />
                <PortfolioRiskWidget />
                <RiskMetrics />
                <TradeIntelligence items={macroSignals} selectedAsset="FX" />
                <CaribbeanFxNetCard />
              </div>
            )}
          </HomeSection>
        ))}

      {/* ── 5. EMPTY-STATE FUNNEL (only when truly empty) ──────────────
          Skipped if a contextual banner is already rendering the
          cold-start or empty guidance. Avoids double-prompting. */}
      {!hasHoldings && home.banner === null && (
        <Card
          padding="p-6"
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-2 border-blue-200 dark:border-blue-800"
        >
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">🛡️</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {home.isBeginner ? "Ready to Protect Your Savings?" : "Start Your Protection"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xs mx-auto">
              {home.isBeginner
                ? "Inflation can reduce purchasing power over time. Review the context before choosing an approach."
                : "Review diversification options across currencies and asset types."}
            </p>
          </div>

          {/* Milestone-oriented next steps — collapsed to a single row of
              chips to keep the empty state scannable. */}
          <ol className="space-y-2">
            <li className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-black text-blue-600 dark:text-blue-400 shrink-0">1</div>
              <span className="text-xs font-bold text-gray-900 dark:text-white flex-1">Connect wallet</span>
              <span className="text-emerald-500 text-sm">✓</span>
            </li>
            <li className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">2</div>
              <span className="text-xs font-bold text-gray-900 dark:text-white flex-1">Add funds</span>
            </li>
            <li className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">3</div>
              <span className="text-xs font-bold text-gray-900 dark:text-white flex-1">Make your first swap</span>
            </li>
          </ol>

          {home.isBeginner && (
            <button
              onClick={() => setActiveTab("exchange")}
              className="mt-4 w-full py-2.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 rounded-xl text-sm font-bold transition-colors hover:bg-violet-100"
            >
              🧪 Try the test drive first
            </button>
          )}
        </Card>
      )}

      {/* ── 6. SETTINGS & REGION (collapsed by default) ───────────────
          Region selector + Two Chains marketing + MiniPay footnote now
          live in one disclosure row instead of three stacked cards. */}
      {(home.isBeginner || home.showRegionSelector || home.showTwoChainsBanner) && (
        <MoreOptions
          id="home-more-options"
          userRegion={userRegion}
          setUserRegion={setUserRegion}
          regions={REGIONS}
          showTwoChainsBanner={home.showTwoChainsBanner && !home.isBeginner}
          isMiniPay={isMiniPay}
          showPowerActions={home.isBeginner}
          onNavigateToExchange={() => setActiveTab("exchange")}
          onOpenAdvisor={openAdvisor}
        />
      )}
    </div>
  );
}
