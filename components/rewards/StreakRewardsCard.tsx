/**
 * StreakRewardsCard - GoodDollar $G access display
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Uses existing InsightCard component
 * - DRY: Consumes useStreakRewards hook (single source of truth)
 * - CLEAN: Presentation layer only, no business logic
 * - MODULAR: Self-contained, can be placed in any tab
 * - NEUTRAL: No judgment on swap strategy
 */

import React, { useState } from 'react';
import { InsightCard } from '../shared/TabComponents';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { useWalletContext } from '../wallet/WalletProvider';
import dynamic from 'next/dynamic';

// Lazy load claim flow for better performance
const GoodDollarClaimFlow = dynamic(() => import('../gooddollar/GoodDollarClaimFlow'), {
  ssr: false,
});

interface StreakRewardsCardProps {
  onSaveClick?: () => void;
  className?: string;
}

export function StreakRewardsCard({ onSaveClick }: StreakRewardsCardProps) {
  const { isConnected } = useWalletContext();
  const {
    streak,
    canClaim,
    isEligible,
    estimatedReward,
    nextClaimTime,
    isLoading,
  } = useStreakRewards();

  const [showClaimFlow, setShowClaimFlow] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  // Calculate time until next claim
  const formatTimeUntil = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return 'Available now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Reset dismissed state when claim becomes available
  React.useEffect(() => {
    if (canClaim) {
      setIsDismissed(false);
      setIsCompact(false);
    }
  }, [canClaim]);

  // If dismissed, show minimal restore button
  if (isDismissed) {
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="w-full p-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">💚</span>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">G$ Streak Hidden</span>
        </div>
        <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">Show →</span>
      </button>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <InsightCard
        icon="💰"
        title="Daily G$ Access"
        description="Connect your wallet to unlock free daily G$ through platform usage"
        variant="default"
      />
    );
  }

  // No streak yet - prompt to swap with progress tracking
  if (!isEligible) {
    // Check if user has made any swaps today (from localStorage)
    const todaySwaps = typeof window !== 'undefined'
      ? parseFloat(localStorage.getItem(`diversifi_today_swaps_${Date.now().toString().slice(0, 8)}`) || '0')
      : 0;

    const remaining = Math.max(0, 1 - todaySwaps);
    const progress = Math.min(100, (todaySwaps / 1) * 100);

    return (
      <InsightCard
        icon="🔓"
        title="Unlock Daily G$ Claim"
        description={
          todaySwaps > 0
            ? `You've swapped ${todaySwaps.toFixed(2)} today. Swap ${remaining.toFixed(2)} more to unlock your free daily G$ claim!`
            : "Swap $1+ today to unlock your free daily G$ claim from GoodDollar"
        }
        impact={todaySwaps > 0 ? `${progress.toFixed(0)}% to unlock` : "Free daily UBI"}
        action={
          onSaveClick
            ? {
              label: todaySwaps > 0 ? `Swap ${remaining.toFixed(2)} More` : 'Make a Swap',
              onClick: onSaveClick,
            }
            : undefined
        }
        variant="default"
      />
    );
  }

  // Compact mode - after claiming, show minimal state
  if (isCompact && !canClaim && isEligible) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsCompact(false)}
          className="w-full p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900/20 dark:hover:to-yellow-900/20 rounded-lg border border-amber-200 dark:border-amber-900/30 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div className="text-left">
              <div className="text-sm font-black text-amber-700 dark:text-amber-400">
                {streak?.daysActive || 0}-Day Streak
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-500">
                {nextClaimTime ? `Next claim in ${formatTimeUntil(nextClaimTime)}` : 'Keep it alive!'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">Expand</span>
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="absolute top-1 right-1 p-1 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
          title="Hide until next claim"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Has streak - show claim status (full card)
  return (
    <>
      <div className="relative">
        <InsightCard
          icon={canClaim ? '💚' : '🔥'}
          title={canClaim ? 'Claim Your G$' : `${streak?.daysActive || 0}-Day Streak`}
          description={
            canClaim
              ? `Your daily G$ is ready! Claim ${estimatedReward} now to keep your streak alive.`
              : `Swap $1+ to maintain your streak and unlock your daily G$ claim.`
          }
          impact={canClaim ? estimatedReward : `${streak?.daysActive} days active`}
          action={
            canClaim
              ? {
                label: 'Claim G$',
                onClick: () => setShowClaimFlow(true),
                loading: isLoading,
              }
              : nextClaimTime
                ? {
                  label: `Next claim in ${formatTimeUntil(nextClaimTime)}`,
                  onClick: () => { },
                  disabled: true,
                }
                : undefined
          }
          variant={canClaim ? 'reward' : 'success'}
        />
        {/* Minimize/Dismiss buttons - only show when not claimable */}
        {!canClaim && isEligible && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => setIsCompact(true)}
              className="p-1.5 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shadow-sm"
              title="Minimize"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shadow-sm"
              title="Hide until next claim"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Milestone Progress - Show next achievement */}
      {isEligible && streak && streak.daysActive > 0 && !isCompact && (
        <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 rounded-lg border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">
                {streak.daysActive < 7 ? '🔥 Next: 7-Day Badge' :
                  streak.daysActive < 30 ? '🏆 Next: 30-Day Badge' :
                    streak.daysActive < 100 ? '💎 Next: 100-Day Badge' :
                      streak.daysActive < 365 ? '👑 Next: 365-Day Badge' :
                        '👑 Legend Status!'}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-500">
                {streak.daysActive < 7 ? `${7 - streak.daysActive} days to go` :
                  streak.daysActive < 30 ? `${30 - streak.daysActive} days to go` :
                    streak.daysActive < 100 ? `${100 - streak.daysActive} days to go` :
                      streak.daysActive < 365 ? `${365 - streak.daysActive} days to go` :
                        'All milestones achieved!'}
              </div>
            </div>
            <div className="text-2xl">
              {streak.daysActive < 7 ? '🔥' :
                streak.daysActive < 30 ? '🏆' :
                  streak.daysActive < 100 ? '💎' :
                    streak.daysActive < 365 ? '👑' : '✨'}
            </div>
          </div>
        </div>
      )}

      {/* Claim Flow Modal */}
      {showClaimFlow && (
        <GoodDollarClaimFlow
          onClose={() => setShowClaimFlow(false)}
          onClaimSuccess={() => {
            // Could trigger confetti or other celebration
            console.log('[StreakRewards] Claim successful!');
          }}
        />
      )}
    </>
  );
}

// Social proof stats - shows community activity
export function RewardsStats({ className = '' }: { className?: string }) {
  const [stats, setStats] = React.useState({
    todayClaims: 0,
    totalClaimed: '0',
    activeStreaks: 0,
    topStreak: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/streaks/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('[RewardsStats] Failed to fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className={`grid grid-cols-3 gap-2 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 animate-pulse">
            <div className="h-6 bg-green-200 dark:bg-green-800 rounded mb-1" />
            <div className="h-3 bg-green-100 dark:bg-green-900 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Threshold: Don't show social proof if it's "social disproof" (too few users)
  // We want to see at least 5 active streakers before surfacing this.
  if (stats.activeStreaks < 5) {
    return null;
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700 dark:text-green-300">{stats.todayClaims}</div>
        <div className="text-xs text-green-600 dark:text-green-400">Claims today</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700 dark:text-green-300">{stats.totalClaimed}</div>
        <div className="text-xs text-green-600 dark:text-green-400">G$ earned</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700 dark:text-green-300">{stats.activeStreaks}</div>
        <div className="text-xs text-green-600 dark:text-green-400">Active streaks</div>
      </div>
    </div>
  );
}
