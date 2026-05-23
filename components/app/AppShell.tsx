/**
 * AppShell — The main application layout once the user has completed onboarding.
 * Handles header, tab navigation, tab content, and floating controls.
 * Keeps index.tsx focused on hook orchestration and the landing/app gate.
 */
import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { TabId } from "@/constants/tabs";
import type { UserExperienceMode } from "@/context/app/types";
import type { Region } from "@/hooks/use-user-region";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

import { NETWORKS } from "@/config";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import TabNavigation from "@/components/ui/TabNavigation";
import OverviewTab from "@/components/tabs/OverviewTab";
import ProtectionTab from "@/components/tabs/ProtectionTab";

const ExchangeTab = dynamic(() => import("@/components/tabs/ExchangeTab"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-4 pt-4">
      <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl w-3/4" />
      <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  ),
});

const AgentTab = dynamic(() => import("@/components/tabs/AgentTab"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-4 pt-4">
      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl w-3/4 mx-auto" />
      <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
      <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  ),
});

import InfoTab from "@/components/tabs/InfoTab";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { GuardianStreakWidget } from "@/components/agent/GuardianStreakWidget";
import { WalletTutorial } from "@/components/wallet/WalletTutorial";
import GuidedTour from "@/components/tour/GuidedTour";
import TourTrigger from "@/components/tour/TourTrigger";
import AppHeader from "@/components/app/AppHeader";

interface TabPaneProps {
  id: string;
  children: ReactNode;
}

