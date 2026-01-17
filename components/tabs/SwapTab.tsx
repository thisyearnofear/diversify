import React, { useState, useEffect, useRef } from "react";
import SwapInterface from "../SwapInterface";
import { useInflationData } from "../../hooks/use-inflation-data";
import type { Region } from "../../hooks/use-user-region";
import RegionalIconography, { RegionalPattern } from "../RegionalIconography";
import RealLifeScenario from "../RealLifeScenario";
import { REGION_COLORS } from "../../constants/regions";
import { useSwap } from "../../hooks/use-swap";
import { useWalletContext } from "../WalletProvider";
import WalletButton from "../WalletButton";
import { NETWORKS, ARBITRUM_TOKENS } from "../../config";
import { BridgeService } from "../../services/swap/bridge-service";
import { ethers } from "ethers";
import NetworkSwitcher from "../NetworkSwitcher";

interface SwapTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
  userRegion: Region;
  selectedStrategy: string;
  inflationData: any;
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
  const { address, isConnecting, isMiniPay } = useWalletContext();
  const { dataSource: inflationDataSource } = useInflationData();
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
            : "Africa"
  );

  // Use the swap hook
  const {
    swap: performSwap,
    isLoading: isSwapLoading,
    error: swapError,
    txHash: swapTxHash,
    step: hookSwapStep,
    chainId,
    isMiniPay: isMiniPayDetected,
  } = useSwap();

  // State for transaction status
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [localSwapTxHash, setLocalSwapTxHash] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState<
    "idle" | "approving" | "swapping" | "completed" | "error" | "bridging"
  >("idle");

  // Create a ref to the SwapInterface component
  const swapInterfaceRef = useRef<any>(null);

  // Effect to update UI when swap status changes
  useEffect(() => {
    if (swapError) {
      setSwapStatus(`Error: ${swapError}`);
      setSwapStep("error");
    } else if (hookSwapStep === 'completed') {
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
  ]);

  // Get use case for the selected swap
  const swapUseCase = getSwapUseCase(userRegion, targetRegion);

  // Get tokens for the selected regions
  const fromTokens = availableTokens.filter(
    (token) => token.region === userRegion
  );
  const toTokens = availableTokens.filter(
    (token) => token.region === targetRegion
  );

  // Handle swap function
  const handleSwap = async (
    fromToken: string,
    toToken: string,
    amount: string
  ) => {
    console.log(`Analyzing swap/bridge for ${amount} ${fromToken} to ${toToken}`);

    // Check if this is a cross-chain RWA bridge (to Arbitrum)
    const isRwa = ["PAXG", "USDY", "OUSG"].includes(toToken);

    if (isRwa) {
      console.log("Cross-chain RWA deployment detected. Using BridgeService...");
      setSwapStatus("Preparing cross-chain bridge to Arbitrum...");
      setSwapStep("bridging");

      try {
        if (!window.ethereum) throw new Error("No wallet detected");
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const userAddress = await signer.getAddress();

        // Map symbol to address for Arbitrum
        const toTokenAddr = (ARBITRUM_TOKENS as any)[toToken] || ARBITRUM_TOKENS.USDC;

        const result = await BridgeService.bridgeToWealth(
          signer,
          userAddress,
          amount,
          { address: fromToken, chainId: 42220 }, // Celo Mainnet source
          { address: toTokenAddr, chainId: 42161 } // Arbitrum One target
        );

        if (result) {
          // LI.FI execution result is in the result object
          const txHash = result.steps?.[0]?.execution?.process?.find((p: any) => p.type === 'CROSS_CHAIN')?.txHash
            || result.steps?.[0]?.execution?.process?.[0]?.txHash;

          if (txHash) setLocalSwapTxHash(txHash);
          setSwapStatus(`Success! Assets moved to Arbitrum ${toToken}. Check your wallet on Arbitrum.`);
          setSwapStep("completed");
        } else {
          setSwapStatus("Bridge initiated. Please check your wallet for status.");
          setSwapStep("completed");
        }
        return Promise.resolve();
      } catch (err: any) {
        console.error("Bridge failed:", err);
        setSwapStatus(`Bridge Error: ${err.message}`);
        setSwapStep("error");
        return Promise.reject(err);
      }
    }

    // Default internal swap logic...
    console.log(`Executing standard swap for ${amount} ${fromToken} to ${toToken}`);
    setSwapStatus("Initiating swap process...");
    setSwapStep("approving");

    try {
      if (!address) throw new Error("Wallet not connected");

      await performSwap({
        fromToken,
        toToken,
        amount,
        onApprovalSubmitted: (hash) => setApprovalTxHash(hash),
        onSwapSubmitted: (hash) => setLocalSwapTxHash(hash),
      });

      setSwapStatus("Swap completed successfully!");
      setSwapStep("completed");
    } catch (err: any) {
      console.error("Swap failed:", err);
      setSwapStatus(`Error: ${err.message || "Unknown error"}`);
      setSwapStep("error");
    }
  };

  // Get inflation rates
  const homeInflationRate = inflationData[userRegion]?.avgRate || 0;
  const targetInflationRate = inflationData[targetRegion]?.avgRate || 0;
  const inflationDifference = homeInflationRate - targetInflationRate;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden bg-white rounded-lg shadow-md p-5 mb-4 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <RegionalIconography
              region={userRegion}
              size="sm"
              className="mr-2"
            />
            <h2 className="text-lg font-bold text-gray-900">
              Swap Stablecoins
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {refreshBalances && refreshChainId && (
              <button
                onClick={async () => {
                  try {
                    // First refresh the chain ID
                    await refreshChainId();
                    // Then refresh the balances
                    await refreshBalances();
                  } catch (err) {
                    console.error("Error refreshing data:", err);
                  }
                }}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 p-1 rounded-full transition-colors"
                title="Refresh balances and network"
                disabled={isBalancesLoading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`size-4 ${isBalancesLoading ? "animate-spin" : ""
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
            <NetworkSwitcher
              currentChainId={chainId}
              onNetworkChange={async () => {
                // Refresh balances and chain ID after network switch
                if (refreshChainId) await refreshChainId();
                if (refreshBalances) await refreshBalances();
              }}
              compact
            />
            {inflationDataSource === "api" ? (
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium shadow-sm border border-green-200">
                Live Data
              </span>
            ) : (
              <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium shadow-sm border border-blue-200">
                Cached Inflation Data
              </span>
            )}
          </div>
        </div>

        {/* Swap Interface - Moved to the top */}
        {!address ? (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm mb-4">
            <p className="text-sm text-yellow-800 font-medium mb-3">
              Please connect your wallet to swap stablecoins.
            </p>
            <WalletButton variant="inline" />
          </div>
        ) : (
          <div className="mb-6">
            <SwapInterface
              ref={swapInterfaceRef}
              availableTokens={availableTokens}
              address={address}
              onSwap={handleSwap}
              preferredFromRegion={userRegion}
              preferredToRegion={targetRegion}
              title="" // Pass empty title to prevent duplicate header
            />

            {/* Display swap status */}
            {swapStatus && (
              <div
                className={`mt-4 p-3 rounded-md text-sm font-medium ${swapStatus.includes("Error")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : swapStatus.includes("success")
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
              >
                {swapStatus}

                {(swapTxHash || localSwapTxHash) && (
                  <div className="mt-2">
                    <a
                      href={
                        chainId === NETWORKS.ALFAJORES.chainId
                          ? `${NETWORKS.ALFAJORES.explorerUrl}/tx/${swapTxHash || localSwapTxHash}`
                          : chainId === NETWORKS.ARC_TESTNET.chainId
                            ? `${NETWORKS.ARC_TESTNET.explorerUrl}/tx/${swapTxHash || localSwapTxHash}`
                            : `${NETWORKS.CELO_MAINNET.explorerUrl}/tx/${swapTxHash || localSwapTxHash}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View transaction on explorer
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Display detected environment info */}
            <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {refreshBalances && (
                    <button
                      onClick={async () => {
                        try {
                          if (refreshChainId) {
                            await refreshChainId();
                          }
                          await refreshBalances();
                        } catch (err) {
                          console.error("Error refreshing data:", err);
                        }
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md transition-colors flex items-center"
                      disabled={isBalancesLoading}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`size-3 mr-1 ${isBalancesLoading ? "animate-spin" : ""
                          }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      {isBalancesLoading ? "Refreshing..." : "Refresh Balances"}
                    </button>
                  )}
                  <span>
                    Network:{" "}
                    {chainId === NETWORKS.CELO_MAINNET.chainId
                      ? "Celo Mainnet"
                      : chainId === NETWORKS.ALFAJORES.chainId
                        ? "Celo Alfajores"
                        : chainId === NETWORKS.ARC_TESTNET.chainId
                          ? "Arc Testnet"
                          : chainId
                            ? `Chain ID: ${chainId}`
                            : "Unknown"}
                  </span>
                </div>
                {isMiniPayDetected && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    MiniPay Detected
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Real-world scenario */}
        <div className="mt-8 mb-4">
          <h3 className="font-bold text-gray-900 mb-3">
            Why Swap Stablecoins?
          </h3>

          {/* Home region indicator */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div
                  className="size-8 rounded-full flex items-center justify-center mr-2 border-2 border-white shadow-sm"
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
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Your Home Region
                  </div>
                  <div className="font-bold text-gray-900">{userRegion}</div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => {
                    // This would ideally navigate to the overview tab
                    alert(
                      "To change your home region, please go to the Stable Station tab"
                    );
                  }}
                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-md transition-colors"
                >
                  Change Region
                </button>
              </div>
            </div>
          </div>

          {!address && !isConnecting ? (
            <div
              className={`relative overflow-hidden bg-region-${userRegion.toLowerCase()}-light bg-opacity-30 p-4 rounded-card mb-4`}
            >
              <RegionalPattern region={userRegion} />
              <div className="relative">
                <p
                  className={`text-region-${userRegion.toLowerCase()}-dark font-medium mb-3`}
                >
                  Connect your wallet to swap stablecoins and protect your
                  savings.
                </p>

                {!isMiniPay && (
                  <WalletButton variant="inline" />
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Target region selector */}
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 mb-3">
                  Choose Target Region
                </h3>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {Object.keys(inflationData)
                    .filter((region) => region !== userRegion)
                    .map((region) => (
                      <button
                        key={region}
                        className={`p-3 text-xs rounded-md transition-colors flex flex-col items-center shadow-sm ${region === targetRegion
                          ? `bg-region-${region.toLowerCase()}-light border-2 border-region-${region.toLowerCase()}-medium text-region-${region.toLowerCase()}-dark font-bold`
                          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        onClick={() => setTargetRegion(region as Region)}
                      >
                        <RegionalIconography
                          region={region as Region}
                          size="sm"
                          className="mb-2"
                        />
                        <span className="font-medium">{region}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Scenario selector */}
              <div className="flex overflow-x-auto mb-3 pb-1">
                {[
                  "remittance",
                  "education",
                  "business",
                  "travel",
                  "savings",
                ].map((scenario) => (
                  <button
                    key={scenario}
                    className={`px-3 py-1.5 mr-2 text-xs rounded-md whitespace-nowrap shadow-sm ${selectedScenario === scenario
                      ? `bg-blue-600 text-white font-medium border border-blue-700`
                      : `bg-white text-gray-700 hover:bg-gray-50 border border-gray-200`
                      }`}
                    onClick={() => setSelectedScenario(scenario as any)}
                  >
                    {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                  </button>
                ))}
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
            </div>
          )}

          {/* Inflation comparison */}
          {address && targetRegion && (
            <div
              className={`relative overflow-hidden bg-white p-4 rounded-lg mb-4 border-2 shadow-md`}
              style={{
                borderColor:
                  REGION_COLORS[targetRegion as keyof typeof REGION_COLORS],
              }}
            >
              <div className="relative">
                <h3
                  className={`font-bold text-gray-900 mb-3 flex items-center`}
                >
                  <span className="mr-2">Swap Benefits</span>
                  {inflationDifference > 0 && (
                    <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium border border-green-200">
                      {inflationDifference.toFixed(1)}% Lower Inflation
                    </span>
                  )}
                </h3>

                <div className="bg-gray-50 p-4 rounded-md mb-4 border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-800 mb-3 font-medium">
                    <span className="font-bold text-gray-900">
                      Real-world use:
                    </span>{" "}
                    {swapUseCase}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                      <div
                        className="size-10 rounded-full mr-3 flex items-center justify-center"
                        style={{
                          backgroundColor:
                            REGION_COLORS[
                            userRegion as keyof typeof REGION_COLORS
                            ],
                        }}
                      >
                        <RegionalIconography
                          region={userRegion}
                          size="sm"
                          className="text-white"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium">
                          From
                        </div>
                        <div className="font-bold text-gray-900">
                          {userRegion}
                        </div>
                        <div className="text-sm font-medium text-gray-700">
                          {homeInflationRate.toFixed(1)}% inflation
                        </div>
                      </div>
                    </div>

                    <div className="text-blue-500 font-bold text-xl">→</div>

                    <div className="flex items-center bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                      <div
                        className="size-10 rounded-full mr-3 flex items-center justify-center"
                        style={{
                          backgroundColor:
                            REGION_COLORS[
                            targetRegion as keyof typeof REGION_COLORS
                            ],
                        }}
                      >
                        <RegionalIconography
                          region={targetRegion}
                          size="sm"
                          className="text-white"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium">
                          To
                        </div>
                        <div className="font-bold text-gray-900">
                          {targetRegion}
                        </div>
                        <div className="text-sm font-medium text-gray-700">
                          {targetInflationRate.toFixed(1)}% inflation
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {fromTokens.length > 0 && toTokens.length > 0 && (
                  <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                    <div className="text-sm font-bold text-gray-900 mb-3">
                      Available Tokens
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <div className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                          <div
                            className="size-4 rounded-full mr-1"
                            style={{
                              backgroundColor:
                                REGION_COLORS[
                                userRegion as keyof typeof REGION_COLORS
                                ],
                            }}
                          ></div>
                          From {userRegion}:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {fromTokens.map((token) => (
                            <span
                              key={token.symbol}
                              className="inline-block px-3 py-1 text-xs rounded-md font-medium border shadow-sm"
                              style={{
                                backgroundColor:
                                  REGION_COLORS[
                                  userRegion as keyof typeof REGION_COLORS
                                  ],
                                color: "white",
                                borderColor:
                                  REGION_COLORS[
                                  userRegion as keyof typeof REGION_COLORS
                                  ],
                              }}
                            >
                              {token.symbol}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <div className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                          <div
                            className="size-4 rounded-full mr-1"
                            style={{
                              backgroundColor:
                                REGION_COLORS[
                                targetRegion as keyof typeof REGION_COLORS
                                ],
                            }}
                          ></div>
                          To {targetRegion}:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {toTokens.map((token) => (
                            <span
                              key={token.symbol}
                              className="inline-block px-3 py-1 text-xs rounded-md font-medium border shadow-sm"
                              style={{
                                backgroundColor:
                                  REGION_COLORS[
                                  targetRegion as keyof typeof REGION_COLORS
                                  ],
                                color: "white",
                                borderColor:
                                  REGION_COLORS[
                                  targetRegion as keyof typeof REGION_COLORS
                                  ],
                              }}
                            >
                              {token.symbol}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`relative overflow-hidden bg-white p-5 rounded-lg shadow-md border-2`}
        style={{
          borderColor: REGION_COLORS[userRegion as keyof typeof REGION_COLORS],
        }}
      >
        <div className="relative">
          <h3 className={`font-bold text-gray-900 mb-2`}>
            Personalized Recommendations
          </h3>
          <p className="text-sm text-gray-700 mb-4 font-medium">
            Based on your <span className="font-bold">{selectedStrategy}</span>{" "}
            strategy and location in{" "}
            <span
              className="font-bold px-2 py-0.5 rounded text-white"
              style={{
                backgroundColor:
                  REGION_COLORS[userRegion as keyof typeof REGION_COLORS],
              }}
            >
              {userRegion}
            </span>
            , we recommend:
          </p>

          <div className="space-y-2">
            {userRegion === "Africa" && (
              <>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🌍➡️🇪🇺
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-blue-600">cKES</span> to{" "}
                        <span className="text-green-600">cEUR</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        European inflation is{" "}
                        <span className="font-bold">
                          {(inflationData["Europe"]?.avgRate || 0).toFixed(1)}%
                        </span>{" "}
                        compared to{" "}
                        <span className="font-bold">
                          {homeInflationRate.toFixed(1)}%
                        </span>{" "}
                        in Africa. This swap could protect your savings from
                        higher local inflation.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🌍➡️🇺🇸
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-blue-600">cGHS</span> to{" "}
                        <span className="text-blue-600">cUSD</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        Perfect for paying for online services or education
                        expenses that are priced in USD.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {userRegion === "LatAm" && (
              <>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🌎➡️🇺🇸
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-orange-600">cCOP</span> to{" "}
                        <span className="text-blue-600">cUSD</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        US inflation is{" "}
                        <span className="font-bold">
                          {(inflationData["USA"]?.avgRate || 0).toFixed(1)}%
                        </span>{" "}
                        compared to{" "}
                        <span className="font-bold">
                          {homeInflationRate.toFixed(1)}%
                        </span>{" "}
                        in Latin America. This swap helps protect against local
                        currency volatility.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🌎➡️🇪🇺
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-orange-600">cREAL</span> to{" "}
                        <span className="text-green-600">cEUR</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        Ideal for diversifying your savings and preparing for
                        potential travel to Europe.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {userRegion === "USA" && (
              <>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🇺🇸➡️🇪🇺
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-blue-600">cUSD</span> to{" "}
                        <span className="text-green-600">cEUR</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        Diversify your portfolio geographically and protect
                        against USD-specific economic factors.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🇺🇸➡️🌏
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-blue-600">cUSD</span> to{" "}
                        <span className="text-purple-600">PUSO</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        Gain exposure to fast-growing Asian economies and
                        prepare for potential travel to the region.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {userRegion === "Europe" && (
              <>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🇪🇺➡️🌍
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-green-600">cEUR</span> to{" "}
                        <span className="text-red-600">cKES</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        Gain exposure to high-growth African markets and support
                        economic development in the region.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🇪🇺➡️🇺🇸
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-green-600">cEUR</span> to{" "}
                        <span className="text-blue-600">cUSD</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        Useful for paying for US-based services or preparing for
                        travel to the United States.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {userRegion === "Asia" && (
              <>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🌏➡️🇺🇸
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-purple-600">PUSO</span> to{" "}
                        <span className="text-blue-600">cUSD</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        US inflation is{" "}
                        <span className="font-bold">
                          {(inflationData["USA"]?.avgRate || 0).toFixed(1)}%
                        </span>{" "}
                        compared to{" "}
                        <span className="font-bold">
                          {homeInflationRate.toFixed(1)}%
                        </span>{" "}
                        in Asia. This swap provides more stability for your
                        savings.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3 bg-gray-100 p-2 rounded-md">
                      🌏➡️🇪🇺
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">
                        Swap <span className="text-purple-600">PUSO</span> to{" "}
                        <span className="text-green-600">cEUR</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        Ideal for diversifying your portfolio and preparing for
                        potential travel or business with Europe.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}
