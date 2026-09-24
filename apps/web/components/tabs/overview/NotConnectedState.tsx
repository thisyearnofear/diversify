/**
 * NotConnectedState — Home's unconnected morph.
 *
 * The Risk Theater object works without a wallet (it is geo + currency
 * data, not wallet data), so unconnected Home keeps the same instrument
 * grammar as connected Home: the moment card is the object, the connect
 * wallet button is the one CTA attached to it, and trust/demo live in the
 * status tier as quiet lines. No hero card, no proof card, no how-it-works
 * stack (§5: state morphs the object; §3: the controls teach themselves).
 */
import React from "react";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { trackFunnelEvent } from "@/lib/analytics";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { CurrencyStoryInspector } from "./CurrencyStoryInspector";
import { CountryOverrideSelect } from "./CountryOverrideSelect";
import { InflationMomentCard } from "./InflationMomentCard";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import WalletButton from "../../wallet/WalletButton";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { UnconnectedStatusTier } from "../../shared/UnconnectedStatusTier";

interface NotConnectedStateProps {
  isActive?: boolean;
  onEnableDemo: () => void;
}

export function NotConnectedState({
  isActive = true,
  onEnableDemo,
}: NotConnectedStateProps) {
  const {
    moment,
    inflationMoment,
    isLoading,
    countryCode,
    benchmarks,
    horizons,
    setBenchmark,
    setHorizon,
    setSavingsAmount,
    onChangeCountry,
    frame,
    viewingShared,
    clearSharedView,
  } = useCurrencyMoment();
  const [inspectedCurrency, setInspectedCurrency] = React.useState<string | null>(null);

  const selectBenchmark = (b: Benchmark) => {
    setBenchmark(b);
    trackFunnelEvent("marquee_select", { benchmark: b, source: "home_moment" });
  };
  const selectHorizon = (h: Horizon) => {
    setHorizon(h);
    trackFunnelEvent("marquee_select", { horizon: h, source: "home_moment" });
  };

  const object = (
    <div className="space-y-3">
      {moment ? (
        <CurrencyMomentCard
          moment={moment}
          benchmarks={benchmarks}
          horizons={horizons}
          onSelectBenchmark={selectBenchmark}
          onSelectHorizon={selectHorizon}
          onAmountChange={setSavingsAmount}
          onChangeCountry={onChangeCountry}
          frame={frame}
          onInspectCurrency={() =>
            setInspectedCurrency((prev) =>
              prev === moment.currencyCode ? null : moment.currencyCode,
            )
          }
          currencySelected={inspectedCurrency === moment.currencyCode}
          viewingShared={viewingShared}
          onClearSharedView={clearSharedView}
          rememberVisit={isActive && !viewingShared}
        />
      ) : inflationMoment ? (
        <InflationMomentCard
          moment={inflationMoment}
          onAmountChange={setSavingsAmount}
          onChangeCountry={onChangeCountry}
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
          <CountryOverrideSelect
            currentCountryCode={countryCode ?? ''}
            currentCountryName=''
            onChange={onChangeCountry}
          />
        </div>
      )}
      {/* The one CTA — attached to the object, no card wrapper. */}
      <WalletButton variant="primary" className="w-full" />
      <CurrencyStoryInspector
        code={inspectedCurrency}
        onClose={() => setInspectedCurrency(null)}
      />
    </div>
  );

  const status = <UnconnectedStatusTier onEnableDemo={onEnableDemo} />;

  return <InstrumentShell object={object} status={status} />;
}
