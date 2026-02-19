import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Head from "next/head";
import { useAppState } from "../context/AppStateContext";
import { useUserRegion, type Region, REGIONS } from "../hooks/use-user-region";
import { useInflationData, type RegionalInflationData } from "../hooks/use-inflation-data";
import { useCurrencyPerformance } from "../hooks/use-currency-performance";
import { useMultichainBalances } from "../hooks/use-multichain-balances";
import {
  getChainAssets,
  NETWORKS,
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
import GuidedTour from "../components/tour/GuidedTour";
import TourTrigger from "../components/tour/TourTrigger";
import StrategyModal, { useStrategyModal } from "../components/onboarding/StrategyModal";

import { useVoiceIntent } from "../hooks/use-voice-intent";
import { useAIOracle } from "../hooks/use-ai-oracle";
import { useStreakRewards } from "../hooks/use-streak-rewards";
import { useProtectionProfile } from "../hooks/use-protection-profile";


export default function DiversiFiPage() {
  const { activeTab, setActiveTab, experienceMode, setExperienceMode } = useAppState();
  const { showToast } = useToast();
  const { openOracle, unreadCount } = useAIOracle();

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

  // Declared after useWalletTutorial so openWalletTutorial is in scope
  const { handleTranscription } = useVoiceIntent({ onOpenWalletTutorial: openWalletTutorial });

  const { isOpen: isStrategyModalOpen, closeModal: closeStrategyModal } = useStrategyModal();
  const { isWhitelisted } = useStreakRewards();

  // Mutual exclusion for header hints: only one tooltip/panel open at a time
  const [activeHint, setActiveHint] = useState<'mode' | 'voice' | null>(null);

  const { region: detectedRegion, isLoading: isRegionLoading } =
    useUserRegion();
  const [userRegion, setUserRegion] = useState<Region>("Africa");

  // NEW: Use unified multichain balances hook
  const { config: profileConfig } = useProtectionProfile();
  const multichainPortfolio = useMultichainBalances(address, profileConfig.userGoal || undefined);
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

        {/* Testnet Warning Banner */}
        {walletChainId && (walletChainId === NETWORKS.ALFAJORES.chainId || walletChainId === NETWORKS.ARC_TESTNET.chainId || walletChainId === NETWORKS.RH_TESTNET.chainId) && (
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 mb-2 rounded-lg text-xs font-bold flex items-center justify-between border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <span>🧪</span>
              <span>
                Test Drive —&nbsp;
                {walletChainId === NETWORKS.ALFAJORES.chainId ? 'Alfajores' :
                  walletChainId === NETWORKS.ARC_TESTNET.chainId ? 'Arc Testnet' : 'Robinhood Testnet'}
                &nbsp;(play money)
              </span>
            </div>
            <a
              href={
                walletChainId === NETWORKS.ALFAJORES.chainId
                  ? 'https://faucet.celo.org'
                  : walletChainId === NETWORKS.ARC_TESTNET.chainId
                    ? 'https://faucet.circle.com'
                    : 'https://faucet.testnet.chain.robinhood.com'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 dark:text-amber-300 underline hover:no-underline whitespace-nowrap"
            >
              Get funds →
            </a>
          </div>
        )}

        {/* HEADER - Adaptive based on mode and connection */}
        <div className="flex items-center justify-between mb-2 py-1">
          {/* Left: Logo - hidden on mobile when in Farcaster to save space */}
          <div className={`flex items-center gap-2 ${isFarcaster ? 'hidden sm:flex' : 'flex'}`}>
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20">
              <span className="text-white text-sm font-black">D</span>
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                {experienceMode === "beginner" ? "Protect" : "DiversiFi"}
              </h1>
              {address && (
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isWhitelisted ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                  {isWhitelisted && (
                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                      Verified
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Consistent controls across ALL modes - more compact on mobile in Farcaster */}
          <div className={`flex items-center ${isFarcaster ? 'gap-1 sm:gap-2' : 'gap-2'}`}>
            {/* Mode toggle — same button in all modes, emoji reflects current state */}
            <div
              className="relative"
              onMouseEnter={() => setActiveHint('mode')}
              onMouseLeave={() => setActiveHint(null)}
            >
              <button
                onClick={() => {
                  const next =
                    experienceMode === "beginner" ? "intermediate" :
                    experienceMode === "intermediate" ? "advanced" : "beginner";
                  setExperienceMode(next);
                  setActiveHint(null);
                  showToast(
                    next === "beginner" ? "Simple mode 🌱 — focused view" :
                    next === "intermediate" ? "Standard mode 🚀 — full features unlocked" :
                    "Advanced mode ⚡ — power tools unlocked",
                    "info"
                  );
                }}
                className="w-8 h-8 text-sm rounded-lg transition-all flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
                aria-label={
                  experienceMode === "beginner"
                    ? "Switch to Standard mode — unlock more features"
                    : experienceMode === "intermediate"
                    ? "Switch to Advanced mode — power analytics & voice shortcuts"
                    : "Switch to Simple mode — hide advanced panels"
                }
              >
                {experienceMode === "beginner" ? "🌱" : experienceMode === "intermediate" ? "🚀" : "⚡"}
              </button>
              {/* Tooltip — state-driven so only one hint shows at a time */}
              {activeHint === 'mode' && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-gray-900 dark:bg-gray-700 text-white rounded-xl px-3 py-2.5 shadow-xl z-50">
                  <button
                    onClick={() => setActiveHint(null)}
                    className="absolute top-1.5 right-2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-xs leading-none"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 pr-5">
                    {experienceMode === "beginner" ? "Simple 🌱" : experienceMode === "intermediate" ? "Standard 🚀" : "Advanced ⚡"}
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">
                    Tap → {experienceMode === "beginner" ? "Standard 🚀" : experienceMode === "intermediate" ? "Advanced ⚡" : "Simple 🌱"}
                  </div>
                  <div className="text-[10px] text-gray-300 leading-relaxed">
                    {experienceMode === "beginner"
                      ? "Unlocks: token search, inflation comparison, AI chat"
                      : experienceMode === "intermediate"
                      ? "Unlocks: power analytics, voice shortcuts, batch ops"
                      : "Hides advanced panels — back to focused view"}
                  </div>
                  <div className="absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 dark:bg-gray-700 rotate-45 rounded-sm" />
                </div>
              )}
            </div>

            {/* Voice assistant — routing now handled by useVoiceIntent */}
            <VoiceButton
              size="sm"
              variant="default"
              externalSuggestionsOpen={activeHint === 'voice'}
              onSuggestionsChange={(open) => setActiveHint(open ? 'voice' : null)}
              onTranscription={handleTranscription}
            />

            {/* Oracle — persistent AI entry point with unread badge */}
            <button
              onClick={openOracle}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-sm"
              aria-label="Open AI Oracle"
            >
              <span className="text-sm">🤖</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Theme toggle - hidden on mobile in Farcaster to save space */}
            <div className={isFarcaster ? 'hidden sm:block' : 'block'}>
              <ThemeToggle />
            </div>
            {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
          </div>
        </div>

        <div className="sticky top-0 z-40 py-2 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md">
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            badges={{ protect: unreadCount }}
          />
        </div>

        <AnimatePresence>
          <GuidedTour />
        </AnimatePresence>

        <div className="pt-2">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div key="overview"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
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
                </motion.div>
              )}

              {activeTab === "protect" && (
                <motion.div key="protect"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <ProtectionTab
                    userRegion={userRegion}
                    portfolio={multichainPortfolio}
                    setActiveTab={setActiveTab}
                  />
                </motion.div>
              )}

              {activeTab === "swap" && (
                <motion.div key="swap"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <SwapTab
                    userRegion={userRegion}
                    inflationData={inflationData as Record<string, RegionalInflationData>}
                    refreshBalances={refresh}
                    refreshChainId={async () => walletChainId}
                    isBalancesLoading={isMultichainLoading}
                  />
                </motion.div>
              )}

              {activeTab === "info" && (
                <motion.div key="info"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <InfoTab
                    availableTokens={availableTokens}
                    userRegion={userRegion}
                  />
                </motion.div>
              )}
            </AnimatePresence>
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
          onConnectWallet={connectWallet}
          isWalletConnected={!!address}
          chainId={walletChainId || undefined}
          onComplete={() => {
            // Wallet tutorial no longer auto-triggers - users can access it via voice command or help button
            // This reduces friction for wallet connection
          }}
        />
      </div>
    </div>
  );
}
