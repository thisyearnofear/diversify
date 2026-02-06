import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SmartBuyCryptoButton } from "../onramp";
import InflationProtectionInfo from "../inflation/InflationProtectionInfo";
import RegionalRecommendations from "../regional/RegionalRecommendations";
import AIAssistant from "../ai/AIAssistant";
import GoalBasedStrategies from "../strategies/GoalBasedStrategies";
import MultichainPortfolioBreakdown from "../portfolio/MultichainPortfolioBreakdown";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../wallet/WalletProvider";
import {
  Card,
  CollapsibleSection,
  ConnectWalletPrompt,
  StepCard,
  InsightCard,
  QuickSelect,
  ProtectionScore,
  Section,
  HeroValue,
} from "../shared/TabComponents";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";
import { NETWORK_TOKENS, NETWORKS } from "@/config";
import WalletButton from "../wallet/WalletButton";
import { useAppState } from "@/context/AppStateContext";
import {
  useProtectionProfile,
  USER_GOALS,
  RISK_LEVELS,
  TIME_HORIZONS,
} from "@/hooks/use-protection-profile";

// Types from hook
import type { UserGoal } from "@/hooks/use-protection-profile";

// ============================================================================
// RWA ASSETS CONFIGURATION
// ============================================================================

const RWA_ASSETS = [
  {
    symbol: "USDY",
    type: "Yield Bearing",
    label: "US Treasury Yield",
    description:
      "Tokenized US Treasuries via Ondo. ~5% APY auto-accrues in your wallet. No KYC needed.",
    benefits: [
      "~5% APY auto-accruing",
      "No KYC required",
      "Deep DEX liquidity ($10M+)",
    ],
    gradient: "from-green-600 to-emerald-700",
    icon: "📈",
    textColor: "text-green-700",
    bgColor: "bg-green-100",
    expectedSlippage: "0.5%",
    yieldTooltip:
      "Your USDY balance grows automatically at ~5% APY. Just hold it in your wallet—no claiming needed. The yield accrues continuously and compounds automatically.",
  },
  {
    symbol: "PAXG",
    type: "Store of Value",
    label: "Inflation Hedge",
    description:
      "Tokenized physical gold backed 1:1 by London Good Delivery gold bars held in Brink's vaults.",
    benefits: [
      "No storage fees",
      "Redeemable for physical gold",
      "24/7 trading",
    ],
    gradient: "from-amber-500 to-orange-600",
    icon: "🏆",
    textColor: "text-amber-700",
    bgColor: "bg-amber-100",
    yieldTooltip:
      "PAXG tracks the price of physical gold. No yield—it's a store of value that protects against currency debasement and inflation over time.",
  },
  {
    symbol: "SYRUPUSDC",
    type: "Stable Yield",
    label: "Syrup USDC",
    description:
      "Yield-bearing USDC from Syrup Finance powered by Morpho. Earn passive yield on your USDC holdings.",
    benefits: ["~4.5% APY", "Morpho-powered lending", "Auto-compounding"],
    gradient: "from-purple-500 to-indigo-600",
    icon: "🍯",
    textColor: "text-purple-700",
    bgColor: "bg-purple-100",
    expectedSlippage: "0.3%",
    yieldTooltip:
      "Your SYRUPUSDC balance increases automatically at ~4.5% APY from Morpho lending markets. Just hold it—yield accrues automatically with no action needed.",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ProtectionTabProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  portfolio: MultichainPortfolio;
  onSelectStrategy?: (strategy: string) => void;
  setActiveTab?: (tab: string) => void;
}

import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

export default function ProtectionTab({
  userRegion,
  setUserRegion,
  portfolio,
  onSelectStrategy,
}: ProtectionTabProps) {
  const { address, chainId } = useWalletContext();
  const { navigateToSwap } = useAppState();
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

  // Modal state for asset details
  const [showAssetModal, setShowAssetModal] = useState<string | null>(null);

  // Current regions for recommendations
  const currentRegions = useMemo(() => {
    return displayRegionData
      .filter((item) => (item.usdValue || item.value) > 0)
      .map((item) => item.region as Region);
  }, [displayRegionData]);

  const currentAllocations = useMemo(() => {
    return Object.fromEntries(
      displayRegionData.map((item) => [
        item.region,
        (item.usdValue || item.value) / displayTotalValue,
      ]),
    );
  }, [displayRegionData, displayTotalValue]);

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
                <div className="text-[10px] font-black uppercase text-gray-900">
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
                Protection Engine
              </h3>
              <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
                {isComplete
                  ? "Personalized protection active"
                  : "Set your protection profile"}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30">
              <span className="text-2xl">🤖</span>
            </div>
          </div>

          <HeroValue
            value={`$${displayTotalValue.toFixed(0)}`}
            label={
              isMultichainLoading
                ? "Loading multichain data..."
                : `Protected across ${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""}`
            }
          />

          {isStale && (
            <p className="text-[10px] text-white/60 mt-2">
              Data may be stale. Pull down to refresh.
            </p>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* =================================================================
              PROFILE SETUP FLOW (3 Steps)
              ================================================================= */}
          <AnimatePresence mode="wait">
            {profileMode === "editing" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Step 1: Goal */}
                {currentStep === 0 && (
                  <StepCard
                    step={1}
                    totalSteps={3}
                    title="What's your primary goal?"
                    onNext={() => {
                      if (config.userGoal) nextStep();
                    }}
                    onSkip={skipToEnd}
                    canProceed={!!config.userGoal}
                  >
                    <QuickSelect
                      options={USER_GOALS.map((g) => ({
                        value: g.value,
                        label: g.label,
                        icon: g.icon,
                        description: g.description,
                      }))}
                      value={config.userGoal || "exploring"}
                      onChange={(v) => setUserGoal(v as UserGoal)}
                    />
                  </StepCard>
                )}

                {/* Step 2: Risk Tolerance */}
                {currentStep === 1 && (
                  <StepCard
                    step={2}
                    totalSteps={3}
                    title="What's your risk tolerance?"
                    onNext={nextStep}
                    onSkip={skipToEnd}
                    canProceed={!!config.riskTolerance}
                  >
                    <QuickSelect
                      options={RISK_LEVELS.map((r) => ({
                        value: r.value,
                        label: r.label,
                        icon: r.icon,
                      }))}
                      value={config.riskTolerance || "Balanced"}
                      onChange={(v) =>
                        setRiskTolerance(
                          v as "Conservative" | "Balanced" | "Aggressive",
                        )
                      }
                      columns={3}
                    />
                  </StepCard>
                )}

                {/* Step 3: Time Horizon */}
                {currentStep === 2 && (
                  <StepCard
                    step={3}
                    totalSteps={3}
                    title="What's your time horizon?"
                    onNext={completeEditing}
                    onSkip={skipToEnd}
                    isLast
                    canProceed={!!config.timeHorizon}
                  >
                    <QuickSelect
                      options={TIME_HORIZONS.map((t) => ({
                        value: t.value,
                        label: t.label,
                        description: t.description,
                      }))}
                      value={config.timeHorizon || "3 months"}
                      onChange={(v) =>
                        setTimeHorizon(v as "1 month" | "3 months" | "1 year")
                      }
                      columns={3}
                    />
                  </StepCard>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* =================================================================
              PROFILE SUMMARY (shown when complete)
              ================================================================= */}
          {profileMode === "complete" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{currentGoalIcon}</span>
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {currentGoalLabel}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {currentRiskLabel} • {currentTimeHorizonLabel}
                  </div>
                </div>
              </div>
              <button
                onClick={startEditing}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                Edit
              </button>
            </motion.div>
          )}

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
              AI ANALYSIS SECTION
              ================================================================= */}
          <AIAssistant
            amount={displayTotalValue || 0}
            holdings={chains.flatMap((c) => c.balances.map((b) => b.symbol))}
            onExecute={handleExecuteSwap}
            embedded
            userRegion={userRegion}
          />

          {/* =================================================================
              PROTECTION SCORE
              ================================================================= */}
          {liveAnalysis && (
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

      {/* =====================================================================
          RWA ASSET CARDS
          ===================================================================== */}
      {RWA_ASSETS.map((asset) => {
        const hasAsset = chains.some((chain) =>
          chain.balances.some((b) => b.symbol === asset.symbol),
        );
        const showCard = !hasAsset || config.userGoal === "rwa_access";

        if (!showCard) return null;

        return (
          <Card
            key={asset.symbol}
            className={`bg-gradient-to-br ${asset.gradient} text-white p-4 mb-4 cursor-pointer hover:shadow-lg transition-all`}
            onClick={() => setShowAssetModal(asset.symbol)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                  {asset.icon}
                </div>
                <div>
                  <h3 className="font-black text-sm">{asset.label}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                      {asset.symbol} on Arbitrum
                    </span>
                    <span className="text-[10px] bg-green-500/40 px-2 py-0.5 rounded-full">
                      ✓ Open Market
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-white/80 mb-3">{asset.description}</p>
            {asset.expectedSlippage && (
              <p className="text-[10px] text-white/60 mb-2">
                Expected slippage: ~{asset.expectedSlippage}
              </p>
            )}
            {isCelo && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExecuteSwap(asset.symbol);
                }}
                className={`w-full py-3 bg-white ${asset.textColor} rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/90 transition-all`}
              >
                Get {asset.symbol} →
              </button>
            )}
          </Card>
        );
      })}

      {/* =====================================================================
          FIAT ON-RAMP CARD
          ===================================================================== */}
      {(!displayTotalValue || displayTotalValue < 50) && (
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                💳
              </div>
              <div>
                <h3 className="font-black text-sm">Add Funds</h3>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                  Buy with Card/Bank
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-white/80 mb-3">
            Buy crypto instantly with card or bank transfer. No KYC required
            under limits. Swiss-regulated.
          </p>
          <div className="flex gap-2">
            <SmartBuyCryptoButton className="flex-1" variant="white" />
          </div>
        </Card>
      )}

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
            <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
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
                        <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          +region
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-green-600 font-bold">
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
                      className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700"
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
            <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
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
            onSelectStrategy={onSelectStrategy || (() => {})}
          />
        </div>
      </CollapsibleSection>

      {/* Regional Protection Data */}
      <CollapsibleSection
        title="Regional Protection Data"
        icon={<span>📊</span>}
        defaultOpen={false}
      >
        <InflationProtectionInfo
          homeRegion={userRegion}
          currentRegions={currentRegions}
          amount={displayTotalValue || 1000}
          onChangeHomeRegion={setUserRegion}
        />
        <Section divider>
          <RegionalRecommendations
            userRegion={userRegion}
            currentAllocations={currentAllocations}
          />
        </Section>
      </CollapsibleSection>

      {/* =====================================================================
          ASSET INFO MODAL
          ===================================================================== */}
      {showAssetModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAssetModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {RWA_ASSETS.filter((a) => a.symbol === showAssetModal).map(
              (asset) => (
                <div key={asset.symbol}>
                  <div className="flex items-center gap-4 mb-6">
                    <div
                      className={`w-16 h-16 ${asset.bgColor} dark:bg-opacity-30 rounded-2xl flex items-center justify-center text-4xl shadow-inner`}
                    >
                      {asset.icon}
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-gray-900 dark:text-gray-100">
                        {asset.symbol}
                      </h3>
                      <span
                        className={`text-[10px] font-black uppercase ${asset.bgColor} dark:bg-opacity-30 ${asset.textColor} dark:text-opacity-90 px-2 py-1 rounded-md`}
                      >
                        {asset.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed font-medium">
                    {asset.description}
                  </p>

                  {/* Market Type Badge */}
                  <div className="mb-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-xs">
                        <span>✓</span>
                        <span>Open Market - No KYC Required</span>
                      </div>
                      {asset.expectedSlippage && (
                        <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
                          Expected slippage: ~{asset.expectedSlippage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Yield Explanation Tooltip */}
                  {asset.yieldTooltip && (
                    <div className="mb-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">💡</span>
                          <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                            {asset.yieldTooltip}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 mb-8">
                    {asset.benefits.map((benefit, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5 font-bold"
                      >
                        <span className="text-green-500 text-lg">✓</span>
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAssetModal(null)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setShowAssetModal(null);
                        handleExecuteSwap(asset.symbol);
                      }}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30"
                    >
                      Get {asset.symbol}
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
