import React from "react";
import { motion } from "framer-motion";
import type { TabId } from "@/constants/tabs";
import type { UserExperienceMode } from "@/context/app/types";

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
    label: "Overview",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "swap",
    label: "Swap",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    id: "trade",
    label: "Trade",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    id: "agent",
    label: "Agent",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
    id: "info",
    label: "Learn",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

// Tabs shown in beginner mode (primary tabs only)
const BEGINNER_TAB_IDS: TabId[] = ["overview", "swap", "protect"];

export default function TabNavigation({ activeTab, setActiveTab, badges = {}, experienceMode }: TabNavigationProps) {
  const isBeginner = experienceMode === 'beginner';
  const visibleTabs = isBeginner ? TABS.filter(t => BEGINNER_TAB_IDS.includes(t.id)) : TABS;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-safe">
      <div className="max-w-md mx-auto flex">
        {visibleTabs.map((tab) => {
          const badgeCount = badges[tab.id];
          const hasBadge = badgeCount !== undefined && badgeCount > 0;
          const isActive = activeTab === tab.id;

          return (
            <motion.button
              key={tab.id}
              onClick={() => {
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate(10);
                }
                setActiveTab(tab.id);
              }}
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
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm"
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
  );
}
