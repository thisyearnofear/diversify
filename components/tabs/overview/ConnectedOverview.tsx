import React, { useState } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";
import { useInflationData } from "@/hooks/use-inflation-data";
import { useExperience } from "../../../context/app/ExperienceContext";
import { useProtectionProfile } from "../../../hooks/use-protection-profile";
import { useStreakRewards } from "@/hooks/use-streak-rewards";
import RegionalIconography from "../../regional/RegionalIconography";
import WalletButton from "../../wallet/WalletButton";
import CurrencyPerformanceChart from "../../portfolio/CurrencyPerformanceChart";
import ProtectionAnalysis from "../../portfolio/ProtectionAnalysis";
import { StreakRewardsCard, RewardsStats } from "../../rewards/StreakRewardsCard";
import SimplePieChart from "../../portfolio/SimplePieChart";
import { NetworkOptimizedOnramp } from "../../onramp";
import { AssetInventory } from "../../portfolio/AssetInventory";
import { Card, EmptyState, HeroValue } from "../../shared/TabComponents";
import DashboardCard from "../../shared/DashboardCard";
import { AgentTierStatus } from "../../agent/AgentTierStatus";
import { GoalAlignmentBanner } from "./GoalAlignmentBanner";
import { InflationTooltip } from "./InflationTooltip";

const EMERGING_MARKETS = {
  Africa: { growth: 4.2, highlight: "Fastest growing mobile money market" },
  LatAm: { growth: 3.1, highlight: "Leading fintech adoption" },
  Asia: { growth: 5.3, highlight: "60% of global digital payments" },
  USA: { growth: 2.1, highlight: "World reserve currency" },
  Europe: { growth: 1.8, highlight: "Strong regulatory framework" },
};

