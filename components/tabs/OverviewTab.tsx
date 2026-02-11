import React, { useState } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import { useInflationData } from "@/hooks/use-inflation-data";
import RegionalIconography from "../regional/RegionalIconography";
import { useWalletContext } from "../wallet/WalletProvider";
import WalletButton from "../wallet/WalletButton";
import type { Region } from "@/hooks/use-user-region";
import CurrencyPerformanceChart from "../portfolio/CurrencyPerformanceChart";
import InflationVisualizer from "../inflation/InflationVisualizer";
import ProtectionAnalysis from "../portfolio/ProtectionAnalysis";
import { StreakRewardsCard, RewardsStats } from "../rewards/StreakRewardsCard";
import SimplePieChart from "../portfolio/SimplePieChart";
import { useAppState } from "../../context/AppStateContext";

import { Card, CollapsibleSection, EmptyState, HeroValue } from "../shared/TabComponents";

interface OverviewTabProps {
  portfolio: MultichainPortfolio;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  setActiveTab: (tab: string) => void;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
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
    source?: "api" | "cache" | "fallback";
  };
}

const EMERGING_MARKETS = {
  Africa: { growth: 4.2, highlight: "Fastest growing mobile money market" },
  LatAm: { growth: 3.1, highlight: "Leading fintech adoption" },
  Asia: { growth: 5.3, highlight: "60% of global digital payments" },
  USA: { growth: 2.1, highlight: "World reserve currency" },
  Europe: { growth: 1.8, highlight: "Strong regulatory framework" },
};

