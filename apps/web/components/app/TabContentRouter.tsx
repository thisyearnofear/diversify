/**
 * TabContentRouter — Renders the active tab content with swipe navigation.
 *
 * Reads the shared AppShellContext (set up once by AppShell) — no prop
 * relay needed, and no second useAppShell() instance mounted.
 *
 * The dock order is fixed — TAB_IDS clipped to the tabs visible in the
 * current experience mode. Personas never reorder the dock. A hidden
 * Guardian request (hand-off or ?tab=agent) switches Simple → Full so
 * the tab appears instead of bouncing.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { getVisibleTabIds, isTabId } from "@/constants/tabs";

import { useAppShellContext } from "@/context/app/AppShellContext";
import { useTabDiscovery } from "@/hooks/use-tab-discovery";
import { useShareLanding } from "@/hooks/use-share-landing";
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

export default function TabContentRouter() {
  const {
    activeTab, setActiveTab, trackTabChange,
    multichainPortfolio, isMultichainLoading, refresh,
    isRegionLoading, userRegion, setUserRegion, REGIONS,
    inflationData, currencyPerformanceData,
    walletChainId, isMiniPay, isFarcaster,
    experienceMode, setExperienceMode, hydrated,
  } = useAppShellContext();
  const { recordSwipe, recordTabVisit } = useTabDiscovery();

  // Fixed dock order — TAB_IDS clipped to this mode's visible tabs.
  // Personas never reorder it; swipe order rides the same list.
  const tabOrder = getVisibleTabIds(experienceMode);

  // URL hand-off: ?tab=<id> activates a tab directly — the contract
  // deep-link doorways like /rwa-vaults use to land inside the
  // instrument. One-shot once the router is ready; each tab's own
  // effects consume the rest of the query (e.g. ?sleeve=rwa&serv=1).
  // ?tab=agent counts as a request even when Simple mode hides
  // Guardian — the hidden-tab effect below promotes the dock.
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const tab = router.query.tab;
    if (
      typeof tab === "string" &&
      isTabId(tab) &&
      (tabOrder.includes(tab) || tab === "agent") &&
      tab !== activeTab
    ) {
      setActiveTab(tab);
    }
    // One-shot URL consumption — activeTab/tabOrder must not retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Shared-card attribution: reads src=…_card, fires share_landed once,
  // strips only src so each tab's own query effects still consume theirs.
  useShareLanding();

  useEffect(() => {
    // The saved mode hydrates in a mount effect — until it lands, the
    // pre-hydration 'simple' must not trigger a promote or a bounce
    // (a Full user reloading on Guardian would be downgraded).
    if (!hydrated) return;
    if (tabOrder.length === 0 || tabOrder.includes(activeTab)) return;
    // A Guardian request from Simple mode is a real request, not a
    // bounce — switching to Full grows the dock by one tab and
    // Guardian opens with its pending context intact.
    if (activeTab === "agent" && experienceMode === "simple") {
      setExperienceMode("full");
      return;
    }
    setActiveTab(tabOrder[0]);
  }, [activeTab, setActiveTab, setExperienceMode, experienceMode, hydrated, tabOrder]);

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
      <div className="px-4">
        <ErrorBoundary moduleName="Overview Dashboard">
          <OverviewTab
            isActive={activeTab === "overview"}
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
      // pb-36 clears the nav AND the Ask Guardian FAB (bottom-20, 48px) so the
      // last row of any tab is never hidden under it on mobile.
      className="pt-2 pb-36 lg:pb-20 relative"
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
            <div className="px-4">
              <ErrorBoundary>
                <ProtectionTab
                  userRegion={userRegion}
                  portfolio={multichainPortfolio}
                  isLoading={isMultichainLoading}
                  setActiveTab={setActiveTab}
                  refreshBalances={refresh}
                />
              </ErrorBoundary>
            </div>
          </TabPane>
        )}

        {activeTab === "exchange" && (
          <TabPane key="exchange" id="exchange" direction={direction}>
            <div className="px-4">
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
            </div>
          </TabPane>
        )}

        {activeTab === "agent" && tabOrder.includes("agent") && (
          <TabPane key="agent" id="agent" direction={direction}>
            <div className="px-4">
              <ErrorBoundary>
                <AgentTab
                  isMiniPay={isMiniPay}
                  isFarcaster={isFarcaster}
                  portfolio={multichainPortfolio}
                  refreshBalances={refresh}
                  onNavigateToFund={() => setActiveTab("exchange")}
                />
              </ErrorBoundary>
            </div>
          </TabPane>
        )}

      </AnimatePresence>
    </motion.div>
  );
}