import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MtPelerinOnramp } from "../onramp/MtPelerinOnramp";
import InflationProtectionInfo from "../inflation/InflationProtectionInfo";
import RegionalRecommendations from "../regional/RegionalRecommendations";
import AgentWealthGuard from "../agent/AgentWealthGuard";
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
import WalletButton from "../wallet/WalletButton";
import type { AggregatedPortfolio } from "@/hooks/use-stablecoin-balances";
import { useWealthProtectionAgent } from "@/hooks/use-wealth-protection-agent";
import { useAppState } from "@/context/AppStateContext";
import { useInflationData } from "@/hooks/use-inflation-data";
import {
  analyzePortfolio,
  type PortfolioAnalysis,
} from "@/utils/portfolio-analysis";

// Types from hook
import type { UserGoal } from "@/hooks/use-wealth-protection-agent";

// ============================================================================
// CONSTANTS - Single source of truth
// ============================================================================

const USER_GOALS: Array<{
  value: UserGoal;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: "inflation_protection",
    label: "Hedge Inflation",
    icon: "🛡️",
    description: "Protect against currency devaluation",
  },
  {
    value: "geographic_diversification",
    label: "Diversify Regions",
    icon: "🌍",
    description: "Spread risk across economies",
  },
  {
    value: "rwa_access",
    label: "Access Gold/RWA",
    icon: "🥇",
    description: "Hold real-world assets",
  },
  {
    value: "exploring",
    label: "Just Exploring",
    icon: "🔍",
    description: "Learn about protection",
  },
];

const RISK_LEVELS = [
  { value: "Conservative" as const, label: "Conservative", icon: "🛡️" },
  { value: "Balanced" as const, label: "Balanced", icon: "⚖️" },
  { value: "Aggressive" as const, label: "Aggressive", icon: "🚀" },
] as const;

const TIME_HORIZONS = [
  { value: "1 month" as const, label: "Short", description: "< 3 months" },
  { value: "3 months" as const, label: "Medium", description: "3-12 months" },
  { value: "1 year" as const, label: "Long", description: "> 1 year" },
] as const;

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
      "Deep DEX liquidity ($10M+)"
    ],
    gradient: "from-green-600 to-emerald-700",
    icon: "📈",
    textColor: "text-green-700",
    bgColor: "bg-green-100",
    expectedSlippage: "0.5%",
    yieldTooltip: "Your USDY balance grows automatically at ~5% APY. Just hold it in your wallet—no claiming needed. The yield accrues continuously and compounds automatically.",
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
    yieldTooltip: "PAXG tracks the price of physical gold. No yield—it's a store of value that protects against currency debasement and inflation over time.",
  },
  {
    symbol: "SDAI",
    type: "Stable Yield",
    label: "Savings DAI",
    description:
      "Permissionless yield-bearing stablecoin from Maker/Sky. Rebasing yield on DAI collateral.",
    benefits: [
      "~4.5% APY",
      "Fully permissionless",
      "Instant liquidity"
    ],
    gradient: "from-yellow-500 to-amber-600",
    icon: "💰",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-100",
    expectedSlippage: "0.3%",
    yieldTooltip: "Your sDAI balance increases automatically at ~4.5% APY from Maker's DAI Savings Rate. Just hold it—yield accrues every block with no action needed.",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ProtectionTabProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  balances: Record<string, { formattedBalance: string; value: number }>;
  setActiveTab?: (tab: string) => void;
  onSelectStrategy?: (strategy: string) => void;
  aggregatedPortfolio?: AggregatedPortfolio;
}

