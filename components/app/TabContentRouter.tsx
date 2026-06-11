/**
 * TabContentRouter — Renders the active tab content with swipe navigation.
 *
 * Consumes useAppShell() directly — no prop relay needed.
 */
import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { TabId } from "@/constants/tabs";

import { useAppShell } from "@/hooks/use-app-shell";
import { useTabDiscovery } from "@/hooks/use-tab-discovery";
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

const TAB_DISPLAY_ORDER = ["overview", "protect", "exchange", "agent", "info"] as const;

// ── Component ──

export default function TabContentRouter() {
  const {
    activeTab, setActiveTab, trackTabChange,
    multichainPortfolio, isMultichainLoading, refresh,
    isRegionLoading, userRegion, setUserRegion, REGIONS,
    inflationData, currencyPerformanceData, availableTokens,
    walletChainId, isMiniPay, isFarcaster,
  } = useAppShell();
  const { recordSwipe, recordTabVisit } = useTabDiscovery();

  return (
    <motion.div
      className="pt-2 pb-20"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.05}
      onPanEnd={(_e, info) => {
        const SWIPE_THRESHOLD = 60;
        const idx = TAB_DISPLAY_ORDER.indexOf(activeTab);
        if (info.offset.x < -SWIPE_THRESHOLD && idx < TAB_DISPLAY_ORDER.length - 1) {
          const newTab = TAB_DISPLAY_ORDER[idx + 1];
          trackTabChange(activeTab, newTab);
          setActiveTab(newTab as TabId);
          recordSwipe();
          recordTabVisit(newTab as TabId);
        } else if (info.offset.x > SWIPE_THRESHOLD && idx > 0) {
          const newTab = TAB_DISPLAY_ORDER[idx - 1];
          trackTabChange(activeTab, newTab);
          setActiveTab(newTab as TabId);
          recordSwipe();
          recordTabVisit(newTab as TabId);
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