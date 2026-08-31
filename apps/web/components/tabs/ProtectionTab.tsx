import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
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
// Deep leaf import — NOT the barrel — keeps the strategy stack out of first-load.
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import { useToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";
import { trackFunnelEvent } from "@/lib/analytics";

import { ProtectionNotConnected } from "./protect/ProtectionNotConnected";
import { ProtectionPlanCard } from "./protect/ProtectionPlanCard";
import { ProtectionPlanRing } from "./protect/ProtectionPlanRing";
import { strategyToArchetype } from "@/components/protection-cards/tokens";
import { getArchetypeAllocations } from "@/components/protection-cards/plan-preview";
import { ProtectionPlanGallery } from "./protect/ProtectionPlanGallery";
import { ProtectionJourney } from "./protect/ProtectionJourney";
import type { TokenBalance } from "@/hooks/use-multichain-balances";
import RwaAssetCards from "./protect/RwaAssetCards";
import RobinhoodRwaCard from "./protect/RobinhoodRwaCard";
import AssetModal from "./protect/AssetModal";
import OptimizationInsight from "./protect/OptimizationInsight";
import PortfolioRecommendations from "../portfolio/PortfolioRecommendations";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import DepositHub from "../onramp/DepositHub";
import dynamic from "next/dynamic";
import { GuardianMobileWizard } from "../agent/GuardianMobileWizard";
import { GuardianStatusChip, useGuardianTierSnapshotFrom } from "../agent/AgentTierStatus";
import { GuardianStateScrollytelling } from "./protect/GuardianStateScrollytelling";
import { ShieldGuardianRecommendation } from "./protect/ShieldGuardianRecommendation";
import { PaymentCycleReport } from "./protect/PaymentCycleReport";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useStrategy } from "@/context/app/StrategyContext";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { useVault } from "@/hooks/use-vault";
import { useSessionKey } from "@/hooks/use-session-key";
import ProtectionSkeleton from "../ui/skeletons/ProtectionSkeleton";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import DisclosureSection from "../shared/DisclosureSection";

// Lazy-load heavy sub-sections that fire network requests on mount.
// These are below-the-fold and shouldn't block the initial render.
const SavingsLoopCard = lazy(() => import("../rewards/SavingsLoopCard").then(mod => ({ default: mod.SavingsLoopCard })));
const BestYieldCard = lazy(() => import("../earn/BestYieldCard").then(mod => ({ default: mod.BestYieldCard })));
const CaribbeanFxNetCard = lazy(() => import("../enterprise-fx/CaribbeanFxNetCard").then(mod => ({ default: mod.CaribbeanFxNetCard })));
const YieldDiscoverySection = lazy(() => import("../earn/YieldDiscoverySection").then(mod => ({ default: mod.default })));

