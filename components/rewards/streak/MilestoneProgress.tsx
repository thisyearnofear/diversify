import React from 'react';

export function MilestoneProgress({ daysActive }: { daysActive: number }) {
  if (daysActive <= 0) return null;

  const title =
    daysActive < 7
      ? '🔥 Next: 7-Day Badge'
      : daysActive < 30
        ? '🏆 Next: 30-Day Badge'
        : daysActive < 100
          ? '💎 Next: 100-Day Badge'
          : daysActive < 365
            ? '👑 Next: 365-Day Badge'
            : '👑 Legend Status!';

  const sub =
    daysActive < 7
      ? `${7 - daysActive} days to go`
      : daysActive < 30
        ? `${30 - daysActive} days to go`
        : daysActive < 100
          ? `${100 - daysActive} days to go`
          : daysActive < 365
            ? `${365 - daysActive} days to go`
            : 'All milestones achieved!';

  const emoji =
    daysActive < 7
      ? '🔥'
      : daysActive < 30
        ? '🏆'
        : daysActive < 100
          ? '💎'
          : daysActive < 365
            ? '👑'
            : '✨';

  return (
    <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 rounded-lg border border-amber-200 dark:border-amber-900/30">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">{title}</div>
          <div className="text-xs text-amber-600 dark:text-amber-500">{sub}</div>
        </div>
        <div className="text-2xl">{emoji}</div>
      </div>
    </div>
  );
}
