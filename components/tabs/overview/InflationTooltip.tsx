import React, { useState } from "react";

export function InflationTooltip() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="text-gray-400 hover:text-blue-500 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
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
      </button>
      {showTooltip && (
        <div className="absolute z-50 left-0 bottom-full mb-2 w-48 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl">
          <p className="font-bold mb-1">📊 Data Source</p>
          <p className="opacity-80">Based on IMF & World Bank CPI data. Updated periodically.</p>
          <div className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
        </div>
      )}
    </div>
  );
}
