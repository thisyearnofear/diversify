import React, { useState } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import { useInflationData } from "@/hooks/use-inflation-data";
import RegionalIconography from "../regional/RegionalIconography";
import { useWalletContext } from "../wallet/WalletProvider";
import WalletButton from "../wallet/WalletButton";
import type { Region } from "@/hooks/use-user-region";
import CurrencyPerformanceChart from "../portfolio/CurrencyPerformanceChart";
import ProtectionAnalysis from "../portfolio/ProtectionAnalysis";
import { StreakRewardsCard, RewardsStats } from "../rewards/StreakRewardsCard";
import SimplePieChart from "../portfolio/SimplePieChart";
import { useAppState } from "../../context/AppStateContext";
import { DEMO_PORTFOLIO } from "../../lib/demo-data";
import { NetworkOptimizedOnramp } from "../onramp";
import { AssetInventory } from "../portfolio/AssetInventory";
import { useStreakRewards } from "@/hooks/use-streak-rewards";

import { Card, EmptyState, HeroValue } from "../shared/TabComponents";
import { useProtectionProfile } from "../../hooks/use-protection-profile";
import DashboardCard from "../shared/DashboardCard";

interface OverviewTabProps {
  portfolio: MultichainPortfolio;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  setActiveTab: (tab: import("@/constants/tabs").TabId) => void;
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

// Goal alignment banner — shown between hero and rewards when user has a saved profile
function GoalAlignmentBanner({
  goal,
  riskTolerance,
  timeHorizon,
  goalScores,
  onAction,
}: {
  goal: string;
  riskTolerance: string | null;
  timeHorizon: string | null;
  goalScores: { hedge: number; diversify: number; rwa: number };
  onAction: () => void;
}) {
  // Pick the score that actually reflects the user's stated goal
  const score = Math.round(
    goal === 'inflation_protection' ? goalScores.hedge :
    goal === 'geographic_diversification' ? goalScores.diversify :
    goal === 'rwa_access' ? goalScores.rwa : 0
  );
  const goalMeta: Record<string, { icon: string; label: string; description: string; nextAction: string; bg: string; border: string; badge: string }> = {
    inflation_protection: {
      icon: '🛡️',
      label: 'Hedge Inflation',
      description: 'Reduce exposure to local currency devaluation',
      nextAction: 'Swap into lower-inflation currencies',
      bg: 'from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10',
      border: 'border-blue-200 dark:border-blue-800',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    },
    geographic_diversification: {
      icon: '🌍',
      label: 'Diversify Regions',
      description: 'Spread your wealth across multiple economies',
      nextAction: 'Add exposure to a new region',
      bg: 'from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10',
      border: 'border-purple-200 dark:border-purple-800',
      badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    },
    rwa_access: {
      icon: '🥇',
      label: 'Access Real-World Assets',
      description: 'Hold tokenized gold and yield-bearing assets',
      nextAction: 'Bridge to Arbitrum for USDY or PAXG',
      bg: 'from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10',
      border: 'border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    },
  };

  const meta = goalMeta[goal];
  if (!meta) return null;

  return (
    <div className={`bg-gradient-to-br ${meta.bg} border ${meta.border} rounded-2xl p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.badge}`}>Your Goal</span>
            <span className="text-xs font-black text-gray-900 dark:text-white">{meta.label}</span>
            {riskTolerance && (
              <span className="text-[10px] text-gray-500">• {riskTolerance} risk{timeHorizon ? ` • ${timeHorizon}` : ''}</span>
            )}
          </div>
          <p className="text-[11px] text-gray-600 dark:text-gray-400">{meta.description}</p>
          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Goal Progress</span>
              <span className="text-[10px] font-black text-gray-700 dark:text-gray-300">{score}%</span>
            </div>
            <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onAction}
        className="mt-3 w-full py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-black uppercase tracking-widest text-gray-800 dark:text-gray-200 transition-colors flex items-center justify-center gap-2"
      >
        <span>{meta.nextAction}</span>
        <span>→</span>
      </button>
    </div>
  );
}

// Tooltip component explaining inflation data source
function InflationTooltip() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="text-gray-400 hover:text-blue-500 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
      {showTooltip && (
        <div className="absolute z-50 left-0 bottom-full mb-2 w-48 p-2 bg-gray-900 dark:bg-gray-800 text-white text-[10px] rounded-lg shadow-xl">
          <p className="font-bold mb-1">📊 Data Source</p>
          <p className="opacity-80">Based on IMF & World Bank CPI data. Updated periodically.</p>
          <div className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
        </div>
      )}
    </div>
  );
}

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
  const { canClaim, isWhitelisted, streak } = useStreakRewards();
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();
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

            {/* Primary CTA: Buy Crypto */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wide">Start Here</p>
              <NetworkOptimizedOnramp
                variant="default"
                defaultAmount="100"
                className="w-full !rounded-lg !py-3"
              />
              <p className="text-[10px] text-blue-600 dark:text-blue-400 text-center">
                💳 Buy with card or bank transfer • Low KYC
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
                  or connect existing wallet
                </span>
              </div>
            </div>

            {/* Secondary CTA: Connect existing wallet */}
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
                  Welcome! Let&apos;s Add Some Funds
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mt-1">
                  Your wallet is connected but empty. Add crypto to start protecting your savings.
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">Recommended</p>
                <NetworkOptimizedOnramp
                  variant="white"
                  defaultAmount="100"
                  className="w-full"
                />
                <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                  💳 Buy with card or bank transfer • Low KYC
                </p>
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

              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold mb-2">Transfer from exchange</p>
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
                    just exploring?
                  </span>
                </div>
              </div>

              <button
                onClick={enableDemoMode}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                🎮 Try Demo Mode
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* DAILY CLAIM BANNER — shown at top when G$ reward is ready */}
      {address && isWhitelisted && canClaim && (
        <button
          onClick={() => setActiveTab("protect")}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
          aria-label="Claim your daily GoodDollar reward"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-bounce">🎁</span>
            <div className="text-left">
              <div className="text-xs font-black uppercase tracking-widest">Daily G$ Reward Ready!</div>
              <div className="text-[10px] text-emerald-100 font-medium">
                {streak?.daysActive ? `${streak.daysActive} day streak` : "Start your streak"} — tap to claim →
              </div>
            </div>
          </div>
          <div className="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap">
            Claim Now
          </div>
        </button>
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

      {/* 1b. GOAL ALIGNMENT — shown when user has a complete protection profile */}
      {profileComplete && profileConfig.userGoal && profileConfig.userGoal !== 'exploring' && (
        <GoalAlignmentBanner
          goal={profileConfig.userGoal}
          riskTolerance={profileConfig.riskTolerance}
          timeHorizon={profileConfig.timeHorizon}
          goalScores={activePortfolio.goalScores}
          onAction={() => setActiveTab('swap')}
        />
      )}

      {/* 2. PROTECTION ANALYSIS - Moved to top for priority visibility */}
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
                  <AssetInventory tokens={activePortfolio.allTokens || []} />
                  <p className="mt-4 text-[9px] text-gray-400 font-bold text-center uppercase tracking-tighter">
                    Tired of toggling? Switch to <span className="text-blue-500">Standard Mode</span> in the header to unlock full details.
                  </p>
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

      {/* 3. REWARDS (Unified Insight Card) */}
      {hasHoldings && (
        <div className="space-y-4">
          <StreakRewardsCard
            onSaveClick={() => setActiveTab("swap")}
          />

          {/* Community Stats - Social Proof */}
          <RewardsStats />
        </div>
      )}

      {/* ENHANCEMENT: Arbitrum Yield Opportunity Card */}
      {hasHoldings && (
        <div
          onClick={() => setActiveTab("protect")}
          className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-4 text-white cursor-pointer hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💰</span>
                <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  Earn Yield
                </span>
              </div>
              <h3 className="text-lg font-black mt-2">Up to 5% APY</h3>
              <p className="text-sm text-blue-100 mt-1">
                Tokenized treasuries on Arbitrum
              </p>
            </div>
            <div className="bg-white/10 p-2 rounded-xl">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-blue-200">
            <span className="bg-green-500/30 px-2 py-0.5 rounded-full">USDY 5%</span>
            <span className="bg-purple-500/30 px-2 py-0.5 rounded-full">SYRUP 4.5%</span>
            <span>→</span>
          </div>
        </div>
      )}

      {/* ENHANCEMENT: Multichain Identity Banner - Celebrates both ecosystems */}
      <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-blue-600 p-0.5 rounded-2xl">
        <div className="bg-white dark:bg-gray-900 rounded-[14px] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-lg z-10 border-2 border-white dark:border-gray-900">
                  🌍
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg border-2 border-white dark:border-gray-900">
                  💰
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black">Two Chains, One Mission</h3>
                <p className="text-xs text-gray-500">
                  Celo for regional diversity • Arbitrum for yield
                </p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-gray-400">Powered by</div>
              <div className="text-xs font-black">LiFi</div>
            </div>
          </div>
        </div>
      </div>

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
            <div className="flex items-center gap-1 mb-1">
              <div className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">
                {isBeginner ? "Living Costs Up" : "Inflation"}
              </div>
              <InflationTooltip />
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

      {/* 5. SMART RECOMMENDATIONS - goal-aware tips */}
      {(() => {
        const gs = activePortfolio.goalScores;
        const missing = activePortfolio.missingRegions;
        const goal = profileConfig.userGoal;

        // Build goal-specific tips when profile is complete
        let tips: string[] = [];
        if (profileComplete && goal && goal !== 'exploring') {
          if (goal === 'inflation_protection') {
            if (gs.hedge < 60) tips.push(`Your hedge score is ${Math.round(gs.hedge)}%. Swap high-inflation tokens to USDm or EURm to improve it.`);
            else if (gs.hedge >= 80) tips.push(`Excellent inflation protection (${Math.round(gs.hedge)}%)! Consider adding PAXG on Arbitrum for long-term coverage.`);
            else tips.push(`Good hedge score (${Math.round(gs.hedge)}%). Reducing your most concentrated region exposure would improve it further.`);
            tips.push(...diversificationTips.filter(t => t.includes('PAXG') || t.includes('inflation')));
          } else if (goal === 'geographic_diversification') {
            if (gs.diversify < 60) tips.push(`Diversification score: ${Math.round(gs.diversify)}%. Add ${missing.slice(0, 2).join(' and ')} exposure to improve it.`);
            else if (gs.diversify >= 80) tips.push(`Excellent diversification (${Math.round(gs.diversify)}%)! You're well-spread across regions.`);
            else tips.push(`Good diversification (${Math.round(gs.diversify)}%). ${missing.length > 0 ? `Adding ${missing[0]} would push you above 80%.` : 'Keep rebalancing as markets move.'}`);
            tips.push(...diversificationTips.filter(t => t.includes('region')));
          } else if (goal === 'rwa_access') {
            if (gs.rwa === 0) {
              tips.push('No real-world assets detected. Add PAXG (gold) or USDY (~5% APY Treasuries) on Arbitrum.');
              tips.push('Bridge USDm → Arbitrum to access tokenized US Treasuries and gold without KYC.');
            } else if (gs.rwa < 80) {
              tips.push(`RWA score: ${Math.round(gs.rwa)}%. Consider adding SYRUPUSDC for additional structured yield (~4.5% APY).`);
            } else {
              tips.push(`Strong RWA position (${Math.round(gs.rwa)}%). PAXG and yield tokens are providing solid inflation protection.`);
            }
          }
        } else {
          // Generic tips when no profile set
          tips = diversificationTips;
        }

        if (tips.length === 0) return null;
        return (
          <DashboardCard title="Smart Recommendations" icon={<span>💡</span>} color="amber" size="md">
            <div className="space-y-2">
              {tips.slice(0, 3).map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-sm mt-0.5">•</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        );
      })()}

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
              ? "Your money loses value every day due to inflation. Let&apos;s fix that by converting it to more stable currencies."
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
