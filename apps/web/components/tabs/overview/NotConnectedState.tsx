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
import { InflationMomentCard } from "./InflationMomentCard";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import WalletButton from "../../wallet/WalletButton";
import { Card } from "../../shared/TabComponents";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { VerifiedEvidence } from "../../shared/VerifiedEvidence";

interface NotConnectedStateProps {
  onEnableDemo: () => void;
}

export function NotConnectedState({
  onEnableDemo,
}: NotConnectedStateProps) {
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
        />
      ) : inflationMoment ? (
        <InflationMomentCard
          moment={inflationMoment}
          onAmountChange={setSavingsAmount}
          onChangeCountry={onChangeCountry}
        />
      ) : (
        <Card className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            We could not detect your country yet — pick a region to see your
            specific currency risk.
          </p>
        </Card>
      )}
      {/* The one CTA — attached to the object, no card wrapper. */}
      <WalletButton variant="primary" className="w-full" />
    </div>
  );

  const status = (
    <div className="flex items-center justify-between gap-3">
      <VerifiedEvidence />
      <button
        type="button"
        onClick={onEnableDemo}
        className="min-h-[44px] px-2 text-xs font-semibold text-blue-600 dark:text-blue-400"
      >
        Explore a sample plan
      </button>
    </div>
  );

  return <InstrumentShell object={object} status={status} />;
}
