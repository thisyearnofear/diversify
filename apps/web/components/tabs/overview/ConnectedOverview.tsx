/**
 * Home — instrument: Risk Theater (coin motif, always on).
 * The coin stage is the one expressive object; holdings are a quiet
 * strip beneath it, never a second ring. Region tap opens InspectorSheet.
 */

import React, { useCallback, useEffect } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";
import { DataError, HeroValue } from "../../shared/TabComponents";
import { ContextualBanner } from "../../shared/ContextualBanner";
import { ClaimRail } from "../../rewards/ClaimRail";
import { useHomeSections } from "@/hooks/use-home-sections";
import { useAdvisor } from "@/hooks/use-advisor";
import { HomeRiskTheater } from "./HomeRiskTheater";
import { CurrencyStoryInspector } from "./CurrencyStoryInspector";
import { trackFunnelEvent } from "@/lib/analytics";
import { useLensOffered } from "@/hooks/use-lens-offered";
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
import { VerifiedEvidence } from "../../shared/VerifiedEvidence";
import { GuardianCadenceLine } from "../../shared/LiveProofCard";
import { StatusTier } from "../../shared/StatusTier";
import { concentrationOf } from "@/lib/home-lens";
import { useGraduationSignal } from "@/hooks/use-graduation-signal";
import { graduationPromptLine, leadGraduationSignal } from "@/lib/graduation-prompt";
import { MoreOptions } from "../../shared/MoreOptions";
import { useAnchorCurrency, useAnchorFx } from "@/hooks/use-anchor-currency";
import { useExperience } from "@/context/app/ExperienceContext";
import { REGIONS as ALL_REGIONS } from "@/hooks/use-user-region";

