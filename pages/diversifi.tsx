import { useEffect, useState } from "react";
import Head from "next/head";
import { useWalletConnection } from "../hooks/wallet/use-wallet-connection";
import { useUserRegion, type Region, REGIONS } from "../hooks/use-user-region";
import { useStablecoinBalances } from "../hooks/use-stablecoin-balances";
import { useHistoricalPerformance } from "../hooks/use-historical-performance";
import { useInflationData } from "../hooks/use-inflation-data";
import { useCurrencyPerformance } from "../hooks/use-currency-performance";
import {
  AVAILABLE_TOKENS,
  MOCK_REGION_DATA,
  REGION_COLORS,
} from "../constants/regions";
import TabNavigation from "../components/TabNavigation";
import OverviewTab from "../components/tabs/OverviewTab";
import ProtectionTab from "../components/tabs/ProtectionTab";
import AnalyticsTab from "../components/tabs/AnalyticsTab";
import StrategiesTab from "../components/tabs/StrategiesTab";
import SwapTab from "../components/tabs/SwapTab";
import InfoTab from "../components/tabs/InfoTab";

export default function DiversiFiPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState("protect");
  const [selectedStrategy, setSelectedStrategy] = useState("balanced");

  // Wallet connection
  const {
    isInMiniPay,
    address,
    chainId,
    isConnecting,
    error,
    connectWallet,
    formatAddress,
  } = useWalletConnection();

  // Use our custom hooks
  const { region: detectedRegion, isLoading: isRegionLoading } =
    useUserRegion();
  const [userRegion, setUserRegion] = useState<Region>("Africa");
  const {
    isLoading: isBalancesLoading,
    regionTotals,
    totalValue,
    refreshBalances,
    refreshChainId,
  } = useStablecoinBalances(address);
  const { data: performanceData, isLoading: isPerformanceLoading } =
    useHistoricalPerformance(address);
  // We use inflationData in the SwapTab component
  const { inflationData } = useInflationData();
  const {
    data: currencyPerformanceData,
    isLoading: isCurrencyPerformanceLoading,
  } = useCurrencyPerformance();

  // Convert region totals to format needed for pie chart
  const [regionData, setRegionData] = useState(MOCK_REGION_DATA);

  // Update user region when detected
  useEffect(() => {
    if (!isRegionLoading && detectedRegion) {
      setUserRegion(detectedRegion);
    }
  }, [detectedRegion, isRegionLoading]);

  // Update region data when balances change
  useEffect(() => {
    if (address && !isBalancesLoading && Object.keys(regionTotals).length > 0) {
      const newRegionData = Object.entries(regionTotals).map(
        ([region, value]) => ({
          region,
          // Use actual USD value for the pie chart, not percentage
          value: value,
          color:
            REGION_COLORS[region as keyof typeof REGION_COLORS] || "#CBD5E0",
        })
      );

      if (newRegionData.length > 0) {
        setRegionData(newRegionData);
      }
    }
  }, [address, isBalancesLoading, regionTotals]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Head>
        <title>DiversiFi - MiniPay</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </Head>

      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900 bg-white px-2 py-1 rounded-md shadow-sm">
              DiversiFi
            </h1>
            {isInMiniPay && (
              <span className="ml-2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium shadow-sm border border-blue-700">
                MiniPay
              </span>
            )}
          </div>
          {address && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(address);
                alert("Wallet address copied to clipboard!");
              }}
              className="text-sm bg-white px-3 py-1.5 rounded-full text-gray-800 shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors flex items-center"
            >
              <span>{formatAddress(address)}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 ml-1 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Mobile tabs with icons */}
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Tab Content */}
        {activeTab === "overview" && (
          <OverviewTab
            address={address}
            isConnecting={isConnecting}
            error={error}
            connectWallet={connectWallet}
            isInMiniPay={isInMiniPay}
            formatAddress={formatAddress}
            chainId={chainId}
            regionData={regionData}
            regionTotals={regionTotals}
            totalValue={totalValue}
            isRegionLoading={isRegionLoading}
            userRegion={userRegion}
            setUserRegion={setUserRegion}
            REGIONS={REGIONS}
            isBalancesLoading={isBalancesLoading}
            setActiveTab={setActiveTab}
            refreshBalances={refreshBalances}
            refreshChainId={refreshChainId}
          />
        )}

        {/* Protection Tab */}
        {activeTab === "protect" && (
          <ProtectionTab
            userRegion={userRegion}
            setUserRegion={setUserRegion}
            regionData={regionData}
            totalValue={totalValue}
          />
        )}

        {/* Strategies Tab */}
        {activeTab === "strategies" && (
          <StrategiesTab
            userRegion={userRegion}
            regionData={regionData}
            onSelectStrategy={setSelectedStrategy}
          />
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <AnalyticsTab
            performanceData={performanceData}
            isPerformanceLoading={isPerformanceLoading}
            currencyPerformanceData={currencyPerformanceData}
            isCurrencyPerformanceLoading={isCurrencyPerformanceLoading}
            regionData={regionData}
            totalValue={totalValue}
            userRegion={userRegion}
            setUserRegion={setUserRegion}
          />
        )}

        {/* Swap Tab */}
        {activeTab === "swap" && (
          <SwapTab
            address={address}
            isConnecting={isConnecting}
            connectWallet={connectWallet}
            isInMiniPay={isInMiniPay}
            availableTokens={AVAILABLE_TOKENS}
            userRegion={userRegion}
            selectedStrategy={selectedStrategy}
            inflationData={inflationData}
            refreshBalances={refreshBalances}
            refreshChainId={refreshChainId}
            isBalancesLoading={isBalancesLoading}
          />
        )}

        {/* Info Tab */}
        {activeTab === "info" && (
          <InfoTab
            availableTokens={AVAILABLE_TOKENS}
            isInMiniPay={isInMiniPay}
            chainId={chainId}
            address={address}
            formatAddress={formatAddress}
          />
        )}
      </div>
    </div>
  );
}
