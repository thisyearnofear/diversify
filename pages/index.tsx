import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import { useAppState } from "../context/AppStateContext";
import { useUserRegion, type Region, REGIONS } from "../hooks/use-user-region";
import { useStablecoinBalances } from "../hooks/use-stablecoin-balances";
import { useInflationData, type RegionalInflationData } from "../hooks/use-inflation-data";
import { useCurrencyPerformance } from "../hooks/use-currency-performance";
import {
  AVAILABLE_TOKENS,
  ARC_TESTNET_TOKENS,
  REGION_COLORS,
} from "../constants/regions";
import ErrorBoundary from "../components/ErrorBoundary";
import TabNavigation from "../components/TabNavigation";
import OverviewTab from "../components/tabs/OverviewTab";
import ProtectionTab from "../components/tabs/ProtectionTab";
import { ChainDetectionService } from "../services/swap/chain-detection.service";
import { NETWORKS } from "../config";
import AnalyticsTab from "../components/tabs/AnalyticsTab";
import StrategiesTab from "../components/tabs/StrategiesTab";
import SwapTab from "../components/tabs/SwapTab";
import InfoTab from "../components/tabs/InfoTab";
import WalletButton from "../components/WalletButton";
import FarcasterWalletButton from "../components/FarcasterWalletButton";
import { useWalletContext } from "../components/WalletProvider";
import { useWalletTutorial, WalletTutorial } from "../components/WalletTutorial";
import ThemeToggle from "../components/ThemeToggle";
import LazyFarcasterUserInfo from "../components/LazyFarcasterUserInfo";

