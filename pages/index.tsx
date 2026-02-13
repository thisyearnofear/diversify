import { useEffect, useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
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
import HeaderMenu from "../components/ui/HeaderMenu";
import { useToast } from "../components/ui/Toast";
import { useAIConversation } from "../context/AIConversationContext";
import GuidedTour from "../components/tour/GuidedTour";
import TourTrigger from "../components/tour/TourTrigger";
import StrategyModal, { useStrategyModal } from "../components/onboarding/StrategyModal";

import { IntentDiscoveryService } from "../services/ai/intent-discovery.service";

export default function DiversiFiPage() {
  const { activeTab, setActiveTab, setSwapPrefill, experienceMode, setExperienceMode, enableDemoMode } = useAppState();
  const { showToast } = useToast();
  const { unreadCount, markAsRead, setDrawerOpen, addUserMessage } = useAIConversation();

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
    openTutorial: openWalletTutorial,
    closeTutorial,
  } = useWalletTutorial();

  const { isOpen: isStrategyModalOpen, closeModal: closeStrategyModal, openModal: openStrategyModal } = useStrategyModal();

  const { region: detectedRegion, isLoading: isRegionLoading } =
    useUserRegion();
  const [userRegion, setUserRegion] = useState<Region>("Africa");

  // NEW: Use unified multichain balances hook
  const multichainPortfolio = useMultichainBalances(address);
  const {
    isLoading: isMultichainLoading,
    refresh,
  } = multichainPortfolio;

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
        <TourTrigger />

        {/* HEADER - Adaptive based on mode and connection */}
        <div className="flex items-center justify-between mb-2 py-1">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20">
              <span className="text-white text-sm font-black">D</span>
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                {experienceMode === "beginner" ? "Protect" : "DiversiFi"}
              </h1>
              {address && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
            </div>
          </div>

          {/* Right: Adaptive Controls */}
          <div className="flex items-center gap-2">
            {/* BEGINNER MODE: Menu + Wallet only */}
            {experienceMode === "beginner" && (
              <>
                <HeaderMenu
                  experienceMode={experienceMode}
                  onModeChange={() => {
                    if (experienceMode === "beginner") setExperienceMode("intermediate");
                    else if (experienceMode === "intermediate") setExperienceMode("advanced");
                    else setExperienceMode("beginner");
                  }}
                  onVoiceTranscription={(text) => {
                    console.log("[Voice] Intent Discovery for:", text);
                    const intent = IntentDiscoveryService.discover(text);

                    switch (intent.type) {
                      case "NAVIGATE":
                        showToast(`Switching to ${intent.tab.toUpperCase()}`, "info");
                        setActiveTab(intent.tab);
                        break;

                      case "SWAP_SHORTCUT":
                        showToast(`Preparing swap for ${intent.fromToken || 'assets'}...`, "success");
                        setSwapPrefill({
                          fromToken: intent.fromToken,
                          toToken: intent.toToken,
                          amount: intent.amount,
                          reason: `Voice shortcut: "${text}"`
                        });
                        setActiveTab("swap");
                        break;

                      case "QUERY":
                      default:
                        addUserMessage(text);
                        setDrawerOpen(true);
                        break;
                    }
                  }}
                  showVoice={!!address}
                  onOpenStrategyModal={openStrategyModal}
                />
                {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
              </>
            )}

            {/* INTERMEDIATE/ADVANCED MODE: Show more controls */}
            {experienceMode !== "beginner" && (
              <>
                <button
                  onClick={() => {
                    if (experienceMode === "intermediate") setExperienceMode("advanced");
                    else setExperienceMode("beginner");
                  }}
                  className="w-8 h-8 text-sm rounded-lg transition-all flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
                  title={`Mode: ${experienceMode === "intermediate" ? "Standard" : "Advanced"}`}
                >
                  {experienceMode === "intermediate" ? "🚀" : "⚡"}
                </button>

                {/* Voice assistant - always available for questions and commands */}
                <VoiceButton
                  size="sm"
                  variant="default"
                  onTranscription={(text) => {
                    console.log("[Voice] Intent Discovery for:", text);
                    const intent = IntentDiscoveryService.discover(text);

                    switch (intent.type) {
                      case "ONBOARDING":
                        // Handle onboarding questions with contextual responses
                        if (intent.topic === 'demo') {
                          showToast("Enabling demo mode...", "info");
                          enableDemoMode();
                        } else if (intent.topic === 'wallet-help' && !address) {
                          showToast("Opening wallet tutorial...", "info");
                          openWalletTutorial();
                        } else {
                          // Send to AI for detailed explanation
                          addUserMessage(text);
                          setDrawerOpen(true);
                        }
                        break;

                      case "NAVIGATE":
                        showToast(`Switching to ${intent.tab.toUpperCase()}`, "info");
                        setActiveTab(intent.tab);
                        break;

                      case "SWAP_SHORTCUT":
                        showToast(`Preparing swap for ${intent.fromToken || 'assets'}...`, "success");
                        setSwapPrefill({
                          fromToken: intent.fromToken,
                          toToken: intent.toToken,
                          amount: intent.amount,
                          reason: `Voice shortcut: "${text}"`
                        });
                        setActiveTab("swap");
                        break;

                      case "QUERY":
                      default:
                        addUserMessage(text);
                        setDrawerOpen(true);
                        break;
                    }
                  }}
                />

                <ThemeToggle />
                {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
              </>
            )}
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
            experienceMode={experienceMode}
          />
        </div>

        <AnimatePresence>
          <GuidedTour />
        </AnimatePresence>

        <div className="space-y-4 pt-2">
          <ErrorBoundary>
            {activeTab === "overview" && (
              <OverviewTab
                portfolio={multichainPortfolio}
                isRegionLoading={isRegionLoading}
                userRegion={userRegion}
                setUserRegion={setUserRegion}
                REGIONS={REGIONS}
                setActiveTab={setActiveTab}
                refreshBalances={refresh}
                currencyPerformanceData={currencyPerformanceData}
              />
            )}

            {activeTab === "protect" && (
              <ProtectionTab
                userRegion={userRegion}
                portfolio={multichainPortfolio}
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
                setActiveTab={setActiveTab}
                userRegion={userRegion}
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

        <StrategyModal
          isOpen={isStrategyModalOpen}
          onClose={closeStrategyModal}
          onComplete={() => {
            if (!address && !isInMiniPay && !isFarcaster) {
              setTimeout(() => openWalletTutorial(), 800);
            }
          }}
        />
      </div>
    </div>
  );
}
