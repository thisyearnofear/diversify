import React, { useState, useEffect, useRef, useMemo } from "react";
import SwapInterface from "../SwapInterface";
import { useInflationData } from "../../hooks/use-inflation-data";
import type { Region } from "../../hooks/use-user-region";
import type { RegionalInflationData } from "../../hooks/use-inflation-data";
import RegionalIconography from "../RegionalIconography";
import RealLifeScenario from "../RealLifeScenario";
import { REGION_COLORS } from "../../constants/regions";
import { useSwap } from "../../hooks/use-swap";
import { useWalletContext } from "../WalletProvider";
import WalletButton from "../WalletButton";
import { NETWORKS, getTokenAddresses } from "../../config";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";
import {
  TabHeader,
  CollapsibleSection,
  Card,
  ConnectWalletPrompt,
} from "../shared/TabComponents";

// Network-specific token configurations
const NETWORK_TOKENS: Record<
  number,
  Array<{ symbol: string; name: string; region: string }>
> = {
  // Celo Mainnet
  [NETWORKS.CELO_MAINNET.chainId]: [
    { symbol: "CUSD", name: "Celo Dollar", region: "USA" },
    { symbol: "CEUR", name: "Celo Euro", region: "Europe" },
    { symbol: "CREAL", name: "Celo Real", region: "LatAm" },
    { symbol: "CKES", name: "Celo Kenyan Shilling", region: "Africa" },
    { symbol: "CCOP", name: "Celo Colombian Peso", region: "LatAm" },
    { symbol: "PUSO", name: "Philippine Peso", region: "Asia" },
    { symbol: "CGHS", name: "Celo Ghana Cedi", region: "Africa" },
    { symbol: "CGBP", name: "British Pound", region: "Europe" },
    { symbol: "CCAD", name: "Canadian Dollar", region: "USA" },
  ],
  // Celo Alfajores
  [NETWORKS.ALFAJORES.chainId]: [
    { symbol: "CUSD", name: "Celo Dollar", region: "USA" },
    { symbol: "CEUR", name: "Celo Euro", region: "Europe" },
    { symbol: "CREAL", name: "Celo Real", region: "LatAm" },
    { symbol: "CKES", name: "Celo Kenyan Shilling", region: "Africa" },
    { symbol: "CCOP", name: "Celo Colombian Peso", region: "LatAm" },
    { symbol: "PUSO", name: "Philippine Peso", region: "Asia" },
  ],
  // Arbitrum One
  [NETWORKS.ARBITRUM_ONE.chainId]: [
    { symbol: "USDC", name: "USD Coin", region: "USA" },
    { symbol: "PAXG", name: "Paxos Gold", region: "Global" },
  ],
};

interface SwapTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
  userRegion: Region;
  selectedStrategy: string;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
}

// Real-world use cases for swapping between different stablecoins
const getSwapUseCase = (fromRegion: Region, toRegion: Region): string => {
  if (fromRegion === toRegion) return "";

  const cases: Record<string, Record<string, string>> = {
    Africa: {
      USA: "Pay for online courses or software subscriptions priced in USD",
      Europe: "Save for a trip to Europe or pay for imported European goods",
      LatAm:
        "Purchase goods from Latin American suppliers or prepare for travel",
      Asia: "Pay for electronics or goods imported from Asian markets",
    },
    USA: {
      Africa: "Send money to family or friends in Africa with lower fees",
      Europe: "Prepare for European travel or protect against USD inflation",
      LatAm: "Invest in Latin American markets or send remittances",
      Asia: "Pay for services or goods from Asian markets",
    },
    Europe: {
      Africa: "Support family in Africa or invest in African growth markets",
      USA: "Pay for US-based services or prepare for travel to the USA",
      LatAm: "Diversify savings or prepare for Latin American travel",
      Asia: "Purchase goods from Asian markets or prepare for travel",
    },
    LatAm: {
      Africa: "Diversify savings into different emerging markets",
      USA: "Pay for US imports or online services priced in USD",
      Europe: "Save for European travel or education opportunities",
      Asia: "Purchase electronics or goods from Asian markets",
    },
    Asia: {
      Africa: "Invest in African growth markets or support projects",
      USA: "Pay for US-based services or education expenses",
      Europe: "Prepare for European travel or business opportunities",
      LatAm: "Diversify into Latin American markets or prepare for travel",
    },
  };

  return cases[fromRegion]?.[toRegion] || "Diversify your stablecoin portfolio";
};

