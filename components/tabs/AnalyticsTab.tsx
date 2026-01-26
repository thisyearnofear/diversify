import React, { useState } from "react";
import CurrencyPerformanceChart from "../portfolio/CurrencyPerformanceChart";
import RegionalIconography from "../regional/RegionalIconography";
import type { Region } from "@/hooks/use-user-region";
import { useInflationData } from "@/hooks/use-inflation-data";
import InflationVisualizer from "../inflation/InflationVisualizer";
import { REGION_COLORS } from "@/constants/regions";
import { Card, TabHeader, CollapsibleSection, StatBadge } from "../shared/TabComponents";

interface AnalyticsTabProps {
  currencyPerformanceData: {
    dates: string[];
    currencies: {
      symbol: string;
      name: string;
      region: Region;
      values: number[];
      percentChange: number;
    }[];
    baseCurrency: string;
    source?: "api" | "cache" | "fallback";
  };
  isCurrencyPerformanceLoading: boolean;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  userRegion: string;
  setUserRegion?: (region: Region) => void;
}

// Emerging markets growth data
const EMERGING_MARKETS = {
  Africa: { growth: 4.2, highlight: "Fastest growing mobile money market" },
  LatAm: { growth: 3.1, highlight: "Leading fintech adoption" },
  Asia: { growth: 5.3, highlight: "60% of global digital payments" },
  USA: { growth: 2.1, highlight: "World reserve currency" },
  Europe: { growth: 1.8, highlight: "Strong regulatory framework" },
};

export default function AnalyticsTab({
  currencyPerformanceData,
  isCurrencyPerformanceLoading,
  totalValue,
  userRegion,
  setUserRegion,
}: AnalyticsTabProps) {
  const [localRegion, setLocalRegion] = useState<Region>(userRegion as Region);
  const selectedRegion = setUserRegion ? (userRegion as Region) : localRegion;
  const changeRegion = (region: Region) => {
    if (setUserRegion) setUserRegion(region);
    else setLocalRegion(region);
  };

  const { inflationData } = useInflationData();
  const selectedRegionInflation = inflationData[selectedRegion]?.avgRate || 0;
  const hasHoldings = totalValue > 0;
  const marketData = EMERGING_MARKETS[selectedRegion as keyof typeof EMERGING_MARKETS] || EMERGING_MARKETS.Africa;

  return (
    <div className="space-y-4">
      {/* Main Analytics Card */}
      <Card>
        <TabHeader title="Analytics" showNetworkSwitcher={false} />

        {/* Compact Region Selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(inflationData).map((region) => (
            <button
              key={region}
              onClick={() => changeRegion(region as Region)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
                region === selectedRegion
                  ? "text-white font-medium"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              style={region === selectedRegion ? { backgroundColor: REGION_COLORS[region as keyof typeof REGION_COLORS] } : {}}
            >
              <RegionalIconography region={region as Region} size="sm" className={region === selectedRegion ? "text-white" : ""} />
              {region}
            </button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="flex gap-2 mb-4">
          <StatBadge label="Inflation" value={`${selectedRegionInflation.toFixed(1)}%`} color={selectedRegionInflation > 5 ? "red" : "green"} />
          <StatBadge label="Growth" value={`+${marketData.growth}%`} color="blue" />
          {hasHoldings && <StatBadge label="Holdings" value={`$${totalValue.toFixed(0)}`} color="gray" />}
        </div>

        {/* Market Highlight */}
        <div
          className="p-3 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: REGION_COLORS[selectedRegion as keyof typeof REGION_COLORS] }}
        >
          {marketData.highlight}
        </div>
      </Card>

      {/* Inflation Visualizer */}
      <InflationVisualizer
        region={selectedRegion}
        inflationRate={selectedRegionInflation}
        years={5}
        initialAmount={100}
        safeHavenYield={5.2}
      />

      {/* Currency Performance - Collapsible when loading or for cleaner UI */}
      <CollapsibleSection
        title="Currency Performance"
        icon={<span>📈</span>}
        badge={currencyPerformanceData.source === "api" && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Live</span>}
        defaultOpen={hasHoldings}
      >
        {isCurrencyPerformanceLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <svg className="animate-spin w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          </div>
        ) : (
          <CurrencyPerformanceChart
            data={currencyPerformanceData}
            title="Value of $1 over 30 days"
          />
        )}
      </CollapsibleSection>
    </div>
  );
}
