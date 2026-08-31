import React from "react";
import { useCurrencyMoment } from "@/hooks/use-currency-moment";
import { trackFunnelEvent } from "@/lib/analytics";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { InflationMomentCard } from "./InflationMomentCard";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import WalletButton from "../../wallet/WalletButton";
import { Card } from "../../shared/TabComponents";
import { UnconnectedStateShell } from "../../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../../shared/UnconnectedStateShell";

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

  const HOW_IT_WORKS: HowItWorksStep[] = [
    {
      icon: "🪙",
      title: "Make the story yours",
      text: "Scrub the horizon, pick a benchmark. The number is your savings, not an index.",
    },
    {
      icon: "🛡️",
      title: "Protect on your terms",
      text: "Hold stablecoins from any exchange, connect your wallet, choose a philosophy. The Guardian handles allocation — no lock-ups, no subscriptions.",
    },
  ];

  const heroCard = (
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
      <Card padding="p-4" className="text-center">
        <WalletButton variant="primary" className="w-full" />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Connect a wallet to protect what matters — or open the demo below.
        </p>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <UnconnectedStateShell
        heroCard={heroCard}
        howItWorks={HOW_IT_WORKS}
        onEnableDemo={onEnableDemo}
      />
    </div>
  );
}
