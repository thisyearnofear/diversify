import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
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
  const router = useRouter();
  const { activeTab, setActiveTab } = useAppState();
  
  // Get share card params from URL for dynamic OG image
  const shareParams = {
    regions: (router.query.regions as string) || '3',
    div: (router.query.div as string) || 'B',
    inf: (router.query.inf as string) || 'A+',
    rwa: (router.query.rwa as string) || '17.5',
  };
  const hasShareParams = router.query.regions || router.query.div || router.query.inf || router.query.rwa;
  const ogImageUrl = hasShareParams 
    ? `https://diversifiapp.vercel.app/api/og/share-card?regions=${shareParams.regions}&div=${shareParams.div}&inf=${shareParams.inf}&rwa=${shareParams.rwa}`
    : 'https://diversifiapp.vercel.app/embed-image.png';

  const {
    isMiniPay: isInMiniPay,
    isFarcaster,
    address,
    chainId: walletChainId,
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
  } = useStablecoinBalances(address, walletChainId);

  // Automatically fetch multi-chain data when address AND chainId are ready
  // This prevents duplicate fetches during initialization
  useEffect(() => {
    if (address && chainId) {
      fetchAllChainBalances();
    }
  }, [address, chainId, fetchAllChainBalances]);

  const currentChainId = chainId;

  const availableTokens = useMemo(() => {
    return getChainAssets(currentChainId || 42220);
  }, [currentChainId]);

  const { inflationData } = useInflationData();

  // Load currency performance for the Overview (Station) tab
  const shouldLoadCurrencyPerformance = activeTab === 'overview';
  const {
    data: currencyPerformanceData,
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
        <title>DiversiFi - Protect Your Savings</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />
        
        {/* Open Graph tags for social sharing */}
        <meta property="og:title" content="DiversiFi - Protection Analysis" />
        <meta property="og:description" content={`Savings protected across ${shareParams.regions} regions • Diversification: ${shareParams.div} • Inflation Hedge: ${shareParams.inf}`} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DiversiFi - Protection Analysis" />
        <meta name="twitter:description" content={`Savings protected across ${shareParams.regions} regions • Diversification: ${shareParams.div}`} />
        <meta name="twitter:image" content={ogImageUrl} />
        
        {/* Farcaster Mini App */}
        <meta
          name="fc:miniapp"
          content={JSON.stringify({
            version: "1",
            imageUrl: ogImageUrl,
            button: {
              title: "Open DiversiFi",
              action: {
                type: "launch_miniapp",
                name: "DiversiFi",
                url: "https://diversifiapp.vercel.app",
                splashImageUrl: "https://diversifiapp.vercel.app/splash.png",
                splashBackgroundColor: "#8B5CF6"
              }
            }
          })}
        />
        {/* Backward compatibility */}
        <meta
          name="fc:frame"
          content={JSON.stringify({
            version: "1",
            imageUrl: ogImageUrl,
            button: {
              title: "Open DiversiFi",
              action: {
                type: "launch_frame",
                name: "DiversiFi",
                url: "https://diversifiapp.vercel.app",
                splashImageUrl: "https://diversifiapp.vercel.app/splash.png",
                splashBackgroundColor: "#8B5CF6"
              }
            }
          })}
        />
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
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Protection Active</span>
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
                aggregatedPortfolio={aggregatedPortfolio || undefined}
              />
            )}

            {activeTab === "swap" && (
              <SwapTab
                userRegion={userRegion}
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
