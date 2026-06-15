import React, { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import type { TabId } from "@/constants/tabs";
import type { UserExperienceMode } from "@/context/app/types";
import { TabNavHint } from "./TabNavHint";
import { useTabDiscovery } from "@/hooks/use-tab-discovery";

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
    id: "overview",
    label: "Home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "protect",
    label: "Protect",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
    label: "Advisor",
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

// Tabs shown in beginner mode — includes Advisor so new users see the
// autonomous Guardian (the single most differentiated product feature).
const BEGINNER_TAB_IDS: TabId[] = ["overview", "protect", "exchange", "agent"];

// Tabs only available in advanced mode
const ADVANCED_ONLY_TAB_IDS: TabId[] = [];

export default function TabNavigation({ activeTab, setActiveTab, badges = {}, experienceMode }: TabNavigationProps) {
  const isBeginner = experienceMode === 'beginner';
  const isAdvanced = experienceMode === 'advanced';
  const visibleTabs = isBeginner
    ? TABS.filter(t => BEGINNER_TAB_IDS.includes(t.id))
    : TABS.filter(t => isAdvanced || !ADVANCED_ONLY_TAB_IDS.includes(t.id));

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

  return (
    <>
      <TabNavHint />
      <div
        role="tablist"
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-nav pb-safe"
      >
        <div className="max-w-md mx-auto flex">
        {visibleTabs.map((tab, index) => {
          const badgeCount = badges[tab.id];
          const hasBadge = badgeCount !== undefined && badgeCount > 0;
          const isActive = activeTab === tab.id;

          return (
            <motion.button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              ref={el => { tabRefs.current[index] = el; }}
              onClick={() => {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate(10);
                }
                setActiveTab(tab.id);
                recordTabBar();
                recordTabVisit(tab.id);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              whileTap={{ scale: 0.9 }}
              className={`flex-1 min-w-0 py-2 px-1 min-h-[64px] text-center flex flex-col items-center justify-center transition-all duration-200 relative ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
              <span className={`text-xs sm:text-xs font-bold uppercase tracking-wider mt-0.5 ${isActive ? "opacity-100" : "opacity-60"}`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
    </>
  );
}
