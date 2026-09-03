import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import SwapInterface from "../swap/SwapInterface";
import type { Region } from "../../hooks/use-user-region";
import type { RegionalInflationData } from "../../hooks/use-inflation-data";
import { getChainAssets, getPreferredChainIdForGoal, NETWORKS, isTestnetChain } from "../../config";
// Deep leaf imports — NOT the barrel — keeps the swap + strategy stacks out of first-load.
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
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
import { usePortfolio, useSharedMultichainBalances } from "../../context/app/PortfolioContext";
import { useStreakRewards } from "../../hooks/use-streak-rewards";
import { useClaimFlowContext } from "../../hooks/claim-flow-context";
import { useProtectionProfile } from "../../hooks/use-protection-profile";
import ExperienceModeNotification from "../ui/ExperienceModeNotification";
import SwapSuccessCelebration from "../swap/SwapSuccessCelebration";
import NetworkSwitcher from "../swap/NetworkSwitcher";
import { useMobile } from "../../hooks/use-mobile";
import SwapStatusPanel from "../swap/SwapStatusPanel";
import GoalAlignmentBanner from "../swap/GoalAlignmentBanner";
import { SocialContactPicker } from "../swap/SocialContactPicker";
import { useSocialResolve } from "../../hooks/use-social-resolve";
import ErrorBoundary from "../ui/ErrorBoundary";
import { buildWalletPortfolioView, canSafelyExecute } from "@/lib/wallet-portfolio-view";

interface SwapTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
  /** Strip tab chrome so Exchange can own the instrument layout. */
  instrument?: boolean;
  onInspectQuote?: (fromToken: string, toToken: string) => void;
  quoteInspected?: boolean;
}