const HOME_LENS_KEY = "diversifi.home.lens";

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
  setUserRegion,
  REGIONS,
  setActiveTab,
  refreshBalances,
  onDisableDemo,
  onEnableDemo,
}: ConnectedOverviewProps) {
  const { askAdvisor } = useAdvisor();
  const { experienceMode, setExperienceMode } = useExperience();
  const [focusedRegion, setFocusedRegion] = React.useState<string | null>(null);
  const [inspectedCurrency, setInspectedCurrency] = React.useState<string | null>(null);
  const { navigateToCompare, navigateWithIntent, lastSettlement, consumeSettlement } = useNavigation();
  const [sealedRegion, setSealedRegion] = React.useState<string | null>(null);
  // The concentration lens is a state of the coin object — preview-only,
  // entered through the transition slot, left via the in-object ←.
  const [lens, setLens] = React.useState<"moment" | "concentration">("moment");

  const handleDialSelect = useCallback((region: string | null) => {
    // One selection at a time — a region pick closes the currency sheet.
    setInspectedCurrency(null);
    setFocusedRegion(region);
    setSealedRegion(null);
    if (region) {
      trackFunnelEvent("marquee_select", { region, source: "home_theater" });
    }
  }, []);

  // Settlement seal: only when refreshed balances actually show the
  // destination token — the receipt's word is never taken on faith.
  // lastUpdated older than the settlement means the refresh hasn't
  // landed yet: wait, don't claim a move balances don't show.
  useEffect(() => {
    if (!isActive || !lastSettlement) return;
    if (
      portfolio.lastUpdated == null ||
      portfolio.lastUpdated <= lastSettlement.settledAt
    ) {
      return;
    }
    const landed = portfolio.allTokens?.find(
      (t) =>
        t.symbol.toLowerCase() === lastSettlement.toToken.toLowerCase() &&
        t.value > 0,
    );
    if (landed) setSealedRegion(landed.region);
    consumeSettlement();
  }, [isActive, lastSettlement, portfolio, consumeSettlement]);

  useEffect(() => {
    if (!isActive) setSealedRegion(null);
  }, [isActive]);

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
    viewingShared,
    clearSharedView,
  } = useCurrencyMoment();
  const { config: profileConfig } = useProtectionProfile();
  const anchor = useAnchorCurrency(portfolio);
  const anchorFx = useAnchorFx(anchor.anchorCurrency);
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
  const concentration = React.useMemo(
    () => concentrationOf(regionData, totalValue),
    [regionData, totalValue],
  );

  // Session memory: restore the lens only while the trigger still holds —
  // never resurrect a lens the balances no longer support. Demo never
  // touches storage.
  React.useEffect(() => {
    if (isDemo) return;
    if (
      sessionStorage.getItem(HOME_LENS_KEY) === "concentration" &&
      concentration
    ) {
      setLens("concentration");
    }
    // Mount-only restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (lens === "concentration" && !concentration) setLens("moment");
  }, [lens, concentration]);

  React.useEffect(() => {
    if (isDemo) return;
    if (lens === "concentration") {
      sessionStorage.setItem(HOME_LENS_KEY, "concentration");
    } else {
      sessionStorage.removeItem(HOME_LENS_KEY);
    }
  }, [lens, isDemo]);

  const home = useHomeSections({
    portfolio,
    isDemo,
    userRegion,
    chainId,
  });

  const hasHoldings = totalValue > 0;

  // Retail → business graduation (strategy.md Phase 4). Behaviour, not
  // self-declaration: the endpoint reads the wallet's own swaps and saved
  // cycles. Demo views never read it. Users who already declared a payment
  // purpose get the payment-cycle transition instead, so it never doubles.
  const graduation = useGraduationSignal(isDemo ? null : address);
  const graduationSignals = graduation.data?.signals ?? null;
  const graduationLine =
    !home.isPaymentCycle &&
    graduation.data?.shouldShow &&
    !graduation.isDismissed &&
    graduationSignals
      ? graduationPromptLine(graduationSignals)
      : null;
  const graduationLead = graduationSignals ? leadGraduationSignal(graduationSignals) ?? "none" : "none";
  // Viewed = it's the rendered transition (a banner outranks it), once per mount.
  const graduationShown = Boolean(graduationLine && !home.banner && isActive);
  const graduationViewedRef = React.useRef(false);
  useEffect(() => {
    if (!graduationShown || graduationViewedRef.current) return;
    graduationViewedRef.current = true;
    trackFunnelEvent("graduation_prompt_viewed", { signal: graduationLead });
  }, [graduationShown, graduationLead]);
  const openCycle = useCallback(
    () => navigateWithIntent("protect", { source: "home", lens: "cycle" }),
    [navigateWithIntent],
  );

  // Offered = the prompt is actually the chosen transition (banner,
  // payment-cycle and graduation outrank it) on a live, non-demo surface.
  const concentrationOffered = Boolean(
    !home.banner &&
      !home.isPaymentCycle &&
      !graduationLine &&
      concentration &&
      lens === "moment" &&
      isActive &&
      !isDemo,
  );
  useLensOffered("home", "concentration", concentrationOffered);
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
      onInspectCurrency={
        moment
          ? () => {
              handleDialSelect(null);
              setInspectedCurrency((prev) =>
                prev === moment.currencyCode ? null : moment.currencyCode,
              );
            }
          : undefined
      }
      currencySelected={moment !== null && inspectedCurrency === moment.currencyCode}
      viewingShared={viewingShared}
      onClearSharedView={clearSharedView}
      regionData={regionData}
      totalValue={totalValue}
      focusedRegion={focusedRegion}
      onSelectRegion={handleDialSelect}
      isDemo={isDemo}
      isActive={isActive}
      sealedRegion={sealedRegion}
      lens={lens}
      onLensBack={() => setLens("moment")}
    />
  ) : (
    // No card here — InstrumentShell owns the one surface; the fallback
    // hero is bare content inside it.
    <div className="text-center" data-testid="home-fallback-hero">
      {hasHoldings && (
        <>
          <HeroValue
            value={home.isSimple ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
            label={home.isSimple ? "Protection Score" : "Total Value"}
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
        const ctaLabel = philosophyName
          ? `See your ${philosophyName} shield`
          : "Set up your plan";
        return (
          <div className="mt-5">
            <button
              onClick={() => setActiveTab("protect")}
              className="min-h-tap px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
            >
              {ctaLabel}
            </button>
          </div>
        );
      })()}
    </div>
  );

  const inspector = (
    <>
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
            onClick={() =>
              navigateWithIntent("protect", {
                source: "home",
                region: selected.region,
              })
            }
            className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
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
            className="min-h-tap text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Ask Guardian about this region
          </button>
          {home.showZakat && <ZakatCalculator totalPortfolioValue={totalValue} />}
        </div>
      )}
      </InspectorSheet>
      <CurrencyStoryInspector
        code={inspectedCurrency}
        onClose={() => setInspectedCurrency(null)}
      />
    </>
  );

  const transition = home.banner ? (
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
        openCycle();
      }}
    />
  ) : home.isPaymentCycle ? (
    // Declared payment purpose → the signature business surface: what FX
    // timing costs this cycle. Netting stays one tap away on Exchange.
    <button
      type="button"
      data-testid="home-cycle-link"
      onClick={openCycle}
      className="min-h-tap text-sm font-semibold text-blue-600 dark:text-blue-400"
    >
      See what FX timing costs this payment →
    </button>
  ) : graduationLine ? (
    <div className="flex items-center gap-1 min-w-0" data-testid="home-graduation">
      <button
        type="button"
        onClick={() => {
          trackFunnelEvent("graduation_prompt_clicked", { signal: graduationLead });
          openCycle();
        }}
        className="min-h-tap text-left text-sm font-semibold text-blue-600 dark:text-blue-400"
      >
        {graduationLine}
      </button>
      <button
        type="button"
        aria-label="Not a business — hide this"
        onClick={() => {
          trackFunnelEvent("graduation_prompt_dismissed", { signal: graduationLead });
          void graduation.dismiss();
        }}
        className="min-h-tap min-w-tap shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        ×
      </button>
    </div>
  ) : concentration && lens === "moment" ? (
    <button
      type="button"
      data-testid="home-concentration-link"
      onClick={() => {
        setLens("concentration");
        if (!isDemo) {
          trackFunnelEvent("lens_open", { tab: "home", lens: "concentration" });
        }
      }}
      className="min-h-tap text-sm font-semibold text-blue-600 dark:text-blue-400"
    >
      See your concentration →
    </button>
  ) : home.primaryTip && hasHoldings ? (
    <p className="text-sm text-gray-600 dark:text-gray-300">{home.primaryTip}</p>
  ) : philosophyName ? (
    <button
      type="button"
      onClick={() => navigateToCompare()}
      className="min-h-tap text-sm font-semibold text-blue-600 dark:text-blue-400"
      data-testid="home-compare-link"
    >
      Compare philosophies →
    </button>
  ) : undefined;

  const status = (
    <StatusTier
      trust={
        <div className="flex flex-col items-end gap-1">
          <VerifiedEvidence />
          {/* Informed mode only: the same measured cadence the compact proof
              card carries, kept right under the trust line it quantifies. */}
          <GuardianCadenceLine />
        </div>
      }
      transition={transition}
      rail={<ClaimRail />}
    />
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
      <InstrumentShell
        layout={focusedRegion === null ? "calibrated" : "natural"}
        object={object}
        inspector={inspector}
        status={status}
        portfolio={{
          lastUpdated: portfolio.lastUpdated,
          isStale: portfolio.isStale,
          hasEstimates: portfolio.hasEstimates,
          isDemo,
          isLoading: portfolio.isLoading,
          errors: chainErrors.length ? chainErrors : null,
        }}
        onRefresh={refreshBalances ? handleRefresh : undefined}
      />
      <div className="mt-3">
        <MoreOptions
          userRegion={userRegion}
          setUserRegion={setUserRegion}
          regions={REGIONS ?? ALL_REGIONS}
          showTwoChainsBanner={false}
          experienceMode={experienceMode}
          setExperienceMode={setExperienceMode}
          anchorCurrency={anchor.anchorCurrency}
          anchorSource={anchor.source}
          anchorFx={anchorFx}
          onAnchorChange={anchor.setAnchorCurrency}
        />
      </div>
    </div>
  );
}
