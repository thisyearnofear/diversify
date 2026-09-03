import React, { useCallback, useRef, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { TabId } from "@/constants/tabs";
import { getVisibleTabIds } from "@/constants/tabs";
import type { UserExperienceMode } from "@/context/app/types";
import { TabNavHint } from "./TabNavHint";
import { useTabDiscovery } from "@/hooks/use-tab-discovery";
import { haptics } from "@/lib/haptics";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import { spring } from "@/lib/motion-tokens";

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface TabNavigationProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  /** Optional badge counts keyed by tab id */
  badges?: Partial<Record<TabId, number>>;
  experienceMode?: UserExperienceMode;
}

const TABS: TabItem[] = [
  {
    id: "protect",
    label: "Shield",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: "overview",
    label: "Home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "exchange",
    label: "Exchange",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    id: "agent",
    label: "Guardian",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" />
      </svg>
    ),
  },
  {
    id: "info",
    label: "Learn",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function TabNavigation({ activeTab, setActiveTab, badges = {}, experienceMode }: TabNavigationProps) {
  const mode = experienceMode ?? 'intermediate';
  const visibleTabIds = getVisibleTabIds(mode);
  const visibleTabs = TABS.filter((t) => visibleTabIds.includes(t.id));

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { recordTabVisit, recordTabBar } = useTabDiscovery();

  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const tabCount = visibleTabs.length;
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % tabCount;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + tabCount) % tabCount;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tabCount - 1;
    } else {
      return;
    }

    const nextTab = visibleTabs[newIndex];
    setActiveTab(nextTab.id);
    recordTabVisit(nextTab.id);
    tabRefs.current[newIndex]?.focus();
  }, [visibleTabs, setActiveTab, recordTabVisit]);

  // Read adaptive tab labels and order — persona-specific overrides.
  // Importers see Shield first, savers see Overview first.
  const { config: adaptiveConfig } = useAdaptiveContext();
  const tabLabels = useMemo(
    () => adaptiveConfig?.tabLabels ?? {},
    [adaptiveConfig],
  );

  // Sort visible tabs according to adaptive order (e.g., ["protect","overview",...]
  // for importers vs ["overview","protect",...] for savers).
  const adaptiveOrder = useMemo(() => {
    const order = adaptiveConfig?.content?.tabOrder;
    if (!order || order.length === 0) return visibleTabs;
    return [...visibleTabs].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      // Unlisted tabs go to the end
      if (ai === -1 && bi === -1) return visibleTabs.indexOf(a) - visibleTabs.indexOf(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [adaptiveConfig?.content?.tabOrder, visibleTabs]);

  return (
    <>
      <div className="lg:hidden">
        <TabNavHint activeTab={activeTab} />
        <div
          role="tablist"
          aria-label="Main navigation"
          className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-nav pb-safe"
        >
        <div className="max-w-md mx-auto flex">
        {adaptiveOrder.map((tab, index) => {
          const badgeCount = badges[tab.id];
          const hasBadge = badgeCount !== undefined && badgeCount > 0;
          const isActive = activeTab === tab.id;
          const label = tabLabels[tab.id] ?? tab.label;

          return (
            <motion.button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              ref={el => { tabRefs.current[index] = el; }}
              onClick={() => {
                haptics.tap();
                setActiveTab(tab.id);
                recordTabBar();
                recordTabVisit(tab.id);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              whileTap={{ scale: 0.9 }}
              className={`flex-1 min-w-0 py-2 px-1 min-h-[64px] text-center flex flex-col items-center justify-center transition-all duration-200 relative ${                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
            >
              {/* Active indicator — bottom line */}
              {isActive && (
                <motion.span 
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                />
              )}
              <motion.div 
                className={`transition-transform duration-200 ${isActive ? "scale-110" : ""} relative`}
                animate={hasBadge ? { scale: [1, 1.05, 1] } : {}}
                transition={hasBadge ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
              >
                <div className="[&>svg]:size-5 [&>svg]:sm:size-6 [&>svg]:mb-0.5 [&>svg]:sm:mb-1">
                  {tab.icon}
                </div>
                {hasBadge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </motion.span>
                )}
              </motion.div>
              <span className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-0.5">
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
      </div>
      </div>
    </>
  );
}

/**
 * DesktopRail — the lg+ sibling of the bottom tab bar. Same tabs, same
 * adaptive visibility/order/labels, same badges — a vertical rail so the
 * desktop shell is a two-pane layout (rail + content) instead of a phone
 * column in decorated margins. Solid surface per the design language.
 */
export function DesktopRail({ activeTab, setActiveTab, badges = {}, experienceMode }: TabNavigationProps) {
  const mode = experienceMode ?? 'intermediate';
  const visibleTabIds = getVisibleTabIds(mode);
  const visibleTabs = TABS.filter((t) => visibleTabIds.includes(t.id));
  const { config: adaptiveConfig } = useAdaptiveContext();
  const tabLabels = useMemo(
    () => adaptiveConfig?.tabLabels ?? {},
    [adaptiveConfig],
  );

  // Sylva's dock: hover magnifies the tab under the pointer, neighbors lean
  // in proportionally, and a spring settles everything back on leave.
  // Pointer-proximity on desktop only — the mouse is the dock's instrument;
  // touch/keyboard get the flat rail. Reduced motion: flat rail, no spring.
  const reducedMotion = useReducedMotion();
  const canDock = !reducedMotion && typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  const railRef = useRef<HTMLElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const adaptiveOrder = useMemo(() => {
    const order = adaptiveConfig?.content?.tabOrder;
    if (!order || order.length === 0) return visibleTabs;
    return [...visibleTabs].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      if (ai === -1 && bi === -1) return visibleTabs.indexOf(a) - visibleTabs.indexOf(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [adaptiveConfig?.content?.tabOrder, visibleTabs]);

  return (
    <nav
      ref={railRef}
      aria-label="Main navigation"
      className="hidden lg:flex fixed left-0 top-0 h-full w-20 z-50 flex-col items-center py-6 gap-1
                 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
      onMouseLeave={() => setHoverIndex(null)}
    >
      {adaptiveOrder.map((tab, index) => {
        const badgeCount = badges[tab.id];
        const hasBadge = badgeCount !== undefined && badgeCount > 0;
        const isActive = activeTab === tab.id;
        const label = tabLabels[tab.id] ?? tab.label;

        const hovering = hoverIndex === index;
        return (
          <motion.button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onMouseEnter={canDock ? () => setHoverIndex(index) : undefined}
            onFocus={canDock ? () => setHoverIndex(index) : undefined}
            onBlur={canDock ? () => setHoverIndex((cur) => (cur === index ? null : cur)) : undefined}
            animate={
              !canDock
                ? undefined
                : hovering
                  ? { scale: 1.18, y: -4 }
                  : hoverIndex !== null
                    ? { scale: 1.05, y: 0 }
                    : { scale: 1, y: 0 }
            }
            transition={spring}
            onClick={() => {
              haptics.tap();
              setActiveTab(tab.id);
            }}
            className={`relative w-16 min-h-[64px] py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors origin-bottom ${
              isActive
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            }`}
          >
            {hasBadge && (
              <span className="absolute top-1 right-2 bg-orange-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
            <div className="[&>svg]:size-6">{tab.icon}</div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight px-0.5">
              {label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}
