import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import Head from "next/head";
import { useNavigation } from "../context/app/NavigationContext";
import { useExperience } from "../context/app/ExperienceContext";
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
const ExchangeTab = dynamic(() => import("../components/tabs/ExchangeTab"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-4 pt-4">
      <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl w-3/4" />
      <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  ),
});
const AgentTab = dynamic(() => import("../components/tabs/AgentTab"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-4 pt-4">
      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl w-3/4 mx-auto" />
      <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
      <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  ),
});
import InfoTab from "../components/tabs/InfoTab";
import WalletButton from "../components/wallet/WalletButton";
import FarcasterWalletButton from "../components/wallet/FarcasterWalletButton";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { useWalletTutorial, WalletTutorial } from "../components/wallet/WalletTutorial";
import VoiceButton from "../components/ui/VoiceButton";
import { useToast } from "../components/ui/Toast";
import GuidedTour from "../components/tour/GuidedTour";
import TourTrigger from "../components/tour/TourTrigger";
import StrategyModal, { useStrategyModal } from "../components/onboarding/StrategyModal";
import PullToRefresh from "../components/ui/PullToRefresh";

import { useVoiceIntent } from "../hooks/use-voice-intent";
import { useAnalytics } from "../hooks/use-analytics";
import { useAdvisor } from "../hooks/use-advisor";
import { useStreakRewards } from "../hooks/use-streak-rewards";
import { useProtectionProfile } from "../hooks/use-protection-profile";


// Tab display order — single source of truth for swipe navigation
const TAB_DISPLAY_ORDER = ["overview", "exchange", "agent", "protect", "info"] as const;
type TabId = typeof TAB_DISPLAY_ORDER[number];

