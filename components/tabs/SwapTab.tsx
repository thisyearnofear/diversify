import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { motion } from "framer-motion";
import SwapInterface from "../swap/SwapInterface";
import type { Region } from "../../hooks/use-user-region";
import type { RegionalInflationData } from "../../hooks/use-inflation-data";
import { getChainAssets, getPreferredChainIdForGoal, NETWORKS, isTestnetChain } from "../../config";
import { ChainDetectionService, StrategyService } from "@diversifi/shared";
import { getPersistedStrategy } from "../../hooks/useFinancialStrategies";
import { TabHeader, Card, ConnectWalletPrompt, Skeleton } from "../shared/TabComponents";
import { useSwap } from "../../hooks/use-swap";
import { useWalletContext } from "../wallet/WalletProvider";
import { useNavigation } from "../../context/app/NavigationContext";
import { useExperience } from "../../context/app/ExperienceContext";
import { useDemoMode } from "../../context/app/DemoModeContext";
import WalletButton from "../wallet/WalletButton";
import {
  useTradeableTokens,
  filterTradeableTokens,
} from "../../hooks/use-tradeable-tokens";
import ChainBalancesHeader from "../swap/ChainBalancesHeader";
import { useSharedMultichainBalances } from "../../context/app/PortfolioContext";
import { useStreakRewards } from "../../hooks/use-streak-rewards";
import { useClaimFlowContext } from "../../hooks/claim-flow-context";
import { useProtectionProfile } from "../../hooks/use-protection-profile";
import ExperienceModeNotification from "../ui/ExperienceModeNotification";
import SwapSuccessCelebration from "../swap/SwapSuccessCelebration";
import { StreakRewardsSection } from "../rewards/StreakRewardsCard";
import NetworkSwitcher from "../swap/NetworkSwitcher";
import { MobileCollapsible } from "../ui/MobileCollapsible";
import { useMobile } from "../../hooks/use-mobile";
import { useInView } from "../../hooks/use-in-view";
import SwapStatusPanel from "../swap/SwapStatusPanel";
import GoalAlignmentBanner from "../swap/GoalAlignmentBanner";
import YieldDiscoverySection from "../earn/YieldDiscoverySection";
import YieldBridgePrompt from "../swap/YieldBridgePrompt";
import SwapInsightsPanel from "../swap/SwapInsightsPanel";
import { SocialContactPicker } from "../swap/SocialContactPicker";
import { useSocialResolve } from "../../hooks/use-social-resolve";
import ErrorBoundary from "../ui/ErrorBoundary";
import DepositHub from "../onramp/DepositHub";

interface SwapTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
}

