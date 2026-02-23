import React from 'react';

export function CompactStreakBanner({
  daysActive,
  nextClaimLabel,
  onExpand,
}: {
  daysActive: number;
  nextClaimLabel: string;
  onExpand: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onExpand}
        className="w-full p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900/20 dark:hover:to-yellow-900/20 rounded-lg border border-amber-200 dark:border-amber-900/30 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div className="text-left">
            <div className="text-sm font-black text-amber-700 dark:text-amber-400">
              {daysActive}-Day Streak
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-500">{nextClaimLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
            Expand
          </span>
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
    </div>
  );
}
