/**
 * TabContentRouter — Renders the active tab content with swipe navigation.
 *
 * Receives only the subset of AppShell state needed for tab rendering.
 * Extracted from AppShell.tsx per the 9/10 roadmap (Task 3).
 */
import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { TabId } from "@/constants/tabs";
import type { Region } from "@/hooks/use-user-region";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

import ErrorBoundary from "@/components/ui/ErrorBoundary";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { GuardianStreakWidget } from "@/components/agent/GuardianStreakWidget";

// ── Skeleton loaders ──

const tabSkeleton = (rows: number = 3) => (
  <div className="animate-pulse space-y-4 pt-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className={`h-${i === 0 ? "10" : i === 1 ? "8" : "40"} bg-gray-100 dark:bg-gray-800 rounded-${i === 2 ? "2xl" : "xl"} ${i === 1 ? "w-3/4" : ""}`}
      />
    ))}
  </div>
);

// ── Dynamic tab imports ──

const OverviewTab = dynamic(() => import("@/components/tabs/OverviewTab"), {
  ssr: false,
  loading: () => tabSkeleton(3),
});

const ProtectionTab = dynamic(() => import("@/components/tabs/ProtectionTab"), {
  ssr: false,
  loading: () => tabSkeleton(3),
});

const ExchangeTab = dynamic(() => import("@/components/tabs/ExchangeTab"), {
  ssr: false,
  loading: () => tabSkeleton(3),
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

const InfoTab = dynamic(() => import("@/components/tabs/InfoTab"), {
  ssr: false,
  loading: () => tabSkeleton(2),
});

// ── TabPane + transition ──

interface TabPaneProps {
  id: string;
  children: ReactNode;
}

const tabTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

function TabPane({ id, children }: TabPaneProps) {
  return (
    <motion.div key={id} {...tabTransition}>
      {children}
    </motion.div>
  );
}

const TAB_DISPLAY_ORDER = ["overview", "exchange", "agent", "protect", "info"] as const;

// ── Props ──

export interface TabContentRouterProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  trackTabChange: (from: string, to: string) => void;
  // Data passed to tab components
  multichainPortfolio: MultichainPortfolio;
  isMultichainLoading: boolean;
  refresh: () => Promise<void>;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (r: Region) => void;
  REGIONS: readonly Region[];
  inflationData: Record<string, any>;
  currencyPerformanceData?: any;
  availableTokens: any[];
  walletChainId: number | null | undefined;
  isMiniPay: boolean;
  isFarcaster: boolean;
}

// ── Component ──

export default function TabContentRouter({
  activeTab,
  setActiveTab,
  trackTabChange,
  multichainPortfolio,
  isMultichainLoading,
  refresh,
  isRegionLoading,
  userRegion,
  setUserRegion,
  REGIONS,
  inflationData,
  currencyPerformanceData,
  availableTokens,
  walletChainId,
  isMiniPay,
  isFarcaster,
}: TabContentRouterProps) {
  return (
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
            <PullToRefresh onRefresh={refresh}>
              <div className="p-4 space-y-4">
                <ErrorBoundary moduleName="Streak Widget">
                  <GuardianStreakWidget />
                </ErrorBoundary>
                <ErrorBoundary moduleName="Overview Dashboard">
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
                </ErrorBoundary>
              </div>
            </PullToRefresh>
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
  );
}