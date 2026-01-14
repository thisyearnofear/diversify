import React from "react";
import SimplePieChart from "../SimplePieChart";
import { useDiversification } from "@/hooks/use-diversification";
import { REGION_COLORS } from "@/constants/regions";
import type { Region } from "@/hooks/use-user-region";
import RegionalIconography, { RegionalPattern } from "../RegionalIconography";

interface OverviewTabProps {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  isInMiniPay: boolean;
  formatAddress: (addr: string) => string;
  chainId: number | null;
  regionData: Array<{ region: string; value: number; color: string }>;
  regionTotals: Record<string, number>;
  totalValue: number;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  isBalancesLoading: boolean;
  setActiveTab: (tab: string) => void;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
}

export default function OverviewTab({
  address,
  isConnecting,
  error,
  connectWallet,
  isInMiniPay,
  formatAddress,
  chainId,
  regionData,
  regionTotals,
  totalValue,
  isRegionLoading,
  userRegion,
  setUserRegion,
  REGIONS,
  isBalancesLoading,
  setActiveTab,
  refreshBalances,
  refreshChainId,
}: OverviewTabProps) {
  const {
    diversificationScore,
    diversificationRating,
    diversificationDescription,
    diversificationTips,
  } = useDiversification(regionData, userRegion);

  return (
    <div className="space-y-4">
      {!address && !isConnecting && (
        <div className="relative overflow-hidden bg-white rounded-lg shadow-md p-6 mb-4 text-center">
          <RegionalPattern region={userRegion} />
          <div className="relative">
            <div className="flex justify-center mb-6">
              <div
                className={`size-24 bg-region-${userRegion.toLowerCase()}-light rounded-full flex items-center justify-center`}
              >
                <RegionalIconography
                  region={userRegion}
                  size="lg"
                  className="mr-0"
                />
              </div>
            </div>
            <h2
              className={`text-xl font-bold mb-2 text-region-${userRegion.toLowerCase()}-dark`}
            >
              Protect Your Savings
            </h2>
            <p className="mb-6 text-gray-800">
              Diversify your stablecoins across regions to hedge against
              inflation
            </p>
            {isInMiniPay ? (
              <div
                className={`bg-region-${userRegion.toLowerCase()}-light p-3 rounded-md mb-4 text-region-${userRegion.toLowerCase()}-dark`}
              >
                MiniPay detected. Connecting automatically...
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className={`w-full bg-region-${userRegion.toLowerCase()}-medium hover:bg-region-${userRegion.toLowerCase()}-dark text-white font-medium py-3 px-4 rounded-md transition-colors`}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}

      {isConnecting && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-4 text-center border border-gray-200">
          <div className="animate-pulse flex flex-col items-center">
            <div className="size-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
              <svg
                className="animate-spin size-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div className="mt-2 font-medium text-gray-800">
              Connecting to your wallet...
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md mb-4 shadow-sm">
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-5 mr-2 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {address && (
        <>
          <div className="bg-white rounded-lg shadow-md p-5 mb-4 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Portfolio Overview
              </h2>
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
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-4"
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
                <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium border border-blue-200">
                  {chainId === 44787
                    ? "Celo Alfajores"
                    : chainId === 42220
                    ? "Celo Mainnet"
                    : chainId
                    ? `Chain ID: ${chainId}`
                    : "Unknown"}
                </div>
              </div>
            </div>

            {Object.keys(regionTotals).length === 0 ? (
              // Empty state when no stablecoins are found
              <div className="relative text-center py-8">
                <RegionalPattern region={userRegion} />
                <div className="relative">
                  <div className="flex justify-center mb-4">
                    <div
                      className={`size-16 bg-region-${userRegion.toLowerCase()}-light rounded-full flex items-center justify-center`}
                    >
                      <RegionalIconography
                        region={userRegion}
                        size="md"
                        className="mr-0"
                      />
                    </div>
                  </div>
                  <h3
                    className={`text-lg font-medium mb-2 text-region-${userRegion.toLowerCase()}-dark`}
                  >
                    No Stablecoins Found
                  </h3>
                  <p className="text-gray-800 mb-4">
                    You don't have any stablecoins in your wallet yet.
                  </p>

                  <div
                    className={`bg-region-${userRegion.toLowerCase()}-light p-4 rounded-lg text-left`}
                  >
                    <h4
                      className={`font-medium text-region-${userRegion.toLowerCase()}-dark mb-2`}
                    >
                      Get Started with Stablecoins
                    </h4>
                    <ul
                      className={`text-sm text-region-${userRegion.toLowerCase()}-dark space-y-2`}
                    >
                      <li className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`size-4 text-region-${userRegion.toLowerCase()}-medium mr-2 mt-0.5`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        <span>
                          Swap to cUSD, cEUR, or other regional stablecoins
                        </span>
                      </li>
                      <li className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`size-4 text-region-${userRegion.toLowerCase()}-medium mr-2 mt-0.5`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        <span>
                          Diversify across regions to protect against inflation
                        </span>
                      </li>
                      <li className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`size-4 text-region-${userRegion.toLowerCase()}-medium mr-2 mt-0.5`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        <span>Track your portfolio's geographic exposure</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => setActiveTab("swap")}
                    className={`mt-6 bg-region-${userRegion.toLowerCase()}-medium hover:bg-region-${userRegion.toLowerCase()}-dark text-white px-4 py-2 rounded-md transition-colors`}
                  >
                    Go to Swap
                  </button>
                </div>
              </div>
            ) : (
              // Normal state when stablecoins are found
              <>
                <div className="flex flex-col md:flex-row items-center mb-4">
                  <div className="w-full md:w-1/2 mb-4 md:mb-0">
                    <SimplePieChart
                      data={regionData}
                      title="Regional Exposure"
                    />
                  </div>
                  <div className="w-full md:w-1/2 pl-0 md:pl-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center mb-3">
                        <div className="text-3xl font-bold text-blue-600">
                          {diversificationScore}
                        </div>
                        <div className="text-sm ml-2 text-gray-500">/100</div>
                      </div>
                      <div className="text-lg font-medium mb-1 text-gray-900">
                        {diversificationRating} Diversification
                      </div>
                      <div className="text-sm text-gray-700">
                        {diversificationDescription}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-5 text-gray-700 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm font-bold text-gray-900">
                      Recommendations
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                    <ul className="text-sm space-y-2 text-gray-800">
                      {diversificationTips.slice(0, 2).map((tip, index) => (
                        <li key={index} className="flex items-start">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="size-4 text-blue-600 mr-2 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                          </svg>
                          <span className="font-medium">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>

          {Object.keys(regionTotals).length > 0 && (
            <>
              {/* Portfolio Metrics */}
              <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">
                  Portfolio Metrics
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                    <div className="flex items-center mb-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="size-4 mr-1 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="text-sm font-medium text-blue-800">
                        Total Value
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900">
                      ${totalValue ? totalValue.toFixed(2) : "0.00"}
                    </div>
                  </div>

                  <div className="bg-green-50 p-3 rounded-md border border-green-100">
                    <div className="flex items-center mb-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="size-4 mr-1 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="text-sm font-medium text-green-800">
                        Regions
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900">
                      {regionData.filter((r) => r.value > 0).length}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {Object.keys(regionTotals).length > 0 && (
            <div className="relative overflow-hidden bg-white rounded-lg shadow-md p-5 mb-4">
              <RegionalPattern region={userRegion} />
              <div className="relative">
                <h2 className="text-lg font-bold mb-4 text-gray-900">
                  Regional Exposure
                </h2>

                <div className="space-y-4">
                  <p className="text-sm text-gray-700 mb-3">
                    This shows how your stablecoin holdings are distributed
                    across different geographic regions. The percentages show
                    each region's share of your total portfolio value ($
                    {totalValue.toFixed(2)}).
                  </p>
                  {Object.entries(regionTotals).map(([region, value]) => (
                    <div
                      key={region}
                      className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
                    >
                      <div className="flex justify-between mb-2">
                        <div className="flex items-center">
                          <RegionalIconography
                            region={region as Region}
                            size="sm"
                            className="mr-2"
                          />
                          <span className="font-medium text-gray-900">
                            {region}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900">
                          ${value.toFixed(2)}
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full"
                          style={{
                            width: `${(value / (totalValue || 1)) * 100}%`,
                            backgroundColor:
                              REGION_COLORS[
                                region as keyof typeof REGION_COLORS
                              ] || "#CBD5E0",
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <div className="text-xs text-gray-600">
                          Portfolio Allocation
                        </div>
                        <div className="text-xs font-medium text-gray-800">
                          {/* Calculate percentage based on actual USD value */}
                          {totalValue > 0
                            ? ((value / totalValue) * 100).toFixed(1)
                            : "0.0"}
                          %
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="relative overflow-hidden bg-white rounded-lg shadow-md p-5">
            <RegionalPattern region={userRegion} />
            <div className="relative">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">Home Region</h2>
                <div
                  className={`text-sm text-region-${userRegion.toLowerCase()}-dark`}
                >
                  {isRegionLoading ? "Detecting..." : ""}
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-4">
                <div className="flex items-center">
                  <RegionalIconography
                    region={userRegion}
                    size="md"
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {userRegion}
                    </div>
                    <div className="text-xs text-gray-600">
                      Current region setting
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  This personalises inflation and stablecoin data.
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm font-bold mb-2 text-gray-900">
                  Change Region
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  Select home region for a custom app experience.
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {REGIONS.map((region) => (
                    <button
                      key={region}
                      onClick={() => setUserRegion(region)}
                      className={`p-2 rounded-md transition-colors ${
                        userRegion === region
                          ? `bg-blue-600 border border-blue-700 text-white font-medium`
                          : `bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100`
                      }`}
                    >
                      <div className="font-medium">{region}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
