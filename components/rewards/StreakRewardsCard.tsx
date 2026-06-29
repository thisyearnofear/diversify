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
import { CompactStreakBanner } from './streak/CompactStreakBanner';
import { StreakProgressVisualizer } from './streak/StreakProgressVisualizer';
import { InsightCard } from '../shared/TabComponents';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { useClaimFlowContext } from '../../hooks/claim-flow-context';
import { useWalletContext } from '../wallet/WalletProvider';

const DISMISSED_KEY = 'diversifi_streak_dismissed';

/**
 * StreakRewardsSection — lightweight gateway wrapper.
 *
 * Reads the dismissed flag from localStorage BEFORE mounting StreakRewardsCard
 * so that useStreakRewards() is never called when the user has permanently
 * hidden the card. When dismissed, shows a one-line restore affordance.
 */
export function StreakRewardsSection({ onSaveClick }: { onSaveClick?: () => void }) {
  const [isDismissed, setIsDismissed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY_EXPORT) === '1';
  });

  if (isDismissed) {
    return (
      <button
        onClick={() => {
          setIsDismissed(false);
          if (typeof window !== 'undefined') localStorage.removeItem(DISMISSED_KEY_EXPORT);
        }}
        className="w-full p-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">💚</span>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Welcome Bonus Hidden</span>
        </div>
        <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">Show →</span>
      </button>
    );
  }

  return (
    <StreakRewardsCard
      onSaveClick={onSaveClick}
      onDismiss={() => {
        setIsDismissed(true);
        if (typeof window !== 'undefined') localStorage.setItem(DISMISSED_KEY_EXPORT, '1');
      }}
    />
  );
}

interface StreakRewardsCardProps {
  onSaveClick?: () => void;
  className?: string;
  /** Called when the user clicks the dismiss / hide button inside the card */
  onDismiss?: () => void;
}

