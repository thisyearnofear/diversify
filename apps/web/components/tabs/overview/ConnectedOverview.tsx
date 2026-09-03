/**
 * Home — instrument: currency moment + holdings dial.
 * Region tap opens InspectorSheet. No feature catalog.
 */

import React, { useCallback } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";
import { Card, DataError, HeroValue } from "../../shared/TabComponents";
import { ContextualBanner } from "../../shared/ContextualBanner";
import { useHomeSections } from "@/hooks/use-home-sections";
import { useAdvisor } from "@/hooks/use-advisor";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import { HomeExposureDial } from "./HomeExposureDial";
import { trackFunnelEvent } from "@/lib/analytics";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { InflationMomentCard } from "./InflationMomentCard";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { InspectorSheet } from "../../shared/InspectorSheet";
import ZakatCalculator from "../../portfolio/ZakatCalculator";
import { buildWalletPortfolioView } from "@/lib/wallet-portfolio-view";
import { DataFreshnessIndicator } from "../../shared/DataFreshnessIndicator";

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
  const walletView = buildWalletPortfolioView(portfolio);
  const liveTotalValue = isDemo ? totalValue : walletView.totalUsd;

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

  const chainErrors = activePortfolio.errors ?? [];
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const handleRefresh = React.useCallback(async () => {
    await refreshBalances?.();
  }, [refreshBalances]);

  // A connected wallet gets one primary object: the live exposure dial. The
  // currency moment remains the fallback instrument when the wallet is empty
  // or regional holdings are unavailable — never stacked above the dial.
  const object = showExposureDial ? (
    <HomeExposureDial
      regionData={regionData}
      totalValue={totalValue}
      selectedRegion={focusedRegion}
      onSelectRegion={handleDialSelect}
      watermark={isDemo ? "Sample data" : undefined}
    />
  ) : moment ? (
    <section id="home-hero" aria-labelledby="home-hero-title">
      <h2 id="home-hero-title" className="sr-only">
        Your currency this year
      </h2>
      {isDemo && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">Sample data</p>
      )}
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
    </section>
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
            className="min-h-[44px] text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Ask Guardian about this region
          </button>
          {home.showZakat && <ZakatCalculator totalPortfolioValue={totalValue} />}
        </div>
      )}
    </InspectorSheet>
  );

  const status = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <DataFreshnessIndicator
          lastUpdated={portfolio.lastUpdated}
          isStale={portfolio.isStale}
          hasEstimates={portfolio.hasEstimates}
          isLoading={portfolio.isLoading}
          error={chainErrors.length > 0 ? chainErrors[0] : null}
          onRefresh={refreshBalances ? handleRefresh : undefined}
        />
      </div>
      {showExposureDial && moment && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {moment.currencyCode} buying power is {moment.delta < 0 ? "down" : moment.delta > 0 ? "up" : "flat"}{" "}
          {Math.abs(moment.delta).toFixed(0)}% vs {moment.benchmarkLabel} over {moment.horizon}.
        </p>
      )}
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
      <ContextualBanner
        placement="status"
        kind={home.banner}
        isDemo={isDemo}
        demoValue={hasHoldings ? liveTotalValue : undefined}
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
      <InstrumentShell object={object} inspector={inspector} status={status} />
    </div>
  );
}
