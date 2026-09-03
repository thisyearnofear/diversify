/**
 * Learn — instrument: wealth-protection calculator.
 *
 * Amount + years is the object. Year tap opens InspectorSheet (method,
 * inflation source, philosophy mix). One CTA to Shield. Funding lives
 * in the wallet dropdown and Shield's empty-wallet morph — not here.
 */

import React, { useEffect, useMemo, useState } from "react";
import type { Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useInflationData } from "@/hooks/use-inflation-data";
import { exampleSavingsFor } from "@/constants/currency-risk";
import { STRATEGIES } from "@/hooks/useFinancialStrategies";
import { FALLBACK_INFLATION_DATA } from "@/constants/inflation";
import { trackFunnelEvent } from "@/lib/analytics";
import {
  inflationForToken,
  localInflationRate,
  mixForPhilosophy,
  mixLabelFor,
  seriesFor,
  type InflationRates,
} from "@/lib/learn/protection-calculator";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import { ProtectionCalculator } from "../inflation/ProtectionCalculator";
import InfoSkeleton from "../ui/skeletons/InfoSkeleton";
import { TokenIcon } from "../shared/TokenIcon";
import { useWalletContext } from "../wallet/WalletProvider";
import { useSharedMultichainBalances } from "@/context/app/PortfolioContext";
import { buildWalletPortfolioView } from "@/lib/wallet-portfolio-view";
import { DataFreshnessIndicator } from "../shared/DataFreshnessIndicator";

const YEARS = 5;

interface InfoTabProps {
  userRegion: Region;
  isLoading?: boolean;
  setActiveTab: (tab: TabId) => void;
  refreshBalances?: () => Promise<void>;
}

function rateMap(
  inflationData: Record<string, { avgRate?: number } | undefined>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [region, entry] of Object.entries(FALLBACK_INFLATION_DATA)) {
    map[region] = entry.avgRate;
  }
  for (const [region, entry] of Object.entries(inflationData)) {
    if (typeof entry?.avgRate === "number") map[region] = entry.avgRate;
  }
  return map;
}

function sourceLine(dataSource: string, year: string): string {
  if (dataSource === "api") return `IMF ${year}`;
  if (dataSource === "cache") return `IMF ${year} (cached)`;
  return `IMF fallback ${year}`;
}

export default function InfoTab({ userRegion, isLoading, setActiveTab, refreshBalances }: InfoTabProps) {
  const { config } = useProtectionProfile();
  const { address } = useWalletContext();
  const portfolio = useSharedMultichainBalances(address);
  const { currencyCode } = useCurrencyRisk();
  const { inflationData, dataSource, getDataFreshness } = useInflationData();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const previousAddress = React.useRef(address);
  useEffect(() => {
    if (previousAddress.current !== address) {
      setSelectedYear(null);
      previousAddress.current = address;
    }
  }, [address]);
  const [amount, setAmount] = useState(10_000);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const walletView = buildWalletPortfolioView(portfolio);

  const code = currencyCode ?? "USD";
  useEffect(() => {
    if (address && walletView.totalUsd > 0) {
      setAmount((current) => (seededFor === "wallet" ? current : Math.round(walletView.totalUsd)));
      setSeededFor("wallet");
      return;
    }
    if (!currencyCode || seededFor === currencyCode || seededFor === "wallet") return;
    setAmount(exampleSavingsFor(currencyCode));
    setSeededFor(currencyCode);
  }, [address, currencyCode, seededFor, walletView.totalUsd]);

  const philosophy = config.philosophy ?? null;
  const mix = useMemo(() => mixForPhilosophy(philosophy), [philosophy]);
  const mixLabel = mixLabelFor(
    philosophy,
    mix,
    STRATEGIES.find((s) => s.id === philosophy)?.name,
  );

  const rates: InflationRates = useMemo(() => {
    const byRegion = rateMap(inflationData);
    const local = localInflationRate(userRegion, byRegion);
    return {
      local,
      usd: byRegion.USA ?? 4.1,
      eur: byRegion.Europe ?? 6.8,
      africa: byRegion.Africa ?? local,
      latam: byRegion.LatAm ?? local,
      asia: byRegion.Asia ?? local,
      europe: byRegion.Europe ?? 6.8,
    };
  }, [inflationData, userRegion]);

  const series = useMemo(
    () => seriesFor(amount, mix, rates, YEARS),
    [amount, mix, rates],
  );

  const displayYear = selectedYear ?? YEARS;
  const freshness = getDataFreshness();
  const source = sourceLine(dataSource, freshness.mostRecentYear || "2023");
  const amountLabel = address && walletView.totalUsd > 0 ? "Wallet value (editable)" : "Your savings amount";

  const handleSelectYear = (year: number) => {
    setSelectedYear((prev) => (prev === year ? null : year));
    trackFunnelEvent("marquee_select", {
      year: String(year),
      source: "learn_calculator",
    });
  };

  if (isLoading) {
    return <InfoSkeleton />;
  }

  const inspectorYear = selectedYear ?? displayYear;
  const inspectorPoint = series[inspectorYear] ?? series[series.length - 1];
  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className="p-4">
      <InstrumentShell
        object={
          <ProtectionCalculator
            amount={amount}
            onAmountChange={setAmount}
            amountLabel={amountLabel}
            currencyCode={code}
            series={series}
            selectedYear={displayYear}
            years={YEARS}
            mixLabel={mixLabel}
            onSelectYear={handleSelectYear}
            onProtect={() => setActiveTab("protect")}
            ctaLabel={
              philosophy ? "See this on Shield" : "Choose a plan on Shield"
            }
          />
        }
        inspector={
          <InspectorSheet
            selectedId={selectedYear === null ? null : `year-${selectedYear}`}
            onClose={() => setSelectedYear(null)}
            title={`Year ${inspectorYear}`}
          >
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
              Cash buys {code} {fmt(inspectorPoint.cash)} after {rates.local.toFixed(1)}%
              a year. {mixLabel} buys {code} {fmt(inspectorPoint.protected)}.
            </p>
            <ul className="space-y-2 mb-3">
              {mix.map((slice) => (
                <li
                  key={slice.token}
                  className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <TokenIcon symbol={slice.token} size={18} />
                    <span className="font-semibold truncate">
                      {slice.percent}% {slice.token}
                    </span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {inflationForToken(slice.token, rates).toFixed(1)}% inflation
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Purchasing power after inflation — not yield. Gold holds. Pegged
              stables follow their peg. Local stables still erode at local
              inflation.
            </p>
          </InspectorSheet>
        }
        status={
          <div className="space-y-2">
            <DataFreshnessIndicator
              lastUpdated={portfolio.lastUpdated}
              isStale={portfolio.isStale}
              hasEstimates={portfolio.hasEstimates}
              isLoading={portfolio.isLoading || Boolean(isLoading)}
              error={portfolio.errors?.[0] ?? null}
              onRefresh={refreshBalances}
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
            ● {address && walletView.totalUsd > 0 ? `Based on your ${walletView.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} wallet value · ` : ""}{userRegion} {rates.local.toFixed(1)}% a year · {source} · history,
            not advice.
            </p>
          </div>
        }
      />
    </div>
  );
}