interface ConnectedOverviewProps {
  portfolio: MultichainPortfolio;
  activePortfolio: MultichainPortfolio;
  address: string;
  chainId: number | null;
  isDemo: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  setActiveTab: (tab: TabId) => void;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  onDisableDemo: () => void;
  onEnableDemo: () => void;
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

export function ConnectedOverview({
  portfolio,
  activePortfolio,
  address,
  chainId,
  isDemo,
  userRegion,
  setUserRegion,
  REGIONS,
  setActiveTab,
  refreshBalances,
  refreshChainId,
  onDisableDemo,
  onEnableDemo,
  currencyPerformanceData,
}: ConnectedOverviewProps) {
  const { inflationData } = useInflationData();
  const [selectedMarket, setSelectedMarket] = useState<Region>(userRegion);
  const [showAssetDetails, setShowAssetDetails] = useState(false);
  const { experienceMode } = useExperience();
  const { canClaim, isWhitelisted, streak } = useStreakRewards();
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();

  const isBeginner = experienceMode === "beginner";
  const isAdvanced = experienceMode === "advanced";

  const {
    diversificationScore,
    diversificationRating,
    totalValue,
    regionData,
    diversificationTips,
  } = activePortfolio;

  const hasHoldings = totalValue > 0;

  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  const selectedMarketData =
    EMERGING_MARKETS[selectedMarket as keyof typeof EMERGING_MARKETS] ||
    EMERGING_MARKETS.Africa;
  const selectedMarketInflation = inflationData[selectedMarket]?.avgRate || 0;

  // Build goal-aware tips
  const buildTips = (): string[] => {
    const gs = activePortfolio.goalScores;
    const missing = activePortfolio.missingRegions;
    const goal = profileConfig.userGoal;
    let tips: string[] = [];

    if (profileComplete && goal && goal !== "exploring") {
      if (goal === "inflation_protection") {
        if (gs.hedge < 60)
          tips.push(`Your hedge score is ${Math.round(gs.hedge)}%. Swap high-inflation tokens to USDm or EURm to improve it.`);
        else if (gs.hedge >= 80)
          tips.push(`Excellent inflation protection (${Math.round(gs.hedge)}%)! Consider adding PAXG on Arbitrum for long-term coverage.`);
        else
          tips.push(`Good hedge score (${Math.round(gs.hedge)}%). Reducing your most concentrated region exposure would improve it further.`);
        tips.push(...diversificationTips.filter((t) => t.includes("PAXG") || t.includes("inflation")));
      } else if (goal === "geographic_diversification") {
        if (gs.diversify < 60)
          tips.push(`Diversification score: ${Math.round(gs.diversify)}%. Add ${missing.slice(0, 2).join(" and ")} exposure to improve it.`);
        else if (gs.diversify >= 80)
          tips.push(`Excellent diversification (${Math.round(gs.diversify)}%)! You're well-spread across regions.`);
        else
          tips.push(`Good diversification (${Math.round(gs.diversify)}%). ${missing.length > 0 ? `Adding ${missing[0]} would push you above 80%.` : "Keep rebalancing as markets move."}`);
        tips.push(...diversificationTips.filter((t) => t.includes("region")));
      } else if (goal === "rwa_access") {
        if (gs.rwa === 0) {
          tips.push("No real-world assets detected. Add PAXG (gold) or USDY (~5% APY Treasuries) on Arbitrum.");
          tips.push("Bridge USDm → Arbitrum to access tokenized US Treasuries and gold without KYC.");
        } else if (gs.rwa < 80) {
          tips.push(`RWA score: ${Math.round(gs.rwa)}%. Consider adding SYRUPUSDC for additional structured yield (~4.5% APY).`);
        } else {
          tips.push(`Strong RWA position (${Math.round(gs.rwa)}%). PAXG and yield tokens are providing solid inflation protection.`);
        }
      }
    } else {
      tips = diversificationTips;
    }

    if (!tips.some((t) => t.includes("Robinhood"))) {
      tips.push("🎮 Explore: Practice your trading strategies risk-free on the Robinhood Stock Testnet. Visit /trade to get started.");
    }
    return tips;
  };

  const tips = buildTips();

  return (
    <div className="space-y-6">
      {/* 1. HERO SCORE */}
      <Card
        padding="p-6"
        className="text-center relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10"
      >
        <div className="relative z-10">
          <HeroValue
            value={isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
            label={isBeginner ? "Health Score" : "Total Value"}
          />
          <div
            className={`mt-2 text-sm font-bold px-4 py-1.5 rounded-full inline-block ${
              diversificationScore >= 80
                ? "bg-green-100 text-green-800"
                : diversificationScore >= 60
                  ? "bg-blue-100 text-blue-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            {diversificationRating}
          </div>
          {isBeginner && (
            <p className="text-xs text-gray-500 mt-3 max-w-[200px] mx-auto leading-relaxed">
              Your money is currently{" "}
              <strong>{diversificationScore}% protected</strong> from local inflation.
            </p>
          )}
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />
      </Card>

      {/* 1b. GOAL ALIGNMENT */}
      {profileComplete && profileConfig.userGoal && profileConfig.userGoal !== "exploring" && (
        <GoalAlignmentBanner
          goal={profileConfig.userGoal}
          riskTolerance={profileConfig.riskTolerance}
          timeHorizon={profileConfig.timeHorizon}
          goalScores={activePortfolio.goalScores}
          onAction={() => setActiveTab("swap")}
        />
      )}

      {/* DAILY CLAIM BANNER */}
      {address && isWhitelisted && canClaim && (
        <button
          onClick={() => setActiveTab("protect")}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
          aria-label="Claim your daily GoodDollar reward"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-bounce">🎁</span>
            <div className="text-left">
              <div className="text-xs font-black uppercase tracking-widest">
                Daily G$ Reward Ready!
              </div>
              <div className="text-xs text-emerald-100 font-medium">
                {streak?.daysActive ? `${streak.daysActive} day streak` : "Start your streak"}{" "}
                — tap to claim →
              </div>
            </div>
          </div>
          <div className="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap">
            Claim Now
          </div>
        </button>
      )}

      {/* DEMO MODE BANNER */}
      {isDemo && (
        <Card padding="p-0" className="overflow-hidden border-2 border-blue-500 dark:border-blue-600">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                <div>
                  <h3 className="text-sm font-black text-white">Demo Mode Active</h3>
                  <p className="text-xs text-blue-100">
                    Exploring with sample data • Connect wallet for real portfolio
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onDisableDemo}
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

      {/* EMPTY WALLET */}
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
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
                  Recommended
                </p>
                <NetworkOptimizedOnramp variant="white" defaultAmount="100" className="w-full" />
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  💳 Buy with card or bank transfer • Low KYC
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-amber-200 dark:border-amber-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-amber-50 dark:bg-amber-900/20 px-2 text-amber-700 dark:text-amber-300">or</span>
                </div>
              </div>
              <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                <p className="text-xs text-amber-700 dark:text-amber-400 uppercase font-bold mb-2">
                  Transfer from exchange
                </p>
                <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-inner">
                  <code className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate flex-1">
                    {address}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(address)}
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
                onClick={onEnableDemo}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                🎮 Try Demo Mode
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* 2. PROTECTION ANALYSIS */}
      {hasHoldings && (
        isBeginner ? (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">
                Global Spread
              </h3>
              <span className="text-xs font-bold text-blue-600">{regionData.length} Regions</span>
            </div>
            <SimplePieChart data={regionData} />
            <div className="mt-4 flex flex-wrap justify-center gap-2 mb-6">
              {regionData.map((r) => (
                <div
                  key={r.region}
                  className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-full shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{r.region}</span>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowAssetDetails(!showAssetDetails)}
                className="w-full flex items-center justify-between py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors"
              >
                <span>{showAssetDetails ? "Hide" : "View"} Asset Inventory</span>
                <span>{showAssetDetails ? "↑" : "↓"}</span>
              </button>
              {showAssetDetails && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AssetInventory tokens={activePortfolio.allTokens || []} />
                  <p className="mt-4 text-xs text-gray-400 font-bold text-center uppercase tracking-tighter">
                    Tired of toggling? Switch to{" "}
                    <span className="text-blue-500">Standard Mode</span> in the header to unlock full details.
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

      {/* 3. REWARDS */}
      {hasHoldings && (
        <div className="space-y-4">
          <StreakRewardsCard onSaveClick={() => setActiveTab("swap")} />
          <RewardsStats />
        </div>
      )}

      {/* YIELD OPPORTUNITY CARD */}
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
              <p className="text-sm text-blue-100 mt-1">Tokenized treasuries on Arbitrum</p>
            </div>
            <div className="bg-white/10 p-2 rounded-xl">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
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

      {/* MULTICHAIN IDENTITY BANNER */}
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
                <p className="text-xs text-gray-500">Celo for regional diversity • Arbitrum for yield</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-gray-400">Powered by</div>
              <div className="text-xs font-black">LiFi</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MARKET INTELLIGENCE */}
      <DashboardCard
        title={isBeginner ? "Global Opportunities" : "Market Intelligence"}
        icon={<span>🌍</span>}
        color="blue"
        size="lg"
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedMarket(region)}
              className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${
                region === selectedMarket
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {region}
            </button>
          ))}
        </div>
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
        <div className="p-3 bg-gray-900 dark:bg-gray-950 rounded-xl text-white text-xs font-bold italic mb-4">
          &quot;{selectedMarketData.highlight}&quot;
        </div>
        {isAdvanced && currencyPerformanceData && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-black text-gray-400 uppercase mb-3">
              Currency Velocity (30D)
            </div>
            <CurrencyPerformanceChart data={currencyPerformanceData} title="" />
          </div>
        )}
      </DashboardCard>

      {/* 5. SMART RECOMMENDATIONS */}
      {tips.length > 0 && (
        <DashboardCard title="Smart Recommendations" icon={<span>💡</span>} color="amber" size="md">
          <div className="space-y-2">
            {tips.slice(0, 3).map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg">
                <span className="text-amber-600 dark:text-amber-400 font-bold text-sm mt-0.5">•</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                  {tip}
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {/* 6. REGION SELECTOR (Advanced only) */}
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
                className={`px-3 py-1.5 text-xs rounded-full transition-all font-bold ${
                  userRegion === region
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

      {/* 7. EMPTY STATE FUNNEL */}
      {!hasHoldings && (
        <Card
          padding="p-6"
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-2 border-blue-200 dark:border-blue-800"
        >
          <EmptyState
            icon="🛡️"
            title={isBeginner ? "Ready to Protect Your Money?" : "Start Building Protection"}
            description={
              isBeginner
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
                  <strong className="text-gray-900 dark:text-white">Quick tip:</strong>{" "}
                  Start small! Convert just $10-20 to see how it works. You can always do more later.
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* AGENT COMMAND CENTER (Standard/Advanced only) */}
      {!isBeginner && (
        <AgentTierStatus
          showActivityFeed={true}
          onNavigateToAgent={() => setActiveTab("agent")}
        />
      )}
    </div>
  );
}
