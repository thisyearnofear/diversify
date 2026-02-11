import React, { useState, useMemo } from "react";
import GoalBasedStrategies from "../strategies/GoalBasedStrategies";
import MultichainPortfolioBreakdown from "../portfolio/MultichainPortfolioBreakdown";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../wallet/WalletProvider";
import {
  Card,
  CollapsibleSection,
  ConnectWalletPrompt,
  InsightCard,
  ProtectionScore,
} from "../shared/TabComponents";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";
import { NETWORK_TOKENS, NETWORKS } from "@/config";
import WalletButton from "../wallet/WalletButton";
import { useAppState } from "@/context/AppStateContext";
import {
  useProtectionProfile,
  USER_GOALS,
} from "@/hooks/use-protection-profile";
import { useAIConversation } from "@/context/AIConversationContext";

import ProtectHeroCard from "./protect/ProtectHeroCard";
import ProfileWizard from "./protect/ProfileWizard";
import RwaAssetCards from "./protect/RwaAssetCards";
import AssetModal from "./protect/AssetModal";

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
  const { navigateToSwap } = useAppState();
  const { setDrawerOpen, addUserMessage } = useAIConversation();
  const isCelo = ChainDetectionService.isCelo(chainId);

  const {
    totalValue,
    chainCount,
    chains,
    regionData,
    isLoading: isMultichainLoading,
    isStale,
    rebalancingOpportunities,
  } = portfolio;

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
    skipToEnd,
    completeEditing,
    setUserGoal,
    setRiskTolerance,
    setTimeHorizon,
  } = useProtectionProfile();

  const [showAssetModal, setShowAssetModal] = useState<string | null>(null);
  const { experienceMode } = useAppState();
  const isBeginner = experienceMode === "beginner";

  // Current regions for recommendations
  const currentRegions = useMemo(() => {
    return displayRegionData
      .filter((item) => (item.usdValue || item.value) > 0)
      .map((item) => item.region as Region);
  }, [displayRegionData]);

  // Use the pre-calculated live portfolio analysis from the portfolio prop
  const liveAnalysis = portfolio;
  const topOpportunity = rebalancingOpportunities?.[0];

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleExecuteSwap = (
    targetToken: string,
    fromToken?: string,
    amount?: string,
  ) => {
    const sourceToken = fromToken || getBestFromToken(targetToken);
    const swapAmount = amount || getSwapAmount(sourceToken);

    // Find source chain from balances
    const sourceTokenObj = chains
      .flatMap((c) => c.balances)
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
    const allTokens = chains.flatMap((c) => c.balances);
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
      .flatMap((c) => c.balances)
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

  if (!address) {
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

  // ============================================================================
  // RENDER: Connected
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* =====================================================================
          HERO: Primary Value + Status
          ===================================================================== */}
      <Card padding="p-0" className="overflow-hidden shadow-xl">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">
                {isBeginner ? "Shield Engine" : "Protection Engine"}
              </h3>
              <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
                {isComplete
                  ? (isBeginner ? "Your Shield is Active" : "Personalized protection active")
                  : (isBeginner ? "Set up your shield" : "Set your protection profile")}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30">
              <span className="text-2xl">🤖</span>
            </div>
          </div>

          <HeroValue
            value={isBeginner ? `${Math.round((liveAnalysis.diversificationScore + (100 - liveAnalysis.weightedInflationRisk * 5)) / 2)}%` : `$${displayTotalValue.toFixed(0)}`}
            label={
              isBeginner
                ? "Protection Level"
                : (isMultichainLoading
                  ? "Loading multichain data..."
                  : `Protected across ${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""}`)
            }
          />

          {isStale && (
            <p className="text-xs text-white/60 mt-2">
              Data may be stale. Pull down to refresh.
            </p>
          )}
        </div>

        <div className="p-4 space-y-4">
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
          />

          {/* =================================================================
              PRIMARY INSIGHT CARD
              ================================================================= */}
          {liveAnalysis && topOpportunity && (
            <InsightCard
              icon="⚡"
              title={`Reduce ${topOpportunity.fromRegion} Inflation Exposure`}
              description={`Your ${topOpportunity.fromToken} holdings face ${topOpportunity.fromInflation}% inflation. Swapping to ${topOpportunity.toToken} (${topOpportunity.toInflation}% inflation) preserves purchasing power.`}
              impact={`Save $${topOpportunity.annualSavings.toFixed(2)}/year`}
              variant={
                topOpportunity.priority === "HIGH" ? "urgent" : "default"
              }
              action={{
                label: `Swap ${topOpportunity.fromToken} → ${topOpportunity.toToken}`,
                onClick: () =>
                  handleExecuteSwap(
                    topOpportunity.toToken,
                    topOpportunity.fromToken,
                    topOpportunity.suggestedAmount.toFixed(2),
                  ),
              }}
            />
          )}

          {/* =================================================================
              AI ANALYSIS CTA — opens global AI drawer
              ================================================================= */}
          <InsightCard
            icon="🤖"
            title="AI Portfolio Analysis"
            description="Get personalized recommendations based on your holdings, inflation data, and market conditions."
            variant="default"
            action={{
              label: "Analyze My Portfolio",
              onClick: () => {
                addUserMessage(`Analyze my portfolio of $${displayTotalValue.toFixed(0)} across ${displayChainCount} chain${displayChainCount !== 1 ? 's' : ''}. My goal is ${currentGoalLabel}. I'm in the ${userRegion} region.`);
                setDrawerOpen(true);
              },
            }}
          />

          {/* =================================================================
              PROTECTION SCORE - Non-beginner only
              ================================================================= */}
          {liveAnalysis && !isBeginner && (
            <ProtectionScore
              score={Math.round(
                (liveAnalysis.diversificationScore +
                  (100 - liveAnalysis.weightedInflationRisk * 5)) /
                2,
              )}
              factors={[
                {
                  label: "Data Freshness",
                  value: 90,
                  status: "Live (IMF)",
                  icon: "📊",
                },
                {
                  label: "Portfolio Coverage",
                  value: liveAnalysis.tokenCount > 0 ? 95 : 50,
                  status:
                    liveAnalysis.tokenCount > 0
                      ? `${liveAnalysis.tokenCount} tokens`
                      : "No data",
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
                  value: Math.max(
                    0,
                    100 - liveAnalysis.weightedInflationRisk * 10,
                  ),
                  status: `${liveAnalysis.weightedInflationRisk.toFixed(1)}% weighted`,
                  icon: "🛡️",
                },
              ]}
              className="mt-4"
            />
          )}
        </div>
      </Card>

      <RwaAssetCards
        chains={chains}
        userGoal={config.userGoal}
        chainId={chainId}
        onSwap={handleExecuteSwap}
        onShowModal={setShowAssetModal}
      />

      {/* =====================================================================
          COLLAPSIBLE SECTIONS
          ===================================================================== */}

      {/* Rebalancing Opportunities */}
      {liveAnalysis && liveAnalysis.rebalancingOpportunities.length > 1 && (
        <CollapsibleSection
          title={
            config.userGoal === "geographic_diversification"
              ? "Diversification Options"
              : "More Opportunities"
          }
          icon={<span>⚖️</span>}
          defaultOpen={false}
          badge={
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
              +{liveAnalysis.rebalancingOpportunities.length - 1}
            </span>
          }
        >
          <div className="space-y-2">
            {liveAnalysis.rebalancingOpportunities
              .filter((opp) => {
                if (config.userGoal !== "geographic_diversification")
                  return true;
                return (
                  opp.toRegion !== "Global" || opp.fromRegion === opp.toRegion
                );
              })
              .slice(0, 4)
              .map((opp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-600">
                      {opp.fromToken}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="text-xs font-bold text-blue-600">
                      {opp.toToken}
                    </span>
                    {config.userGoal === "geographic_diversification" &&
                      opp.fromRegion !== opp.toRegion && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          +region
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-bold">
                      +${opp.annualSavings.toFixed(2)}/yr
                    </span>
                    <button
                      onClick={() =>
                        handleExecuteSwap(
                          opp.toToken,
                          opp.fromToken,
                          opp.suggestedAmount.toFixed(2),
                        )
                      }
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                    >
                      Swap
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Chain Distribution - Now with real multichain data */}
      {displayTotalValue > 0 && (
        <CollapsibleSection
          title="Chain Distribution"
          icon={<span>🔗</span>}
          defaultOpen={false}
          badge={
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
              {displayChainCount} Chain{displayChainCount !== 1 ? "s" : ""}
            </span>
          }
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
        </CollapsibleSection>
      )}

      {/* Strategies */}
      <CollapsibleSection
        title="Goal-Based Strategies"
        icon={<span>🎯</span>}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <GoalBasedStrategies
            userRegion={userRegion}
            onSelectStrategy={onSelectStrategy || (() => { })}
          />
        </div>
      </CollapsibleSection>

      <AssetModal
        assetSymbol={showAssetModal}
        onClose={() => setShowAssetModal(null)}
        onSwap={handleExecuteSwap}
      />
    </div>
  );
}