export default function OverviewTab({
  portfolio,
  userRegion,
  setUserRegion,
  REGIONS,
  setActiveTab,
  refreshBalances,
  refreshChainId,
  currencyPerformanceData,
}: OverviewTabProps) {
  const { address, isConnecting, chainId } = useWalletContext();
  const { inflationData } = useInflationData();
  const [selectedMarket, setSelectedMarket] = useState<Region>(userRegion);

  const { experienceMode } = useAppState();
  const isBeginner = experienceMode === "beginner";
  const isAdvanced = experienceMode === "advanced";

  const {
    diversificationScore,
    diversificationRating,
    totalValue,
    regionData,
    diversificationTips,
  } = portfolio;



  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  const hasHoldings = totalValue > 0;

  const selectedMarketData = EMERGING_MARKETS[selectedMarket as keyof typeof EMERGING_MARKETS] || EMERGING_MARKETS.Africa;
  const selectedMarketInflation = inflationData[selectedMarket]?.avgRate || 0;

  // Not connected state
  if (!address && !isConnecting) {
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <EmptyState
            icon={<RegionalIconography region={userRegion} size="lg" />}
            title="Protect Your Savings"
            description="Diversify stablecoins across regions to hedge against inflation"
          />
          <div className="mt-4">
            <WalletButton variant="inline" className="w-full" />
          </div>
        </Card>
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className="space-y-4">
        <Card className="text-center py-8">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
              <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-600">Connecting wallet...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. PRIMARY HEALTH SCORE / HERO (Dynamic by Mode) */}
      <Card padding="p-6" className="text-center relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
        <div className="relative z-10">
          <HeroValue
            value={isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
            label={isBeginner ? "Health Score" : "Total Value"}
          />
          <div className={`mt-2 text-sm font-bold px-4 py-1.5 rounded-full inline-block ${
            diversificationScore >= 80 ? 'bg-green-100 text-green-800' :
            diversificationScore >= 60 ? 'bg-blue-100 text-blue-800' :
            'bg-red-100 text-red-800'
          }`}>
            {diversificationRating}
          </div>
          {isBeginner && (
            <p className="text-xs text-gray-500 mt-3 max-w-[200px] mx-auto leading-relaxed">
              Your money is currently <strong>{diversificationScore}% protected</strong> from local inflation.
            </p>
          )}
        </div>
        {/* Visual background element */}
        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />
      </Card>

      {/* 2. REWARDS (Unified Insight Card) */}
      <div className="space-y-4">
        <StreakRewardsCard 
          onSaveClick={() => setActiveTab("swap")}
        />
        {isAdvanced && <RewardsStats />}
      </div>

      {/* 3. ASSET BREAKDOWN (Simplified for Beginners) */}
      {hasHoldings && (
        isBeginner ? (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Global Spread</h3>
              <span className="text-[10px] font-bold text-blue-600">{regionData.length} Regions</span>
            </div>
            <SimplePieChart 
              data={regionData} 
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {regionData.map(r => (
                <div key={r.region} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-full border border-gray-100 dark:border-gray-800">
                   <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                   <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400">{r.region}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <ProtectionAnalysis
            regionData={regionData}
            totalValue={totalValue}
            goalScores={portfolio.goalScores}
            diversificationScore={diversificationScore}
            diversificationRating={diversificationRating}
            onOptimize={() => setActiveTab("protect")}
            onSwap={() => setActiveTab("swap")}
            chainId={chainId}
            onNetworkChange={refreshChainId ? handleRefresh : undefined}
            refreshBalances={refreshBalances}
            yieldSummary={portfolio}
          />
        )
      )}

      {/* 4. MARKET DISCOVERY (Always there, but zoom level changes) */}
      <CollapsibleSection
        title={isBeginner ? "Global Opportunities" : "Market Intelligence"}
        icon={<span>🌍</span>}
        defaultOpen={isBeginner && !hasHoldings}
      >
        <div className="space-y-6">
          {/* Region Selection with simple labels for beginners */}
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedMarket(region)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${region === selectedMarket
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                  }`}
              >
                {region}
              </button>
            ))}
          </div>

          {/* Core Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
              <div className="text-[10px] font-black text-blue-500 uppercase mb-1">
                {isBeginner ? "Living Costs Up" : "Inflation"}
              </div>
              <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedMarketInflation.toFixed(1)}%</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
              <div className="text-[10px] font-black text-emerald-500 uppercase mb-1">
                {isBeginner ? "Growth Potential" : "Market Growth"}
              </div>
              <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">+{selectedMarketData.growth}%</div>
            </div>
          </div>

          {/* Advanced Visualizer only for non-beginners */}
          {!isBeginner && (
            <>
              <div className="p-3 bg-gray-900 rounded-xl text-white text-[11px] font-bold italic">
                &quot;{selectedMarketData.highlight}&quot;
              </div>
              <InflationVisualizer
                region={selectedMarket}
                inflationRate={selectedMarketInflation}
                years={5}
                initialAmount={100}
              />
            </>
          )}

          {/* Performance Chart only for advanced */}
          {isAdvanced && currencyPerformanceData && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="text-[10px] font-black text-gray-400 uppercase mb-3">Currency Velocity (30D)</div>
              <CurrencyPerformanceChart
                data={currencyPerformanceData}
                title=""
              />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 5. SETTINGS & INSIGHTS */}
      {!isBeginner && (
        <CollapsibleSection
          title="Insights & Configuration"
          icon={<span>🧠</span>}
        >
          <div className="space-y-6">
            {/* Tips Section */}
            {diversificationTips.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center gap-2">
                  <span>💡</span>
                  Smart Picks
                </h4>
                <div className="space-y-3">
                  {diversificationTips.map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-sm mt-0.5">•</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Home Region Selector */}
            <div>
              <h4 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center gap-2">
                <RegionalIconography region={userRegion} size="sm" />
                Your Home Region
              </h4>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() => setUserRegion(region)}
                    className={`px-3 py-1.5 text-xs rounded-full transition-all font-bold ${userRegion === region
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* 6. EMPTY STATE (Beginner specific) */}
      {!hasHoldings && isBeginner && (
        <Card padding="p-6">
          <EmptyState
            icon="🛡️"
            title="Start Protecting Wealth"
            description="Convert your local currency into digital dollars to stop losing money to inflation."
            action={{
              label: "Get Started",
              onClick: () => setActiveTab("swap"),
              icon: <span>➕</span>,
            }}
          />
        </Card>
      )}
    </div>
  );
}