export default function ProtectionTab({
  userRegion,
  setUserRegion,
  regionData,
  totalValue,
  balances,
  setActiveTab,
  onSelectStrategy,
  aggregatedPortfolio,
}: ProtectionTabProps) {
  // setActiveTab available for future navigation needs
  void setActiveTab;
  const { address, chainId } = useWalletContext();
  const { config, updateConfig, advice, portfolioAnalysis, isAnalyzing } =
    useWealthProtectionAgent();
  const { navigateToSwap } = useAppState();
  const { inflationData } = useInflationData();
  const isCelo = ChainDetectionService.isCelo(chainId);

  // Progressive disclosure state
  const [profileStep, setProfileStep] = useState(0); // 0 = not started, 1-3 = steps
  const [showAssetModal, setShowAssetModal] = useState<string | null>(null);

  // Live portfolio analysis (independent of AI)
  const liveAnalysis = useMemo<PortfolioAnalysis | null>(() => {
    if (!aggregatedPortfolio) return null;
    return analyzePortfolio(
      aggregatedPortfolio,
      inflationData,
      config.userGoal,
    );
  }, [aggregatedPortfolio, inflationData, config.userGoal]);

  const currentRegions = regionData
    .filter((item) => item.value > 0)
    .map((item) => item.region as Region);

  const currentAllocations = Object.fromEntries(
    regionData.map((item) => [item.region, item.value / 100]),
  );

  // Derived state for cleaner conditionals
  const hasProfile =
    profileStep >= 3 ||
    (config.userGoal && config.riskTolerance && config.timeHorizon);
  const analysis = portfolioAnalysis || liveAnalysis;
  const topOpportunity = analysis?.rebalancingOpportunities?.[0];

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleExecuteSwap = (
    targetToken: string,
    fromToken?: string,
    amount?: string,
  ) => {
    // Auto-select source token if not provided
    const sourceToken = fromToken || getBestFromToken(targetToken);
    const swapAmount = amount || getSwapAmount(sourceToken);

    navigateToSwap({
      fromToken: sourceToken,
      toToken: targetToken,
      amount: swapAmount,
      reason:
        advice?.reasoning ||
        `Swap to ${targetToken} for ${USER_GOALS.find((g) => g.value === config.userGoal)?.label || "wealth protection"}`,
    });
  };

  const getBestFromToken = (targetToken: string): string => {
    const tokensWithBalances = Object.entries(balances || {})
      .filter(([, data]) => data.value > 0)
      .sort((a, b) => b[1].value - a[1].value);

    if (tokensWithBalances.length === 0) return "CUSD";

    // For gold, prefer high-inflation regional tokens
    if (targetToken === "PAXG") {
      const highInflationTokens = [
        "CKES",
        "CCOP",
        "CZAR",
        "CREAL",
        "CXOF",
        "CGHS",
      ];
      const foundHighInflation = tokensWithBalances.find(([symbol]) =>
        highInflationTokens.some((hit) => symbol.toUpperCase().includes(hit)),
      );
      if (foundHighInflation) return foundHighInflation[0];
    }

    const largestNonTarget = tokensWithBalances.find(
      ([symbol]) => symbol.toUpperCase() !== targetToken.toUpperCase(),
    );
    return largestNonTarget?.[0] || tokensWithBalances[0]?.[0] || "CUSD";
  };

  const getSwapAmount = (fromToken: string): string => {
    const balance = balances?.[fromToken]?.value || 0;
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
            message="Connect your wallet to analyze your portfolio against real-time global inflation data."
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
                {hasProfile
                  ? "Personalized protection active"
                  : "Set your protection profile"}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30">
              <span className="text-2xl">🤖</span>
            </div>
          </div>

          <HeroValue
            value={`$${totalValue.toFixed(0)}`}
            label={`Protected across ${currentRegions.length || 0} regions`}
          />
        </div>

        <div className="p-4 space-y-4">
          {/* =================================================================
              STEP 1: Select Goal (Always visible, collapses after selection)
              ================================================================= */}
          <AnimatePresence mode="wait">
            {!hasProfile && profileStep === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StepCard
                  step={1}
                  totalSteps={3}
                  title="What's your primary goal?"
                  onNext={() => setProfileStep(1)}
                  onSkip={() => setProfileStep(3)}
                >
                  <QuickSelect
                    options={USER_GOALS}
                    value={config.userGoal || "exploring"}
                    onChange={(v) => updateConfig({ userGoal: v })}
                  />
                </StepCard>
              </motion.div>
            )}

            {!hasProfile && profileStep === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StepCard
                  step={2}
                  totalSteps={3}
                  title="What's your risk tolerance?"
                  onNext={() => setProfileStep(2)}
                  onSkip={() => setProfileStep(3)}
                >
                  <QuickSelect
                    options={RISK_LEVELS}
                    value={config.riskTolerance || "Balanced"}
                    onChange={(v) => updateConfig({ riskTolerance: v })}
                    columns={3}
                  />
                </StepCard>
              </motion.div>
            )}

            {!hasProfile && profileStep === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StepCard
                  step={3}
                  totalSteps={3}
                  title="What's your time horizon?"
                  onNext={() => setProfileStep(3)}
                  onSkip={() => setProfileStep(3)}
                  isLast
                >
                  <QuickSelect
                    options={TIME_HORIZONS}
                    value={config.timeHorizon || "3 months"}
                    onChange={(v) => updateConfig({ timeHorizon: v })}
                    columns={3}
                  />
                </StepCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* =================================================================
              PROFILE SUMMARY (shown when profile complete)
              ================================================================= */}
          {hasProfile && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {USER_GOALS.find((g) => g.value === config.userGoal)?.icon}
                </span>
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {USER_GOALS.find((g) => g.value === config.userGoal)?.label}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {config.riskTolerance} •{" "}
                    {
                      TIME_HORIZONS.find((t) => t.value === config.timeHorizon)
                        ?.label
                    }
                  </div>
                </div>
              </div>
              <button
                onClick={() => setProfileStep(0)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
              >
                Edit
              </button>
            </div>
          )}

          {/* =================================================================
              PRIMARY INSIGHT CARD
              Consolidates: AgentWealthGuard + ActionableRecommendation top action
              ================================================================= */}
          {analysis && topOpportunity && !isAnalyzing && (
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
              AI ANALYSIS SECTION (embedded AgentWealthGuard)
              ================================================================= */}
          <AgentWealthGuard
            amount={totalValue || 0}
            holdings={
              aggregatedPortfolio?.allHoldings || Object.keys(balances || {})
            }
            onExecute={handleExecuteSwap}
            aggregatedPortfolio={aggregatedPortfolio}
            embedded
          />

          {/* =================================================================
              PROTECTION SCORE - Single consolidated indicator with breakdown
              ================================================================= */}
          {analysis && (
            <ProtectionScore
              score={Math.round(
                (analysis.diversificationScore +
                  (100 - analysis.weightedInflationRisk * 5)) /
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
                  value: analysis.tokenCount > 0 ? 95 : 50,
                  status:
                    analysis.tokenCount > 0
                      ? `${analysis.tokenCount} tokens`
                      : "No data",
                  icon: "💰",
                },
                {
                  label: "Regional Diversification",
                  value: analysis.regionCount > 2 ? 90 : 70,
                  status: `${analysis.regionCount} regions`,
                  icon: "🌍",
                },
                {
                  label: "Inflation Risk",
                  value: Math.max(0, 100 - analysis.weightedInflationRisk * 10),
                  status: `${analysis.weightedInflationRisk.toFixed(1)}% weighted`,
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
        const hasAsset = analysis?.tokens.some(
          (t) => t.symbol === asset.symbol,
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
          FIAT ON-RAMP CARD - Show when user has low balance
          ===================================================================== */}
      {(!totalValue || totalValue < 50) && (
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
            <MtPelerinOnramp mode="buy" className="flex-1" variant="white" />
          </div>
        </Card>
      )}

      {/* =====================================================================
          COLLAPSIBLE SECTIONS (progressive disclosure for details)
          ===================================================================== */}

      {/* Rebalancing Opportunities - Filtered by goal */}
      {analysis && analysis.rebalancingOpportunities.length > 1 && (
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
              +{analysis.rebalancingOpportunities.length - 1}
            </span>
          }
        >
          <div className="space-y-2">
            {analysis.rebalancingOpportunities
              // Filter: if diversifying, don't show all-gold options
              .filter((opp) => {
                if (config.userGoal !== "geographic_diversification")
                  return true;
                // For diversification, prefer regional diversity over gold
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

      {/* Chain Distribution */}
      {totalValue > 0 && (
        <CollapsibleSection
          title="Chain Distribution"
          icon={<span>🔗</span>}
          defaultOpen={false}
          badge={
            aggregatedPortfolio && (
              <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
                {
                  aggregatedPortfolio.chains.filter((c) => c.totalValue > 0)
                    .length
                }{" "}
                Chains
              </span>
            )
          }
        >
          <MultichainPortfolioBreakdown
            regionData={regionData}
            totalValue={totalValue}
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
          amount={totalValue || 1000}
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
