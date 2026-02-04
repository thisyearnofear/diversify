import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Head from "next/head";
import { useAppState } from "../context/AppStateContext";
import { useUserRegion, type Region, REGIONS } from "../hooks/use-user-region";
import { useInflationData, type RegionalInflationData } from "../hooks/use-inflation-data";
import { useCurrencyPerformance } from "../hooks/use-currency-performance";
import { useMultichainBalances } from "../hooks/use-multichain-balances";
import {
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
import VoiceButton from "../components/ui/VoiceButton";
import { useToast } from "../components/ui/Toast";
import { useAIConversation } from "../context/AIConversationContext";

export default function DiversiFiPage() {
  const { activeTab, setActiveTab, guidedTour, exitTour } = useAppState();
  const { showToast } = useToast();
  const { unreadCount, markAsRead } = useAIConversation();

  // Static OG image for consistent social sharing
  const ogImageUrl = 'https://diversifiapp.vercel.app/embed-image.png';

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

  // NEW: Use unified multichain balances hook
  const {
    totalValue,
    chainCount,
    regionData: multichainRegionData,
    allTokens,
    isLoading: isMultichainLoading,
    refresh,
  } = useMultichainBalances(address);

  // Available tokens based on current chain (for swap tab)
  const availableTokens = useMemo(() => {
    return getChainAssets(walletChainId || 42220);
  }, [walletChainId]);

  const { inflationData } = useInflationData();

  // Load currency performance for the Overview (Station) tab
  const shouldLoadCurrencyPerformance = activeTab === 'overview';
  const {
    data: currencyPerformanceData,
  } = useCurrencyPerformance('USD', shouldLoadCurrencyPerformance);

  // Convert multichain region data to the format expected by components
  const regionData = useMemo(() => {
    if (!address || isMultichainLoading) {
      return [];
    }
    
    // Use multichain data if available
    if (multichainRegionData.length > 0) {
      return multichainRegionData.map(r => ({
        region: r.region,
        value: r.value,
        color: r.color,
      }));
    }
    
    return [];
  }, [address, isMultichainLoading, multichainRegionData]);

  // Legacy balances format for compatibility
  const balances = useMemo(() => {
    const result: Record<string, { formattedBalance: string; value: number }> = {};
    allTokens.forEach(token => {
      result[token.symbol] = {
        formattedBalance: token.formattedBalance,
        value: token.value,
      };
    });
    return result;
  }, [allTokens]);

  useEffect(() => {
    if (!isRegionLoading && detectedRegion) {
      setUserRegion(detectedRegion);
    }
  }, [detectedRegion, isRegionLoading]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-4 transition-colors relative">
      <Head>
        <title>DiversiFi - Protect Your Savings</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />

        {/* Open Graph tags for social sharing */}
        <meta property="og:title" content="DiversiFi - Protect Your Savings" />
        <meta property="og:description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DiversiFi - Protect Your Savings" />
        <meta name="twitter:description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />
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
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  {isMultichainLoading ? 'Loading...' : `${chainCount} Chain${chainCount !== 1 ? 's' : ''} Active`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VoiceButton
              size="sm"
              variant="default"
              onTranscription={(text) => {
                // Handle voice commands globally with user feedback
                console.log('[Voice] Transcribed:', text);
                
                const query = text.toLowerCase();
                let targetTab: string | null = null;
                let tabName = '';

                // Intent routing
                if (query.includes('swap') || query.includes('exchange') || query.includes('buy') || query.includes('convert')) {
                  targetTab = 'swap';
                  tabName = 'Swap';
                } else if (query.includes('protect') || query.includes('analyze') || query.includes('advice') || query.includes('score')) {
                  targetTab = 'protect';
                  tabName = 'Protection';
                } else if (query.includes('balance') || query.includes('portfolio') || query.includes('holding') || query.includes('asset')) {
                  targetTab = 'overview';
                  tabName = 'Overview';
                } else if (query.includes('info') || query.includes('learn') || query.includes('help') || query.includes('about')) {
                  targetTab = 'info';
                  tabName = 'Info';
                }

                // Show feedback to user
                if (targetTab && targetTab !== activeTab) {
                  showToast(`"${text}" → Switching to ${tabName}`, 'info');
                  setActiveTab(targetTab);
                } else if (targetTab && targetTab === activeTab) {
                  showToast(`"${text}" → You're already on ${tabName}`, 'info');
                } else {
                  showToast(`"${text}" → Ask about swap, protect, balance, or info`, 'info');
                }
              }}
            />
            <ThemeToggle />
            {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
          </div>
        </div>

        <div className="sticky top-0 z-40 py-2 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md">
          <TabNavigation 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              // Mark conversation as read when switching to protect tab
              if (tab === 'protect' && unreadCount > 0) {
                markAsRead();
              }
              setActiveTab(tab);
            }}
            badges={{ protect: unreadCount }}
          />
        </div>

        {/* Guided Tour Progress Indicator */}
        <AnimatePresence>
          {guidedTour && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-xl shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎯</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">
                      Tour Step {guidedTour.currentStep + 1}/{guidedTour.totalSteps}
                    </span>
                    <div className="flex gap-1 mt-1">
                      {Array.from({ length: guidedTour.totalSteps }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 w-4 rounded-full ${
                            i <= guidedTour.currentStep ? 'bg-white' : 'bg-white/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={exitTour}
                  className="text-white/80 hover:text-white text-sm font-bold px-2"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                refreshBalances={refresh}
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
                totalValue={totalValue}
                balances={balances}
                setActiveTab={setActiveTab}
              />
            )}
            
            {activeTab === "swap" && (
              <SwapTab
                userRegion={userRegion}
                inflationData={inflationData as Record<string, RegionalInflationData>}
                refreshBalances={refresh}
                refreshChainId={async () => walletChainId}
                isBalancesLoading={isMultichainLoading}
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
