import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import { useAppState } from "../context/AppStateContext";
import { useUserRegion, type Region, REGIONS } from "../hooks/use-user-region";
import { useStablecoinBalances } from "../hooks/use-stablecoin-balances";
import { useInflationData, type RegionalInflationData } from "../hooks/use-inflation-data";
import { useCurrencyPerformance } from "../hooks/use-currency-performance";
import {
  REGION_COLORS,
  getChainAssets,
} from "../config";
import ErrorBoundary from "../components/ui/ErrorBoundary";
import TabNavigation from "../components/ui/TabNavigation";
import OverviewTab from "../components/tabs/OverviewTab";
import ProtectionTab from "../components/tabs/ProtectionTab";
import SwapTab from "../components/tabs/SwapTab";
import InfoTab from "../components/tabs/InfoTab";
import WalletButton from "../components/wallet/WalletButton";
import FarcasterWalletButton from "../components/wallet/FarcasterWalletButton";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { useWalletTutorial, WalletTutorial } from "../components/wallet/WalletTutorial";
import ThemeToggle from "../components/ui/ThemeToggle";

export default function DiversiFiPage() {
  const { activeTab, setActiveTab } = useAppState();
  const [selectedStrategy, setSelectedStrategy] = useState("balanced");

  const {
    isMiniPay: isInMiniPay,
    isFarcaster,
    address,
    connect: connectWallet,
  } = useWalletContext();

  const {
    isTutorialOpen,
    closeTutorial,
  } = useWalletTutorial();

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
    aggregatedPortfolio,
    fetchAllChainBalances,
  } = useStablecoinBalances(address);

  // Automatically fetch multi-chain data when address changes
  useEffect(() => {
    if (address) {
      fetchAllChainBalances();
    }
  }, [address, fetchAllChainBalances]);

  const currentChainId = chainId;

  const availableTokens = useMemo(() => {
    return getChainAssets(currentChainId || 42220);
  }, [currentChainId]);

  const { inflationData } = useInflationData();

  // Load currency performance for the Overview (Station) tab
  const shouldLoadCurrencyPerformance = activeTab === 'overview';
  const {
    data: currencyPerformanceData,
    isLoading: isCurrencyPerformanceLoading,
  } = useCurrencyPerformance('USD', shouldLoadCurrencyPerformance);

  const regionData = useMemo(() => {
    if (!address || isBalancesLoading || Object.keys(regionTotals).length === 0) {
      return [];
    }
    return Object.entries(regionTotals).map(
      ([region, value]) => ({
        region,
        value: value,
        color: REGION_COLORS[region as keyof typeof REGION_COLORS] || "#CBD5E0",
      })
    );
  }, [address, isBalancesLoading, regionTotals]);

  useEffect(() => {
    if (!isRegionLoading && detectedRegion) {
      setUserRegion(detectedRegion);
    }
  }, [detectedRegion, isRegionLoading]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-4 transition-colors">
      <Head>
        <title>DiversiFi - MiniPay</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>

      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4 py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white text-lg font-black">D</span>
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">DiversiFi</h1>
              <div className="flex items-center gap-1 opacity-60">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Oracle Live</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
          </div>
        </div>

        <div className="sticky top-0 z-40 py-2 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md">
          <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        <div className="space-y-4 pt-2">
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
                currencyPerformanceData={currencyPerformanceData}
                isCurrencyPerformanceLoading={isCurrencyPerformanceLoading}
              />
            )}

            {activeTab === "protect" && (
              <ProtectionTab
                userRegion={userRegion}
                setUserRegion={setUserRegion}
                regionData={regionData}
                totalValue={aggregatedPortfolio?.totalValue || totalValue}
                balances={balances}
                setActiveTab={setActiveTab}
                onSelectStrategy={setSelectedStrategy}
                aggregatedPortfolio={aggregatedPortfolio || undefined}
              />
            )}

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

            {activeTab === "info" && (
              <InfoTab
                availableTokens={availableTokens}
              />
            )}
          </ErrorBoundary>
        </div>

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
