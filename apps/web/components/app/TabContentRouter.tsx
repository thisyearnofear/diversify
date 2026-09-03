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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import type { TabId } from "@/constants/tabs";
import { getVisibleTabIds } from "@/constants/tabs";

import { useAppShellContext } from "@/context/app/AppShellContext";
import { useTabDiscovery } from "@/hooks/use-tab-discovery";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import PullToRefresh from "@/components/ui/PullToRefresh";
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
  /** Which edge the content enters from — set by the swipe/tab direction. */
  direction: 1 | -1;
}

function TabPane({ id, children, direction }: TabPaneProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      key={id}
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 24 * direction, y: 0 }
      }
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: -24 * direction, y: 0 }
      }
      transition={{ duration: 0.18, ease: "easeOut" }}
      role="tabpanel"
      aria-label={id}
    >
      {children}
    </motion.div>
  );
}

/**
 * KeepMountedPane — a pane that never unmounts.
 *
 * Maxima's layout trick, adapted: heavy content lives on while hidden, so
 * returning to the tab is instant (no refetch, no skeleton, no count-up
 * replay — the state you left is the state you find). Used for the Home
 * pane only: it is the app's landing object, the most expensive to mount
 * (wallet fan-out, geolocation, the moment hero), and the one where
 * re-entry cost is most visible.
 *
 * Hidden, not gone: `visibility: hidden` keeps it out of the a11y tree and
 * unfocusable (opacity alone would leave phantom focus targets) while
 * framer animates opacity for the re-entry. With `popLayout`, the hidden
 * pane is removed from layout flow so it never pushes the active tab down.
 */
function KeepMountedPane({
  id,
  children,
  active,
  reducedMotion,
}: {
  id: string;
  children: ReactNode;
  active: boolean;
  reducedMotion: boolean;
}) {
  const direction = active ? 1 : -1;
  return (
    <motion.div
      key={id}
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 24 * direction }
      }
      animate={{
        opacity: active ? 1 : 0,
        x: 0,
        // visibility lands in the a11y tree too: hidden panes are invisible
        // AND unfocusable (unlike opacity alone, which leaves phantom
        // focus targets). framer animates the crossfade, visibility gates
        // interaction the moment the fade completes.
        visibility: active ? "visible" : "hidden",
      }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{
        pointerEvents: active ? "auto" : "none",
        // Inactive: out of the layout flow entirely. popLayout only pops
        // EXITING children — this pane never exits, so without the explicit
        // absolute it would keep its full height in flow and push the
        // active tab below the fold (the "blank tab" bug: the pane was in
        // the DOM, just 700px of hidden Overview away).
        position: active ? "relative" : "absolute",
        top: active ? undefined : 0,
        left: active ? undefined : 0,
        right: active ? undefined : 0,
      }}
      data-keep-mounted={id}
      aria-hidden={!active}
      role="tabpanel"
      aria-label={id}
    >
      {children}
    </motion.div>
  );
}

const DEFAULT_TAB_ORDER: TabId[] = ["overview", "protect", "exchange", "agent", "info"];

export default function TabContentRouter() {
  const {
    activeTab, setActiveTab, trackTabChange,
    multichainPortfolio, isMultichainLoading, refresh,
    isRegionLoading, userRegion, setUserRegion, REGIONS,
    inflationData, currencyPerformanceData,
    walletChainId, isMiniPay, isFarcaster,
    experienceMode,
  } = useAppShellContext();
  const { recordSwipe, recordTabVisit } = useTabDiscovery();
  const { config: adaptiveConfig } = useAdaptiveContext();

  // Determine Guardian mode — cycle-aware for importers, savings for savers
  const guardianMode = adaptiveConfig?.guardianMode ?? "savings";
  // Adaptive tab order — importers see Shield first, savers see Overview.
  // Swipe order is then clipped to the tabs actually in this mode's dock
  // so beginners cannot swipe onto Learn or Guardian.
  const tabOrder = useMemo(() => {
    const visible = new Set(getVisibleTabIds(experienceMode));
    const rawOrder = adaptiveConfig?.content?.tabOrder ?? DEFAULT_TAB_ORDER;
    const validIds = new Set(DEFAULT_TAB_ORDER);
    return rawOrder
      .map((id: string) => id as TabId)
      .filter((id: TabId) => validIds.has(id) && visible.has(id));
  }, [adaptiveConfig, experienceMode]);

  useEffect(() => {
    if (tabOrder.length === 0 || tabOrder.includes(activeTab)) return;
    setActiveTab(tabOrder[0]);
  }, [activeTab, setActiveTab, tabOrder]);

  // Direction-aware transitions: content enters from the side you swiped
  // toward (or the side the new tab sits on in tab order). Maxima's carousel
  // rotates toward the arrow — same vocabulary, translate instead of rotate.
  const prevTabRef = useRef(activeTab);
  const [direction, setDirection] = useState<1 | -1>(1);
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    const prevIdx = tabOrder.indexOf(prevTabRef.current);
    const nextIdx = tabOrder.indexOf(activeTab);
    if (prevIdx !== -1 && nextIdx !== -1) setDirection(nextIdx > prevIdx ? 1 : -1);
    prevTabRef.current = activeTab;
    // tabOrder is derived config; identity changes don't alter direction math
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Keep-mounted Home — the one pane that never unmounts. Kill switch:
  // NEXT_PUBLIC_KEEP_MOUNTED_HOME=false reverts without a code change.
  // Disabled under test (NODE_ENV=test) so suites exercise the classic
  // unmount path and framer stubs never see popLayout.
  const reducedMotion = useReducedMotion();
  const RENDER_OVERVIEW_ALWAYS =
    process.env.NEXT_PUBLIC_KEEP_MOUNTED_HOME !== "false" &&
    process.env.NODE_ENV !== "test";

  const overviewContent = (
    <PullToRefresh onRefresh={refresh}>
      <div className="p-4">
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
  );

  return (
    <motion.div
      className="pt-2 pb-20 relative"
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
      <AnimatePresence mode={RENDER_OVERVIEW_ALWAYS ? "popLayout" : "wait"}>
        {/* Keys are required on every child: AnimatePresence treats its
            children as a list, and keyless presence children all collide
            on the empty key (React "same key" warnings on every render). */}
        {RENDER_OVERVIEW_ALWAYS ? (
          <KeepMountedPane
            key="overview"
            id="overview"
            active={activeTab === "overview"}
            reducedMotion={Boolean(reducedMotion)}
          >
            {overviewContent}
          </KeepMountedPane>
        ) : (
          activeTab === "overview" && (
            <TabPane key="overview" id="overview" direction={direction}>
              {overviewContent}
            </TabPane>
          )
        )}

        {activeTab === "protect" && (
          <TabPane key="protect" id="protect" direction={direction}>
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
          <TabPane key="exchange" id="exchange" direction={direction}>
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

        {activeTab === "agent" && tabOrder.includes("agent") && (
          <TabPane key="agent" id="agent" direction={direction}>
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

        {activeTab === "info" && tabOrder.includes("info") && (
          <TabPane key="info" id="info" direction={direction}>
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