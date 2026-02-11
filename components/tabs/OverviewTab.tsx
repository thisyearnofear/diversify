import React, { useState } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import { useInflationData } from "@/hooks/use-inflation-data";
import RegionalIconography from "../regional/RegionalIconography";
import { useWalletContext } from "../wallet/WalletProvider";
import WalletButton from "../wallet/WalletButton";
import type { Region } from "@/hooks/use-user-region";
import CurrencyPerformanceChart from "../portfolio/CurrencyPerformanceChart";
import InflationVisualizer from "../inflation/InflationVisualizerEnhanced";
import ProtectionAnalysis from "../portfolio/ProtectionAnalysis";
import { StreakRewardsCard, RewardsStats } from "../rewards/StreakRewardsCard";
import SimplePieChart from "../portfolio/SimplePieChart";
import { useAppState } from "../../context/AppStateContext";
import { DEMO_PORTFOLIO } from "../../lib/demo-data";
import { NetworkOptimizedOnramp } from "../onramp";
import { AssetInventory } from "../portfolio/AssetInventory";

import { Card, EmptyState, HeroValue } from "../shared/TabComponents";
import DashboardCard from "../shared/DashboardCard";

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
  const [showAssetDetails, setShowAssetDetails] = useState(false);

  const { experienceMode, demoMode, disableDemoMode, enableDemoMode } = useAppState();
  const isBeginner = experienceMode === "beginner";
  const isAdvanced = experienceMode === "advanced";

  // Use demo data if in demo mode, otherwise use real portfolio
  const activePortfolio = demoMode.isActive ? DEMO_PORTFOLIO : portfolio;
  const isDemo = demoMode.isActive;

  const {
    diversificationScore,
    diversificationRating,
    totalValue,
    regionData,
    diversificationTips,
  } = activePortfolio;



  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  const hasHoldings = totalValue > 0;

  const selectedMarketData = EMERGING_MARKETS[selectedMarket as keyof typeof EMERGING_MARKETS] || EMERGING_MARKETS.Africa;
  const selectedMarketInflation = inflationData[selectedMarket]?.avgRate || 0;

  // Not connected state - ENHANCED: Show the problem viscerally + Demo Mode option
  if (!address && !isConnecting && !isDemo) {
    const regionalInflation = inflationData[userRegion]?.avgRate || 15.4;
    const monthlyLoss = (1000 * (regionalInflation / 100) / 12).toFixed(2);
    const yearlyLoss = (1000 * (regionalInflation / 100)).toFixed(0);

    return (
      <div className="space-y-4">
        {/* ENHANCEMENT: Hope-first approach - show value before fear */}
        <Card padding="p-0" className="overflow-hidden border-2 border-emerald-200 dark:border-emerald-900">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🛡️</span>
                  <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-100">
                    Protect Your Savings from Inflation
                  </h3>
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                  Smart diversification for {userRegion} ({regionalInflation.toFixed(1)}% inflation)
                </p>
              </div>
              <RegionalIconography region={userRegion} size="md" />
            </div>

            {/* THE OPPORTUNITY (reframed from threat) */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-4 border-2 border-emerald-100 dark:border-emerald-900">
              <div className="text-center mb-3">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 font-bold">Protect $1,000 →</div>
                <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100">Save ${yearlyLoss}/year</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">Per month</div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">+${monthlyLoss}</div>
                </div>
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-700">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mb-1">Per year</div>
                  <div className="text-xl font-black text-emerald-800 dark:text-emerald-200">+${yearlyLoss}</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-lg">✨</span>
              <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
                <strong>How it works:</strong> Spread your savings across stable currencies to reduce inflation risk. Free to try, takes 2 minutes.
              </p>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-800 space-y-3">
            {/* ENHANCEMENT: Demo-first approach - lowest friction for beginners */}
            <button
              onClick={enableDemoMode}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              <span className="text-lg">🎮</span>
              <span>Try Demo First</span>
              <span className="text-xs opacity-80 ml-1">(No wallet needed)</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
                  Ready to protect your money?
                </span>
              </div>
            </div>

            {/* Secondary CTA: Buy Crypto */}
            <div className="w-full">
              <NetworkOptimizedOnramp
                variant="default"
                defaultAmount="100"
                className="w-full !rounded-lg !py-2.5"
              />
            </div>

            {/* Tertiary CTA: Connect existing wallet */}
            <WalletButton variant="inline" className="w-full !bg-gray-100 dark:!bg-gray-700 !text-gray-700 dark:!text-gray-200 hover:!bg-gray-200 dark:hover:!bg-gray-600" />

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              🔒 Secure • 🇨🇭 Swiss regulated • 💯 Free to try
            </p>
          </div>
        </Card>

        {/* Quick preview of what they'll get */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
          <h4 className="text-xs font-black uppercase text-gray-400 mb-3 tracking-widest">What You&apos;ll Get</h4>
          <div className="space-y-2">
            {[
              { icon: "📊", text: "Real-time protection score across multiple currencies" },
              { icon: "🤖", text: "AI recommendations based on your region" },
              { icon: "🔄", text: "One-click swaps to safer currencies" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg">
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.text}</span>
              </div>
            ))}
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
      {/* DEMO MODE BANNER */}
      {isDemo && (
        <Card padding="p-0" className="overflow-hidden border-2 border-blue-500 dark:border-blue-600">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                <div>
                  <h3 className="text-sm font-black text-white">Demo Mode Active</h3>
                  <p className="text-xs text-blue-100">Exploring with sample data • Connect wallet for real portfolio</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={disableDemoMode}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Exit Demo
                </button>
                <WalletButton variant="inline" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ENHANCEMENT: Empty wallet detection - guide users to add funds */}
      {!isDemo && address && !hasHoldings && (
        <Card padding="p-0" className="overflow-hidden border-2 border-amber-200 dark:border-amber-900">
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">👋</span>
              <div>
                <h3 className="text-lg font-black text-amber-900 dark:text-amber-100">
                  Welcome! Let's Add Some Funds
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mt-1">
                  Your wallet is connected but empty. Add crypto to start protecting your savings.
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-2">
              <NetworkOptimizedOnramp
                variant="white"
                defaultAmount="100"
                className="w-full"
              />

              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold mb-2">Deposit from exchange</p>
                <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <code className="text-[10px] font-mono text-gray-600 dark:text-gray-300 truncate flex-1">{address}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(address);
                    }}
                    className="p-1 px-2 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-amber-200 dark:border-amber-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-amber-50 dark:bg-amber-900/20 px-2 text-amber-700 dark:text-amber-300">
                    or
                  </span>
                </div>
              </div>

              <button
                onClick={enableDemoMode}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                🎮 Try Demo While You Wait
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* 1. PRIMARY HEALTH SCORE / HERO (Dynamic by Mode) */}
      <Card padding="p-6" className="text-center relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
        <div className="relative z-10">
          <HeroValue
            value={isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
            label={isBeginner ? "Health Score" : "Total Value"}
          />
          <div className={`mt-2 text-sm font-bold px-4 py-1.5 rounded-full inline-block ${diversificationScore >= 80 ? 'bg-green-100 text-green-800' :
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

        {/* Community Stats - Social Proof */}
        <RewardsStats />
      </div>

      {/* 3. ASSET BREAKDOWN (Simplified for Beginners) */}
      {hasHoldings && (
        isBeginner ? (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Global Spread</h3>
              <span className="text-xs font-bold text-blue-600">{regionData.length} Regions</span>
            </div>
            <SimplePieChart
              data={regionData}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2 mb-6">
              {regionData.map(r => (
                <div key={r.region} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-full border border-gray-100 dark:border-gray-800">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{r.region}</span>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowAssetDetails(!showAssetDetails)}
                className="w-full flex items-center justify-between py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors"
              >
                <span>{showAssetDetails ? "Hide" : "View"} Asset Inventory</span>
                <span>{showAssetDetails ? "↑" : "↓"}</span>
              </button>

              {showAssetDetails && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AssetInventory tokens={(activePortfolio as any).allTokens || []} />
                </div>
              )}
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

      {/* 4. MARKET DISCOVERY - Dashboard Cards (No Collapsible) */}
      <DashboardCard
        title={isBeginner ? "Global Opportunities" : "Market Intelligence"}
        icon={<span>🌍</span>}
        color="blue"
        size="lg"
      >
        {/* Region Selection */}
        <div className="flex flex-wrap gap-2 mb-4">
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedMarket(region)}
              className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${region === selectedMarket
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
            >
              {region}
            </button>
          ))}
        </div>

        {/* Core Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
            <div className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase mb-1">
              {isBeginner ? "Living Costs Up" : "Inflation"}
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {selectedMarketInflation.toFixed(1)}%
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">
              {isBeginner ? "Growth Potential" : "Market Growth"}
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              +{selectedMarketData.growth}%
            </div>
          </div>
        </div>

        {/* Market Highlight */}
        <div className="p-3 bg-gray-900 dark:bg-gray-950 rounded-xl text-white text-xs font-bold italic mb-4">
          &quot;{selectedMarketData.highlight}&quot;
        </div>

        {/* Advanced: Performance Chart */}
        {isAdvanced && currencyPerformanceData && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-black text-gray-400 uppercase mb-3">Currency Velocity (30D)</div>
            <CurrencyPerformanceChart data={currencyPerformanceData} title="" />
          </div>
        )}
      </DashboardCard>

      {/* 5. SMART RECOMMENDATIONS - Dashboard Card */}
      {diversificationTips.length > 0 && (
        <DashboardCard
          title="Smart Recommendations"
          icon={<span>💡</span>}
          color="amber"
          size="md"
        >
          <div className="space-y-2">
            {diversificationTips.slice(0, 3).map((tip, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg"
              >
                <span className="text-amber-600 dark:text-amber-400 font-bold text-sm mt-0.5">•</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                  {tip}
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {/* 6. REGION SELECTOR - Dashboard Card (Advanced Only) */}
      {!isBeginner && (
        <DashboardCard
          title="Your Home Region"
          icon={<RegionalIconography region={userRegion} size="sm" />}
          color="purple"
          size="sm"
        >
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((region) => (
              <button
                key={region}
                onClick={() => setUserRegion(region)}
                className={`px-3 py-1.5 text-xs rounded-full transition-all font-bold ${userRegion === region
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100"
                  }`}
              >
                {region}
              </button>
            ))}
          </div>
        </DashboardCard>
      )}

      {/* 7. EMPTY STATE WITH CLEAR FUNNEL */}
      {!hasHoldings && (
        <Card padding="p-6" className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-2 border-blue-200 dark:border-blue-800">
          <EmptyState
            icon="🛡️"
            title={isBeginner ? "Ready to Protect Your Money?" : "Start Building Protection"}
            description={isBeginner
              ? "Your money loses value every day due to inflation. Let's fix that by converting it to more stable currencies."
              : "Convert your local currency into diversified stablecoins to protect against inflation and currency debasement."
            }
            action={{
              label: isBeginner ? "Convert Money Now" : "Start Swapping",
              onClick: () => setActiveTab("swap"),
              icon: <span>→</span>,
            }}
          />
          {isBeginner && (
            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-blue-900">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-900 dark:text-white">Quick tip:</strong> Start small! Convert just $10-20 to see how it works. You can always do more later.
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
