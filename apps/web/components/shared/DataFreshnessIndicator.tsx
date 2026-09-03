/**
 * Data Freshness Indicator
 * Shows when data was last updated and warns if it's stale
 */

import React from "react";
import StatusBadge from "./StatusBadge";

interface DataFreshnessIndicatorProps {
  lastUpdated: number | null;
  isStale?: boolean;
  /** Some of the displayed values are fallback estimates, not live quotes */
  hasEstimates?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  lastUpdated,
  isStale = false,
  hasEstimates = false,
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
        <StatusBadge label="Data unavailable" tone="error" compact />
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
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <StatusBadge label="Reading wallet data" tone="info" compact />
      </div>
    );
  }

  // No data yet
  if (!lastUpdated) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <StatusBadge label="No wallet data" tone="neutral" compact />
      </div>
    );
  }

  // Stale or partially estimated data — both get the honest amber marker
  if (isStale || hasEstimates) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <StatusBadge
          label={isStale ? "Stale wallet data" : "Includes estimates"}
          detail={getRelativeTime(lastUpdated)}
          tone="warning"
          compact
        />
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
      <StatusBadge
        label="Wallet data live"
        detail={getRelativeTime(lastUpdated)}
        tone="ready"
        compact
      />
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