export default function SwapTab({
  availableTokens,
  userRegion,
  selectedStrategy,
  inflationData,
  refreshBalances,
  refreshChainId,
  isBalancesLoading,
}: SwapTabProps) {
  const { address, chainId: walletChainId } = useWalletContext();
  useInflationData();
  const [selectedScenario, setSelectedScenario] = useState<
    "education" | "remittance" | "business" | "travel" | "savings"
  >("remittance");
  const [targetRegion, setTargetRegion] = useState<Region>(
    userRegion === "Africa"
      ? "Europe"
      : userRegion === "Europe"
        ? "USA"
        : userRegion === "USA"
          ? "Asia"
          : userRegion === "Asia"
            ? "LatAm"
            : "Africa",
  );

  // Use the swap hook
  const {
    swap: performSwap,
    isLoading: isSwapLoading,
    error: swapError,
    txHash: swapTxHash,
    step: hookSwapStep,
    chainId,
  } = useSwap();

  // State for transaction status
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [, setApprovalTxHash] = useState<string | null>(null);
  const [localSwapTxHash, setLocalSwapTxHash] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState<
    "idle" | "approving" | "swapping" | "completed" | "error" | "bridging"
  >("idle");

  // Create a ref to the SwapInterface component
  const swapInterfaceRef = useRef<{ refreshBalances: () => void }>(null);

  // Network-aware token filtering - show only tokens available on current chain
  const networkTokens = useMemo(() => {
    const currentChainId = walletChainId || NETWORKS.CELO_MAINNET.chainId;
    const networkSpecificTokens = NETWORK_TOKENS[currentChainId];

    if (networkSpecificTokens) {
      return networkSpecificTokens;
    }

    // Fallback to passed tokens for unknown networks
    return availableTokens;
  }, [walletChainId, availableTokens]);

  // Check if on Arbitrum (different swap behavior)
  const isArbitrum = ChainDetectionService.isArbitrum(walletChainId);

  // Effect to update UI when swap status changes
  useEffect(() => {
    if (swapError) {
      setSwapStatus(`Error: ${swapError}`);
      setSwapStep("error");
    } else if (hookSwapStep === "completed") {
      setSwapStatus("Swap completed successfully!");
      setSwapStep("completed");

      // Refresh token balances after successful swap
      console.log("Refreshing token balances after successful swap");

      // Use a more reliable approach with multiple retries
      const refreshWithRetries = async (retries = 3, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
          try {
            // Wait for the specified delay
            await new Promise((resolve) => setTimeout(resolve, delay));

            console.log(`Refresh attempt ${i + 1} of ${retries}`);

            // First refresh chain ID if available
            if (refreshChainId) {
              await refreshChainId();
            }

            // Then refresh balances using the parent component's function if available
            if (refreshBalances) {
              await refreshBalances();
            }
            // Otherwise use the SwapInterface component's function
            else if (
              swapInterfaceRef.current &&
              swapInterfaceRef.current.refreshBalances
            ) {
              await swapInterfaceRef.current.refreshBalances();
            }

            // If we get here without an error, we can break the loop
            console.log(`Refresh attempt ${i + 1} successful`);
            break;
          } catch (error) {
            console.error(`Refresh attempt ${i + 1} failed:`, error);
            // If this is the last attempt, log a more detailed error
            if (i === retries - 1) {
              console.error("All refresh attempts failed");
            }
          }
        }
      };

      // Start the refresh process
      refreshWithRetries();
    } else if (swapTxHash || localSwapTxHash) {
      if (swapStep === "approving") {
        setSwapStatus("Approval confirmed. Now executing swap...");
        setSwapStep("swapping");
      } else {
        setSwapStatus("Transaction submitted, waiting for confirmation...");
      }
    } else if (isSwapLoading) {
      if (!swapStep || swapStep === "idle") {
        setSwapStatus("Checking allowance and preparing swap...");
        setSwapStep("approving");
      }
    }
  }, [
    isSwapLoading,
    swapError,
    swapTxHash,
    localSwapTxHash,
    hookSwapStep,
    refreshBalances,
    refreshChainId,
    swapStep,
  ]);

  // Get use case for the selected swap
  const swapUseCase = getSwapUseCase(userRegion, targetRegion);

  // Get tokens for the selected regions - filtered by network
  const fromTokens = networkTokens.filter(
    (token) => token.region === userRegion || token.region === "Global",
  );
  const toTokens = networkTokens.filter(
    (token) => token.region === targetRegion || token.region === "Global",
  );

  // Handle swap function
  const handleSwap = async (
    fromToken: string,
    toToken: string,
    amount: string,
  ) => {
    console.log(
      `Initiating swap: ${amount} ${fromToken} to ${toToken}`,
    );

    setSwapStatus("Initiating swap process...");
    setSwapStep("approving");

    try {
      if (!address) throw new Error("Wallet not connected");

      // Use the swap hook which now delegates to SwapOrchestrator
      // The orchestrator will automatically determine if this is:
      // - Celo same-chain (use Mento)
      // - Arbitrum same-chain (use LiFi)
      // - Cross-chain (use LiFi Bridge)
      await performSwap({
        fromToken,
        toToken,
        amount,
        onApprovalSubmitted: (hash) => {
          setApprovalTxHash(hash);
          setSwapStatus("Approval submitted, waiting for confirmation...");
        },
        onSwapSubmitted: (hash) => {
          setLocalSwapTxHash(hash);
          setSwapStatus("Swap submitted, waiting for confirmation...");
        },
      });

      setSwapStatus("Swap completed successfully!");
      setSwapStep("completed");
    } catch (err: unknown) {
      console.error("Swap failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setSwapStatus(`Error: ${errorMessage}`);
      setSwapStep("error");
    }
  };

  // Get inflation rates
  const homeInflationRate = inflationData[userRegion]?.avgRate || 0;
  const targetInflationRate = inflationData[targetRegion]?.avgRate || 0;
  const inflationDifference = homeInflationRate - targetInflationRate;

  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  return (
    <div className="space-y-4">
      <Card>
        <TabHeader
          title="Swap"
          chainId={walletChainId}
          onRefresh={refreshBalances ? handleRefresh : undefined}
          isLoading={isBalancesLoading}
          onNetworkChange={handleRefresh}
        />

        {/* Wallet connection or Swap Interface */}
        {!address ? (
          <ConnectWalletPrompt
            message="Connect your wallet to swap tokens."
            WalletButtonComponent={<WalletButton variant="inline" />}
          />
        ) : (
          <>
            {/* Arbitrum notice */}
            {isArbitrum && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 rounded-r">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Arbitrum Mode:</span> Swap
                  between yield-bearing assets and RWAs.
                </p>
              </div>
            )}

            <SwapInterface
              ref={swapInterfaceRef}
              availableTokens={networkTokens}
              address={address}
              onSwap={handleSwap}
              preferredFromRegion={isArbitrum ? "USA" : userRegion}
              preferredToRegion={isArbitrum ? "USA" : targetRegion}
              title=""
              chainId={chainId}
            />

            {/* Swap status - only show when relevant */}
            {swapStatus && (
              <div
                className={`mt-3 p-3 rounded-md text-sm ${
                  swapStatus.includes("Error")
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : swapStatus.includes("success")
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {swapStatus}
                {(swapTxHash || localSwapTxHash) && (
                  <a
                    href={`${
                      walletChainId === NETWORKS.ARBITRUM_ONE.chainId
                        ? NETWORKS.ARBITRUM_ONE.explorerUrl
                        : walletChainId === NETWORKS.ALFAJORES.chainId
                          ? NETWORKS.ALFAJORES.explorerUrl
                          : NETWORKS.CELO_MAINNET.explorerUrl
                    }/tx/${swapTxHash || localSwapTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-2 text-blue-600 hover:underline text-xs"
                  >
                    View on explorer →
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Progressive Disclosure Sections - Only show on Celo chains */}
      {!isArbitrum && address && (
        <div className="space-y-3">
          {/* Why Swap - Collapsible */}
          <CollapsibleSection
            title={`Inflation Protection: ${userRegion} → ${targetRegion}`}
            icon={
              <div className="flex items-center gap-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor:
                      REGION_COLORS[userRegion as keyof typeof REGION_COLORS],
                  }}
                >
                  <RegionalIconography
                    region={userRegion}
                    size="sm"
                    className="text-white"
                  />
                </div>
                <span className="text-gray-400">→</span>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor:
                      REGION_COLORS[targetRegion as keyof typeof REGION_COLORS],
                  }}
                >
                  <RegionalIconography
                    region={targetRegion}
                    size="sm"
                    className="text-white"
                  />
                </div>
              </div>
            }
          >
            {/* Compact region selector */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Target Region</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(inflationData)
                  .filter((region) => region !== userRegion)
                  .map((region) => (
                    <button
                      key={region}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        region === targetRegion
                          ? "text-white font-medium"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      style={
                        region === targetRegion
                          ? {
                              backgroundColor:
                                REGION_COLORS[
                                  region as keyof typeof REGION_COLORS
                                ],
                            }
                          : {}
                      }
                      onClick={() => setTargetRegion(region as Region)}
                    >
                      {region}
                    </button>
                  ))}
              </div>
            </div>

            {/* Inflation comparison - compact */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-gray-500">{userRegion}</p>
                <p className="font-bold text-lg">
                  {homeInflationRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-gray-400">→</div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{targetRegion}</p>
                <p className="font-bold text-lg">
                  {targetInflationRate.toFixed(1)}%
                </p>
              </div>
              {inflationDifference > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Save {inflationDifference.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Use case hint */}
            {swapUseCase && (
              <p className="text-xs text-gray-600 mt-3 italic">{swapUseCase}</p>
            )}
          </CollapsibleSection>

          {/* Scenarios - Collapsible */}
          <CollapsibleSection
            title="Real-World Scenarios"
            icon={<span className="text-lg">💡</span>}
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {["remittance", "education", "business", "travel", "savings"].map(
                (scenario) => (
                  <button
                    key={scenario}
                    className={`px-3 py-1 text-xs rounded-full ${
                      selectedScenario === scenario
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    onClick={() =>
                      setSelectedScenario(
                        scenario as
                          | "remittance"
                          | "education"
                          | "business"
                          | "travel"
                          | "savings",
                      )
                    }
                  >
                    {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                  </button>
                ),
              )}
            </div>
            <RealLifeScenario
              region={userRegion}
              targetRegion={targetRegion}
              scenarioType={selectedScenario}
              inflationRate={homeInflationRate}
              targetInflationRate={targetInflationRate}
              amount={1000}
              monthlyAmount={100}
            />
          </CollapsibleSection>

          {/* Recommendations - Collapsible */}
          <CollapsibleSection
            title="Personalized Recommendations"
            icon={<span className="text-lg">🎯</span>}
          >
            <p className="text-xs text-gray-600 mb-3">
              Based on your{" "}
              <span className="font-medium">{selectedStrategy}</span> strategy
              in {userRegion}:
            </p>
            <div className="space-y-2">
              {getRecommendations(userRegion, inflationData, homeInflationRate)}
            </div>
          </CollapsibleSection>

          {/* Available Tokens - Compact display */}
          {(fromTokens.length > 0 || toTokens.length > 0) && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Available:</span>
                  <div className="flex gap-1">
                    {networkTokens.slice(0, 4).map((token) => (
                      <span
                        key={token.symbol}
                        className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200"
                      >
                        {token.symbol}
                      </span>
                    ))}
                    {networkTokens.length > 4 && (
                      <span className="text-xs text-gray-400">
                        +{networkTokens.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to generate recommendations based on region
function getRecommendations(
  userRegion: Region,
  inflationData: Record<string, RegionalInflationData>,
  homeInflationRate: number,
): React.ReactNode {
  const recommendations: Record<
    Region,
    Array<{ from: string; to: string; reason: string }>
  > = {
    Africa: [
      {
        from: "cKES",
        to: "cEUR",
        reason: `Europe has ${(inflationData["Europe"]?.avgRate || 0).toFixed(1)}% vs ${homeInflationRate.toFixed(1)}% inflation`,
      },
      {
        from: "cGHS",
        to: "cUSD",
        reason: "Pay for online services priced in USD",
      },
    ],
    LatAm: [
      {
        from: "cCOP",
        to: "cUSD",
        reason: "Protect against local currency volatility",
      },
      { from: "cREAL", to: "cEUR", reason: "Diversify for European travel" },
    ],
    USA: [
      { from: "cUSD", to: "cEUR", reason: "Geographic diversification" },
      { from: "cUSD", to: "PUSO", reason: "Exposure to Asian growth" },
    ],
    Europe: [
      { from: "cEUR", to: "cKES", reason: "African market exposure" },
      { from: "cEUR", to: "cUSD", reason: "US services and travel" },
    ],
    Asia: [
      { from: "PUSO", to: "cUSD", reason: "More stable savings" },
      { from: "PUSO", to: "cEUR", reason: "European diversification" },
    ],
  };

  const recs = recommendations[userRegion] || [];
  return recs.map((rec, idx) => (
    <div
      key={idx}
      className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"
    >
      <span className="text-sm font-medium">
        {rec.from} → {rec.to}
      </span>
      <span className="text-xs text-gray-500">{rec.reason}</span>
    </div>
  ));
}
