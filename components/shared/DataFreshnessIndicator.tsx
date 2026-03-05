/**
 * Data Freshness Indicator
 * Shows when data was last updated and warns if it's stale
 */

import React from "react";

interface DataFreshnessIndicatorProps {
  lastUpdated: number | null;
  isStale?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  lastUpdated,
  isStale = false,
  isLoading = false,
  error = null,
  onRefresh,
  className = "",
}) => {
  // Format relative time (e.g., "2 min ago")
  const getRelativeTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Error state
  if (error) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-600 dark:text-red-400">
          Error loading data
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:underline ml-1"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading && !lastUpdated) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-400 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  // No data yet
  if (!lastUpdated) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-400 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        <span>No data</span>
      </div>
    );
  }

  // Stale data warning
  if (isStale) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-amber-600 dark:text-amber-400">
          Stale data • {getRelativeTime(lastUpdated)}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:underline ml-1"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  // Fresh data
  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span className="text-green-600 dark:text-green-400">
        Live • {getRelativeTime(lastUpdated)}
        {isLoading && <span className="ml-1">(updating...)</span>}
      </span>
      {onRefresh && !isLoading && (
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
          title="Refresh now"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
};
