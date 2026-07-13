import React, { useState, useEffect } from "react";
import type { Region } from "../../hooks/use-user-region";
import type { RegionalInflationData } from "../../hooks/use-inflation-data";
import RealLifeScenario from "../demo/RealLifeScenario";
import DashboardCard from "../shared/DashboardCard";
import SwapRecommendations from "./SwapRecommendations";
import InflationBenefitCard from "./InflationBenefitCard";
import { useProtectionProfile } from "../../hooks/use-protection-profile";

// Primary stablecoin per region — the first entry of REGION_STABLECOINS in
// hooks/use-inflation-data.ts. Kept inline here (rather than imported) so
// this file doesn't pull the inflation-data module into the swap bundle.
// Fulfills the TODO: "replace with region→token mapping from
// config/emerging-markets" — the mapping is the primary stablecoin per
// region, which is what SwapInsightsPanel already implies when it asks
// "Save X% by moving from {userRegion} to {targetRegion}".
//
// Only the 5 valid GeographicRegion values are listed (no "Global" or
// "Commodities" — those are inflation-data keys, not user regions).
const PRIMARY_STABLECOINS: Record<Region, string> = {
  Africa: "KESm",
  LatAm: "BRLm",
  Asia: "PHPm",
  Europe: "EURm",
  USA: "USDm",
};

interface SwapInsightsPanelProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
}

export default function SwapInsightsPanel({
  userRegion,
  inflationData,
}: SwapInsightsPanelProps) {
  const [targetRegion, setTargetRegion] = useState<Region>("Africa");
  const { config: profileConfig } = useProtectionProfile();

  useEffect(() => {
    if (Object.keys(inflationData).includes("Global")) {
      setTargetRegion("Global" as Region);
    } else if (userRegion === "Africa") {
      setTargetRegion("USA");
    } else if (userRegion === "USA") {
      setTargetRegion("Europe");
    } else {
      setTargetRegion("Africa");
    }
  }, [userRegion, inflationData]);

  const homeInflationRate = inflationData[userRegion]?.avgRate || 0;
  const targetInflationRate = inflationData[targetRegion]?.avgRate || 0;
  const inflationDifference = homeInflationRate - targetInflationRate;

  return (
    <div className="space-y-4">
      <DashboardCard
        title="Inflation Comparison"
        subtitle={`${userRegion} vs ${targetRegion}`}
        icon={<span>🛡️</span>}
        color="amber"
        size="md"
      >
        <div className="text-xs font-medium text-gray-500 mb-3">
          Compare your local inflation against other regions
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(inflationData).map((r) => (
            <button
              key={r}
              onClick={() => setTargetRegion(r as Region)}
              className={`px-3 py-1 rounded-full text-xs font-black uppercase transition-colors ${
                targetRegion === r
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl flex justify-between items-center border border-amber-100/50 dark:border-amber-900/20">
          <div className="text-center">
            <div className="text-xs font-black text-gray-400 uppercase tracking-tighter mb-1">
              Your Region ({userRegion})
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {homeInflationRate.toFixed(1)}%
            </div>
          </div>
          <div className="flex flex-col items-center px-2">
            <div className="text-gray-300 text-xl">→</div>
            {inflationDifference !== 0 && (
              <div
                className={`mt-1 text-xs font-black px-1.5 py-0.5 rounded ${
                  inflationDifference > 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {inflationDifference > 0 ? "+" : ""}
                {inflationDifference.toFixed(1)}%
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs font-black text-gray-400 uppercase tracking-tighter mb-1">
              Target ({targetRegion})
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {targetInflationRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        title="Action Guidance"
        icon={<span>🧠</span>}
        color="blue"
        size="md"
      >
        <RealLifeScenario
          region={userRegion}
          targetRegion={targetRegion}
          scenarioType="remittance"
          inflationRate={homeInflationRate}
          targetInflationRate={targetInflationRate}
          amount={1000}
          monthlyAmount={100}
        />
        <SwapRecommendations
          userRegion={userRegion}
          inflationData={inflationData}
          homeInflationRate={homeInflationRate}
          userGoal={profileConfig.userGoal}
          riskTolerance={profileConfig.riskTolerance}
          timeHorizon={profileConfig.timeHorizon}
        />
        {/*
          InflationBenefitCard — the retail trust-builder that converts the
          abstract "+X% inflation delta" into a per-swap outcome
          ("Save X% by swapping from {fromToken} to {toToken}"). The
          fromToken / toToken are the primary stablecoin per region
          (PRIMARY_STABLECOINS above) — what a user would actually swap
          to hedge that inflation. The component self-gates via
          hasInflationBenefit; we only forward when the delta is positive.
        */}
        <InflationBenefitCard
          fromToken={PRIMARY_STABLECOINS[userRegion]}
          toToken={PRIMARY_STABLECOINS[targetRegion]}
          fromTokenRegion={userRegion}
          toTokenRegion={targetRegion}
          inflationDifference={inflationDifference}
          hasInflationBenefit={inflationDifference > 0}
        />
      </DashboardCard>
    </div>
  );
}
