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
import { useAppState } from "@/context/AppStateContext";
import {
  useProtectionProfile,
  USER_GOALS,
} from "@/hooks/use-protection-profile";
import { useAIOracle } from "@/hooks/use-ai-oracle";

import ProfileWizard from "./protect/ProfileWizard";
import type { TokenBalance } from "@/hooks/use-multichain-balances";
import RwaAssetCards from "./protect/RwaAssetCards";
import AssetModal from "./protect/AssetModal";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import GoodDollarInfoCard from "../gooddollar/GoodDollarInfoCard";
import { useStreakRewards } from "@/hooks/use-streak-rewards";
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
  setActiveTab?: (tab: string) => void;
}

import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

export default function ProtectionTab({
  userRegion,
  portfolio,
  onSelectStrategy,
}: ProtectionTabProps) {
  const { address, chainId } = useWalletContext();
  const { navigateToSwap, demoMode, experienceMode } = useAppState();
  const { ask: askOracle } = useAIOracle();
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

  const handleExecuteSwap = (
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

    navigateToSwap({
      fromToken: sourceToken,
      toToken: targetToken,
      amount: swapAmount,
      reason: `Swap to ${targetToken} for ${currentGoalLabel}`,
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
                Protection Engine
              </h3>
              <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
                Multi-chain inflation protection
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
                className="p-3 bg-white border border-gray-200 rounded-xl text-center"
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

  // Calculate protection score
  const protectionScore = liveAnalysis ? Math.round(
    (liveAnalysis.diversificationScore +
      (100 - liveAnalysis.weightedInflationRisk * 5)) / 2
  ) : 0;

  // ============================================================================
  // RENDER: Connected
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* =====================================================================
          CONSOLIDATED PROTECTION DASHBOARD
          ===================================================================== */}
      {isBeginner ? (
        // Beginner: Simple hero with protection level
        <Card padding="p-0" className="overflow-hidden shadow-xl">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  Shield Engine
                </h3>
                <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
                  {isComplete ? "Your Shield is Active" : "Set up your shield"}
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30">
                <span className="text-2xl">🤖</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black">
                {Math.round((liveAnalysis?.diversificationScore + (100 - (liveAnalysis?.weightedInflationRisk || 0) * 5)) / 2)}%
              </div>
              <div className="text-xs text-indigo-200 font-medium mt-1">
                Protection Level
              </div>
            </div>
          </div>
          <div className="p-4">
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
        <ProtectionDashboard
          title="Protection Engine"
          subtitle={isComplete ? "Personalized protection active" : "Set your protection profile"}
          icon={<span>🤖</span>}
          totalValue={`$${displayTotalValue.toFixed(0)}`}
          chainCount={displayChainCount}
          score={protectionScore}
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
              status: `${(liveAnalysis?.weightedInflationRisk || 0).toFixed(1)}% weighted`,
              icon: "🛡️",
            },
          ]}
          isLoading={isMultichainLoading}
          isStale={isStale}
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
      )}

      {/* =================================================================
          PRIMARY INSIGHT CARD - Dynamic based on selected goal
          ================================================================= */}
      {liveAnalysis && topOpportunity && (
        <InsightCard
          icon={config.userGoal === 'geographic_diversification' ? '🌍' : config.userGoal === 'rwa_access' ? '🥇' : config.userGoal === 'inflation_protection' ? '🛡️' : '⚡'}
          title={
            config.userGoal === 'geographic_diversification'
              ? `Expand ${topOpportunity.toRegion} Presence`
              : config.userGoal === 'rwa_access'
              ? `Add ${topOpportunity.toToken} to Portfolio`
              : config.userGoal === 'inflation_protection'
              ? `Reduce ${topOpportunity.fromRegion} Inflation Exposure`
              : `Optimize Your Portfolio`
          }
          description={
            config.userGoal === 'geographic_diversification'
              ? `Adding ${topOpportunity.toToken} gives you exposure to ${topOpportunity.toRegion} economy. Your current ${topOpportunity.fromToken} is mainly ${topOpportunity.fromRegion}-focused.`
              : config.userGoal === 'rwa_access'
              ? `${topOpportunity.toToken} provides ${topOpportunity.toToken === 'PAXG' ? 'gold-backed' : 'yield-bearing'} exposure that ${topOpportunity.fromToken} can't match.`
              : `Your ${topOpportunity.fromToken} holdings face ${topOpportunity.fromInflation.toFixed(1)}% inflation. Swapping to ${topOpportunity.toToken} (${topOpportunity.toInflation.toFixed(1)}% inflation) preserves purchasing power.`
          }
          impact={`Save $${topOpportunity.annualSavings.toFixed(2)}/year`}
          variant={topOpportunity.priority === "HIGH" ? "urgent" : "default"}
          action={{
            label: `Swap ${topOpportunity.fromToken} → ${topOpportunity.toToken}`,
            onClick: () =>
              handleExecuteSwap(
                topOpportunity.toToken,
                topOpportunity.fromToken,
                topOpportunity.suggestedAmount.toFixed(2),
              ),
          }}
        >
          {liveAnalysis.rebalancingOpportunities.length > 1 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                {config.userGoal === "geographic_diversification"
                  ? "More Regional Options"
                  : config.userGoal === "rwa_access"
                  ? "More RWA Options"
                  : "More Inflation Options"}
              </p>
              <div className="space-y-2">
                {liveAnalysis.rebalancingOpportunities
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
                  .map((opp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-50 dark:border-gray-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{opp.fromToken}</span>
                        <span className="text-gray-300">→</span>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{opp.toToken}</span>
                        {config.userGoal === 'geographic_diversification' && (
                          <span className="text-[9px] text-gray-400">({opp.toRegion})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">+${opp.annualSavings.toFixed(2)}</span>
                        <button
                          onClick={() => handleExecuteSwap(opp.toToken, opp.fromToken, opp.suggestedAmount.toFixed(2))}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase rounded-lg transition-colors"
                        >
                          Swap
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </InsightCard>
      )}

      {/* =================================================================
          AI ANALYSIS CTA
          ================================================================= */}
      <InsightCard
        icon="🤖"
        title="AI Portfolio Analysis"
        description="Get personalized recommendations based on your holdings, inflation data, and market conditions."
        variant="default"
        action={{
          label: "Analyze My Portfolio",
          onClick: () => {
            const effectiveGoal = currentGoalLabel && currentGoalLabel !== "Not set" ? currentGoalLabel : "diversification";
            askOracle(`Analyze my portfolio of $${displayTotalValue.toFixed(0)} across ${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""}. My goal is ${effectiveGoal}. I'm in the ${userRegion} region.`);
          },
        }}
      />

      {/* RWA Assets - Non-beginner only */}
      {!isBeginner && (
        <RwaAssetCards
          chains={chains}
          userGoal={config.userGoal}
          chainId={chainId}
          onSwap={handleExecuteSwap}
          onShowModal={setShowAssetModal}
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


      {/* REMOVED: Goal-Based Strategies - consolidated to Learn tab with interactive RealWorldUseCases */}

      <AssetModal
        assetSymbol={showAssetModal}
        onClose={() => setShowAssetModal(null)}
        onSwap={handleExecuteSwap}
      />

      {/* GoodDollar — compact banner, full hub lives in Learn tab */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-900">
        <GoodDollarInfoCard
          compact
          streak={streak}
          canClaim={canClaim}
          estimatedReward={estimatedReward}
          onClaim={() => setShowClaimFlow(true)}
        />
      </div>

      {showClaimFlow && (
        <GoodDollarClaimFlow
          onClose={() => setShowClaimFlow(false)}
          onClaimSuccess={() => setShowClaimFlow(false)}
        />
      )}
    </div>
  );
}
