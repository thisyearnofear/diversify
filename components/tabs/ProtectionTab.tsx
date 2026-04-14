import React, { useState, useMemo } from "react";
import MultichainPortfolioBreakdown from "../portfolio/MultichainPortfolioBreakdown";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../wallet/WalletProvider";
import {
  Card,
  ConnectWalletPrompt,
  InsightCard,
  ProtectionDashboard,
} from "../shared/TabComponents";
import DashboardCard from "../shared/DashboardCard";
import { NETWORK_TOKENS, NETWORKS } from "@/config";
import WalletButton from "../wallet/WalletButton";
import { useNavigation } from "@/context/app/NavigationContext";
import { useDemoMode } from "@/context/app/DemoModeContext";
import { useExperience } from "@/context/app/ExperienceContext";
import {
  useProtectionProfile,
  USER_GOALS,
} from "@/hooks/use-protection-profile";
import { useAdvisor } from "@/hooks/use-advisor";
import { useFinancialStrategies } from "@/hooks/useFinancialStrategies";
import { StrategyService } from "@diversifi/shared";
import { useToast } from "@/components/ui/Toast";

import ProfileWizard from "./protect/ProfileWizard";
import type { TokenBalance } from "@/hooks/use-multichain-balances";
import RwaAssetCards from "./protect/RwaAssetCards";
import YieldDiscoverySection from "../earn/YieldDiscoverySection";
import AssetModal from "./protect/AssetModal";
import OptimizationInsight from "./protect/OptimizationInsight";
import PortfolioRecommendations from "../portfolio/PortfolioRecommendations";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import { useStreakRewards } from "@/hooks/use-streak-rewards";
import DepositHub from "../onramp/DepositHub";
import dynamic from "next/dynamic";

