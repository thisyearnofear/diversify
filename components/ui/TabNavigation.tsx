import React from "react";

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  badges?: Record<string, number>;
}

export default function TabNavigation({
  activeTab,
  setActiveTab,
  badges = {},
}: TabNavigationProps) {
  const tabs: TabItem[] = [
    {
      id: "overview",
      label: "Station",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="size-6 mb-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      id: "protect",
      label: "Protect",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="size-6 mb-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      id: "swap",
      label: "Action",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="size-6 mb-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      ),
    },
    {
      id: "info",
      label: "Learn",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="size-6 mb-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="mb-4">
      <div className="flex bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-1">
        {tabs.map((tab) => {
          const badgeCount = badges[tab.id];
          const hasBadge = badgeCount !== undefined && badgeCount > 0;
          
          return (
            <button
              key={tab.id}
              className={`flex-1 py-2 px-1 text-center flex flex-col items-center justify-center transition-all duration-200 rounded-lg relative ${activeTab === tab.id
                  ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : ''} relative`}>
                {tab.icon}
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
