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
import RealLifeScenario from "../demo/RealLifeScenario";
import { getChainAssets, NETWORKS, isTestnetChain } from "../../config";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";
import {
  TabHeader,
  Card,
  ConnectWalletPrompt,
} from "../shared/TabComponents";
import DashboardCard from "../shared/DashboardCard";
import { useSwap } from "../../hooks/use-swap";
import { useWalletContext } from "../wallet/WalletProvider";
import { useAppState } from "../../context/AppStateContext";
import WalletButton from "../wallet/WalletButton";
import {
  useTradeableTokens,
  filterTradeableTokens,
} from "../../hooks/use-tradeable-tokens";
import ChainBalancesHeader from "../swap/ChainBalancesHeader";
import { useMultichainBalances } from "../../hooks/use-multichain-balances";
import { useStreakRewards } from "../../hooks/use-streak-rewards";
import { useProtectionProfile } from "../../hooks/use-protection-profile";
import ExperienceModeNotification from "../ui/ExperienceModeNotification";
import SwapSuccessCelebration from "../swap/SwapSuccessCelebration";
import { TestnetSimulationBanner } from "../swap/TestnetSimulationBanner";
import { StreakRewardsSection } from "../rewards/StreakRewardsCard";
import NetworkSwitcher from "../swap/NetworkSwitcher";
import SwapStatusPanel from "../swap/SwapStatusPanel";
import GoalAlignmentBanner from "../swap/GoalAlignmentBanner";
import SwapRecommendations from "../swap/SwapRecommendations";
import YieldBridgePrompt from "../swap/YieldBridgePrompt";
import dynamic from "next/dynamic";