const GoodDollarClaimFlow = dynamic(() => import("../gooddollar/GoodDollarClaimFlow"), {
  ssr: false,
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ProtectionTabProps {
  userRegion: Region;
  portfolio: MultichainPortfolio;
  onSelectStrategy?: (strategy: string) => void;
  setActiveTab?: (tab: import("@/constants/tabs").TabId) => void;
}

import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

export default function ProtectionTab({
  userRegion,
  portfolio,
  onSelectStrategy,
  setActiveTab,
}: ProtectionTabProps) {
  const { address, chainId } = useWalletContext();
  const { navigateToSwap } = useNavigation();
  const { demoMode } = useDemoMode();
  const { experienceMode } = useExperience();
  const { askAdvisor } = useAdvisor();
  const isDemo = demoMode.isActive;
  const isBeginner = experienceMode === "beginner";

  // Use demo data if in demo mode
  const activePortfolio = isDemo ? DEMO_PORTFOLIO : portfolio;

  const {
    totalValue,
    chainCount,
    chains,
    regionData,
    isLoading: isMultichainLoading,
    isStale,
    rebalancingOpportunities,
  } = activePortfolio;

  // Use values directly from portfolio
  const displayTotalValue = totalValue;
  const displayRegionData = regionData;
  const displayChainCount = chainCount;

  // NEW: Use protection profile hook for proper edit flow
  const {
    mode: profileMode,
    currentStep,
    config,
    isComplete,

    currentGoalLabel,
    currentGoalIcon,
    currentRiskLabel,
    currentTimeHorizonLabel,
    startEditing,
    nextStep,
    prevStep,
    skipToEnd,
    completeEditing,
    setUserGoal,
    setRiskTolerance,
    setTimeHorizon,
  } = useProtectionProfile();

  const { selectedStrategy, getStrategyById } = useFinancialStrategies();
  const selectedStrategyData = selectedStrategy ? getStrategyById(selectedStrategy) : null;
  const { showToast } = useToast();

  const [showAssetModal, setShowAssetModal] = useState<string | null>(null);
  const [showClaimFlow, setShowClaimFlow] = useState(false);
  const { streak, canClaim, isWhitelisted, estimatedReward } = useStreakRewards();

  // Current regions for recommendations
  const currentRegions = useMemo(() => {
    return displayRegionData
      .filter((item) => (item.usdValue || item.value) > 0)
      .map((item) => item.region as Region);
  }, [displayRegionData]);

  // Use the pre-calculated live portfolio analysis from the portfolio prop
  const liveAnalysis = activePortfolio;
  const topOpportunity = rebalancingOpportunities?.[0];

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const openProtectionFlow = (
    targetToken: string,
    fromToken?: string,
    amount?: string,
  ) => {
    // In demo mode, show connect prompt
    if (isDemo) {
      alert("Connect your wallet to execute real swaps!");
      return;
    }

    const sourceToken = fromToken || getBestFromToken(targetToken);
    const swapAmount = amount || getSwapAmount(sourceToken);

    // Find source chain from balances
    const sourceTokenObj = chains
      .flatMap((c) => c.balances as TokenBalance[])
      .find((t) => t.symbol === sourceToken && t.value > 0);

    const fromChainId = sourceTokenObj?.chainId;

    // Determine target chain based on asset availability
    let toChainId: number | undefined;

    // 1. Try to find on same chain (avoid bridging)
    if (fromChainId && NETWORK_TOKENS[fromChainId]?.includes(targetToken)) {
      toChainId = fromChainId;
    } else {
      // 2. Find any chain that supports this token, preferring Mainnets
      const PREFERRED_CHAINS = [
        NETWORKS.CELO_MAINNET.chainId,
        NETWORKS.ARBITRUM_ONE.chainId,
      ];

      // Check preferred chains first
      for (const chainId of PREFERRED_CHAINS) {
        if (NETWORK_TOKENS[chainId]?.includes(targetToken)) {
          toChainId = chainId;
          break;
        }
      }

      // Fallback to any chain if not found in preferred
      if (!toChainId) {
        for (const [chainIdStr, tokens] of Object.entries(NETWORK_TOKENS)) {
          if (tokens.includes(targetToken)) {
            toChainId = Number(chainIdStr);
            break;
          }
        }
      }
    }

    setActiveTab?.("exchange");

    navigateToSwap({
      fromToken: sourceToken,
      toToken: targetToken,
      amount: swapAmount,
      reason: `Review protection move to ${targetToken} for ${currentGoalLabel}`,
      fromChainId,
      toChainId,
    });
  };

  const getBestFromToken = (targetToken: string): string => {
    // Get all tokens with balances across chains
    const allTokens = chains.flatMap((c) => c.balances as TokenBalance[]);
    const tokensWithBalances = allTokens
      .filter((t) => t.value > 0)
      .sort((a, b) => b.value - a.value);

    if (tokensWithBalances.length === 0) return "USDC";

    // For gold, prefer high-inflation regional tokens
    if (targetToken === "PAXG") {
      const highInflationTokens = [
        "KESm",
        "COPm",
        "ZARm",
        "BRLm",
        "XOFm",
        "GHSm",
        "NGNm",
      ];
      const foundHighInflation = tokensWithBalances.find((t) =>
        highInflationTokens.some((hit) =>
          t.symbol.toUpperCase().includes(hit.toUpperCase()),
        ),
      );
      if (foundHighInflation) return foundHighInflation.symbol;
    }

    const largestNonTarget = tokensWithBalances.find(
      (t) => t.symbol.toUpperCase() !== targetToken.toUpperCase(),
    );
    return largestNonTarget?.symbol || tokensWithBalances[0]?.symbol || "USDC";
  };

  const getSwapAmount = (fromToken: string): string => {
    // Find token across all chains
    const token = chains
      .flatMap((c) => c.balances as TokenBalance[])
      .find((t) => t.symbol === fromToken);

    const balance = token?.value || 0;
    if (balance <= 0) return "10";
    const percentage =
      config.userGoal === "geographic_diversification" ? 0.25 : 0.5;
    return (balance * percentage).toFixed(2);
  };

  // Calculate protection score (generic portfolio health)
  const protectionScore = liveAnalysis
    ? Math.round(
        (liveAnalysis.diversificationScore +
          (100 - (liveAnalysis.weightedInflationRisk || 0) * 5)) /
          2,
      )
    : 0;

  // Keep hook order stable across disconnected/connected renders.
  const strategyAlignmentScore = useMemo(() => {
    if (!selectedStrategy || !displayRegionData.length) return protectionScore;
    const totalVal = displayRegionData.reduce(
      (sum, region) => sum + (region.usdValue || region.value || 0),
      0,
    );
    if (totalVal === 0) return 0;
    const regionAllocations = displayRegionData.reduce(
      (acc, region) => {
        acc[region.region] =
          ((region.usdValue || region.value || 0) / totalVal) * 100;
        return acc;
      },
      {} as Record<string, number>,
    );
    const result = StrategyService.calculateScore(
      selectedStrategy,
      regionAllocations as any,
    );
    return Math.round(result.score);
  }, [selectedStrategy, displayRegionData, protectionScore]);

  const strategyAlignmentFeedback = useMemo(() => {
    if (!selectedStrategy || !displayRegionData.length) return [];
    const totalVal = displayRegionData.reduce(
      (sum, region) => sum + (region.usdValue || region.value || 0),
      0,
    );
    if (totalVal === 0) return [];
    const regionAllocations = displayRegionData.reduce(
      (acc, region) => {
        acc[region.region] =
          ((region.usdValue || region.value || 0) / totalVal) * 100;
        return acc;
      },
      {} as Record<string, number>,
    );
    return StrategyService.calculateScore(
      selectedStrategy,
      regionAllocations as any,
    ).feedback;
  }, [selectedStrategy, displayRegionData]);

  // Strategy change nudge — fires after score is computed
  const prevStrategyRef = React.useRef(selectedStrategy);
  React.useEffect(() => {
    if (
      prevStrategyRef.current &&
      selectedStrategy &&
      prevStrategyRef.current !== selectedStrategy
    ) {
      const data = getStrategyById(selectedStrategy);
      const msg = `${data?.icon ?? "🎯"} Switched to ${
        data?.name ?? selectedStrategy
      } — your portfolio is ${strategyAlignmentScore}% aligned. ${
        strategyAlignmentScore < 50
          ? "Rebalance to improve alignment."
          : "Looking good!"
      }`;
      showToast(msg, strategyAlignmentScore < 50 ? "warning" : "success");
    }
    prevStrategyRef.current = selectedStrategy;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStrategy]);

  // ============================================================================
  // RENDER: Not Connected
  // ============================================================================

  if (!address && !isDemo) {
    return (
      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">
                Protection Plan
              </h3>
              <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
                Build your inflation protection plan
              </p>
            </div>
            <span className="text-3xl">🤖</span>
          </div>
          <ConnectWalletPrompt
            message="Connect your wallet to analyze your portfolio across Arbitrum and Celo against real-time global inflation data."
            WalletButtonComponent={<WalletButton variant="inline" />}
            experienceMode={experienceMode}
          />
        </Card>

        {/* Preview of goals */}
        <Card className="bg-gray-50 border-dashed border-2 p-4">
          <h4 className="text-xs font-black uppercase text-gray-400 mb-4 tracking-widest text-center">
            Available Protection Goals
          </h4>
          <div className="grid grid-cols-2 gap-2 opacity-50">
            {USER_GOALS.map((goal) => (
              <div
                key={goal.value}
                className="p-3 bg-white rounded-xl text-center shadow-md"
              >
                <div className="text-xl mb-1">{goal.icon}</div>
                <div className="text-xs font-black uppercase text-gray-900">
                  {goal.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // RENDER: Connected
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Strategy Alignment Bar */}
      {selectedStrategyData && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
          <span className="text-xl">{selectedStrategyData.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300 truncate">
                {selectedStrategyData.name}
              </span>
              <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 ml-2 shrink-0">
                {strategyAlignmentScore}% aligned
              </span>
            </div>
            <div className="w-full bg-indigo-200 dark:bg-indigo-900 rounded-full h-1.5">
              <div
                className="bg-indigo-600 dark:bg-indigo-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(strategyAlignmentScore, 100)}%` }}
              />
            </div>
            {strategyAlignmentFeedback.length > 0 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                {strategyAlignmentFeedback[0]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          CONSOLIDATED PROTECTION DASHBOARD
          ===================================================================== */}
      {isBeginner ? (
        // Beginner: Simple hero with protection level
        <Card padding="p-0" className="overflow-hidden shadow-[0_20px_50px_-24px_rgba(79,70,229,0.45)] border border-indigo-200/40 dark:border-indigo-900/40">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-50 backdrop-blur-sm">
                  <span className="size-1.5 rounded-full bg-white" />
                  Plan Setup
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  Protection Plan
                </h3>
                <p className="text-indigo-100 text-sm font-semibold opacity-90 mt-2 max-w-[220px] leading-relaxed">
                  {isComplete ? "Your plan is ready" : "Set up your protection plan"}
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/30 shadow-sm">
                <span className="text-2xl">🤖</span>
              </div>
            </div>
            <div className="text-center relative z-10">
              <div className="text-4xl font-black tracking-tight">
                {protectionScore}%
              </div>
              <div className="text-sm text-indigo-100 font-semibold mt-1">
                Protection Level
              </div>
            </div>
          </div>
          <div className="p-5 bg-white dark:bg-gray-900">
            <ProfileWizard
              mode={profileMode}
              currentStep={currentStep}
              config={config}
              currentGoalIcon={currentGoalIcon}
              currentGoalLabel={currentGoalLabel}
              currentRiskLabel={currentRiskLabel}
              currentTimeHorizonLabel={currentTimeHorizonLabel}
              onSetUserGoal={setUserGoal}
              onSetRiskTolerance={setRiskTolerance}
              onSetTimeHorizon={setTimeHorizon}
              onNextStep={nextStep}
              onSkipToEnd={skipToEnd}
              onCompleteEditing={completeEditing}
              onStartEditing={startEditing}
              onBack={prevStep}
            />
          </div>
        </Card>
      ) : (
        // Non-beginner: Full ProtectionDashboard
        <Card
          aiPrompt={() => `Review my protection plan: $${displayTotalValue.toFixed(0)} across ${displayChainCount} chains. Goal: ${currentGoalLabel}. Region: ${userRegion}. What should I know?`}
          aiQuickQuestions={[
            "What's my biggest risk?",
            "How can I improve my protection score?",
            "Should I rebalance now?",
            "What's my inflation exposure?",
            "Am I diversified enough?"
          ]}
        >
          <ProtectionDashboard
          title="Protection Plan"
          subtitle={isComplete ? "Your protection profile is ready" : "Set your protection profile"}
          icon={<span>🤖</span>}
          totalValue={`$${displayTotalValue.toFixed(0)}`}
          chainCount={displayChainCount}
          score={protectionScore}
          strategy={config.userGoal || 'global'}
          factors={[
            {
              label: "Portfolio Coverage",
              value: liveAnalysis?.tokenCount > 0 ? 95 : 50,
              status: liveAnalysis?.tokenCount > 0 ? `${liveAnalysis?.tokenCount} tokens` : "No data",
              icon: "💰",
            },
            {
              label: "Chain Diversification",
              value: displayChainCount > 1 ? 90 : 60,
              status: `${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""}`,
              icon: "🔗",
            },
            {
              label: "Regional Diversification",
              value: currentRegions.length > 2 ? 90 : 70,
              status: `${currentRegions.length} regions`,
              icon: "🌍",
            },
            {
              label: "Inflation Risk",
              value: Math.max(0, 100 - (liveAnalysis?.weightedInflationRisk || 0) * 10),
              status: `${Math.round(liveAnalysis?.weightedInflationRisk || 0)}% weighted`,
              icon: "🛡️",
            },
          ]}
          isLoading={isMultichainLoading}
          isStale={isStale}
          streak={streak}
          canClaim={canClaim}
          estimatedReward={estimatedReward}
          onClaim={() => setShowClaimFlow(true)}
        >
          <div className="mt-2">
            <ProfileWizard
              mode={profileMode}
              currentStep={currentStep}
              config={config}
              currentGoalIcon={currentGoalIcon}
              currentGoalLabel={currentGoalLabel}
              currentRiskLabel={currentRiskLabel}
              currentTimeHorizonLabel={currentTimeHorizonLabel}
              onSetUserGoal={setUserGoal}
              onSetRiskTolerance={setRiskTolerance}
              onSetTimeHorizon={setTimeHorizon}
              onNextStep={nextStep}
              onSkipToEnd={skipToEnd}
              onCompleteEditing={completeEditing}
              onStartEditing={startEditing}
              onBack={prevStep}
            />
          </div>
        </ProtectionDashboard>
        </Card>
      )}

      {/* =================================================================
          PRIMARY INSIGHT CARD - Dynamic based on selected goal
          ================================================================= */}
      {displayTotalValue === 0 && address && (
        <Card
          className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800"
          aiPrompt={() => `I want to start protecting my savings but have no funds yet. What should I do? Which onramp is best for ${userRegion}?`}
          aiQuickQuestions={[
            "How do I add funds?",
            "What's the minimum to start?",
            "Which payment methods are available?",
            "Is it safe to deposit?"
          ]}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h3 className="font-bold text-purple-900 dark:text-purple-100">
                  Ready to Protect Your Savings?
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  Add funds to activate your protection plan
                </p>
              </div>
            </div>
          </div>
          
          <DepositHub compact={true} />
        </Card>
      )}
      
      {liveAnalysis && topOpportunity && displayTotalValue > 0 && (
        <OptimizationInsight
          icon={config.userGoal === 'geographic_diversification' ? '🌍' : config.userGoal === 'rwa_access' ? '🥇' : config.userGoal === 'inflation_protection' ? '🛡️' : '⚡'}
          title={
            config.userGoal === 'geographic_diversification'
              ? `Expand ${topOpportunity.toRegion} Presence`
              : config.userGoal === 'rwa_access'
              ? `Add ${topOpportunity.toToken} to Your Plan`
              : config.userGoal === 'inflation_protection'
              ? `Reduce ${topOpportunity.fromRegion} Inflation Exposure`
              : `Improve Your Protection Plan`
          }
          description={
            config.userGoal === 'geographic_diversification'
              ? `Adding ${topOpportunity.toToken} gives you exposure to ${topOpportunity.toRegion} economy. Your current ${topOpportunity.fromToken} is mainly ${topOpportunity.fromRegion}-focused.`
              : config.userGoal === 'rwa_access'
              ? `${topOpportunity.toToken} provides ${topOpportunity.toToken === 'PAXG' ? 'gold-backed' : 'yield-bearing'} exposure that ${topOpportunity.fromToken} can't match.`
              : `Your ${topOpportunity.fromToken} holdings face ${Math.round(topOpportunity.fromInflation)}% inflation. Swapping to ${topOpportunity.toToken} preserves purchasing power.`
          }
          fromToken={topOpportunity.fromToken}
          toToken={topOpportunity.toToken}
          fromInflation={topOpportunity.fromInflation}
          toInflation={topOpportunity.toInflation}
          impact={`Save $${topOpportunity.annualSavings.toFixed(2)}/year`}
          variant={topOpportunity.priority === "HIGH" ? "urgent" : "default"}
          action={{
            label: `Review ${topOpportunity.fromToken} → ${topOpportunity.toToken} in Protect`,
            onClick: () =>
              openProtectionFlow(
                topOpportunity.toToken,
                topOpportunity.fromToken,
                topOpportunity.suggestedAmount.toFixed(2),
              ),
          }}
          secondaryOptions={
            liveAnalysis.rebalancingOpportunities
              .filter((opp) => {
                if (opp.fromToken === topOpportunity.fromToken && opp.toToken === topOpportunity.toToken) return false;
                // Filter by goal
                if (config.userGoal === 'geographic_diversification') {
                  return opp.toRegion !== 'Global' && opp.fromRegion !== opp.toRegion;
                }
                if (config.userGoal === 'rwa_access') {
                  return ['PAXG', 'USDY', 'SYRUPUSDC'].includes(opp.toToken);
                }
                return true;
              })
              .slice(0, 3)
              .map(opp => ({
                fromToken: opp.fromToken,
                toToken: opp.toToken,
                annualSavings: opp.annualSavings,
                onClick: () => openProtectionFlow(opp.toToken, opp.fromToken, opp.suggestedAmount.toFixed(2))
              }))
          }
        />
      )}

      {/* =================================================================
          AI ANALYSIS CTA
          ================================================================= */}
      <InsightCard
        icon="🤖"
        title="Advisor Plan Review"
        description="Ask the Advisor to review your holdings, inflation exposure, and protection plan."
        variant="default"
        action={{
          label: "Ask Advisor About My Plan",
          onClick: () => {
            const effectiveGoal = currentGoalLabel && currentGoalLabel !== "Not set" ? currentGoalLabel : "diversification";
            askAdvisor(`Review my protection plan for a portfolio of $${displayTotalValue.toFixed(0)} across ${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""}. My goal is ${effectiveGoal}. I'm in the ${userRegion} region.`);
          },
        }}
      />

      {/* RWA Assets - Non-beginner only */}
      {!isBeginner && (
        <RwaAssetCards
          chains={chains}
          userGoal={config.userGoal}
          chainId={chainId}
          onSwap={openProtectionFlow}
          onShowModal={setShowAssetModal}
          experienceMode={experienceMode}
        />
      )}

      {/* LI.FI Earn Yield Discovery - Non-beginner only */}
      {!isBeginner && (
        <YieldDiscoverySection
          chainId={chainId ?? undefined}
          onSelectVault={(vault) => {
            openProtectionFlow(
              `lifi-earn:${vault.id}`,
              vault.asset.symbol,
              '10'
            );
          }}
        />
      )}

      {/* =====================================================================
          DASHBOARD CARDS (Replaced Collapsible Sections)
          ===================================================================== */}

      {/* REMOVED: Strategy Metrics and Zakat Calculator - tied to financial strategy which didn't add value */}

      {/* Chain Distribution - Non-beginner only */}
      {!isBeginner && displayTotalValue > 0 && (
        <DashboardCard
          title="Chain Distribution"
          icon={<span>🔗</span>}
          subtitle={`${displayChainCount} Chain${displayChainCount !== 1 ? "s" : ""}`}
          color="blue"
          size="lg"
        >
          <MultichainPortfolioBreakdown
            regionData={displayRegionData.map((r) => ({
              region: r.region,
              value: r.value,
              color: r.color,
            }))}
            totalValue={displayTotalValue}
            chainBreakdown={chains.map((c) => ({
              chainId: c.chainId,
              chainName: c.chainName,
              totalValue: c.totalValue,
              tokenCount: c.tokenCount,
            }))}
          />
        </DashboardCard>
      )}


      {/* Portfolio Strategy Recommendations - Non-beginner only */}
      {!isBeginner && displayTotalValue > 0 && (
        <PortfolioRecommendations
          currentAllocations={Object.fromEntries(
            displayRegionData.map((r) => [r.region, (r.usdValue ?? r.value) / (displayTotalValue || 1)])
          )}
          onSelectStrategy={(strategy) => {
            const recommended = StrategyService.getRecommendedAssets(strategy as any);
            const toToken = recommended[0] || 'KESm';
            const fromToken = recommended.includes('USDm') ? 'USDC' : 'USDm';

            // Compute suggested swap amount from target allocation gap
            const config = StrategyService.getConfig(strategy as any);
            const primaryTarget = config.targetAllocations[0];
            let swapAmount: string | undefined;
            if (primaryTarget && displayTotalValue > 0) {
              const currentRegion = displayRegionData.find(
                (r) => r.region === primaryTarget.region
              );
              const currentPct = currentRegion
                ? ((currentRegion.usdValue ?? currentRegion.value) / displayTotalValue) * 100
                : 0;
              const gapPct = Math.max(0, primaryTarget.ideal - currentPct);
              const gapUsd = (gapPct / 100) * displayTotalValue;
              if (gapUsd > 1) swapAmount = gapUsd.toFixed(2);
            }

            setActiveTab?.("exchange");
            navigateToSwap({
              fromToken,
              toToken,
              amount: swapAmount,
              reason: `Review ${strategy} plan adjustments toward ${toToken}`,
            });
          }}
        />
      )}

      {/* REMOVED: Goal-Based Strategies - consolidated to Learn tab with interactive RealWorldUseCases */}

      <AssetModal
        assetSymbol={showAssetModal}
        onClose={() => setShowAssetModal(null)}
        onSwap={openProtectionFlow}
      />

      {/* GoodDollar streak now integrated into ProtectionDashboard header */}

      {showClaimFlow && (
        <GoodDollarClaimFlow
          onClose={() => setShowClaimFlow(false)}
          onClaimSuccess={() => setShowClaimFlow(false)}
        />
      )}
    </div>
  );
}
