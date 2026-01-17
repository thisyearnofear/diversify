import { useEffect, useState } from "react";
import Head from "next/head";
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
import WalletButton from "../components/WalletButton";
import { useWalletContext } from "../components/WalletProvider";
import { useWalletTutorial, WalletTutorial } from "../components/WalletTutorial";

export default function DiversiFiPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState("protect");
  const [selectedStrategy, setSelectedStrategy] = useState("balanced");

  // Wallet connection from context
  const {
    isMiniPay: isInMiniPay,
    address,
    connect: connectWallet,
    switchNetwork,
  } = useWalletContext();

  // Wallet tutorial
  const {
    isTutorialOpen,
    closeTutorial,
  } = useWalletTutorial();

  // Use our custom hooks
  const { region: detectedRegion, isLoading: isRegionLoading } =
    useUserRegion();
  const [userRegion, setUserRegion] = useState<Region>("Africa");
  const {
    isLoading: isBalancesLoading,
    balances,
    regionTotals,
    totalValue,
    isMockData,
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
          <WalletButton />
        </div>

        {/* Network Nudge */}
        {address && isMockData && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm animate-pulse-subtle">
            <div className="flex items-start">
              <div className="flex-shrink-0 bg-amber-100 rounded-full p-2 mr-3">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-900">Unsupported Network</h3>
                <p className="text-xs text-amber-700 mt-1">
                  You are currently seeing mock data because you're not on a supported network (Celo or Arc).
                  Switch to a supported network to see your real balances.
                </p>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => switchNetwork(42220)}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold py-2 px-3 rounded-lg transition-colors shadow-sm"
                  >
                    Celo
                  </button>
                  <button
                    onClick={() => switchNetwork(44787)}
                    className="bg-white hover:bg-gray-50 text-amber-700 text-[10px] font-bold py-2 px-3 rounded-lg border border-amber-200 transition-colors shadow-sm"
                  >
                    Alfajores
                  </button>
                  <button
                    onClick={() => switchNetwork(5042002)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-2 px-3 rounded-lg transition-colors shadow-sm"
                  >
                    Arc Testnet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile tabs with icons */}
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Tab Content */}
        {activeTab === "overview" && (
          <OverviewTab
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
            balances={balances}
            setActiveTab={setActiveTab}
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
          />
        )}
      </div>

      {/* Wallet Tutorial Modal */}
      <WalletTutorial
        isOpen={isTutorialOpen}
        onClose={closeTutorial}
        onConnect={connectWallet}
        isMiniPay={isInMiniPay}
      />
    </div>
  );
}