export function StreakRewardsCard({ onSaveClick, onDismiss }: StreakRewardsCardProps) {
  const { isConnected, chainId } = useWalletContext();
  const {
    streak,
    canClaim,
    isEligible,
    isWhitelisted,
    entitlement,
    estimatedReward,
    nextClaimTime,
    refresh,
    isLoading,
  } = useStreakRewards();

  // Claim/verify state machine shared from app-level context.
  const flow = useClaimFlowContext();
  const { claimStatus, claimError, verifyStatus, handleClaim, handleVerify } = flow;

  // Start compact when an active streak exists but claiming isn't available yet —
  // prevents the card from occupying full height in the banner stack by default.
  const [isCompact, setIsCompact] = useState(true);

  // Persist isDismissed to localStorage so it survives page refresh
  const [isDismissed, setIsDismissedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY) === '1';
  });

  const setIsDismissed = (value: boolean) => {
    setIsDismissedState(value);
    if (typeof window !== 'undefined') {
      if (value) {
        localStorage.setItem(DISMISSED_KEY, '1');
      } else {
        localStorage.removeItem(DISMISSED_KEY);
      }
    }
  };

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
    if (canClaim && isWhitelisted) {
      setIsDismissed(false);
      setIsCompact(false);
    }
  }, [canClaim, isWhitelisted]);

  // If dismissed, show minimal restore button
  if (isDismissed) {
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="w-full p-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">💚</span>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Welcome Bonus Hidden</span>
        </div>
        <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">Show →</span>
      </button>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <InsightCard
        icon="💚"
        title="Celo Welcome Bonus"
        description="Connect your wallet to earn free G$ tokens daily on Celo"
        variant="default"
      />
    );
  }

  // No streak yet — one InsightCard, G$ carrot only. Testnet teases live in
  // the graduation system, not here.
  if (!isEligible) {
    return (
      <>
        <InsightCard
          icon="🌱"
          title="Unlock Daily G$"
          description="Swap $1+ to activate daily G$ rewards. Requires one-time face verification on GoodDollar."
          impact="Daily G$ rewards"
          action={
            onSaveClick
              ? { label: 'Make a Swap →', onClick: onSaveClick }
              : undefined
          }
          variant="default"
        />
      </>
    );
  }

  // Compact mode - after claiming, show minimal state
  if (isCompact && !canClaim && isEligible) {
    return (
      <CompactStreakBanner
        daysActive={streak?.daysActive || 0}
        nextClaimLabel={
          nextClaimTime ? `Next claim in ${formatTimeUntil(nextClaimTime)}` : 'Keep it alive!'
        }
        onExpand={() => setIsCompact(false)}
      />
    );
  }

  // Has streak - show claim status (full card)
  const rewardLabel = entitlement !== '0' ? `${entitlement} G$` : estimatedReward;
  const claimButtonLabel =
    claimStatus === 'claiming'
      ? 'Claiming...'
      : canClaim
        ? 'Claim G$'
        : nextClaimTime
          ? `Next claim in ${formatTimeUntil(nextClaimTime)}`
          : 'Unlock Daily G$';
  const verifyButtonLabel =
    verifyStatus === 'opening'
      ? 'Opening Verification...'
      : verifyStatus === 'awaiting'
        ? 'Awaiting Approval...'
        : 'Verify with Face Scan';

  return (
    <>
      <div className="relative">
        <InsightCard
          icon={!isWhitelisted ? '🛡️' : (canClaim ? '💚' : '🔥')}
          title={
            !isWhitelisted
              ? verifyStatus === 'awaiting'
                ? 'Awaiting Verification'
                : 'Verification Required'
              : canClaim
                ? 'Claim Your G$'
                : `Day ${streak?.daysActive || 1} Bonus`
          }
          description={
            !isWhitelisted
              ? verifyStatus === 'awaiting'
                ? 'Complete face verification on GoodDollar, then return here. We check automatically when you come back.'
                : "Verify once on GoodDollar to start claiming your daily UBI. Takes about a minute."
              : canClaim
                ? `Your daily G$ is ready — claim ${rewardLabel} now.`
                : `Swap $1+ to unlock tomorrow's bonus.`
          }
          impact={!isWhitelisted ? (verifyStatus === 'awaiting' ? 'Checking every 30s' : 'Identity Pending') : (canClaim ? rewardLabel : `Day ${streak?.daysActive} streak`)}
          action={
            !isWhitelisted
              ? {
                label: verifyButtonLabel,
                onClick: verifyStatus === 'awaiting' ? () => void refresh() : handleVerify,
                loading: verifyStatus === 'opening' || verifyStatus === 'awaiting',
                disabled: verifyStatus === 'awaiting',
              }
              : canClaim
                ? {
                  label: claimButtonLabel,
                  onClick: handleClaim,
                  loading: claimStatus === 'claiming',
                }
                : nextClaimTime
                  ? {
                    label: claimButtonLabel,
                    onClick: () => { },
                    disabled: true,
                  }
                  : undefined
          }
          variant={!isWhitelisted ? 'urgent' : (canClaim ? 'reward' : 'success')}
        >
          {/* Enhanced Streak Visualizer */}
          {isEligible && streak && isWhitelisted && (
            <StreakProgressVisualizer daysActive={streak.daysActive} />
          )}

          {/* Inline claim error — disappears after 6s */}
          {claimStatus === 'error' && claimError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
              <span className="text-sm">⚠️</span>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed flex-1">
                {claimError}
              </p>
            </div>
          )}

          {/* Faucet footnote — first-time claimers may need a free CELO top-up */}
          {canClaim && claimStatus !== 'claiming' && (
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 text-center">
              Free to claim · first time may sign a one-time gas top-up
            </p>
          )}
        </InsightCard>
        
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
              onClick={() => onDismiss ? onDismiss() : setIsDismissed(true)}
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
        <div className="text-xs text-green-600 dark:text-green-400">Active savers</div>
      </div>
    </div>
  );
}
