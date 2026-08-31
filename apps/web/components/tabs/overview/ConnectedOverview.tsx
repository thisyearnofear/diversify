/**
 * Home — instrument: currency moment + holdings dial.
 * Region tap opens InspectorSheet. No feature catalog.
 */

import React, { useCallback } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";
import { Card, DataError, HeroValue } from "../../shared/TabComponents";
import SimplePieChart from "../../portfolio/SimplePieChart";
import { ContextualBanner } from "../../shared/ContextualBanner";
import { useHomeSections } from "@/hooks/use-home-sections";
import { useAdvisor } from "@/hooks/use-advisor";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import { useProtectionProfile } from "../../../hooks/use-protection-profile";
import { HomeExposureDial } from "./HomeExposureDial";
import { trackFunnelEvent } from "@/lib/analytics";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { InflationMomentCard } from "./InflationMomentCard";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { InspectorSheet } from "../../shared/InspectorSheet";
import ZakatCalculator from "../../portfolio/ZakatCalculator";

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
  setActiveTab,
  refreshBalances,
  onDisableDemo,
  onEnableDemo,
}: ConnectedOverviewProps) {
  const { config: adaptiveConfig } = useAdaptiveContext();
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();
  const { askAdvisor } = useAdvisor();
  const [focusedRegion, setFocusedRegion] = React.useState<string | null>(null);

  const handleDialSelect = useCallback((region: string | null) => {
    setFocusedRegion(region);
    if (region) {
      trackFunnelEvent("marquee_select", { region, source: "home_dial" });
    }
  }, []);

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

  const handleMomentBenchmark = useCallback(
    (b: Benchmark) => {
      setBenchmark(b);
      trackFunnelEvent("marquee_select", { benchmark: b, source: "home_moment" });
    },
    [setBenchmark],
  );
  const handleMomentHorizon = useCallback(
    (h: Horizon) => {
      setHorizon(h);
      trackFunnelEvent("marquee_select", { horizon: h, source: "home_moment" });
    },
    [setHorizon],
  );

  const {
    diversificationScore,
    diversificationRating,
    totalValue,
    regionData,
  } = activePortfolio;

  const home = useHomeSections({
    portfolio,
    isDemo,
    userRegion,
    chainId,
  });

  const hasHoldings = totalValue > 0;
  const showExposureDial = home.showDial && regionData.length > 0;
  const selected = regionData.find((r) => r.region === focusedRegion) ?? null;
  const selectedPct =
    selected && totalValue > 0 ? (selected.value / totalValue) * 100 : 0;

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

  const chainErrors = activePortfolio.errors ?? [];
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const object = (
    <section id="home-hero" aria-labelledby="home-hero-title" className="space-y-4">
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
              : adaptiveConfig.content.hero.icon &&
                `${adaptiveConfig.content.hero.icon} ` + adaptiveConfig.content.hero.type}
          </div>
          <HeroValue
            value={home.isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
            label={home.isBeginner ? "Protection Score" : "Total Value"}
          />
          <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {diversificationRating}
          </p>
          {(() => {
            const ctaLabel = home.isBeginner
              ? hasHoldings
                ? "Review Your Shield"
                : "Set Up Your Plan"
              : adaptiveConfig.content.hero.ctaLabel;
            const ctaTab = home.isBeginner
              ? hasHoldings
                ? "exchange"
                : "protect"
              : (adaptiveConfig.content.hero.ctaTab as TabId | null);
            if (!ctaLabel) return null;
            return (
              <div className="mt-5">
                <button
                  onClick={() =>
                    setActiveTab(ctaTab ?? (hasHoldings ? "exchange" : "protect"))
                  }
                  className="min-h-[44px] px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
                >
                  {ctaLabel}
                </button>
              </div>
            );
          })()}
        </Card>
      )}

      {showExposureDial && (
        <HomeExposureDial
          regionData={regionData}
          totalValue={totalValue}
          selectedRegion={focusedRegion}
          onSelectRegion={handleDialSelect}
        />
      )}

      {home.isBeginner && hasHoldings && regionData.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            Your Protection Mix
          </h3>
          <SimplePieChart
            data={regionData.map((r) => ({
              name: r.region,
              value: r.value,
              color: r.color,
            }))}
          />
        </div>
      )}
    </section>
  );

  const inspector = (
    <InspectorSheet
      selectedId={focusedRegion}
      onClose={() => setFocusedRegion(null)}
      title={focusedRegion ?? "Region"}
    >
      {selected && (
        <div className="space-y-3 text-left">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {selectedPct >= 50 ? (
              <>
                More than half your savings sit in <strong>{selected.region}</strong>{" "}
                ({fmt(selected.value)}) — one region&apos;s currency risk carries
                most of your plan.
              </>
            ) : selectedPct >= 30 ? (
              <>
                <strong>{Math.round(selectedPct)}%</strong> of your savings sit in{" "}
                <strong>{selected.region}</strong> — meaningful exposure worth
                watching.
              </>
            ) : (
              <>
                A light <strong>{Math.round(selectedPct)}%</strong> of your savings
                sit in <strong>{selected.region}</strong>.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("protect")}
            className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
          >
            Strengthen {selected.region} coverage in Shield
          </button>
          <button
            type="button"
            onClick={() =>
              askAdvisor(
                `How exposed am I to ${selected.region}? Review my ${selected.region} holdings and tell me whether that concentration fits my goal.`,
              )
            }
            className="min-h-[44px] w-full rounded-xl text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Ask Guardian about my {selected.region} exposure
          </button>
          {home.showZakat && <ZakatCalculator totalPortfolioValue={totalValue} />}
        </div>
      )}
    </InspectorSheet>
  );

  const status = (
    <div className="space-y-2">
      {home.primaryTip && hasHoldings && (
        <p className="text-sm text-gray-600 dark:text-gray-300">{home.primaryTip}</p>
      )}
      {home.isPaymentCycle && (
        <button
          type="button"
          onClick={() => setActiveTab("exchange")}
          className="min-h-[44px] text-sm font-semibold text-blue-600 dark:text-blue-400"
        >
          Payment-cycle tools live on Exchange
        </button>
      )}
    </div>
  );

  return (
    <div>
      {chainErrors.length > 0 && (
        <div className="space-y-1 mb-3">
          {chainErrors.map((err, i) => (
            <DataError key={i} message={err} onRetry={refreshBalances} compact />
          ))}
        </div>
      )}
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
          home.dismissFxCorridorHint();
          setActiveTab("exchange");
        }}
      />
      <InstrumentShell object={object} inspector={inspector} status={status} />
    </div>
  );
}
