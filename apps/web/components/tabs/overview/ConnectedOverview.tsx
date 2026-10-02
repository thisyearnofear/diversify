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
import { regionGlyph } from "@/lib/home-lens";
import { CurrencyStoryInspector } from "./CurrencyStoryInspector";
import { trackFunnelEvent } from "@/lib/analytics";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { useNavigation } from "@/context/app/NavigationContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { STRATEGIES } from "@/hooks/useFinancialStrategies";
import { CountryPicker } from "./CountryPicker";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import { Coin } from "../../shared/FloatingCoins";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { InspectorSheet } from "../../shared/InspectorSheet";
import { InstrumentWait } from "../../shared/InstrumentWait";
import ZakatCalculator from "../../portfolio/ZakatCalculator";
import { buildWalletPortfolioView } from "@/lib/wallet-portfolio-view";
import { StatusTier } from "../../shared/StatusTier";
import { useGraduationSignal } from "@/hooks/use-graduation-signal";
import { graduationPromptLine, leadGraduationSignal } from "@/lib/graduation-prompt";
import { MoreOptions } from "../../shared/MoreOptions";
import { useAnchorCurrency, useAnchorFx } from "@/hooks/use-anchor-currency";
import { useExperience } from "@/context/app/ExperienceContext";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";
import { REGIONS as ALL_REGIONS } from "@/hooks/use-user-region";
import { useGuardianVisibility } from "@/context/app/GuardianVisibilityContext";
import { useGuardianSessionInfo } from "@/hooks/use-guardian-session-info";
import { useSinceLastVisit } from "@/hooks/use-since-last-visit";
import { MIN_SNAPSHOT_AGE_MS, formatElapsed } from "@/lib/since-last-visit";
import { timeAgo } from "@/lib/format-duration";

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
  const { navigateToCompare, navigateWithIntent, navigateToGuardian, lastSettlement, consumeSettlement } = useNavigation();
  const [sealedRegion, setSealedRegion] = React.useState<string | null>(null);
  // The concentration lens is a state of the coin object — preview-only,
  // entered through the transition slot, left via the in-object ←.
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

  // Session memory: restore the lens only while the trigger still holds —
  // never resurrect a lens the balances no longer support. Demo never
  // touches storage.
  // Mount-only restore.
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

  // "While you were away" — the Guardian's own weekly counters (server-side,
  // so a capped in-memory log can't inflate them) rendered only in informed
  // mode. Same-week deltas against the last visit's snapshot; across a week
  // boundary the counters reset, so we quote "this week" instead. Missing
  // activityStats (legacy session doc) → the line is omitted, never
  // zero-filled, and decisionLog detail is always labeled "recent".
  const { visibility } = useGuardianVisibility();
  const sessionInfo = useGuardianSessionInfo(visibility === "informed" && !isDemo);
  const activityStats = sessionInfo?.activityStats ?? null;
  const previousActivity = useSinceLastVisit(
    "guardian-activity",
    activityStats
      ? `${activityStats.week}|${activityStats.evaluated}|${activityStats.executed}|${activityStats.declined}`
      : null,
  );
  const guardianAway = (() => {
    if (visibility !== "informed" || !activityStats) return null;
    const now = Date.now();
    let prev: { week: string; evaluated: number; executed: number; declined: number } | null = null;
    if (previousActivity) {
      const [week, ev, ex, de] = previousActivity.value.split("|");
      const parsed = { week: week ?? "", evaluated: Number(ev), executed: Number(ex), declined: Number(de) };
      if ([parsed.evaluated, parsed.executed, parsed.declined].every(Number.isFinite)) {
        prev = parsed;
      }
    }
    const sameWeek = prev && prev.week === activityStats.week;
    const elapsed = prev && previousActivity ? formatElapsed(previousActivity.at, now) : null;
    // Same rule as the currency line: a snapshot younger than 6h is the
    // same session, not a visit — no "while you were away" story to tell.
    if (previousActivity && now - previousActivity.at < MIN_SNAPSHOT_AGE_MS) return null;
    const counts = sameWeek
      ? {
          evaluated: Math.max(0, activityStats.evaluated - prev!.evaluated),
          executed: Math.max(0, activityStats.executed - prev!.executed),
          declined: Math.max(0, activityStats.declined - prev!.declined),
        }
      : {
          evaluated: activityStats.evaluated,
          executed: activityStats.executed,
          declined: activityStats.declined,
        };
    if (!sameWeek && !elapsed && counts.evaluated === 0) return null;
    if (sameWeek && counts.evaluated === 0 && counts.executed === 0 && counts.declined === 0) {
      return null;
    }
    const lead = sameWeek
      ? `Since your last visit (${elapsed ?? "recently"}):`
      : "This week:";
    const parts = [
      `Guardian ran ${counts.evaluated} check${counts.evaluated === 1 ? "" : "s"}`,
      counts.executed > 0 ? `${counts.executed} move${counts.executed === 1 ? "" : "s"}` : null,
      counts.declined > 0 ? `${counts.declined} stand-down${counts.declined === 1 ? "" : "s"}` : null,
      (sessionInfo?.decisionLog?.length ?? 0) > 0 ? "recent decisions in Ask Guardian" : null,
    ].filter(Boolean);
    const line = `${lead} ${parts.join(" · ")}`;
    const recentDecisions = (sessionInfo?.decisionLog ?? [])
      .slice(0, 3)
      .map((d) => `- ${timeAgo(d.capturedAt)}: ${d.reason}`)
      .join("\n");
    const prompt =
      `Guardian, ${lead.toLowerCase()} you ran ${counts.evaluated} checks, ` +
      `${counts.executed} moves and ${counts.declined} stand-downs for me. ` +
      `Walk me through what you did and why.` +
      (recentDecisions ? `\nRecent decisions:\n${recentDecisions}` : "");
    return { line, summary: line, prompt };
  })();

  // Offered = the prompt is actually the chosen transition (banner,
  // payment-cycle and graduation outrank it) on a live, non-demo surface.
  const selected = regionData.find((r) => r.region === focusedRegion) ?? null;
  const selectedPct =
    selected && totalValue > 0 ? (selected.value / totalValue) * 100 : 0;
  const inspectingSelection = focusedRegion !== null || inspectedCurrency !== null;

  const chainErrors = activePortfolio.errors ?? [];
  const { formatMoney: fmt } = useBalanceVisibility();
  const handleRefresh = React.useCallback(async () => {
    await refreshBalances?.();
  }, [refreshBalances]);

  const inspection = (
    <>
      <InspectorSheet
        selectedId={focusedRegion}
        onClose={() => setFocusedRegion(null)}
        title={focusedRegion ?? "Region"}
        presentation="stage"
      >
        {selected && (
          <RegionStageBody
            region={selected.region}
            color={selected.color}
            value={selected.value}
            pct={selectedPct}
            totalValue={totalValue}
            showZakat={home.showZakat}
            onReviewInShield={() =>
              navigateWithIntent("protect", {
                source: "home",
                region: selected.region,
              })
            }
            onAskGuardian={() =>
              askAdvisor(
                `How exposed am I to ${selected.region}? Review my ${selected.region} holdings and tell me whether that concentration fits my goal.`,
              )
            }
          />
        )}
      </InspectorSheet>
      <CurrencyStoryInspector
        code={inspectedCurrency}
        onClose={() => setInspectedCurrency(null)}
        presentation="stage"
      />
    </>
  );

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
      onProtect={focusedRegion === null ? () => setActiveTab("protect") : undefined}
      protectLabel={philosophyName ? "Review protection plan" : undefined}
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
      inspection={inspection}
    />
  ) : (
    // No card here — InstrumentShell owns the one surface; the fallback
    // hero is bare content inside it.
    <div className="text-center" data-testid="home-fallback-hero">
      {hasHoldings && (
        <>
          <HeroValue
            value={home.isSimple ? `${diversificationScore}%` : fmt(totalValue)}
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
        <CountryPicker
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
  ) : guardianAway ? (
    <button
      type="button"
      data-testid="home-guardian-activity-link"
      onClick={() =>
        navigateToGuardian({ summary: guardianAway.summary, prompt: guardianAway.prompt })
      }
      className="min-h-tap text-sm font-semibold text-blue-600 dark:text-blue-400"
    >
      Review Guardian activity →
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
      trust={null}
      transition={inspectingSelection ? undefined : transition}
      rail={<ClaimRail setupMode="entry" />}
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
        inspectorOpen={focusedRegion !== null || inspectedCurrency !== null}
        object={object}
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

function RegionStageBody({
  region,
  color,
  value,
  pct,
  totalValue,
  showZakat,
  onReviewInShield,
  onAskGuardian,
}: {
  region: string;
  color: string;
  value: number;
  pct: number;
  totalValue: number;
  showZakat: boolean;
  onReviewInShield: () => void;
  onAskGuardian: () => void;
}) {
  const { formatMoney: fmt } = useBalanceVisibility();
  const [pane, setPane] = React.useState<"exposure" | "zakat">("exposure");
  const meaning =
    pct >= 50
      ? "One region's currency risk carries most of your plan."
      : pct >= 30
        ? "Meaningful exposure worth watching."
        : "A light share of your savings.";
  return (
    <div className="text-center">
      {showZakat && (
        <div
          role="group"
          aria-label="Region detail"
          className="mb-3 inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-0.5"
        >
          {(["exposure", "zakat"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pane === p}
              onClick={() => setPane(p)}
              className={`min-h-tap px-3 rounded-full text-2xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                pane === p
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {p === "exposure" ? "Exposure" : "Zakat"}
            </button>
          ))}
        </div>
      )}
      {pane === "zakat" && showZakat ? (
        <ZakatCalculator totalPortfolioValue={totalValue} />
      ) : (
        <>
          <div className="flex justify-center">
            <Coin variant="asset" size={64} symbol={regionGlyph(region)} color={color} />
          </div>
          <p className="mt-2 text-4xl font-black tabular-nums text-gray-900 dark:text-white">
            {Math.round(pct)}%
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {region} · {fmt(value)} of {fmt(totalValue)}
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{meaning}</p>
          <button
            type="button"
            onClick={onReviewInShield}
            className="mt-3 min-h-tap w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
          >
            Review in Shield
          </button>
          <button
            type="button"
            onClick={onAskGuardian}
            className="mt-1 min-h-tap text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Ask Guardian about this region
          </button>
        </>
      )}
    </div>
  );
}