const GoodDollarClaimFlow = dynamic(() => import("../gooddollar/GoodDollarClaimFlow"), {
  ssr: false,
});

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
  const { address, chainId: walletChainId, switchNetwork } = useWalletContext();
  const { swapPrefill, clearSwapPrefill, recordSwap: recordExperienceSwap, experienceMode, demoMode } = useAppState();
  const { recordSwap: recordStreakSwap, recordActivity } = useStreakRewards();
  const [searchQuery, setSearchQuery] = useState("");
  const [targetRegion, setTargetRegion] = useState<Region>("Africa");

  const isBeginner = experienceMode === "beginner";
  const isDemo = demoMode.isActive;

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

  // G$ claim flow state (triggered from swap success celebration)
  const [showClaimFlow, setShowClaimFlow] = useState(false);

  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousGoalScore, setPreviousGoalScore] = useState<number | undefined>(undefined);
  const [celebrationData, setCelebrationData] = useState<{
      fromToken: string;
      toToken: string;
      amount: string;
      fromTokenInflation: number;
      toTokenInflation: number;
  } | null>(null);

  const swapInterfaceRef = useRef<{
    refreshBalances: () => void;
    setTokens: (
      from: string,
      to: string,
      amount?: string,
      fromChainId?: number,
      toChainId?: number,
    ) => void;
  }>(null);

  // Get multichain balances for the header (also provides goalScores for celebration modal)
  const {
    chains,
    goalScores,
    isLoading: isMultichainLoading,
    refresh: refreshMultichain,
  } = useMultichainBalances(address);

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
    useTradeableTokens(walletChainId);

  const networkTokens = useMemo(() => {
    return getChainAssets(walletChainId || NETWORKS.CELO_MAINNET.chainId);
  }, [walletChainId]);

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

    return [...filtered, ...essentials];
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

  const isArbitrum = ChainDetectionService.isArbitrum(walletChainId);

  // Goal-aware swap defaults: read protection profile to personalise the experience
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();

  useEffect(() => {
    if (swapPrefill && swapInterfaceRef.current?.setTokens) {
      swapInterfaceRef.current.setTokens(
        swapPrefill.fromToken || "USDm",
        swapPrefill.toToken || "EURm",
        swapPrefill.amount,
        swapPrefill.fromChainId,
        swapPrefill.toChainId,
      );
      if (swapPrefill.reason) {
        setAiRecommendationReason(swapPrefill.reason);
        setShowAiRecommendation(true);
      }
      clearSwapPrefill();
    }
  }, [swapPrefill, clearSwapPrefill]);

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
          action: 'swap',
          chainId: walletChainId,
          networkType: isTestnetChain(walletChainId) ? 'testnet' : 'mainnet',
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
  }, [swapError, hookSwapStep, swapTxHash, refreshWithRetries, recordExperienceSwap, recordStreakSwap, celebrationData]);

  const handleSwap = async (
        fromToken: string,
        toToken: string,
        amount: string,
        fromChainId?: number,
        toChainId?: number,
        fromTokenInflation?: number,
        toTokenInflation?: number,
    ) => {
        setSwapStatus("Initiating swap...");
        setSwapStep("approving");

        // ENHANCEMENT: Store current goal score before swap for impact calculation
        if (profileConfig.userGoal && goalScores) {
            const currentScore = 
                profileConfig.userGoal === 'inflation_protection' ? goalScores.hedge :
                profileConfig.userGoal === 'geographic_diversification' ? goalScores.diversify :
                profileConfig.userGoal === 'rwa_access' ? goalScores.rwa : 0;
            setPreviousGoalScore(Math.round(currentScore));
        }

        // Store swap data for celebration (including inflation rates for savings calculation)
    setCelebrationData({
      fromToken,
      toToken,
      amount,
      fromTokenInflation: fromTokenInflation || 0,
      toTokenInflation: toTokenInflation || 0,
    });

    try {
      if (!address) throw new Error("Wallet not connected");
      const result = await performSwap({
        fromToken,
        toToken,
        amount,
        fromChainId,
        toChainId,
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
      setSwapStatus(`Error: ${(err as Error).message || "Unknown error"}`);
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

  const homeInflationRate = inflationData[userRegion]?.avgRate || 0;
  const targetInflationRate = inflationData[targetRegion]?.avgRate || 0;
  // Use absolute difference for comparison, or keep sign for direction
  const inflationDifference = homeInflationRate - targetInflationRate;

  useEffect(() => {
    // Default target region to Global if available, otherwise stay at default
    if (Object.keys(inflationData).includes("Global")) {
      setTargetRegion("Global" as Region);
    } else if (userRegion === "Africa") {
      setTargetRegion("USA");
    } else if (userRegion === "USA") {
      setTargetRegion("Europe");
    } else {
      setTargetRegion("Africa");
    }
  }, [userRegion, inflationData]); // Run when userRegion or inflationData changes

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

  return (
    <div className="space-y-4">
      <Card>
        {/* DEMO MODE BANNER */}
        {isDemo && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎮</span>
                <div>
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-100">Demo Mode</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Connect wallet to execute real swaps</p>
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Convert Your Money</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Protect your savings by converting to more stable currencies
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
          <ChainBalancesHeader
            chains={chainBalancesData}
            currentChainId={walletChainId}
            onSwitchChain={handleSwitchChain}
            isLoading={isMultichainLoading}
          />
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
            message={isDemo ? "Connect your wallet to execute real swaps with live prices." : "Connect your wallet to swap tokens."}
            WalletButtonComponent={<WalletButton variant="inline" />}
            userRegion={userRegion}
            inflationData={inflationData}
            availableTokens={filteredTokens}
            experienceMode={experienceMode}
          />
        ) : (
          <>
            <ExperienceModeNotification />

            {/* Testnet simulation banner — shown on Arc/RH when contracts aren't deployed yet */}
            <TestnetSimulationBanner
              chainId={walletChainId}
              onSimulated={() => {
                // Trigger the same celebration modal as a real swap so Arc/RH users
                // get the same dopamine hit. Use $10 USDC→EURC as the mock trade.
                if (profileConfig.userGoal && goalScores) {
                    const currentScore = 
                        profileConfig.userGoal === 'inflation_protection' ? goalScores.hedge :
                        profileConfig.userGoal === 'geographic_diversification' ? goalScores.diversify :
                        profileConfig.userGoal === 'rwa_access' ? goalScores.rwa : 0;
                    setPreviousGoalScore(Math.round(currentScore));
                }
                setCelebrationData({
                  fromToken: 'USDC',
                  toToken: 'EURC',
                  amount: '10',
                  fromTokenInflation: 3.1,
                  toTokenInflation: 2.3,
                });
                setShowCelebration(true);
              }}
            />

            {/* GoodDollar UBI Streak — gated by StreakRewardsSection so hook only runs when visible */}
            <div className="mb-4">
              <StreakRewardsSection />
            </div>

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

            {isTradeableLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                <span className="text-sm text-gray-500">
                  Loading available tokens...
                </span>
              </div>
            ) : (
              <SwapInterface
                ref={swapInterfaceRef}
                availableTokens={filteredTokens}
                address={address}
                onSwap={handleSwap}
                preferredFromRegion={userRegion}
                preferredToRegion={targetRegion}
                title=""
                chainId={walletChainId}
                enableCrossChain={true}
              />
            )}

            {/* Transaction status + explorer link — delegated to SwapStatusPanel */}
            <SwapStatusPanel
              status={swapStatus ?? ''}
              txHash={swapTxHash}
              chainId={walletChainId}
              isCompleted={hookSwapStep === "completed"}
            />
          </>
        )}
      </Card>

      {/* Yield bridge prompt — self-contained, owns its own dismissed state */}
      {!isArbitrum && address && (
        <YieldBridgePrompt
          onBridgeCTA={() => {
            if (swapInterfaceRef.current?.setTokens) {
              swapInterfaceRef.current.setTokens(
                'USDm',
                'USDY',
                '',
                NETWORKS.CELO_MAINNET.chainId,
                NETWORKS.ARBITRUM_ONE.chainId
              );
            }
          }}
        />
      )}

      {/* Advanced: Regional Hedge & Action Guidance - Dashboard Cards */}
      {!isArbitrum && address && !isBeginner && (
        <div className="space-y-4">
          <DashboardCard
            title="Inflation Comparison"
            subtitle={`${userRegion} vs ${targetRegion}`}
            icon={<span>🛡️</span>}
            color="amber"
            size="md"
          >
            <div className="text-xs font-medium text-gray-500 mb-3">
              Compare your local inflation against other regions
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(inflationData)
                .map((r) => (
                  <button
                    key={r}
                    onClick={() => setTargetRegion(r as Region)}
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase transition-colors ${targetRegion === r
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700"
                      }`}
                  >
                    {r}
                  </button>
                ))}
            </div>
            <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl flex justify-between items-center border border-amber-100/50 dark:border-amber-900/20">
              <div className="text-center">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">
                  Your Region ({userRegion})
                </div>
                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {homeInflationRate.toFixed(1)}%
                </div>
              </div>
              <div className="flex flex-col items-center px-2">
                <div className="text-gray-300 text-xl">→</div>
                {inflationDifference !== 0 && (
                  <div className={`mt-1 text-[10px] font-black px-1.5 py-0.5 rounded ${inflationDifference > 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                    {inflationDifference > 0 ? "+" : ""}{inflationDifference.toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">
                  Target ({targetRegion})
                </div>
                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {targetInflationRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Action Guidance"
            icon={<span>🧠</span>}
            color="blue"
            size="md"
          >
            <RealLifeScenario
              region={userRegion}
              targetRegion={targetRegion}
              scenarioType="remittance"
              inflationRate={homeInflationRate}
              targetInflationRate={targetInflationRate}
              amount={1000}
              monthlyAmount={100}
            />
            <SwapRecommendations
              userRegion={userRegion}
              inflationData={inflationData}
              homeInflationRate={homeInflationRate}
              userGoal={profileConfig.userGoal}
              riskTolerance={profileConfig.riskTolerance}
              timeHorizon={profileConfig.timeHorizon}
            />
          </DashboardCard>
        </div>
      )}

      {/* Success Celebration Modal — passes user goal and live goal score for personalised display */}
      {celebrationData && (
        <SwapSuccessCelebration
          isVisible={showCelebration}
          onClose={() => {
            setShowCelebration(false);
            setCelebrationData(null);
            setPreviousGoalScore(undefined);
          }}
          fromToken={celebrationData.fromToken}
          toToken={celebrationData.toToken}
          amount={celebrationData.amount}
          protectionScoreIncrease={5}
          annualSavings={parseFloat(celebrationData.amount) * ((celebrationData.fromTokenInflation - celebrationData.toTokenInflation) / 100)}
          userGoal={profileComplete ? profileConfig.userGoal : null}
          goalScore={goalScores ? Math.round(
            profileConfig.userGoal === 'inflation_protection' ? goalScores.hedge :
            profileConfig.userGoal === 'geographic_diversification' ? goalScores.diversify :
            profileConfig.userGoal === 'rwa_access' ? goalScores.rwa : 0
          ) : undefined}
          previousGoalScore={previousGoalScore}
          onClaimG={() => setShowClaimFlow(true)}
        />
      )}

      {showClaimFlow && (
        <GoodDollarClaimFlow
          onClose={() => setShowClaimFlow(false)}
          onClaimSuccess={() => setShowClaimFlow(false)}
        />
      )}
    </div>
  );
}