// Reusable animated tab wrapper — eliminates repeated motion.div boilerplate
function TabPane({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function DiversiFiPage() {
  const { activeTab, setActiveTab } = useNavigation();
  const { experienceMode, setExperienceMode } = useExperience();
  const { showToast } = useToast();
  const { openAdvisor, unreadCount } = useAdvisor();

  // Static OG image for consistent social sharing
  const ogImageUrl = 'https://diversifiapp.vercel.app/embed-image.png';

  // Shared Farcaster mini-app config — single source of truth for both meta tags
  const farcasterMeta = {
    version: "1",
    imageUrl: ogImageUrl,
    button: {
      title: "Open DiversiFi",
      action: {
        name: "DiversiFi",
        url: "https://diversifiapp.vercel.app",
        splashImageUrl: "https://diversifiapp.vercel.app/splash.png",
        splashBackgroundColor: "#8B5CF6",
      },
    },
  };

  const {
    isMiniPay,
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
  const { trackTabChange } = useAnalytics();

  const { isOpen: isStrategyModalOpen, closeModal: closeStrategyModal } = useStrategyModal();
  const { isWhitelisted } = useStreakRewards();

  // Mutual exclusion for header hints: only one tooltip/panel open at a time
  const [activeHint, setActiveHint] = useState<'mode' | 'voice' | null>(null);

  // One-time mode toggle discoverability tip — shown only on first visit
  const [showModeTip, setShowModeTip] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('seenModeTip') && !!localStorage.getItem('inlineOnboardingDismissed');
  });
  const dismissModeTip = () => {
    setShowModeTip(false);
    if (typeof window !== 'undefined') localStorage.setItem('seenModeTip', '1');
  };

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
    return getChainAssets(walletChainId || NETWORKS.CELO_MAINNET.chainId);
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
    <div className="min-h-screen bg-white dark:bg-gray-950 p-2 sm:p-4 transition-colors relative">
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
          content={JSON.stringify({ ...farcasterMeta, button: { ...farcasterMeta.button, action: { ...farcasterMeta.button.action, type: "launch_miniapp" } } })}
        />
        {/* Backward compatibility */}
        <meta
          name="fc:frame"
          content={JSON.stringify({ ...farcasterMeta, button: { ...farcasterMeta.button, action: { ...farcasterMeta.button.action, type: "launch_frame" } } })}
        />
      </Head>

      <div className="max-w-md mx-auto">
        <TourTrigger />

        {/* Testnet Warning Banner */}
        {walletChainId && (walletChainId === NETWORKS.CELO_SEPOLIA.chainId || walletChainId === NETWORKS.ARC_TESTNET.chainId || walletChainId === NETWORKS.RH_TESTNET.chainId) && (
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 mb-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <span>🧪</span>
              <span>
                Testnet —&nbsp;
                {walletChainId === NETWORKS.CELO_SEPOLIA.chainId ? 'Celo Sepolia' :
                  walletChainId === NETWORKS.ARC_TESTNET.chainId ? 'Arc Testnet' : 'Robinhood Testnet'}
                &nbsp;(play money)
              </span>
            </div>
            <a
              href={
                walletChainId === NETWORKS.CELO_SEPOLIA.chainId
                  ? 'https://faucet.celo.org/sepolia'
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
          {/* Left: Logo - hidden on mobile to give wallet button room */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white text-sm font-black">D</span>
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                DiversiFi
              </h1>
              {address && (
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isWhitelisted ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                  {isWhitelisted && (
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                      Verified
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Consistent controls across ALL modes - compact on mobile */}
          <div className="flex items-center gap-1 sm:gap-2">
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
                  dismissModeTip();
                  showToast(
                    next === "beginner" ? "Simple mode 🌱 — focused view" :
                      next === "intermediate" ? "Standard mode 🚀 — full features unlocked" :
                        "Advanced mode ⚡ — power tools unlocked",
                    "info"
                  );
                }}
                className="flex flex-col items-center gap-0.5"
                aria-label={
                  experienceMode === "beginner"
                    ? "Switch to Standard mode — unlock more features"
                    : experienceMode === "intermediate"
                      ? "Switch to Advanced mode — power analytics & voice shortcuts"
                      : "Switch to Simple mode — hide advanced panels"
                }
              >
                <span className="relative w-10 h-8 text-sm rounded-xl transition-all flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
                  {experienceMode === "beginner" ? "🌱" : experienceMode === "intermediate" ? "🚀" : "⚡"}
                  {/* First-visit pulse ring */}
                  {showModeTip && (
                    <span className="absolute inset-0 rounded-xl ring-2 ring-emerald-400 animate-ping opacity-75 pointer-events-none" />
                  )}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-none">
                  {experienceMode === "beginner" ? "Simple" : experienceMode === "intermediate" ? "Standard" : "Advanced"}
                </span>
              </button>
              {/* First-visit nudge tooltip — auto-dismisses on any interaction */}
              {showModeTip && !isStrategyModalOpen && activeHint !== 'mode' && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-emerald-700 text-white rounded-xl px-3 py-2 shadow-xl z-50">
                  <button
                    onClick={dismissModeTip}
                    className="absolute top-1.5 right-2 text-emerald-300 hover:text-white text-xs leading-none"
                    aria-label="Dismiss"
                  >✕</button>
                  <p className="text-xs font-black leading-snug pr-4">Tap to unlock more features →</p>
                  <div className="absolute -top-1.5 right-3 w-3 h-3 bg-emerald-700 rotate-45 rounded-sm" />
                </div>
              )}
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
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1 pr-5">
                    {experienceMode === "beginner" ? "Simple 🌱" : experienceMode === "intermediate" ? "Standard 🚀" : "Advanced ⚡"}
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">
                    Tap → {experienceMode === "beginner" ? "Standard 🚀" : experienceMode === "intermediate" ? "Advanced ⚡" : "Simple 🌱"}
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed">
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

            {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
          </div>
        </div>

        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          badges={{}}
          experienceMode={experienceMode}
        />

        {!isStrategyModalOpen && (
          <AnimatePresence>
            <GuidedTour />
          </AnimatePresence>
        )}

        <motion.div
          className="pt-2 pb-20"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.05}
          onPanEnd={(_e, info) => {
            const SWIPE_THRESHOLD = 60;
            // Tab display order matches TabNavigation TABS array
            const TAB_ORDER = TAB_DISPLAY_ORDER;
            const idx = TAB_ORDER.indexOf(activeTab as TabId);
            if (info.offset.x < -SWIPE_THRESHOLD && idx < TAB_ORDER.length - 1) {
              const newTab = TAB_ORDER[idx + 1];
              trackTabChange(activeTab, newTab);
              setActiveTab(newTab);
            } else if (info.offset.x > SWIPE_THRESHOLD && idx > 0) {
              const newTab = TAB_ORDER[idx - 1];
              trackTabChange(activeTab, newTab);
              setActiveTab(newTab);
            }
          }}
        >
          <AnimatePresence mode="wait">
import { GuardianStreakWidget } from "../components/agent/GuardianStreakWidget";

...

              {activeTab === "overview" && (
                <TabPane id="overview">
                  <ErrorBoundary>
                    <PullToRefresh onRefresh={refresh}>
                      <div className="p-4 space-y-4">
                        <GuardianStreakWidget />
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
                      </div>
                    </PullToRefresh>
                  </ErrorBoundary>
                </TabPane>
              )}

              {activeTab === "protect" && (
                <TabPane id="protect">
                  <ErrorBoundary>
                    <ProtectionTab
                      userRegion={userRegion}
                      portfolio={multichainPortfolio}
                      setActiveTab={setActiveTab}
                    />
                  </ErrorBoundary>
                </TabPane>
              )}

              {activeTab === "exchange" && (
                <TabPane id="exchange">
                  <ErrorBoundary>
                    <ExchangeTab
                      userRegion={userRegion}
                      inflationData={inflationData as Record<string, RegionalInflationData>}
                      refreshBalances={refresh}
                      refreshChainId={async () => walletChainId}
                      isBalancesLoading={isMultichainLoading}
                    />
                  </ErrorBoundary>
                </TabPane>
              )}

              {activeTab === "agent" && (
                <TabPane id="agent">
                  <ErrorBoundary>
                    <AgentTab isMiniPay={isMiniPay} isFarcaster={isFarcaster} portfolio={multichainPortfolio} />
                  </ErrorBoundary>
                </TabPane>
              )}

              {activeTab === "info" && (
                <TabPane id="info">
                  <ErrorBoundary>
                    <InfoTab
                      availableTokens={availableTokens}
                      userRegion={userRegion}
                    />
                  </ErrorBoundary>
                </TabPane>
              )}
            </AnimatePresence>
        </motion.div>

        {/* AI Chat FAB — floats above bottom nav, visible on all tabs */}
        <button
          onClick={openAdvisor}
          aria-label="AI Chat"
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all"
        >
          <span className="text-lg leading-none">🤖</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <WalletTutorial
          isOpen={isTutorialOpen}
          onClose={closeTutorial}
          onConnect={connectWallet}
          isMiniPay={isMiniPay}
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