// Skeleton placeholder for lazy-loaded sections
const LazySectionSkeleton = () => (
  <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-24" />
);

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
  const { config: adaptiveConfig } = useAdaptiveContext();
  const isDemo = demoMode.isActive;
  const isBeginner = experienceMode === "beginner";

  // Use demo data if in demo mode
  const activePortfolio = isDemo ? DEMO_PORTFOLIO : portfolio;

  // Guardian onboarding state — lives here so the Protect tab owns setup
  const { isLoading: isGuardianStatusLoading } = useAgentStatus();
  const [showMobileWizard, setShowMobileWizard] = useState(false);
  const { financialStrategy } = useStrategy();
  const vault = useVault();
  const { requestPermission, signedPermission, sessionInfo, deriveGuardianState } = useSessionKey();
  const { guardianState } = useGuardianTierSnapshotFrom(vault, {
    signedPermission,
    sessionInfo,
    deriveGuardianState,
  });

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

  const { riskData, primaryDepreciation } = useCurrencyRisk();
  const [dismissedInlineRec, setDismissedInlineRec] = useState(false);

  // Marquee focus state — the plan ring's selection lives here so the rest
  // of the tab (optimization insight, Guardian prompt) can react to it.
  const [focusedToken, setFocusedToken] = useState<string | null>(null);
  const handleMarqueeSelect = useCallback((token: string | null) => {
    setFocusedToken(token);
    if (token) trackFunnelEvent('marquee_select', { token, source: 'shield_ring' });
  }, []);

  // Shield section priority — persona-aware ordering of shield tab sections.
  // The adaptiveConfig.content.shieldSections array defines the priority order;
  // sections appear earlier if they're listed first in that array.
  const shieldSectionOrder = useMemo(() => {
    const order = adaptiveConfig.content.shieldSections;
    const sectionIndex = new Map<string, number>();
    order.forEach((id, i) => sectionIndex.set(id, i));
    return sectionIndex;
  }, [adaptiveConfig.content.shieldSections]);

  // Sort-key helper — maps a section identifier to its position in the
  // persona-priority order. Sections not listed in shieldSections fall
  // back to their document order via `fallbackIndex`.
  const getSectionSortKey = useCallback(
    (sectionId: string, fallbackIndex: number) => {
      return shieldSectionOrder.get(sectionId) ?? fallbackIndex;
    },
    [shieldSectionOrder],
  );

  const { selectedStrategy, getStrategyById } = useFinancialStrategies();

  // The marquee renders only when the strategy resolves to real allocations —
  // the plan-card demotion follows the same predicate, so the plan is never
  // buried without the ring taking over its job.
  const planRingVisible = useMemo(() => {
    const key = (selectedStrategy || financialStrategy) as string | null;
    if (!key) return false;
    const archetypeId = strategyToArchetype(key);
    return archetypeId ? getArchetypeAllocations(archetypeId).length > 0 : false;
  }, [selectedStrategy, financialStrategy]);
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

  // Focus-aware routing: when the marquee has a slice selected, insights
  // speak about the opportunity involving that token; otherwise the
  // top-priority opportunity stands.
  const activeOpportunity = useMemo(() => {
    if (!focusedToken || !rebalancingOpportunities?.length) return topOpportunity;
    return (
      rebalancingOpportunities.find(
        (o) => o.fromToken === focusedToken || o.toToken === focusedToken,
      ) ?? topOpportunity
    );
  }, [focusedToken, rebalancingOpportunities, topOpportunity]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const openProtectionFlow = (
    targetToken: string,
    fromToken?: string,
    amount?: string,
  ) => {
    // In demo mode, show connect prompt via toast (not browser alert)
    if (isDemo) {
      showToast("Connect your wallet to execute real swaps.", "info");
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

  // Derive the CSS pattern class from the user's strategy (or selected
  // strategy) so the Shields tab background carries their philosophy.
  // Must be called before any early return to satisfy rules-of-hooks.
  const patternClass = useMemo(() => {
    const key = (selectedStrategy || financialStrategy) as string | null;
    if (!key) return '';
    // Normalize: "islamic" → "islamic", "global_diversification" → "global".
    const normalized = key
      .replace('_finance', '')
      .replace('_diversification', '');
    return `shields-pattern--${normalized}`;
  }, [selectedStrategy, financialStrategy]);

  const patternColor = useMemo(() => {
    const key = (selectedStrategy || financialStrategy) as string | null;
    // Map strategy → accent color for the pattern.
    switch (key) {
      case 'africapitalism': return '#d97706';
      case 'buen_vivir': return '#0d9488';
      case 'pan_caribbean': return '#06b6d4';
      case 'confucian': return '#b91c1c';
      case 'gotong_royong': return '#ea580c';
      case 'islamic': return '#059669';
      case 'halo': return '#7c3aed';
      case 'taco': return '#0284c7';
      case 'global_diversification':
      case 'global': return '#0284c7';
      default: return '#64748b';
    }
  }, [selectedStrategy, financialStrategy]);

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

  const hasChosenPlan = !!(financialStrategy || selectedStrategy);

  return (
    <div className="relative space-y-4">
      {/* Archetype-aware geometric pattern layer — sits behind cards,
          derived from the user's chosen philosophy. */}
      {patternClass && patternColor && (
        <div
          className={`shields-pattern-layer ${patternClass}`}
          style={{ color: patternColor }}
          aria-hidden="true"
        />
      )}
      {/* Plan ring — the tab's one expressive object (Tier 1 marquee).
          Interactive allocation vs holdings; everything else orbits it. */}
      {planRingVisible && (
        <ProtectionPlanRing
          strategyKey={(selectedStrategy || financialStrategy) as string}
          portfolio={activePortfolio as MultichainPortfolio}
          selectedToken={focusedToken}
          onSelectToken={handleMarqueeSelect}
          onReviewSwap={(toToken) => openProtectionFlow(toToken)}
        />
      )}

      {/* Protection Journey — connects the user's philosophy to Guardian
          execution and offers a clear next action. Replaces the generic
          Strategy Alignment Bar with philosophy-aware guidance. */}
      <ProtectionJourney
        financialStrategy={financialStrategy}
        strategyAlignmentScore={strategyAlignmentScore}
        strategyAlignmentFeedback={strategyAlignmentFeedback}
        hasChosenPlan={hasChosenPlan}
        onNavigateToProtection={() => setActiveTab?.("protect")}
        onNavigateToExchange={() => setActiveTab?.("exchange")}
      />

      {/* =====================================================================
          G$ SAVINGS LOOP — Claim G$ → Build streak → Protect → Repeat.
          This is the explicit loop GoodBuilders S4 reviewers asked for.
          ===================================================================== */}
      {/* Ordered shield sections — persona-aware render order.
          Each section has an `id` that maps to shieldSectionOrder.
          Sections render in persona-priority order, not document order. */}
      {(() => {
        // Ordered sections — tier 1 renders as expressive standalone blocks
        // (persona priority order preserved); tier 2 collapses into ONE
        // divided card so the tab reads as a list, not a stack of cards.
        const sections = [
          { id: 'savings-loop', tier: 2, order: getSectionSortKey('savings-loop', 0), render: !isBeginner && displayTotalValue > 0 && adaptiveConfig.content.showYield },
          { id: 'plan-gallery', tier: 1, order: getSectionSortKey('plan-gallery', 1), render: !hasChosenPlan },
          { id: 'plan-card', tier: planRingVisible && !isBeginner ? 2 : 1, order: getSectionSortKey('plan-card', 2), render: true },
          { id: 'guardian-chip', tier: 1, order: getSectionSortKey('guardian-chip', 3), render: Boolean(address) && !isGuardianStatusLoading && !showMobileWizard },
          { id: 'payment-cycle', tier: 2, order: getSectionSortKey('payment-cycle', 4), render: config.moneyPurpose === 'upcoming_payment' },
          { id: 'shield-rec', tier: 1, order: getSectionSortKey('shield-rec', 5), render: displayTotalValue > 0 && !dismissedInlineRec && (riskData || topOpportunity) },
          { id: 'primary-insight', tier: 1, order: getSectionSortKey('primary-insight', 6), render: displayTotalValue === 0 && address },
          { id: 'optimization-insight', tier: 2, order: getSectionSortKey('optimization-insight', 7), render: Boolean(liveAnalysis) && Boolean(topOpportunity) && displayTotalValue > 0 },
          { id: 'ai-analysis', tier: 2, order: getSectionSortKey('ai-analysis', 8), render: true },
          { id: 'rwa-assets', tier: 2, order: getSectionSortKey('rwa-assets', 9), render: !isBeginner },
          { id: 'robinhood-rwa', tier: 2, order: getSectionSortKey('robinhood-rwa', 10), render: !isBeginner },
          { id: 'best-yield', tier: 2, order: getSectionSortKey('best-yield', 11), render: !isBeginner && adaptiveConfig.content.showYield },
          { id: 'caribbean-fx', tier: 2, order: getSectionSortKey('caribbean-fx', 12), render: financialStrategy === 'pan_caribbean' && !isBeginner && adaptiveConfig.content.showYield },
          { id: 'yield-discovery', tier: 2, order: getSectionSortKey('yield-discovery', 13), render: !isBeginner && adaptiveConfig.content.showYield },
          { id: 'chain-distribution', tier: 2, order: getSectionSortKey('chain-distribution', 14), render: !isBeginner && displayTotalValue > 0 },
          { id: 'plan-adjustments', tier: 2, order: getSectionSortKey('plan-adjustments', 15), render: !isBeginner && displayTotalValue > 0 },
        ];

        const renderSection = (sectionId: string, grouped: boolean) => {
            switch (sectionId) {
              case 'savings-loop':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-savings-loop"
                    title="Savings loop"
                    summary="Claim G$, build your streak, protect on repeat"
                    icon="🔁"
                    grouped={grouped}
                  >
                    <Suspense fallback={<LazySectionSkeleton />}>
                      <SavingsLoopCard />
                    </Suspense>
                  </DisclosureSection>
                );
              case 'plan-gallery':
                return (
                  <div key={sectionId}>
                    <ProtectionPlanGallery mobile />
                  </div>
                );
              case 'plan-card': {
                const planCard = (
                  <ProtectionPlanCard
                    experienceMode={experienceMode}
                    address={address}
                    portfolio={activePortfolio as MultichainPortfolio}
                    userRegion={userRegion}
                    isComplete={isComplete}
                    currentGoalLabel={currentGoalLabel}
                    embedded={grouped}
                  />
                );
                if (!grouped) return <React.Fragment key={sectionId}>{planCard}</React.Fragment>;
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-plan-profile"
                    title="Protection score & profile"
                    summary={`${protectionScore}% protection — ${currentGoalLabel && currentGoalLabel !== 'Not set' ? currentGoalLabel : 'set your goal'}`}
                    icon="🧭"
                    grouped
                  >
                    {planCard}
                  </DisclosureSection>
                );
              }
              case 'guardian-chip':
                return (
                  <React.Fragment key={sectionId}>
                    <GuardianStatusChip
                      onSetup={() => setShowMobileWizard(true)}
                      onDeposit={() => setActiveTab?.("exchange")}
                      onViewActivity={() => setActiveTab?.("agent")}
                    />
                    {isBeginner && guardianState !== 'monitoring' && (
                      <GuardianStateScrollytelling
                        variant="compact"
                        currentState={guardianState}
                      />
                    )}
                  </React.Fragment>
                );
              case 'payment-cycle':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-payment-cycle"
                    title="Upcoming payment plan"
                    summary="Protect funds timed to your payment date"
                    icon="📅"
                    grouped={grouped}
                  >
                    <PaymentCycleReport
                      defaultLocalCurrency={riskData?.code}
                      onAskGuardian={(prompt) => askAdvisor(prompt)}
                    />
                  </DisclosureSection>
                );
              case 'shield-rec':
                return (
                  <ShieldGuardianRecommendation
                    key={sectionId}
                    portfolio={activePortfolio as MultichainPortfolio}
                    riskData={riskData}
                    primaryDepreciationPct={primaryDepreciation}
                    topOpportunity={activeOpportunity}
                    onReview={() => {
                      if (activeOpportunity?.toToken) {
                        openProtectionFlow(
                          activeOpportunity.toToken,
                          activeOpportunity.fromToken,
                          activeOpportunity.suggestedAmount?.toFixed(2),
                        );
                      } else {
                        setActiveTab?.("exchange");
                      }
                    }}
                    onAskWhy={() =>
                      askAdvisor(
                        `Why is ${riskData?.code ?? 'my currency'} exposure reducing my purchasing power, and what protection move would fit my plan?`,
                      )
                    }
                    onDismiss={() => setDismissedInlineRec(true)}
                  />
                );
              case 'primary-insight':
                return (
                  <Card
                    key={sectionId}
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
                );
              case 'optimization-insight':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-optimization-insight"
                    title="Plan optimization available"
                    summary={`${focusedToken && (activeOpportunity.fromToken === focusedToken || activeOpportunity.toToken === focusedToken) ? `${focusedToken}: ` : ''}${activeOpportunity?.annualSavings ? `up to $${activeOpportunity.annualSavings.toFixed(0)}/yr — review ${activeOpportunity.fromToken} → ${activeOpportunity.toToken}` : `Review ${activeOpportunity.fromToken} → ${activeOpportunity.toToken}`}`}
                    icon="⚡"
                    grouped={grouped}
                  >
                    <OptimizationInsight
                    key={sectionId}
                    icon={config.userGoal === 'geographic_diversification' ? '🌍' : config.userGoal === 'rwa_access' ? '🥇' : config.userGoal === 'inflation_protection' ? '🛡️' : '⚡'}
                    title={
                      config.userGoal === 'geographic_diversification'
                        ? `Expand ${activeOpportunity.toRegion} Presence`
                        : config.userGoal === 'rwa_access'
                        ? `Add ${activeOpportunity.toToken} to Your Plan`
                        : config.userGoal === 'inflation_protection'
                        ? `Reduce ${activeOpportunity.fromRegion} Inflation Exposure`
                        : `Improve Your Protection Plan`
                    }
                    description={
                      config.userGoal === 'geographic_diversification'
                        ? `Adding ${activeOpportunity.toToken} gives you exposure to ${activeOpportunity.toRegion} economy. Your current ${activeOpportunity.fromToken} is mainly ${activeOpportunity.fromRegion}-focused.`
                        : config.userGoal === 'rwa_access'
                        ? `${activeOpportunity.toToken} provides ${activeOpportunity.toToken === 'PAXG' ? 'gold-backed' : 'yield-bearing'} exposure that ${activeOpportunity.fromToken} can't match.`
                        : `Your ${activeOpportunity.fromToken} holdings face ${Math.round(activeOpportunity.fromInflation)}% inflation. Swapping to ${activeOpportunity.toToken} preserves purchasing power.`
                    }
                    fromToken={activeOpportunity.fromToken}
                    toToken={activeOpportunity.toToken}
                    fromInflation={activeOpportunity.fromInflation}
                    toInflation={activeOpportunity.toInflation}
                    impact={`Save $${activeOpportunity.annualSavings.toFixed(2)}/year`}
                    variant={activeOpportunity.priority === "HIGH" ? "urgent" : "default"}
                    action={{
                      label: `Review ${activeOpportunity.fromToken} → ${activeOpportunity.toToken} in Protect`,
                      onClick: () =>
                        openProtectionFlow(
                          activeOpportunity.toToken,
                          activeOpportunity.fromToken,
                          activeOpportunity.suggestedAmount.toFixed(2),
                        ),
                    }}
                    secondaryOptions={
                      liveAnalysis.rebalancingOpportunities
                        .filter((opp) => {
                          if (opp.fromToken === activeOpportunity.fromToken && opp.toToken === activeOpportunity.toToken) return false;
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
                  </DisclosureSection>
                );
              case 'ai-analysis':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-ask-guardian"
                    title="Ask Guardian about my plan"
                    summary="A plan review across your holdings, currency exposure and goals"
                    icon="🤖"
                    grouped={grouped}
                  >
                    <InsightCard
                      icon="🤖"
                      title="Protection Plan Review"
                      description="Ask Guardian to review your holdings, currency exposure, and protection plan."
                      variant="default"
                      action={{
                        label: "Ask Guardian about my plan",
                        onClick: () => {
                          const effectiveGoal = currentGoalLabel && currentGoalLabel !== "Not set" ? currentGoalLabel : "diversification";
                          const focusClause = focusedToken ? ` I'm currently focused on my ${focusedToken} position — address it specifically.` : '';
                          askAdvisor(`Review my protection plan for a portfolio of $${displayTotalValue.toFixed(0)} across ${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""}. My goal is ${effectiveGoal}. I'm in the ${userRegion} region.${focusClause}`);
                        },
                      }}
                    />
                  </DisclosureSection>
                );
              case 'rwa-assets':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-rwa-assets"
                    title="Real-world assets"
                    summary="Tokenized stocks, gold and T-bills you can hold"
                    icon="🏛️"
                    grouped={grouped}
                  >
                    <RwaAssetCards
                      chains={chains}
                      userGoal={config.userGoal}
                      chainId={chainId}
                      onSwap={openProtectionFlow}
                      onShowModal={setShowAssetModal}
                      experienceMode={experienceMode}
                    />
                  </DisclosureSection>
                );
              case 'robinhood-rwa':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-robinhood-rwa"
                    title="Robinhood Chain stocks"
                    summary="Tokenized equities + USDG on Robinhood Chain"
                    icon="📈"
                    grouped={grouped}
                  >
                    <RobinhoodRwaCard
                      onLearnMore={() => {
                        askAdvisor(
                          "How can I use Robinhood Chain tokenized stocks and USDG to protect my savings against local currency depreciation?"
                        );
                      }}
                    />
                  </DisclosureSection>
                );
              case 'best-yield':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-best-yield"
                    title="Best yield for your wallet"
                    summary="Personalized vault picks, ranked by risk rating"
                    icon="🏆"
                    grouped={grouped}
                  >
                    <Suspense fallback={<LazySectionSkeleton />}>
                      <BestYieldCard userAddress={address} className={grouped ? '' : 'mb-4'} />
                    </Suspense>
                  </DisclosureSection>
                );
              case 'caribbean-fx':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-caribbean-fx"
                    title="Caribbean FX netting"
                    summary="Match BBD↔JMD needs directly, settle only the net"
                    icon="🔄"
                    grouped={grouped}
                  >
                    <Suspense fallback={<LazySectionSkeleton />}>
                      <CaribbeanFxNetCard userAddress={address} />
                    </Suspense>
                  </DisclosureSection>
                );
              case 'yield-discovery':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-yield-discovery"
                    title="Yield opportunities"
                    summary="Low-to-medium risk vaults ranked for your plan"
                    icon="🌱"
                    grouped={grouped}
                  >
                    <Suspense fallback={<LazySectionSkeleton />}>
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
                    </Suspense>
                  </DisclosureSection>
                );
              case 'chain-distribution':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-chain-distribution"
                    title="Chain distribution"
                    summary={`${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""} holding your funds`}
                    icon="🔗"
                    grouped={grouped}
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
                  </DisclosureSection>
                );
              case 'plan-adjustments':
                return (
                  <DisclosureSection
                    key={sectionId}
                    id="shield-plan-adjustments"
                    title="Plan adjustments"
                    summary="Guardian-suggested rebalances toward your target plan"
                    icon="🎯"
                    grouped={grouped}
                  >
                    <PortfolioRecommendations
                      currentAllocations={Object.fromEntries(
                        displayRegionData.map((r) => [r.region, (r.usdValue ?? r.value) / (displayTotalValue || 1)])
                      )}
                      onSelectStrategy={(strategy) => {
                        const recommended = StrategyService.getRecommendedAssets(strategy as any);
                        const toToken = recommended[0] || 'KESm';
                        const fromToken = recommended.includes('USDm') ? 'USDC' : 'USDm';

                        // Compute suggested swap amount from target allocation gap
                        const strategyConfig = StrategyService.getConfig(strategy as any);
                        const primaryTarget = strategyConfig.targetAllocations[0];
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
                  </DisclosureSection>
                );
              default:
                return null;
            }
        };

        const ordered = sections
          .filter(s => s.render)
          .sort((a, b) => a.order - b.order);
        const tier1 = ordered.filter(s => s.tier === 1);
        const tier2 = ordered.filter(s => s.tier === 2);

        return (
          <React.Fragment key="shield-sections">
            {tier1.map(s => renderSection(s.id, false))}
            {tier2.length > 0 && (
              <Card
                padding="p-0"
                className="overflow-hidden divide-y divide-gray-200/70 dark:divide-white/[0.06]"
              >
                {tier2.map(s => renderSection(s.id, true))}
              </Card>
            )}
          </React.Fragment>
        );
      })()}

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