export default function SwapTab({
  userRegion,
  inflationData,
  refreshBalances,
  refreshChainId,
  isBalancesLoading,
  instrument = false,
  onInspectQuote,
  quoteInspected = false,
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
  // Inline banner shown when the wallet is being auto-switched to the
  // prefilled source chain. Helps the user understand the chain
  // change isn't accidental (especially the reverse-bridge case:
  // user on Arbitrum, prefill says fromChainId=Celo, wallet moves
  // to Celo). Auto-dismisses once the wallet chain actually changes,
  // or on switch rejection.
  const [autoSwitchNotice, setAutoSwitchNotice] = useState<{
    chainName: string;
    targetChainId: number;
  } | null>(null);

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
  const sharedPortfolio = usePortfolio();
  const {
    chains,
    allTokens,
    goalScores,
    isLoading: isMultichainLoading,
    isStale: isMultichainStale,
    errors: multichainErrors,
    hasEstimates: multichainHasEstimates,
    refresh: refreshMultichain,
  } = useSharedMultichainBalances(address);
  const walletView = useMemo(
    () => buildWalletPortfolioView(
      sharedPortfolio ?? ({
        ...({} as any),
        chains,
        isLoading: isMultichainLoading || Boolean(isBalancesLoading),
        isStale: isMultichainStale,
        errors: multichainErrors,
        hasEstimates: multichainHasEstimates,
      } as any),
    ),
    [
      chains,
      isMultichainLoading,
      isBalancesLoading,
      isMultichainStale,
      multichainErrors,
      multichainHasEstimates,
      sharedPortfolio,
    ],
  );
  const walletSymbols = useMemo(
    () => new Set((walletView.holdings ?? []).map((token) => token.symbol)),
    [walletView.holdings],
  );
  const previousAddress = useRef(address);
  useEffect(() => {
    if (previousAddress.current !== address) {
      setSearchQuery("");
      setAutoSwitchNotice(null);
      previousAddress.current = address;
    }
  }, [address]);

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

    const combined = [...filtered, ...essentials].sort((a, b) => {
      const aHeld = walletSymbols.has(a.symbol);
      const bHeld = walletSymbols.has(b.symbol);
      return Number(bHeld) - Number(aHeld);
    });

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
  }, [networkTokens, tradeableSymbols, walletSymbols]);

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

      // Auto-switch the wallet to the prefilled SOURCE chain
      // (fromChainId) so the form is fully executable. The wallet must
      // be on the source chain to sign the swap/bridge transaction.
      //
      // We deliberately do NOT switch on toChainId alone — for a yield
      // review where only toChainId is set (e.g. BestYieldCard
      // "Review in Swap"), the wallet is already the source for a
      // bridge from the user's current chain to the yield's chain.
      // Switching to the destination would strand the user with no
      // source balance to bridge from.
      //
      // Skip for MiniPay (Celo-only, can't switch networks).
      if (
        swapPrefill.fromChainId &&
        swapPrefill.fromChainId !== walletChainId &&
        switchNetwork &&
        !isMiniPay
      ) {
        // Surface the auto-switch as an inline banner so the user
        // understands the chain change isn't accidental. Reverse-
        // bridge case (user on Arbitrum, prefill says fromChainId=
        // Celo) is the most surprising — the wallet moves to a chain
        // the user wasn't on, with no balance to bridge from, so
        // context is essential.
        const targetChainId = swapPrefill.fromChainId;
        const chainName =
          Object.values(NETWORKS).find((n) => n.chainId === targetChainId)
            ?.name ?? `chain ${targetChainId}`;
        setAutoSwitchNotice({ chainName, targetChainId });

        // Fire-and-forget: the form is already pre-filled, the wallet
        // switch is best-effort (user may reject the wallet prompt).
        switchNetwork(targetChainId).catch((err) => {
          console.warn(
            "[SwapTab] auto-switch to fromChainId failed:",
            err
          );
          // Clear the notice on rejection — the user will need to
          // either retry or switch manually via the NetworkSwitcher.
          setAutoSwitchNotice(null);
        });
      }

      setSwapPrefill(null);
    }
  }, [
    swapPrefill,
    setSwapPrefill,
    setAiRecommendationReason,
    setShowAiRecommendation,
    walletChainId,
    switchNetwork,
    isMiniPay,
  ]);

  // Auto-dismiss the auto-switch notice once the wallet chain has
  // actually changed to the target. This is the success path — the
  // user accepted the wallet prompt and the chain moved. Manual X
  // and the rejection catch handle the other paths.
  useEffect(() => {
    if (
      autoSwitchNotice &&
      walletChainId === autoSwitchNotice.targetChainId
    ) {
      setAutoSwitchNotice(null);
    }
  }, [walletChainId, autoSwitchNotice]);
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
    if (address && !isDemo && !canSafelyExecute(walletView.freshness)) {
      setSwapStatus("Wallet data is still updating — refresh before swapping.");
      return { success: false, error: "Wallet data is not ready" };
    }
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

  // Add bottom padding on mobile beginner mode to account for sticky CTA
  const containerPadding = !instrument && isMobile && isBeginner ? "pb-24" : "";
  const showChrome = !instrument;

  return (
    <div className={`space-y-4 ${containerPadding}`}>
      <div>
        {/* DEMO MODE BANNER */}
        {showChrome && isDemo && (
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
        {showChrome && !isBeginner && (
          <TabHeader
            title="Action Hub"
            chainId={walletChainId}
            onRefresh={handleRefresh}
            isLoading={isBalancesLoading || isSwapLoading}
            onNetworkChange={handleRefresh}
          />
        )}

        {/* Beginner: Simple title + compact NetworkSwitcher (consistent with advanced mode) */}
        {showChrome && isBeginner && (
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
        {showChrome && address && !isBeginner && (
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
        {showChrome && !isBeginner && (
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
            {showChrome && <ExperienceModeNotification />}

            {showChrome && showAiRecommendation && (
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

            {autoSwitchNotice && (
              <div
                className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 mb-4 rounded-xl flex justify-between items-start"
                role="status"
                aria-live="polite"
                data-testid="auto-switch-notice"
              >
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  🔄 Guardian is moving your wallet to{" "}
                  {autoSwitchNotice.chainName} to sign the bridge
                </p>
                <button
                  onClick={() => setAutoSwitchNotice(null)}
                  className="text-amber-500 font-bold"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            {showChrome && (
              <GoalAlignmentBanner
                userGoal={profileConfig.userGoal}
                riskTolerance={profileConfig.riskTolerance}
                timeHorizon={profileConfig.timeHorizon}
                profileComplete={profileComplete}
                suppressedByAI={showAiRecommendation}
              />
            )}

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
                <div className="relative">
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
                    instrument={instrument}
                    onInspectQuote={onInspectQuote}
                    quoteInspected={quoteInspected}
                  />
                </div>
              )}
            </ErrorBoundary>

            {/* Social Contact Picker - Send to phone/email (hidden on mobile beginner) */}
            {showChrome && !isBeginner && address && !isMobile && (
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
      </div>

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
