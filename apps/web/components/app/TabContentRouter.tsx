/**
 * TabContentRouter — Renders the active tab content with swipe navigation.
 *
 * Reads the shared AppShellContext (set up once by AppShell) — no prop
 * relay needed, and no second useAppShell() instance mounted.
 *
 * Reads adaptive config to determine tab order — importers see Shield
 * first, savers see Overview first. This is the foundation of the
 * adaptive experience: different personas see different information
 * architecture in the same shell.
 */
import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { TabId } from "@/constants/tabs";

import { useAppShellContext } from "@/context/app/AppShellContext";
import { useTabDiscovery } from "@/hooks/use-tab-discovery";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { GuardianStreakWidget } from "@/components/agent/GuardianStreakWidget";
import { TabSkeleton } from "@/components/ui/Skeleton";

// ── Dynamic tab imports ──

const OverviewTab = dynamic(() => import("@/components/tabs/OverviewTab"), {
  ssr: false,
  loading: () => <TabSkeleton label="Opening Home" />,
});

const ProtectionTab = dynamic(() => import("@/components/tabs/ProtectionTab"), {
  ssr: false,
  loading: () => <TabSkeleton label="Opening Shield" />,
});

const ExchangeTab = dynamic(() => import("@/components/tabs/ExchangeTab"), {
  ssr: false,
  loading: () => <TabSkeleton label="Opening Exchange" />,
});

const AgentTab = dynamic(() => import("@/components/tabs/AgentTab"), {
  ssr: false,
  loading: () => <TabSkeleton label="Opening Guardian" />,
});

const InfoTab = dynamic(() => import("@/components/tabs/InfoTab"), {
  ssr: false,
  loading: () => <TabSkeleton label="Opening Learn" />,
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

// ── Component ──

export default function TabContentRouter() {
  const {
    activeTab, setActiveTab, trackTabChange,
    multichainPortfolio, isMultichainLoading, refresh,
    isRegionLoading, userRegion, setUserRegion, REGIONS,
    inflationData, currencyPerformanceData,
    walletChainId, isMiniPay, isFarcaster,
  } = useAppShellContext();
  const { recordSwipe, recordTabVisit } = useTabDiscovery();
  const { config: adaptiveConfig } = useAdaptiveContext();

  // Determine Guardian mode — cycle-aware for importers, savings for savers
  const guardianMode = adaptiveConfig?.guardianMode ?? "savings";

  // Adaptive tab order — importers see Shield first, savers see Overview
  // This is the foundation of the adaptive UX: different personas see
  // different information architecture, not just different labels.
  const defaultOrder: TabId[] = ["overview", "protect", "exchange", "agent", "info"];
  const rawOrder = adaptiveConfig?.content?.tabOrder ?? defaultOrder;
  const validIds = new Set(defaultOrder);
  const tabOrder = rawOrder
    .map((id: string) => id as TabId)
    .filter((id: TabId) => validIds.has(id));

  return (
    <motion.div
      className="pt-2 pb-20"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.05}
      onPanEnd={(_e, info) => {
        const SWIPE_THRESHOLD = 60;
        const idx = tabOrder.indexOf(activeTab);
        if (info.offset.x < -SWIPE_THRESHOLD && idx < tabOrder.length - 1) {
          const newTab = tabOrder[idx + 1];
          trackTabChange(activeTab, newTab);
          setActiveTab(newTab);
          recordSwipe();
          recordTabVisit(newTab);
        } else if (info.offset.x > SWIPE_THRESHOLD && idx > 0) {
          const newTab = tabOrder[idx - 1];
          trackTabChange(activeTab, newTab);
          setActiveTab(newTab);
          recordSwipe();
          recordTabVisit(newTab);
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
                refreshBalances={refresh}
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
                portfolio={multichainPortfolio}
              />
            </ErrorBoundary>
          </TabPane>
        )}

        {activeTab === "agent" && (
          <TabPane id="agent">
            <ErrorBoundary>
              <AgentTab
                isMiniPay={isMiniPay}
                isFarcaster={isFarcaster}
                portfolio={multichainPortfolio}
                refreshBalances={refresh}
                onNavigateToFund={() => setActiveTab("exchange")}
              />
            </ErrorBoundary>
          </TabPane>
        )}

        {activeTab === "info" && (
          <TabPane id="info">
            <ErrorBoundary>
              <InfoTab
                userRegion={userRegion}
                isLoading={isMultichainLoading}
                setActiveTab={setActiveTab}
                refreshBalances={refresh}
              />
            </ErrorBoundary>
          </TabPane>
        )}
      </AnimatePresence>
    </motion.div>
  );
}