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
import { getChainAssets, NETWORKS } from "../../config";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";
import {
  TabHeader,
  CollapsibleSection,
  Card,
  ConnectWalletPrompt,
} from "../shared/TabComponents";
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
  const { swapPrefill, clearSwapPrefill } = useAppState();
  const [searchQuery, setSearchQuery] = useState("");
  const [targetRegion, setTargetRegion] = useState<Region>("Africa");

  const {
    swap: performSwap,
    isLoading: isSwapLoading,
    error: swapError,
    txHash: swapTxHash,
    step: hookSwapStep,
  } = useSwap();

  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [, setApprovalTxHash] = useState<string | null>(null);
  const [, setSwapStep] = useState<
    "idle" | "approving" | "swapping" | "completed" | "error" | "bridging"
  >("idle");
  const [showAiRecommendation, setShowAiRecommendation] = useState(false);
  const [aiRecommendationReason, setAiRecommendationReason] = useState<
    string | null
  >(null);

  const swapInterfaceRef = useRef<{
    refreshBalances: () => void;
    setTokens: (from: string, to: string, amount?: string) => void;
  }>(null);

  // Get multichain balances for the header
  const {
    chains,
    isLoading: isMultichainLoading,
    refresh: refreshMultichain,
  } = useMultichainBalances(address);

  // Helper to refresh balances with retries
  const refreshWithRetries = useCallback(
    async (retries = 3, delay = 3000) => {
      if (!refreshBalances) return;

      console.log("[SwapTab] Starting balance refresh sequence...");
      for (let i = 0; i < retries; i++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
          console.log(`[SwapTab] Refresh attempt ${i + 1}...`);
          await refreshBalances();
        } catch (err) {
          console.warn(`[SwapTab] Refresh attempt ${i + 1} failed:`, err);
        }
      }
      // Also refresh multichain data
      await refreshMultichain();
    },
    [refreshBalances, refreshMultichain]
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

    const combined = [...filtered, ...essentials];

    console.log("[SwapTab] Network tokens:", networkTokens.map(t => t.symbol));
    console.log("[SwapTab] Tradeable symbols from Mento:", tradeableSymbols);
    console.log("[SwapTab] Filtered tokens:", filtered.map(t => t.symbol));
    console.log("[SwapTab] Essential tokens added:", essentials.map(t => t.symbol));
    console.log("[SwapTab] Final tradeable tokens:", combined.map(t => t.symbol));

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

  const isArbitrum = ChainDetectionService.isArbitrum(walletChainId);

  useEffect(() => {
    if (swapPrefill && swapInterfaceRef.current?.setTokens) {
      swapInterfaceRef.current.setTokens(
        swapPrefill.fromToken || "USDm",
        swapPrefill.toToken || "EURm",
        swapPrefill.amount,
      );
      if (swapPrefill.reason) {
        setAiRecommendationReason(swapPrefill.reason);
        setShowAiRecommendation(true);
      }
      clearSwapPrefill();
    }
  }, [swapPrefill, clearSwapPrefill]);

  useEffect(() => {
    if (swapError) {
      setSwapStatus(`Error: ${swapError}`);
      setSwapStep("error");
    } else if (hookSwapStep === "completed") {
      setSwapStatus("Swap completed successfully!");
      setSwapStep("completed");
      refreshWithRetries();
    } else if (swapTxHash) {
      setSwapStatus("Transaction submitted...");
    }
  }, [swapError, hookSwapStep, swapTxHash, refreshWithRetries]);

  const handleSwap = async (
    fromToken: string,
    toToken: string,
    amount: string,
    fromChainId?: number,
    toChainId?: number,
  ) => {
    setSwapStatus("Initiating swap...");
    setSwapStep("approving");
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
  const inflationDifference = homeInflationRate - targetInflationRate;

  // Prepare chain data for the header
  const chainBalancesData = useMemo(() => {
    return chains.map(chain => ({
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
        <TabHeader
          title="Action Hub"
          chainId={walletChainId}
          onRefresh={handleRefresh}
          isLoading={isBalancesLoading || isSwapLoading}
          onNetworkChange={handleRefresh}
        />

        {/* NEW: Chain Balances Header - Always visible when connected */}
        {address && (
          <ChainBalancesHeader
            chains={chainBalancesData}
            currentChainId={walletChainId}
            onSwitchChain={handleSwitchChain}
            isLoading={isMultichainLoading}
          />
        )}

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

        {!address ? (
          <ConnectWalletPrompt
            message="Connect your wallet to swap tokens."
            WalletButtonComponent={<WalletButton variant="inline" />}
          />
        ) : (
          <>
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

            {swapStatus && (
              <div
                className={`mt-3 p-3 rounded-xl border-2 shadow-sm ${swapStatus.includes("Error")
                  ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400"
                  : "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-400"
                  }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`size-2 rounded-full ${swapStatus.includes("Error")
                      ? "bg-red-500"
                      : "bg-green-500 animate-pulse"
                      }`}
                  />
                  <span className="text-xs font-black uppercase tracking-tight">
                    {swapStatus}
                  </span>
                </div>

                {swapTxHash && (
                  <div className="flex items-center justify-between pt-2 border-t border-current/10">
                    <span className="text-[10px] font-bold opacity-70">
                      Transaction Hash: {swapTxHash.slice(0, 8)}...
                      {swapTxHash.slice(-8)}
                    </span>
                    <a
                      href={`${NETWORKS[walletChainId === 5042002 ? "ARC_TESTNET" : walletChainId === 42161 ? "ARBITRUM_ONE" : walletChainId === 44787 ? "ALFAJORES" : "CELO_MAINNET"].explorerUrl}/tx/${swapTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-black uppercase underline hover:opacity-80 transition-opacity flex items-center gap-1"
                    >
                      View on Explorer
                      <svg
                        className="size-2.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {!isArbitrum && address && (
        <div className="space-y-4">
          <CollapsibleSection
            title={`Regional Hedge: ${userRegion} → ${targetRegion}`}
            icon={<span>🛡️</span>}
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(inflationData)
                .filter((r) => r !== userRegion)
                .map((r) => (
                  <button
                    key={r}
                    onClick={() => setTargetRegion(r as Region)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${targetRegion === r ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}
                  >
                    {r}
                  </button>
                ))}
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl flex justify-between items-center">
              <div className="text-center">
                <div className="text-[10px] font-black text-gray-400 lowercase">
                  {userRegion}
                </div>
                <div className="text-lg font-black">
                  {homeInflationRate.toFixed(1)}%
                </div>
              </div>
              <div className="text-gray-300">→</div>
              <div className="text-center">
                <div className="text-[10px] font-black text-gray-400 lowercase">
                  {targetRegion}
                </div>
                <div className="text-lg font-black">
                  {targetInflationRate.toFixed(1)}%
                </div>
              </div>
              {inflationDifference > 0 && (
                <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-black">
                  +{inflationDifference.toFixed(1)}% Yield
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Action Guidance" icon={<span>🧠</span>}>
            <RealLifeScenario
              region={userRegion}
              targetRegion={targetRegion}
              scenarioType="remittance"
              inflationRate={homeInflationRate}
              targetInflationRate={targetInflationRate}
              amount={1000}
              monthlyAmount={100}
            />
            {getRecommendations(userRegion, inflationData, homeInflationRate)}
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function getRecommendations(
  userRegion: Region,
  inflationData: Record<string, RegionalInflationData>,
  homeInflationRate: number,
) {
  const recommendations: Record<
    string,
    Array<{ from: string; to: string; reason: string }>
  > = {
    Africa: [
      {
        from: "KESm",
        to: "EURm",
        reason: `Hedge: ${(inflationData["Europe"]?.avgRate || 0).toFixed(1)}% vs ${homeInflationRate.toFixed(1)}% inflation`,
      },
    ],
    LatAm: [{ from: "BRLm", to: "USDm", reason: "Stable reserve exposure" }],
    Asia: [{ from: "PHPm", to: "EURm", reason: "Diversify into Eurozone" }],
  };
  const recs = recommendations[userRegion] || [];
  if (recs.length === 0) return null;
  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
        Recommended Actions
      </p>
      {recs.map((r, i) => (
        <div
          key={i}
          className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center"
        >
          <span className="text-xs font-bold">
            {r.from} → {r.to}
          </span>
          <span className="text-[10px] text-blue-500 font-medium">
            {r.reason}
          </span>
        </div>
      ))}
    </div>
  );
}