export default function SwapTab({
  userRegion,
  inflationData,
  refreshBalances,
  refreshChainId,
  isBalancesLoading,
}: SwapTabProps) {
  const { address, chainId: walletChainId, switchNetwork, isMiniPay } = useWalletContext();
  const { swapPrefill, setSwapPrefill, clearSwapPrefill } = useNavigation();
  const { recordSwap: recordExperienceSwap, experienceMode } = useExperience();
  const { demoMode } = useDemoMode();
  const { recordSwap: recordStreakSwap, recordActivity } = useStreakRewards();
  const flow = useClaimFlowContext();
  const { config: profileConfig, isComplete: profileComplete } =
    useProtectionProfile();
  const preferredChainId = useMemo(
    () => getPreferredChainIdForGoal(profileConfig.userGoal, isMiniPay),
    [profileConfig.userGoal, isMiniPay],
  );
  const { resolveIdentifier } = useSocialResolve();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSocialPicker, setShowSocialPicker] = useState(false);

  const isBeginner = experienceMode === "beginner";
  const isDemo = demoMode.isActive;
  const isMobile = useMobile();

  // Lazy loading refs for below-the-fold sections
  const insightsInViewRef = useInView<HTMLDivElement>({ rootMargin: '100px', triggerOnce: true });
  const yieldInViewRef = useInView<HTMLDivElement>({ rootMargin: '100px', triggerOnce: true });

  const {
    swap: performSwap,
    isLoading: isSwapLoading,
    error: swapError,
    txHash: swapTxHash,
    step: hookSwapStep,
  } = useSwap();

  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [, setApprovalTxHash] = useState<string | null>(null);
  // BUGFIX: Import proper type from swap types
  const [, setSwapStep] = useState<
    "idle" | "approving" | "swapping" | "completed" | "error" | "bridging"
  >("idle");
  const [showAiRecommendation, setShowAiRecommendation] = useState(false);
  const [aiRecommendationReason, setAiRecommendationReason] = useState<
    string | null
  >(null);

  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousGoalScore, setPreviousGoalScore] = useState<
    number | undefined
  >(undefined);
  const [celebrationData, setCelebrationData] = useState<{
    fromToken: string;
    toToken: string;
    amount: string;
    fromTokenInflation: number;
    toTokenInflation: number;
    chainId: number;
  } | null>(null);

  const swapInterfaceRef = useRef<{
    refreshBalances: () => void;
    getSelectedTokens: () => { fromToken: string; toToken: string };
    setTokens: (
      from: string,
      to: string,
      amount?: string,
      fromChainId?: number,
      toChainId?: number,
      phoneNumber?: string,
      recipientAddress?: string,
    ) => void;
  }>(null);

  // Get multichain balances for the header (also provides goalScores for celebration modal)
  const {
    chains,
    goalScores,
    isLoading: isMultichainLoading,
    refresh: refreshMultichain,
  } = useSharedMultichainBalances(address);

  // Helper to refresh balances with retries
  const refreshWithRetries = useCallback(
    async (retries = 3, delay = 3000) => {
      if (!refreshBalances) return;

      for (let i = 0; i < retries; i++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
          await refreshBalances();
        } catch {
          // Ignore transient refresh errors — next retry will try again
        }
      }
      // Also refresh multichain data
      await refreshMultichain();
    },
    [refreshBalances, refreshMultichain],
  );

  // Fetch tradeable tokens from Mento
  const { tradeableSymbols, isLoading: isTradeableLoading } =
    useTradeableTokens(walletChainId ?? preferredChainId);

  const networkTokens = useMemo(() => {
    return getChainAssets(walletChainId || preferredChainId);
  }, [walletChainId, preferredChainId]);

  // Filter to only show tokens that Mento actually supports
  const tradeableTokens = useMemo(() => {
    const filtered = filterTradeableTokens(networkTokens, tradeableSymbols);

    const essentialSymbols = ["USDT", "USDC", "USDm", "CELO"];
    const essentials = networkTokens.filter(
      (t) =>
        essentialSymbols.includes(t.symbol.toUpperCase()) &&
        !filtered.some(
          (f) => f.symbol.toUpperCase() === t.symbol.toUpperCase(),
        ),
    );

    const combined = [...filtered, ...essentials];

    // Strategy-aware ordering: bubble recommended assets to top
    const recommended = StrategyService.getRecommendedAssets(getPersistedStrategy());
    if (recommended.length > 0) {
      combined.sort((a, b) => {
        const aIdx = recommended.indexOf(a.symbol);
        const bIdx = recommended.indexOf(b.symbol);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    }

    return combined;
  }, [networkTokens, tradeableSymbols]);

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tradeableTokens;
    const query = searchQuery.toLowerCase();
    return tradeableTokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.region.toLowerCase().includes(query),
    );
  }, [tradeableTokens, searchQuery]);

  // Memoize handlers to prevent unnecessary re-renders in child components
  const handleSwapSuccess = useCallback(() => {
    setShowCelebration(false);
    setCelebrationData(null);
    setPreviousGoalScore(undefined);
  }, []);

  const handleClaimG = flow.handleClaim;

  const isArbitrum = ChainDetectionService.isArbitrum(walletChainId ?? null);
  const activeNetworkName = useMemo(() => {
    const activeChainId = walletChainId ?? preferredChainId;
    return (
      Object.values(NETWORKS).find((network) => network.chainId === activeChainId)
        ?.name ?? "this chain"
    );
  }, [walletChainId, preferredChainId]);

  const targetRegion = profileConfig.userRegion;

  useEffect(() => {
    if (swapPrefill && swapInterfaceRef.current?.setTokens) {
      swapInterfaceRef.current.setTokens(
        swapPrefill.fromToken || "USDm",
        swapPrefill.toToken || "EURm",
        swapPrefill.amount,
        swapPrefill.fromChainId,
        swapPrefill.toChainId,
        swapPrefill.phoneNumber,
        swapPrefill.recipientAddress
      );
      if (swapPrefill.reason) {
        setAiRecommendationReason(swapPrefill.reason);
        setShowAiRecommendation(true);
      }
      setSwapPrefill(null);
    }
  }, [swapPrefill, setSwapPrefill, setAiRecommendationReason, setShowAiRecommendation]);
  // BUGFIX: Handle swap state changes with proper error prioritization
  useEffect(() => {
    // CRITICAL: Check error first and return early to prevent simultaneous success/error display
    if (swapError) {
      setSwapStatus(`Error: ${swapError}`);
      setSwapStep("error");
      return; // Stop processing - don't show success if there's an error
    }

    // Only show success if no error exists
    // Note: hookSwapStep type is 'idle' | 'approving' | 'swapping' | 'error' from useSwap hook
    // The 'completed' state is handled by performSwap result, not hookSwapStep
    if (swapTxHash && !swapError && hookSwapStep !== "completed") {
      // Transaction submitted successfully
      setSwapStatus("Swap completed successfully!");
      setSwapStep("completed");

      // Record swap completion for experience progression
      recordExperienceSwap();

      // Record streak activity for GoodDollar UBI if amount >= $1
      if (celebrationData?.amount) {
        const amountNum = parseFloat(celebrationData.amount);
        if (amountNum >= 1) {
          recordStreakSwap(amountNum);
        }
      }

      // Record cross-chain activity for testnet tracking
      if (walletChainId && celebrationData) {
        recordActivity({
          action: "swap",
          chainId: walletChainId,
          networkType: isTestnetChain(walletChainId) ? "testnet" : "mainnet",
          usdValue: parseFloat(celebrationData.amount),
          txHash: swapTxHash || undefined,
        });
      }

      refreshWithRetries();

      // Show celebration if we have swap data
      if (celebrationData) {
        setShowCelebration(true);
      }
      return;
    }

    // Transaction submitted but waiting for confirmation
    if (swapTxHash && !swapError && hookSwapStep === "swapping") {
      setSwapStatus("Transaction submitted...");
    }
  }, [
    swapError,
    hookSwapStep,
    swapTxHash,
    refreshWithRetries,
    recordExperienceSwap,
    recordStreakSwap,
    celebrationData,
    recordActivity,
    walletChainId,
  ]);

  const handleSwap = async (
    fromToken: string,
    toToken: string,
    amount: string,
    fromChainId?: number,
    toChainId?: number,
    fromTokenInflation?: number,
    toTokenInflation?: number,
    recipientAddress?: string,
    phoneNumber?: string,
  ) => {
    setSwapStatus("Initiating swap...");
    setSwapStep("approving");

    // ENHANCEMENT: Store current goal score before swap for impact calculation
    if (profileConfig.userGoal && goalScores) {
      const currentScore =
        profileConfig.userGoal === "inflation_protection"
          ? goalScores.hedge
          : profileConfig.userGoal === "geographic_diversification"
            ? goalScores.diversify
            : profileConfig.userGoal === "rwa_access"
              ? goalScores.rwa
              : 0;
      setPreviousGoalScore(Math.round(currentScore));
    }

    // Store swap data for celebration (including inflation rates for savings calculation)
    setCelebrationData({
      fromToken,
      toToken,
      amount,
      fromTokenInflation: fromTokenInflation || 0,
      toTokenInflation: toTokenInflation || 0,
      chainId: toChainId || walletChainId || 0,
    });

    try {
      if (!address) throw new Error("Wallet not connected");
      const result = await performSwap({
        fromToken,
        toToken,
        amount,
        fromChainId,
        toChainId,
        recipientAddress,
        phoneNumber,
        onApprovalSubmitted: setApprovalTxHash,
        onSwapSubmitted: () => {
          setSwapStatus("Swap submitted...");
        },
      });

      if (result.success) {
        setSwapStatus("Swap completed successfully!");
        setSwapStep("completed");
        return result;
      }
      return result;
    } catch (err) {
      setSwapStatus("Swap failed — please check your wallet and network, then try again.");
      setSwapStep("error");
      throw err;
    }
  };

  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
    await refreshMultichain();
  };

  // Handle chain switching from the balances header
  const handleSwitchChain = async (chainId: number) => {
    if (switchNetwork && walletChainId !== chainId) {
      await switchNetwork(chainId);
    }
  };

  // Prepare chain data for the header
  const chainBalancesData = useMemo(() => {
    return chains.map((chain) => ({
      chainId: chain.chainId,
      chainName: chain.chainName,
      totalValue: chain.totalValue,
      tokenCount: chain.tokenCount,
      isActive: chain.chainId === walletChainId,
    }));
  }, [chains, walletChainId]);

  // Zero balance detection for onramp prompt
  const hasZeroBalance = useMemo(() => {
    return chains.every(c => c.totalValue === 0);
  }, [chains]);

  // Add bottom padding on mobile beginner mode to account for sticky CTA
  const containerPadding = isMobile && isBeginner ? "pb-24" : "";

  return (
    <div className={`space-y-4 ${containerPadding}`}>
      <Card>
        {/* DEMO MODE BANNER */}
        {isDemo && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎮</span>
                <div>
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-100">
                    Preview Mode
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Connect your wallet to make real protection moves
                  </p>
                </div>
              </div>
              <WalletButton variant="inline" />
            </div>
          </div>
        )}

        {/* Hide complex header for beginners */}
        {!isBeginner && (
          <TabHeader
            title="Action Hub"
            chainId={walletChainId}
            onRefresh={handleRefresh}
            isLoading={isBalancesLoading || isSwapLoading}
            onNetworkChange={handleRefresh}
          />
        )}

        {/* Beginner: Simple title + compact NetworkSwitcher (consistent with advanced mode) */}
        {isBeginner && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Protect Your Savings
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Move into more stable currencies with a guided protection flow
              </p>
            </div>
            {/* Compact chain selector — same control as advanced mode, incl. Test Drive networks */}
            <NetworkSwitcher
              currentChainId={walletChainId}
              onNetworkChange={handleRefresh}
              compact={true}
              className="mt-1 flex-shrink-0"
            />
          </div>
        )}

        {/* Hide chain balances header for beginners */}
        {address && !isBeginner && (
          isMultichainLoading ? (
            <div className="flex gap-2 py-2">
              <Skeleton className="flex-1 h-16" variant="rect" />
              <Skeleton className="flex-1 h-16" variant="rect" />
              <Skeleton className="flex-1 h-16" variant="rect" />
            </div>
          ) : (
            <ChainBalancesHeader
              chains={chainBalancesData}
              currentChainId={walletChainId}
              onSwitchChain={handleSwitchChain}
              isLoading={isMultichainLoading}
            />
          )
        )}

        {/* Hide search for beginners */}
        {!isBeginner && (
          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="size-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search assets (e.g. 'USDm', 'Gold')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border-2 border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm font-bold focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {!address ? (
          <ConnectWalletPrompt
            message={
              isDemo
                ? "Connect your wallet to make real protection moves with live pricing."
                : "Connect your wallet to start protecting your savings."
            }
            WalletButtonComponent={<WalletButton variant="inline" />}
            userRegion={userRegion}
            inflationData={inflationData}
            availableTokens={filteredTokens}
            experienceMode={experienceMode}
          />
        ) : (
          <>
            <ExperienceModeNotification />

            {/* Zero Balance Onramp - Show before swap interface */}
            {hasZeroBalance && (
              <Card
                className="mb-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800"
                aiPrompt={() => `I have zero balance on ${activeNetworkName}. How do I add funds to start protecting my savings? What's the best onramp option for me in ${userRegion}?`}
                aiQuickQuestions={[
                  "What's the fastest way to add funds?",
                  "Which onramp should I use for my region?",
                  "How much should I deposit to start?",
                  "Are there any fees I should know about?",
                  "Can I use a credit card?"
                ]}
              >
                <div className="flex items-center gap-3 mb-4">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl"
                  >
                    💰
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-green-900 dark:text-green-100 text-lg">
                      Get Started
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Add funds to start protecting your savings
                    </p>
                  </div>
                </div>
                
                <DepositHub compact={true} />
                
                <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    💡 <strong>Tip:</strong> Start with $10-20 to test the platform, then add more once you&apos;re comfortable.
                  </p>
                </div>
              </Card>
            )}

            {/* GoodDollar UBI Streak — collapsible on mobile */}
            <ErrorBoundary moduleName="Streak Rewards">
              <MobileCollapsible 
                title="Daily Rewards" 
                icon="🔥" 
                className="mb-4"
                defaultCollapsedOnMobile={true}
              >
                <StreakRewardsSection />
              </MobileCollapsible>
            </ErrorBoundary>

            {showAiRecommendation && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 mb-4 rounded-xl flex justify-between items-start">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-200">
                  🧠 AI: {aiRecommendationReason}
                </p>
                <button
                  onClick={() => setShowAiRecommendation(false)}
                  className="text-blue-400 font-bold"
                >
                  ×
                </button>
              </div>
            )}

            {/* Goal banner — delegated to GoalAlignmentBanner */}
            <GoalAlignmentBanner
              userGoal={profileConfig.userGoal}
              riskTolerance={profileConfig.riskTolerance}
              timeHorizon={profileConfig.timeHorizon}
              profileComplete={profileComplete}
              suppressedByAI={showAiRecommendation}
            />

            <ErrorBoundary moduleName="Swap Interface">
              {isTradeableLoading ? (
                <div className="space-y-4 py-4">
                  {/* Token selector skeleton */}
                  <div className="flex gap-3">
                    <Skeleton className="flex-1 h-12" variant="rect" />
                    <Skeleton className="w-10 h-12" variant="rect" />
                    <Skeleton className="flex-1 h-12" variant="rect" />
                  </div>
                  {/* Amount input skeleton */}
                  <Skeleton className="h-12 w-full" variant="rect" />
                  {/* Swap button skeleton */}
                  <Skeleton className="h-14 w-full" variant="rect" />
                </div>
              ) : (
                <Card
                  padding="p-0"
                  aiPrompt={() => {
                    // Dynamic prompt based on swap state
                    const selectedTokens = swapInterfaceRef.current?.getSelectedTokens();
                    const fromToken = selectedTokens?.fromToken;
                    const toToken = selectedTokens?.toToken;
                    if (!fromToken || !toToken) {
                      return "Help me understand how to use the swap interface to protect my savings";
                    }
                    return `I'm about to swap ${fromToken} to ${toToken}. Is this a good move for my protection plan?`;
                  }}
                  aiQuickQuestions={[
                    "What's the inflation difference between these tokens?",
                    "Will this improve my diversification?",
                    "Are there better alternatives?",
                    "What are the risks of this swap?",
                    "How does this align with my goal?",
                    "⚡ Browse Yield Vaults"
                  ]}
                >
                  <SwapInterface
                    ref={swapInterfaceRef}
                    availableTokens={filteredTokens}
                    address={address}
                    onSwap={handleSwap}
                    preferredFromRegion={userRegion}
                    preferredToRegion={targetRegion ?? undefined}
                    title=""
                    chainId={walletChainId}
                    enableCrossChain={true}
                  />
                </Card>
              )}
            </ErrorBoundary>

            {/* Social Contact Picker - Send to phone/email (hidden on mobile beginner) */}
            {!isBeginner && address && !isMobile && (
              <div className="mt-4">
                <button
                  onClick={() => setShowSocialPicker(!showSocialPicker)}
                  className="w-full flex items-center justify-between p-3 min-h-[48px] bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>👥</span>
                    <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                      Send to Contact
                    </span>
                  </div>
                  <span className="text-xs text-purple-500">
                    {showSocialPicker ? '▲' : '▼'}
                  </span>
                </button>
                {showSocialPicker && (
                  <div className="mt-2">
                    <SocialContactPicker
                      onSelect={(contact) => {
                        // Pre-fill swap interface with resolved address
                        if (swapInterfaceRef.current?.setTokens) {
                          swapInterfaceRef.current.setTokens(
                            "USDC",
                            "USDC",
                            "",
                            undefined,
                            undefined,
                            contact.identifier,
                            contact.resolvedAddress,
                          );
                        }
                        setShowSocialPicker(false);
                      }}
                      onResolve={resolveIdentifier}
                      disabled={isSwapLoading}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Transaction status + explorer link — delegated to SwapStatusPanel */}
            <SwapStatusPanel
              status={swapStatus ?? ""}
              txHash={swapTxHash}
              chainId={walletChainId}
              isCompleted={hookSwapStep === "completed"}
            />
          </>
        )}
      </Card>

      {/* Yield opportunities — dynamic from LI.FI Earn. In MiniPay, these show Arbitrum/Base vaults, so skip */}
      {!isMiniPay && !isArbitrum && address && (
        <div ref={yieldInViewRef.ref}>
          {yieldInViewRef.inView ? (
            <div id="yield-opportunities">
              <MobileCollapsible 
                title="Yield Opportunities" 
                icon="📈" 
                defaultCollapsedOnMobile={true}
              >
                <YieldDiscoverySection
                  chainId={walletChainId || preferredChainId}
                  description="Ranked vaults with route context so you can review the destination before selecting token amount."
                  actionLabel="Review in Swap"
                  onSelectVault={(vault) => {
                    if (swapInterfaceRef.current?.setTokens) {
                      swapInterfaceRef.current.setTokens(
                        vault.asset.symbol,
                        `lifi-earn:${vault.id}`,
                        "",
                        walletChainId || preferredChainId,
                        vault.chainId
                      );
                    }
                  }}
                />
              </MobileCollapsible>
            </div>
          ) : (
            <Skeleton className="h-24 w-full" variant="rect" />
          )}
        </div>
      )}

      {/* Advanced: Regional Hedge & Action Guidance (collapsible on mobile, lazy-loaded). Skip in MiniPay */}
      {!isMiniPay && !isArbitrum && address && !isBeginner && (
        <div ref={insightsInViewRef.ref}>
          {insightsInViewRef.inView ? (
            <MobileCollapsible 
              title="Market Insights" 
              icon="📊" 
              defaultCollapsedOnMobile={true}
            >
              <SwapInsightsPanel
                userRegion={userRegion}
                inflationData={inflationData}
              />
            </MobileCollapsible>
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" variant="rect" />
              <Skeleton className="h-48 w-full" variant="rect" />
            </div>
          )}
        </div>
      )}

      {/* Success Celebration Modal — passes user goal and live goal score for personalised display */}
      {celebrationData && (
        <SwapSuccessCelebration
          isVisible={showCelebration}
          onClose={handleSwapSuccess}
          fromToken={celebrationData.fromToken}
          toToken={celebrationData.toToken}
          amount={celebrationData.amount}
          chainId={celebrationData.chainId}
          protectionScoreIncrease={5}
          annualSavings={
            parseFloat(celebrationData.amount) *
            ((celebrationData.fromTokenInflation -
              celebrationData.toTokenInflation) /
              100)
          }
          userGoal={profileComplete ? profileConfig.userGoal : null}
          goalScore={
            goalScores
              ? Math.round(
                  profileConfig.userGoal === "inflation_protection"
                    ? goalScores.hedge
                    : profileConfig.userGoal === "geographic_diversification"
                      ? goalScores.diversify
                      : profileConfig.userGoal === "rwa_access"
                        ? goalScores.rwa
                        : 0,
                )
              : undefined
          }
          previousGoalScore={previousGoalScore}
          onClaimG={handleClaimG}
        />
      )}

    </div>
  );
}