const transitionStyles: Record<string, any> = {
  overview: {
    initial: { opacity: 0, scale: 0.9, rotateX: -10 },
    animate: { opacity: 1, scale: 1, rotateX: 0 },
    exit: { opacity: 0, scale: 0.95, rotateX: 5 },
    transition: { duration: 0.3, type: "spring", stiffness: 260, damping: 20 },
  },
  exchange: {
    initial: { opacity: 0, x: -20, rotate: -5 },
    animate: { opacity: 1, x: 0, rotate: 0 },
    exit: { opacity: 0, x: 20, rotate: 5 },
    transition: { duration: 0.25, ease: "easeOut" },
  },
  agent: {
    initial: { opacity: 0, rotateY: -30 },
    animate: { opacity: 1, rotateY: 0 },
    exit: { opacity: 0, rotateY: 30 },
    transition: { duration: 0.35, type: "spring", stiffness: 300, damping: 20 },
  },
  protect: {
    initial: { opacity: 0, y: 20, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -20, filter: "blur(4px)" },
    transition: { duration: 0.3, ease: "easeOut" },
  },
  info: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

function TabPane({ id, children }: TabPaneProps) {
  const style = transitionStyles[id] || transitionStyles.overview;
  return (
    <motion.div key={id} {...style}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

const TAB_DISPLAY_ORDER = ["overview", "exchange", "agent", "protect", "info"] as const;

export interface AppShellProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  trackTabChange: (from: string, to: string) => void;
  experienceMode: UserExperienceMode;
  setExperienceMode: (mode: UserExperienceMode) => void;
  address?: string | null;
  isWhitelisted: boolean;
  isMiniPay: boolean;
  isFarcaster: boolean;
  walletChainId: number | null | undefined;
  connectWallet: () => Promise<void>;
  openAdvisor: () => void;
  unreadCount: number;
  multichainPortfolio: MultichainPortfolio;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (r: Region) => void;
  REGIONS: readonly Region[];
  inflationData: Record<string, RegionalInflationData>;
  isMultichainLoading: boolean;
  refresh: () => Promise<void>;
  currencyPerformanceData?: any;
  availableTokens: any[];
  openWalletTutorial: () => void;
  closeTutorial: () => void;
  isTutorialOpen: boolean;
  handleTranscription: (text: string) => void;
}

export default function AppShell({
  activeTab, setActiveTab, trackTabChange,
  experienceMode, setExperienceMode,
  address, isWhitelisted, isMiniPay, isFarcaster, walletChainId,
  connectWallet, openAdvisor, unreadCount,
  multichainPortfolio, isRegionLoading, userRegion, setUserRegion, REGIONS,
  inflationData, isMultichainLoading, refresh, currencyPerformanceData,
  availableTokens,
  openWalletTutorial, closeTutorial, isTutorialOpen,
  handleTranscription,
}: AppShellProps) {
  const isTestnet = !!(
    walletChainId &&
    (walletChainId === NETWORKS.CELO_SEPOLIA.chainId ||
      walletChainId === NETWORKS.ARC_TESTNET.chainId ||
      walletChainId === NETWORKS.RH_TESTNET.chainId)
  );

  // Track unread count changes for bounce animation
  const [prevUnread, setPrevUnread] = useState(unreadCount);
  const [bounceKey, setBounceKey] = useState(0);
  useEffect(() => {
    if (unreadCount > prevUnread) {
      setBounceKey(k => k + 1);
    }
    setPrevUnread(unreadCount);
  }, [unreadCount, prevUnread]);

  return (
    <div className="max-w-md mx-auto">
      <TourTrigger />

      {/* Testnet Warning Banner */}
      {isTestnet && (
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 mb-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span>🧪</span>
            <span>
              Testnet —&nbsp;
              {walletChainId === NETWORKS.CELO_SEPOLIA.chainId
                ? "Celo Sepolia"
                : walletChainId === NETWORKS.ARC_TESTNET.chainId
                  ? "Arc Testnet"
                  : "Robinhood Testnet"}
              &nbsp;(play money)
            </span>
          </div>
          <a
            href={
              walletChainId === NETWORKS.CELO_SEPOLIA.chainId
                ? "https://faucet.celo.org/sepolia"
                : walletChainId === NETWORKS.ARC_TESTNET.chainId
                  ? "https://faucet.circle.com"
                  : "https://faucet.testnet.chain.robinhood.com"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 dark:text-amber-300 underline hover:no-underline whitespace-nowrap"
          >
            Get funds →
          </a>
        </div>
      )}

      {/* HEADER */}
      <AppHeader
        experienceMode={experienceMode}
        setExperienceMode={setExperienceMode}
        address={address}
        isWhitelisted={isWhitelisted}
        isFarcaster={isFarcaster}
        handleTranscription={handleTranscription}
      />

      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} badges={{}} experienceMode={experienceMode} />

      <AnimatePresence>
        <GuidedTour />
      </AnimatePresence>

      <motion.div
        className="pt-2 pb-20"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.05}
        onPanEnd={(_e, info) => {
          const SWIPE_THRESHOLD = 60;
          const idx = TAB_DISPLAY_ORDER.indexOf(activeTab as any);
          if (info.offset.x < -SWIPE_THRESHOLD && idx < TAB_DISPLAY_ORDER.length - 1) {
            const newTab = TAB_DISPLAY_ORDER[idx + 1];
            trackTabChange(activeTab, newTab);
            setActiveTab(newTab as TabId);
          } else if (info.offset.x > SWIPE_THRESHOLD && idx > 0) {
            const newTab = TAB_DISPLAY_ORDER[idx - 1];
            trackTabChange(activeTab, newTab);
            setActiveTab(newTab as TabId);
          }
        }}
      >
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <TabPane id="overview">
              <ErrorBoundary>
                <PullToRefresh onRefresh={refresh}>
                  <div className="p-4 space-y-4">
                    <GuardianStreakWidget />
                    <OverviewTab
                      portfolio={multichainPortfolio}
                      isLoading={isMultichainLoading}
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
                  isLoading={isMultichainLoading}
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
                  inflationData={inflationData}
                  refreshBalances={refresh}
                  refreshChainId={async () => walletChainId ?? null}
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
                <InfoTab availableTokens={availableTokens} userRegion={userRegion} isLoading={isMultichainLoading} />
              </ErrorBoundary>
            </TabPane>
          )}
        </AnimatePresence>
      </motion.div>

      {/* AI Chat FAB */}
      <motion.button
        key={bounceKey}
        onClick={openAdvisor}
        aria-label="AI Chat"
        initial={{ opacity: 0, scale: 0, y: 20 }}
        animate={{
          opacity: 1,
          scale: [0, 1.15, 1],
          y: 0,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ scale: 1.08, boxShadow: "0 0 20px rgba(37, 99, 235, 0.5)" }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center"
      >
        <motion.span
          className="text-lg leading-none"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
        >
          🤖
        </motion.span>
        <span className="absolute inset-0 rounded-2xl bg-blue-400/30 animate-ping pointer-events-none" style={{ animationDuration: "3s" }} />
        {unreadCount > 0 && (
          <motion.span
            key={`badge-${bounceKey}`}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.3 }}
            className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>

      <WalletTutorial
        isOpen={isTutorialOpen}
        onClose={closeTutorial}
        onConnect={connectWallet}
        isMiniPay={isMiniPay}
      />
    </div>
  );
}
