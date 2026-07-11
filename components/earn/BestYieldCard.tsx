import React from 'react';
import { Card } from '../shared/TabComponents';
import { useBestYield, type BestYieldRecommendation } from '../../hooks/use-best-yield';

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  'vaults.fyi': { label: 'Personalized', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  gmx: { label: 'GMX pool', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  free: { label: 'Live', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
};

function sourceOf(rec: BestYieldRecommendation) {
  const s = rec.metadata?.source;
  return s === 'vaults.fyi' ? SOURCE_BADGE['vaults.fyi'] : s === 'gmx' ? SOURCE_BADGE.gmx : SOURCE_BADGE.free;
}

interface BestYieldCardProps {
  userAddress: string | null;
  savedUsd?: number;
  streakDays?: number;
  className?: string;
}

/**
 * "Best yield for you" — the personalized layer (vaults.fyi + GMX + free LI.FI)
 * on top of the free YieldDiscoverySection. Free-tier users see the free yields
 * plus an unlock prompt for the personalized layer (earned by saving OR usage).
 */
export function BestYieldCard({ userAddress, savedUsd, streakDays, className = '' }: BestYieldCardProps) {
  const { data, isLoading, error } = useBestYield(userAddress, { savedUsd, streakDays });

  if (!userAddress) return null;
  if (isLoading && !data) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-3" />
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      </Card>
    );
  }
  if (error || !data || data.recommendations.length === 0) return null;

  const recs = data.recommendations.slice(0, 4);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-gray-900 dark:text-white">Best yield for you</h3>
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{data.tierLabel}</span>
      </div>

      <ul className="space-y-2" aria-label="Best yield opportunities">
        {recs.map((rec) => {
          const badge = sourceOf(rec);
          const apy = typeof rec.metadata?.apy === 'number' ? rec.metadata.apy : null;
          return (
            <li key={rec.id} className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{rec.title}</p>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{rec.description}</p>
              </div>
              {apy != null && (
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{apy.toFixed(1)}%</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">APY</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!data.paidUnlocked && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 p-2">
          🔓 Save $100 or keep a 7-day streak to unlock <strong>personalized</strong> best-yield picks across 1,000+ vaults.
        </p>
      )}
    </Card>
  );
}