export default function DiversiFiPage() {
  // Use app state context for tab management
  const { activeTab, setActiveTab } = useAppState();
  const [selectedStrategy, setSelectedStrategy] = useState("balanced");

  // Wallet connection from context
  const {
    isMiniPay: isInMiniPay,
    isFarcaster,
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
    chainId,
    refreshBalances,
    refreshChainId,
  } = useStablecoinBalances(address);

  // Extract chainId for use in memo
  const currentChainId = chainId;

  // Dynamic token list based on network
  const availableTokens = useMemo(() => {
    if (currentChainId === 5042002) {
      // Arc testnet - show testnet tokens
      return ARC_TESTNET_TOKENS;
    }
    // Default to mainnet tokens
    return AVAILABLE_TOKENS;
  }, [currentChainId]);
  // const { data: performanceData, isLoading: isPerformanceLoading } =
  //   useHistoricalPerformance(address); // performanceData is not currently used
  // We use inflationData in the SwapTab component
  const { inflationData } = useInflationData();

  // Only load currency performance data when on analytics tab to reduce initial load
  const shouldLoadCurrencyPerformance = activeTab === 'analytics';
  const {
    data: currencyPerformanceData,
    isLoading: isCurrencyPerformanceLoading,
  } = useCurrencyPerformance('USD', shouldLoadCurrencyPerformance);

  // Convert region totals to format needed for pie chart
  const regionData = useMemo(() => {
    if (!address || isBalancesLoading || Object.keys(regionTotals).length === 0) {
      return [];
    }
    return Object.entries(regionTotals).map(
      ([region, value]) => ({
        region,
        // Use actual USD value for the pie chart, not percentage
        value: value,
        color: REGION_COLORS[region as keyof typeof REGION_COLORS] || "#CBD5E0",
      })
    );
  }, [address, isBalancesLoading, regionTotals]);

  // Update user region when detected
  useEffect(() => {
    if (!isRegionLoading && detectedRegion) {
      setUserRegion(detectedRegion);
    }
  }, [detectedRegion, isRegionLoading]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
      <Head>
        <title>DiversiFi - MiniPay</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>" />
        {/* Farcaster Mini App Meta Tag */}
        <meta
          name="fc:miniapp"
          content='{"version":"1","name":"DiversiFi","iconUrl":"https://diversifi-minipay.netlify.app/icon.png","splashImageUrl":"https://diversifi-minipay.netlify.app/splash.png","webhookUrl":"https://diversifi-minipay.netlify.app/api/farcaster-webhook"}'
        />
      </Head>

      <div className="max-w-md mx-auto">
        {/* Farcaster User Info - Lazy loaded for better performance */}
        <LazyFarcasterUserInfo />

        {/* Header with proper spacing */}
        <div className="flex items-center justify-between mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              DiversiFi
            </h1>
            {isInMiniPay && (
              <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                MiniPay
              </span>
            )}
            {isFarcaster && (
              <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                Farcaster
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
          </div>
        </div>

        {/* Unsupported Network State - Blocking */}
        {address && balances && Object.keys(balances).length === 0 && (
          // We can infer unsupported network if address is connected but no balances are fetched
          // AND the chainId (if available) is not in our supported list.
          // However, useStablecoinBalances now just returns empty balances for unsupported networks.
          // A better check is needed. Let's use the wallet context's chainId if available, or just rely on the empty balances + explicit check.

          // Actually, let's look at the implementation in useStablecoinBalances again.
          // It sets chainId state. 

          // Let's implement a robust check here.
          (!ChainDetectionService.isSupported(currentChainId) && currentChainId !== null) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
                <div className="mx-auto bg-amber-100 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Unsupported Network</h3>
                <p className="text-gray-600 mb-6">
                  DiversiFi operates on Celo, Arc, and Arbitrum. Please switch to a supported network to access your portfolio.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => switchNetwork(NETWORKS.CELO_MAINNET.chainId)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                  >
                    <span>Switch to Celo</span>
                  </button>
                  <button
                    onClick={() => switchNetwork(NETWORKS.ARBITRUM_ONE.chainId)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                  >
                    <span>Switch to Arbitrum One</span>
                  </button>
                  <button
                    onClick={() => switchNetwork(NETWORKS.ARC_TESTNET.chainId)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                  >
                    <span>Switch to Arc Testnet</span>
                  </button>
                  <button
                    onClick={() => switchNetwork(NETWORKS.ALFAJORES.chainId)}
                    className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl border border-gray-200 transition-colors shadow-sm"
                  >
                    Switch to Alfajores (Testnet)
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {/* Mobile tabs with proper spacing */}
        <div className="mb-6">
          <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Tab Content with proper spacing */}
        <div className="space-y-4">
          <ErrorBoundary>
            {activeTab === "overview" && (
              <OverviewTab
                regionData={regionData}
                regionTotals={regionTotals}
                totalValue={totalValue}
                isRegionLoading={isRegionLoading}
                userRegion={userRegion}
                setUserRegion={setUserRegion}
                REGIONS={REGIONS}
                setActiveTab={setActiveTab}
                refreshBalances={refreshBalances}
                refreshChainId={refreshChainId}
                balances={balances}
                inflationData={inflationData as Record<string, RegionalInflationData>}
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
                totalValue={totalValue}
                onSelectStrategy={setSelectedStrategy}
              />
            )}

            {/* Analytics Tab */}
            {activeTab === "analytics" && (
              <AnalyticsTab
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
                availableTokens={availableTokens}
                userRegion={userRegion}
                selectedStrategy={selectedStrategy}
                inflationData={inflationData as Record<string, RegionalInflationData>}
                refreshBalances={refreshBalances}
                refreshChainId={refreshChainId}
                isBalancesLoading={isBalancesLoading}
              />
            )}

            {/* Info Tab */}
            {activeTab === "info" && (
              <InfoTab
                availableTokens={availableTokens}
              />
            )}
          </ErrorBoundary>
        </div>

        {/* Wallet Tutorial Modal */}
        <WalletTutorial
          isOpen={isTutorialOpen}
          onClose={closeTutorial}
          onConnect={connectWallet}
          isMiniPay={isInMiniPay}
        />
      </div>
    </div>
  );
}
