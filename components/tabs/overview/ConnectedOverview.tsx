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
import { Card, DataError, EmptyState, HeroValue } from "../../shared/TabComponents";
import DashboardCard from "../../shared/DashboardCard";
import { AgentTierStatus } from "../../agent/AgentTierStatus";
import { GoalAlignmentBanner } from "./GoalAlignmentBanner";
import { InflationTooltip } from "./InflationTooltip";
import { GuardianPulse } from "../../agent/GuardianPulse";

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

    return tips;
  };

  const tips = buildTips();
  const primaryTip = tips[0];

  const chainErrors = activePortfolio.errors ?? [];

  return (
    <div className="space-y-6">
      {/* Chain RPC errors — compact inline banner, one per failed chain */}
      {chainErrors.length > 0 && (
        <div className="space-y-1">
          {chainErrors.map((err, i) => (
            <DataError key={i} message={err} onRetry={refreshBalances} compact />
          ))}
        </div>
      )}

      {/* 1. HERO SCORE */}
      <Card
        padding="p-0"
        className="text-center relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/10 dark:via-gray-900 dark:to-indigo-900/10 border border-blue-100/80 dark:border-blue-900/60 shadow-[0_20px_50px_-20px_rgba(37,99,235,0.25)]"
      >
        <div className="relative z-10 p-7 sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 shadow-sm">
            <span className="size-1.5 rounded-full bg-blue-500" />
            Home Overview
          </div>
          <HeroValue
            value={isBeginner ? `${diversificationScore}%` : `$${totalValue.toFixed(0)}`}
            label={isBeginner ? "Protection Score" : "Total Value"}
          />
          <div
            className={`mt-3 text-sm font-bold px-4 py-1.5 rounded-full inline-block shadow-sm ${
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
            <p className="text-sm text-gray-500 mt-4 max-w-xs mx-auto leading-relaxed">
              Your savings are currently{" "}
              <strong>{diversificationScore}% protected</strong> from local inflation.
            </p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setActiveTab(hasHoldings ? "exchange" : "protect")}
              className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:translate-y-[-1px]"
            >
              {hasHoldings ? "Review My Protection" : "Set Up My Plan"}
            </button>
            {hasHoldings && (
              <button
                onClick={() => setActiveTab("protect")}
                className="px-5 py-3 rounded-2xl bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold transition-all hover:bg-gray-50 dark:hover:bg-gray-800 hover:translate-y-[-1px]"
              >
                Adjust My Plan
              </button>
            )}
          </div>

          {isBeginner && primaryTip && hasHoldings && (
            <div className="mt-5 p-4 rounded-2xl bg-white/85 dark:bg-gray-900/85 border border-blue-100 dark:border-blue-900 text-left max-w-md mx-auto shadow-sm backdrop-blur-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
                Next Best Move
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {primaryTip}
              </p>
            </div>
          )}
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-25%] left-[-10%] w-48 h-48 bg-indigo-500/8 rounded-full blur-3xl" />
      </Card>

      {/* 1b. GOAL ALIGNMENT */}
      {profileComplete && profileConfig.userGoal && profileConfig.userGoal !== "exploring" && (
        <GoalAlignmentBanner
          goal={profileConfig.userGoal}
          riskTolerance={profileConfig.riskTolerance}
          timeHorizon={profileConfig.timeHorizon}
          goalScores={activePortfolio.goalScores}
          onAction={() => setActiveTab("exchange")}
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
                Daily Reward Ready
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
                  <h3 className="text-sm font-black text-white">Preview Mode Active</h3>
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
                  Welcome! Fund Your Protection
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
                  Transfer from another wallet or exchange
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
          <Card className="border border-gray-100 dark:border-gray-800 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">
                Your Protection Mix
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
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setActiveTab("exchange")}
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                >
                  Improve My Protection
                </button>
                <button
                  onClick={() => setShowAssetDetails(!showAssetDetails)}
                  className="w-full flex items-center justify-between py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <span>{showAssetDetails ? "Hide" : "View"} Asset Details</span>
                  <span>{showAssetDetails ? "↑" : "↓"}</span>
                </button>
              </div>
              {showAssetDetails && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AssetInventory tokens={activePortfolio.allTokens || []} />
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
            onSwap={() => setActiveTab("exchange")}
            chainId={chainId}
            onNetworkChange={refreshChainId ? handleRefresh : undefined}
            refreshBalances={refreshBalances}
            yieldSummary={portfolio}
          />
        )
      )}

      {/* 3. REWARDS */}
      {hasHoldings && !isBeginner && (
        <div className="space-y-4">
          <StreakRewardsCard onSaveClick={() => setActiveTab("exchange")} />
          <RewardsStats />
        </div>
      )}

      {!isBeginner && (
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
      )}

      {/* 4. MARKET INTELLIGENCE */}
      {!isBeginner && (
      <DashboardCard
        title={isBeginner ? "Global Opportunities" : "Guardian Pulse"}
        icon={<span>🌍</span>}
        color="blue"
        size="lg"
      >
        <GuardianPulse />
      </DashboardCard>
      )}

      {/* 5. SMART RECOMMENDATIONS */}
      {tips.length > 0 && !isBeginner && (
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
            title={isBeginner ? "Ready to Protect Your Savings?" : "Start Your Protection"}
            description={
              isBeginner
                ? "Your savings lose value every day due to inflation. Let&apos;s fix that by moving into more stable currencies."
                : "Convert your local currency into diversified stablecoins to protect against inflation and currency debasement."
            }
            action={{
              label: isBeginner ? "Protect My Savings" : "Open Protect Flow",
              onClick: () => setActiveTab("exchange"),
              icon: <span>→</span>,
            }}
          />
          
          {/* Milestone-oriented next steps */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-black text-blue-600 dark:text-blue-400">1</div>
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white">Connect wallet</p>
                <p className="text-xs text-gray-500">Secure & takes 30 seconds</p>
              </div>
              <span className="text-emerald-500 text-sm">✓</span>
            </div>
            <div className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-black text-gray-400">2</div>
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white">Add funds</p>
                <p className="text-xs text-gray-500">Use on-ramp or transfer</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-black text-gray-400">3</div>
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white">Make first swap</p>
                <p className="text-xs text-gray-500">Make your first protection move</p>
              </div>
            </div>
          </div>

          {/* Alternative: Testnet for risk-free learning */}
          {isBeginner && (
            <div className="mt-4 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
              <div className="flex items-start gap-2">
                <span className="text-lg">🧪</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-violet-900 dark:text-violet-100 mb-1">
                    Not ready to use real money?
                  </p>
                  <p className="text-xs text-violet-700 dark:text-violet-300 mb-2">
                    Try testnet first — free tokens, same experience, no risk.
                  </p>
                  <button
                    onClick={() => setActiveTab("exchange")}
                    className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
                  >
                    Try Test Drive →
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* AGENT COMMAND CENTER (Standard/Advanced only) */}
      {isAdvanced && (
        <AgentTierStatus
          showActivityFeed={true}
          onNavigateToAgent={() => setActiveTab("agent")}
        />
      )}
    </div>
  );
}
