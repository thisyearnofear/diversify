import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import confetti from "canvas-confetti";
import MultichainPortfolioBreakdown from "../portfolio/MultichainPortfolioBreakdown";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../wallet/WalletProvider";
import {
  Card,
  Section,
  InsightCard,
} from "../shared/TabComponents";
import { NETWORK_TOKENS, NETWORKS } from "@/config";
import { useNavigation } from "@/context/app/NavigationContext";
import { useDemoMode } from "@/context/app/DemoModeContext";
import { useExperience } from "@/context/app/ExperienceContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useAdvisor } from "@/hooks/use-advisor";
import { useFinancialStrategies } from "@/hooks/useFinancialStrategies";
import { StrategyService } from "@diversifi/shared";
import { useToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";

import { ProtectionNotConnected } from "./protect/ProtectionNotConnected";
import { ProtectionPlanCard } from "./protect/ProtectionPlanCard";
import type { TokenBalance } from "@/hooks/use-multichain-balances";
import RwaAssetCards from "./protect/RwaAssetCards";
import YieldDiscoverySection from "../earn/YieldDiscoverySection";
import AssetModal from "./protect/AssetModal";
import OptimizationInsight from "./protect/OptimizationInsight";
import PortfolioRecommendations from "../portfolio/PortfolioRecommendations";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import DepositHub from "../onramp/DepositHub";
import dynamic from "next/dynamic";
import { GuardianMascot } from "../shared/GuardianMascot";
import GuardianOnboardingWizard from "../agent/GuardianOnboardingWizard";
import { GuardianMobileWizard } from "../agent/GuardianMobileWizard";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { useAgentConfig } from "@/hooks/use-agent-config";
import { useVault } from "@/hooks/use-vault";
import { useSessionKey } from "@/hooks/use-session-key";
import ProtectionSkeleton from "../ui/skeletons/ProtectionSkeleton";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ProtectionTabProps {
  userRegion: Region;
  portfolio: MultichainPortfolio;
  isLoading?: boolean;
  onSelectStrategy?: (strategy: string) => void;
  setActiveTab?: (tab: import("@/constants/tabs").TabId) => void;
}

import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

export default function ProtectionTab({
  userRegion,
  portfolio,
  isLoading,
  onSelectStrategy,
  setActiveTab,
}: ProtectionTabProps) {
  const { address, chainId } = useWalletContext();
  const { navigateToSwap } = useNavigation();
  const { demoMode, enableDemoMode } = useDemoMode();
  const { experienceMode } = useExperience();
  const { askAdvisor } = useAdvisor();
  const isDemo = demoMode.isActive;
  const isBeginner = experienceMode === "beginner";

  // Use demo data if in demo mode
  const activePortfolio = isDemo ? DEMO_PORTFOLIO : portfolio;

  // Guardian onboarding state — lives here so the Protect tab owns setup
  const { autonomousStatus, isLoading: isGuardianStatusLoading } = useAgentStatus();
  const { config: agentConfig } = useAgentConfig();
  const [guardianDismissed, setGuardianDismissed] = useState(false);
  const [showMobileWizard, setShowMobileWizard] = useState(false);
  const vault = useVault();
  const { requestPermission } = useSessionKey();

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
  // CONFETTI CELEBRATIONS
  // ============================================================================

  const lastScoreMilestoneRef = useRef(0);
  const hasFiredProfileConfettiRef = useRef(false);

  const fireScoreConfetti = useCallback((score: number) => {
    const milestone = Math.floor(score / 25) * 25;
    if (milestone > 0 && milestone > lastScoreMilestoneRef.current) {
      lastScoreMilestoneRef.current = milestone;
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.4, x: 0.5 },
        colors: ["#6366f1", "#a855f7", "#ec4899"],
      });
    }
  }, []);

  const fireProfileConfetti = useCallback(() => {
    if (!hasFiredProfileConfettiRef.current) {
      hasFiredProfileConfettiRef.current = true;
      const end = Date.now() + 800;
      const colors = ["#6366f1", "#a855f7", "#ec4899"];
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors,
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, []);

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
    const swapAmount = amount !== undefined ? amount : getSwapAmount(sourceToken);

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

  useEffect(() => {
    if (address && protectionScore > 0 && displayTotalValue > 0) {
      fireScoreConfetti(protectionScore);
    }
  }, [protectionScore, fireScoreConfetti, address, displayTotalValue]);

  useEffect(() => {
    if (isComplete && address) {
      fireProfileConfetti();
    }
  }, [isComplete, address, fireProfileConfetti]);

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

  if (isLoading && address && !isDemo) {
    return <ProtectionSkeleton />;
  }

  if (!address && !isDemo) {
    return <ProtectionNotConnected experienceMode={experienceMode} onEnableDemo={enableDemoMode} />;
  }

  // ============================================================================
  // RENDER: Connected
  // ============================================================================

  // Show EmptyState when connected but no protection data exists yet
  if (address && displayTotalValue === 0 && !isComplete) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="🛡️"
          title="No protection plan yet"
          description="Start by connecting a wallet and exploring your options."
          action={setActiveTab ? { label: "Add Funds", onClick: () => setActiveTab("exchange") } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Strategy Alignment Bar */}
      {selectedStrategyData && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
          <GuardianMascot size={40} mood={strategyAlignmentScore > 80 ? 'happy' : 'thinking'} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 truncate">
                {selectedStrategyData.name}
              </span>
...

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
      {<ProtectionPlanCard
        experienceMode={experienceMode}
        address={address}
        portfolio={activePortfolio as MultichainPortfolio}
        userRegion={userRegion}
        isComplete={isComplete}
        currentGoalLabel={currentGoalLabel}
      />}

      {/* =================================================================
          GUARDIAN ONBOARDING — Setup lives on Protect tab
          ================================================================= */}
      {address && !isGuardianStatusLoading && !guardianDismissed && (!autonomousStatus || !autonomousStatus.enabled) && (
        <GuardianOnboardingWizard
          onActivate={() => setShowMobileWizard(true)}
          onSkip={() => setGuardianDismissed(true)}
          spendingLimit={agentConfig.spendingLimit}
        />
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
          title="Protection Yield Opportunities"
          description="Low-to-medium risk vaults ranked for protection plans. Review the route, confirm the amount, and then deposit through LI.FI."
          actionLabel="Review in Protect"
          onSelectVault={(vault) => {
            openProtectionFlow(
              `lifi-earn:${vault.id}`,
              vault.asset.symbol,
              ""
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
        <Section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-lg">🔗</div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Chain Distribution</h3>
            </div>
            <span className="text-xs font-bold text-gray-500">{displayChainCount} Chain{displayChainCount !== 1 ? "s" : ""}</span>
          </div>
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
        </Section>
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

      {/* Guardian Setup Mobile Wizard — full activation flow inline */}
      {showMobileWizard && address && (
        <GuardianMobileWizard
          userAddress={address}
          vaultAddress={vault.vault?.circleWalletAddress}
          onComplete={() => {
            setShowMobileWizard(false);
            if (address) vault.refresh(address);
          }}
          onCancel={() => setShowMobileWizard(false)}
          onCreateVault={async (strategy) => {
            return vault.createVault(address, strategy);
          }}
          onRequestPermission={async (dailyLimit, tokens) => {
            if (!address || !chainId) return false;
            try {
              const provider = (window as any).ethereum;
              if (!provider) return false;
              const { ethers } = await import("ethers");
              const ethersProvider = new ethers.providers.Web3Provider(provider);
              const signer = ethersProvider.getSigner();
              const result = await requestPermission(
                "GUARDIAN",
                address,
                signer,
                chainId,
                {
                  spendingLimitUSD: dailyLimit * 30,
                  dailyLimitUSD: dailyLimit,
                }
              );
              if (result) {
                await vault.refresh(address);
                return true;
              }
              return false;
            } catch {
              return false;
            }
          }}
        />
      )}
    </div>
  );
}
