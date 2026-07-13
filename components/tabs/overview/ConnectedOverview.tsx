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
import { Tooltip } from "../../shared/Tooltip";
import { GuardianPulse } from "../../agent/GuardianPulse";
import { useWalletContext } from "../../wallet/WalletProvider";
import { ContextualBanner } from "../../shared/ContextualBanner";
import { HomeSection } from "../../shared/HomeSection";
import { HomeNav } from "../../shared/HomeNav";
import { MoreOptions } from "../../shared/MoreOptions";
import { useHomeSections } from "@/hooks/use-home-sections";
import { useMacroSignals } from "@/hooks/use-macro-signals";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useAdvisor } from "@/hooks/use-advisor";
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import { getBeginnerPrimaryTip, type ProtectionUserGoal } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import { ProtectionScorecard } from "./ProtectionScorecard";
import { PaymentCycleReport } from "../protect/PaymentCycleReport";
import ZakatCalculator from "../../portfolio/ZakatCalculator";
import StrategyMetrics from "../../portfolio/StrategyMetrics";
import RegionalRecommendations from "../../regional/RegionalRecommendations";
import EmergingMarketsTracker from "../../enterprise-fx/EmergingMarketsTracker";
import PortfolioRiskWidget from "../../enterprise-fx/PortfolioRiskWidget";
import RiskMetrics from "../../enterprise-fx/RiskMetrics";
import TradeIntelligence from "../../enterprise-fx/TradeIntelligence";

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
    source?: "api" | "cache" | "fallback";
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
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();
  const marketRegime = useMarketRegime();
  const { trackAssetDetailsToggle, trackRegimeTip } = useAnalytics();
  const hasTrackedRegimeTip = useRef(false);
  const { isMiniPay } = useWalletContext();
  const { openAdvisor, askAdvisor } = useAdvisor();
  const { currencyCode } = useCurrencyRisk();
  const { navigateToSwap } = useNavigation();
  const [showAssetDetails, setShowAssetDetails] = React.useState(false);

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

  const {
    diversificationScore,
    diversificationRating,
    totalValue,
    regionData,
    diversificationTips,
  } = activePortfolio;

  const hasHoldings = totalValue > 0;

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
          id="home-hero" so HomeNav can scroll to the top of the page. */}
      <section
        id="home-hero"
        data-home-section="home-hero"
        aria-labelledby="home-hero-title"
        className="scroll-mt-20"
      >
        <Card
          padding="p-0"
          className="text-center relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/10 dark:via-gray-900 dark:to-indigo-900/10 border border-blue-100/80 dark:border-blue-900/60 shadow-[0_20px_50px_-20px_rgba(37,99,235,0.25)]"
        >
          <div className="relative z-10 p-6 sm:p-7">
            <div
              id="home-hero-title"
              className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 shadow-sm"
            >
              <span className="size-1.5 rounded-full bg-blue-500" />
              Home Overview
            </div>
            <HeroValue
              value={home.isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
              label={home.isBeginner ? "Protection Score" : "Total Value"}
            />
            <div className="mt-2 flex justify-center">
              <Tooltip
                analyticsLabel="whats_this_score"
                content={
                  home.isBeginner
                    ? "Your protection score reflects how well your stablecoin savings are spread across regions — higher is better."
                    : "Score reflects diversification across tracked stablecoin regions. Volatile tokens (CELO, ETH, WBTC) are shown in your asset mix but don't count. Open 'View Asset Details' below to see the split."
                }
                side="bottom"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 cursor-help">
                  What&apos;s this?
                </span>
              </Tooltip>
            </div>
            <div
              className={`mt-3 text-sm font-bold px-4 py-1.5 rounded-full inline-block shadow-sm ${
                diversificationScore >= 80
                  ? "bg-green-100 text-green-800"
                  : diversificationScore >= 60
                    ? "bg-blue-100 text-blue-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {diversificationRating}
            </div>
            {home.isBeginner && hasHoldings && (
              <p className="text-sm text-gray-500 mt-4 max-w-xs mx-auto leading-relaxed">
                Your savings are currently{" "}
                <strong>{diversificationScore}% protected</strong> from currency risk.
              </p>
            )}

            {/* Single primary CTA. Secondary CTAs are demoted to text links
                so they don't compete with the hero action. */}
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={() =>
                  setActiveTab(hasHoldings ? "exchange" : "protect")
                }
                className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:translate-y-[-1px]"
              >
                {hasHoldings ? "Review Your Shield" : "Set Up Your Plan"}
              </button>
              {hasHoldings && (
                <button
                  onClick={() => setActiveTab("protect")}
                  className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                >
                  Adjust plan →
                </button>
              )}
            </div>

            {/* Primary tip — only in beginner mode and only when we have one.
                In standard/advanced, the tip moves to the Smart Tips section. */}
            {home.isBeginner && home.primaryTip && hasHoldings && (
              <div className="mt-4 p-3 rounded-2xl bg-white/85 dark:bg-gray-900/85 border border-blue-100 dark:border-blue-900 text-left max-w-md mx-auto shadow-sm backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
                  Next Best Move
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {home.primaryTip}
                </p>
              </div>
            )}
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-25%] left-[-10%] w-48 h-48 bg-indigo-500/8 rounded-full blur-3xl" />
        </Card>
      </section>

      {/* ── 2.5. PROTECTION SCORECARD (philosophy-aware) ──────────────
          Shows how the user's chosen philosophy is performing relative
          to their currency risk. Only renders when the user has holdings
          and a currency risk entry exists. */}
      {home.showProtectionScorecard && hasHoldings && (
        <ProtectionScorecard
          portfolio={portfolio}
          activePortfolio={activePortfolio}
          setActiveTab={setActiveTab}
        />
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
      )}

      {home.showZakat && hasHoldings && (
        <ZakatCalculator totalPortfolioValue={totalValue} />
      )}

      {profileConfig.moneyPurpose === 'upcoming_payment' && (
        <PaymentCycleReport
          defaultLocalCurrency={currencyCode ?? undefined}
          onAskGuardian={(prompt) => askAdvisor(prompt)}
        />
      )}

      {home.showGuardianChip && (
        <GuardianStatusChip
          onSetup={() => setActiveTab("protect")}
          onDeposit={() => setActiveTab("exchange")}
          onViewActivity={openAdvisor}
        />
      )}

      {/* ── 3. PROTECTION MIX (always-open in holdings; default-open is
          the first thing a user sees below the hero) ─────────────── */}
      {home.showProtectionMix && (
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
                <span className="text-xs font-bold text-blue-600">{regionData.length} Regions</span>
              </div>
              <SimplePieChart data={regionData} />
              <div className="mt-4 flex flex-wrap justify-center gap-2 mb-6">
                {regionData.map((r) => (
                  <div
                    key={r.region}
                    className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-full shadow-sm"
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
                    onClick={() => setActiveTab(home.isBeginner ? "protect" : "exchange")}
                    className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                  >
                    {home.isBeginner ? "Start Protecting" : "Improve My Protection"}
                  </button>
                  <button
                    onClick={() => {
                      const newVal = !showAssetDetails;
                      setShowAssetDetails(newVal);
                      trackAssetDetailsToggle(newVal);
                    }}
                    className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <span>{showAssetDetails ? "Hide" : "View"} Asset Details</span>
                    <span>{showAssetDetails ? "↑" : "↓"}</span>
                  </button>
                </div>
                {showAssetDetails && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AssetInventory tokens={activePortfolio.allTokens || []} />
                  </div>
                )}
              </div>
            </Section>
          ) : (
            <>
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
                className="mt-4"
              />
            </>
          )}
        </section>
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
        </section>
      )}

      {!home.isBeginner && hasHoldings && (
        <section id="inflation-protection" data-home-section="inflation-protection" className="scroll-mt-20">
          <InflationProtectionInfo
            homeRegion={userRegion}
            currentRegions={regionData
              .filter((r) => REGIONS.includes(r.region as any))
              .map((r) => r.region as Region)}
            onChangeHomeRegion={setUserRegion}
          />
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
            {section.id === "business" && (
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
                docs/sme-fx-strategy.md §4 — the visible hand-off.
              */
              <div className="space-y-3" data-testid="business-dashboard">
                <EmergingMarketsTracker showFictionalCTA={false} />
                <PortfolioRiskWidget />
                <RiskMetrics />
                <TradeIntelligence items={macroSignals} selectedAsset="FX" />
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
