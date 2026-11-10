/**
 * NotConnectedState — Home's unconnected morph.
 *
 * The Risk Theater object works without a wallet (it is geo + currency
 * data, not wallet data), so unconnected Home keeps the same instrument
 * grammar as connected Home: the moment card is the object, the connect
 * wallet button is the one CTA attached to it, and the ledger is the same
 * object under a different band — Verify re-slices the coins into the
 * Guardian's decisions rather than stacking a panel below them. No hero
 * card, no proof card, no how-it-works stack (§5: state morphs the object;
 * §3: the controls teach themselves).
 */
import React from "react";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { trackFunnelEvent } from "@/lib/analytics";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { CurrencyStoryInspector } from "./CurrencyStoryInspector";
import { CountryPicker } from "./CountryPicker";
import { HomeLedgerStage } from "./HomeLedgerStage";
import { SignInPrimer } from "./SignInPrimer";
import { InflationMomentCard } from "./InflationMomentCard";
import { StageBands } from "../../shared/StageBands";
import { VerifiedEvidencePanel } from "@/components/shared/VerifiedEvidence";
import { useProofFeed } from "@/hooks/use-proof-feed";
import { ledgerViewFrom } from "@/lib/shield-ledger-view";
import { useReservedHeight } from "@/hooks/use-reserved-height";
import { DEFAULT_ACCENT } from "@/components/shared/palette";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import WalletButton from "../../wallet/WalletButton";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { useNavigation } from "@/context/app/NavigationContext";

interface NotConnectedStateProps {
  isActive?: boolean;
}

export function NotConnectedState({
  isActive = true,
}: NotConnectedStateProps) {
  const {
    inspectedCurrency,
    setInspectedCurrency,
    moment,
    inflationMoment,
    isLoading,
    countryCode,
    countryIsDefault,
    benchmarks,
    horizons,
    setBenchmark,
    setHorizon,
    setSavingsAmount,
    onChangeCountry,
    frame,
    viewingShared,
    clearSharedView,
  } = useCurrencyMoment({ fallbackCountryCode: 'NG' });
  const { navigateWithIntent } = useNavigation();

  const selectBenchmark = (b: Benchmark) => {
    setBenchmark(b);
    trackFunnelEvent("marquee_select", { benchmark: b, source: "home_moment" });
  };
  const selectHorizon = (h: Horizon) => {
    setHorizon(h);
    trackFunnelEvent("marquee_select", { horizon: h, source: "home_moment" });
  };

  const storySelected = inspectedCurrency !== null;

  // Home's presenter grammar, walletless: the coin stage is the object and
  // Verify rewrites it into the ledger. The ledger is public — an
  // unconnected visitor reads the same records a connected one does, so
  // this surface carries the trust door too (§7).
  const [band, setBand] = React.useState<"story" | "verify">("story");
  const {
    data: liveFeed,
    isLoading: feedLoading,
    isStale: feedStale,
    error: feedError,
  } = useProofFeed();
  const ledgerView = React.useMemo(
    () =>
      ledgerViewFrom(liveFeed, {
        isLoading: feedLoading,
        isStale: feedStale,
        error: feedError,
      }),
    [liveFeed, feedLoading, feedStale, feedError],
  );
  const coinStageShowing = Boolean(moment || inflationMoment);
  const verifyMorphs =
    band === "verify" && coinStageShowing && ledgerView.state === "ready";
  const { ref: stageRef, style: stageFloor } = useReservedHeight();

  const object = (
    <div className="relative space-y-3">
      <div hidden={storySelected} data-testid="home-comparison">
        {/* The floor is the object and its reading — the tallest band Home
            holds. The pill row rides below the floor, so it never moves and
            stays in the first viewport; the connect CTA and the primer are
            the column's tail. */}
        <div ref={stageRef} style={stageFloor}>
          {verifyMorphs ? (
            <HomeLedgerStage
              ledger={ledgerView}
              accent={frame?.accent ?? DEFAULT_ACCENT}
            />
          ) : moment ? (
          <CurrencyMomentCard
            moment={moment}
            onAmountChange={setSavingsAmount}
            onChangeCountry={onChangeCountry}
            frame={frame}
            onInspectCurrency={() => {
              if (inspectedCurrency !== moment.currencyCode) {
                trackFunnelEvent("currency_story_opened", {
                  currency: moment.currencyCode,
                  source: "home_walletless",
                });
              }
              setInspectedCurrency((prev) =>
                prev === moment.currencyCode ? null : moment.currencyCode,
              );
            }}
            currencySelected={inspectedCurrency === moment.currencyCode}
            viewingShared={viewingShared}
            onClearSharedView={clearSharedView}
            countryIsDefault={countryIsDefault}
            rememberVisit={isActive && !viewingShared && !countryIsDefault}
            liveAlive={isActive}
            onProtect={() =>
              navigateWithIntent("protect", {
                source: "home",
                lens: "compare",
                currencyCode: moment.currencyCode,
                example: countryIsDefault || Boolean(viewingShared),
              })
            }
            protectLabel="Explore plans from this reading"
          />
        ) : inflationMoment ? (
          <InflationMomentCard
            moment={inflationMoment}
            onAmountChange={setSavingsAmount}
            onChangeCountry={onChangeCountry}
            onProtect={() =>
              navigateWithIntent("protect", { source: "home", lens: "compare" })
            }
            protectLabel="Explore protection plans"
          />
        ) : isLoading ? (
          <div className="text-center py-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Detecting your region…
            </p>
          </div>
        ) : (
          // Detection failed (geo blocked, VPN, offline) — the honest fallback
          // is an ACTIONABLE one: the same "whose savings?" control the moment
          // cards use, so the instruction and the affordance always travel
          // together (§5: selection rewrites the artefact). No card chrome —
          // InstrumentShell owns the surface.
          <div className="text-center space-y-3">
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
        )}
        {/* Verify reads the object, so its reading lives in the floored slot
            directly under the coins. */}
        {band === "verify" && (
          <div data-testid="home-verifier" className="mx-auto w-full max-w-[420px]">
            <VerifiedEvidencePanel presentation="stage" />
          </div>
        )}
        </div>
        <StageBands
          testIdBase="home"
          groupLabel="What Home shows"
          options={[{ id: "verify", label: "Verify" }]}
          active={band}
          onSelect={(id) => setBand(id === band ? "story" : "verify")}
        />
        {/* The one CTA — attached to the object, no card wrapper. */}
        <WalletButton
          variant={moment || inflationMoment ? "minimal" : "primary"}
          className="w-full mt-3"
        />
        <SignInPrimer />
      </div>
      <CurrencyStoryInspector
        code={inspectedCurrency}
        onClose={() => setInspectedCurrency(null)}
        presentation="stage"
        reading={
          moment
            ? {
                benchmark: moment.benchmark,
                horizon: moment.horizon,
                benchmarks,
                horizons,
                onSelectBenchmark: selectBenchmark,
                onSelectHorizon: selectHorizon,
              }
            : null
        }
      />
    </div>
  );

  // Home's walletless foot is empty by contract: the verifier lives in the
  // stage that reads it, the sample-plan switch lives in the header.
  return (
    <InstrumentShell object={object} inspectorOpen={storySelected} />
  );
}
