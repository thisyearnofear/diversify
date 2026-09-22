/**
 * Home — instrument: Risk Theater (coin motif, always on).
 * The coin stage is the one expressive object; holdings are a quiet
 * strip beneath it, never a second ring. Region tap opens InspectorSheet.
 */

import React, { useCallback } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";
import { DataError, HeroValue } from "../../shared/TabComponents";
import { ContextualBanner } from "../../shared/ContextualBanner";
import { ClaimRail } from "../../rewards/ClaimRail";
import { useHomeSections } from "@/hooks/use-home-sections";
import { useAdvisor } from "@/hooks/use-advisor";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import { HomeRiskTheater } from "./HomeRiskTheater";
import { trackFunnelEvent } from "@/lib/analytics";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { useNavigation } from "@/context/app/NavigationContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { STRATEGIES } from "@/hooks/useFinancialStrategies";
import { CountryOverrideSelect } from "./CountryOverrideSelect";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { InspectorSheet } from "../../shared/InspectorSheet";
import { InstrumentWait } from "../../shared/InstrumentWait";
import ZakatCalculator from "../../portfolio/ZakatCalculator";
import { buildWalletPortfolioView } from "@/lib/wallet-portfolio-view";
import { DataFreshnessIndicator } from "../../shared/DataFreshnessIndicator";
import { VerifiedEvidence } from "../../shared/VerifiedEvidence";
import { GuardianCadenceLine } from "../../shared/LiveProofCard";

interface ConnectedOverviewProps {
  isActive?: boolean;
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
  isActive = true,
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
      trackFunnelEvent("marquee_select", { region, source: "home_theater" });
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
    countryCode,
    frame,
  } = useCurrencyMoment();
  const { navigateToCompare, navigateToNetting } = useNavigation();
  const { config: profileConfig } = useProtectionProfile();
  const philosophyName = profileConfig.philosophy
    ? STRATEGIES.find((s) => s.id === profileConfig.philosophy)?.name ?? null
    : null;

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
  const selected = regionData.find((r) => r.region === focusedRegion) ?? null;
  const selectedPct =
    selected && totalValue > 0 ? (selected.value / totalValue) * 100 : 0;

  const chainErrors = activePortfolio.errors ?? [];
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const handleRefresh = React.useCallback(async () => {
    await refreshBalances?.();
  }, [refreshBalances]);

  // The coin stage is always the hero. Holdings never swap it out — they
  // add a quiet strip beneath it. One object, one color, one CTA.
  // While the wallet fan-out settles, keep the instrument grammar (coin + job line), not a skeleton.
  const isWaitingForWallet = portfolio.isLoading && !moment && !inflationMoment && !activePortfolio.lastUpdated;
  const object = isWaitingForWallet ? (
    <InstrumentWait label="Reading your wallet" symbol="$" />
  ) : moment || inflationMoment ? (
    <HomeRiskTheater
      moment={moment}
      inflationMoment={inflationMoment}
      benchmarks={benchmarks}
      horizons={horizons}
      onSelectBenchmark={handleMomentBenchmark}
      onSelectHorizon={handleMomentHorizon}
      onAmountChange={setSavingsAmount}
      onProtect={() => setActiveTab("protect")}
      protectLabel={philosophyName ? `See your ${philosophyName} shield` : undefined}
      onChangeCountry={onChangeCountry}
      frame={frame}
      regionData={regionData}
      totalValue={totalValue}
      focusedRegion={focusedRegion}
      onSelectRegion={handleDialSelect}
      isDemo={isDemo}
      isActive={isActive}
    />
  ) : (
    // No card here — InstrumentShell owns the one surface; the fallback
    // hero is bare content inside it.
    <div className="text-center" data-testid="home-fallback-hero">
      <div
        id="home-hero-title"
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400"
      >
        {home.isBeginner
          ? "Home Overview"
          : adaptiveConfig.content.hero.icon &&
            `${adaptiveConfig.content.hero.icon} ` + adaptiveConfig.content.hero.type}
      </div>
      {hasHoldings && (
        <>
          <HeroValue
            value={home.isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
            label={home.isBeginner ? "Protection Score" : "Total Value"}
          />
          <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {diversificationRating}
          </p>
        </>
      )}
      {/* Geo failed — same actionable fallback the unconnected morph uses:
          the instruction and the affordance travel together (§5). */}
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          We could not detect your country — choose where your savings live
          to see your specific currency risk.
        </p>
        <CountryOverrideSelect
          currentCountryCode={countryCode ?? ''}
          currentCountryName=''
          onChange={onChangeCountry}
        />
      </div>
      {(() => {
        const ctaLabel = home.isBeginner
          ? philosophyName
            ? `See your ${philosophyName} shield`
            : "Set up your plan"
          : adaptiveConfig.content.hero.ctaLabel;
        const ctaTab = home.isBeginner
          ? "protect"
          : (adaptiveConfig.content.hero.ctaTab as TabId | null);
        if (!ctaLabel) return null;
        return (
          <div className="mt-5">
            <button
              onClick={() =>
                setActiveTab(ctaTab ?? "protect")
              }
              className="min-h-[44px] px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
            >
              {ctaLabel}
            </button>
          </div>
        );
      })()}
    </div>
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
          isDemo={isDemo}
          isLoading={portfolio.isLoading}
          error={chainErrors.length > 0 ? chainErrors[0] : null}
          onRefresh={refreshBalances ? handleRefresh : undefined}
        />
        <div className="flex flex-col items-end gap-1">
          <VerifiedEvidence />
          {/* Informed mode only: the same measured cadence the compact proof
              card carries, kept right under the trust line it quantifies. */}
          <GuardianCadenceLine />
        </div>
      </div>
      {philosophyName && (
        <button
          type="button"
          onClick={navigateToCompare}
          className="min-h-[44px] text-sm font-semibold text-blue-600 dark:text-blue-400"
          data-testid="home-compare-link"
        >
          Compare philosophies →
        </button>
      )}
      {home.primaryTip && hasHoldings && (
        <p className="text-sm text-gray-600 dark:text-gray-300">{home.primaryTip}</p>
      )}
      {home.isPaymentCycle && (
        <button
          type="button"
          onClick={navigateToNetting}
          className="min-h-[44px] text-sm font-semibold text-blue-600 dark:text-blue-400"
        >
          Match this payment against a counterparty →
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
          navigateToNetting();
        }}
      />
      {/* The persistent daily-G$ rail — morphs through claim states
          (ready / verify / unlock / claimed); null when nothing to say. */}
      <ClaimRail />
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
