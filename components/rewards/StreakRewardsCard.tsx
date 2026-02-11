/**
 * StreakRewardsCard - GoodDollar $G rewards display
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Uses existing InsightCard component
 * - DRY: Consumes useStreakRewards hook (single source of truth)
 * - CLEAN: Presentation layer only, no business logic
 * - MODULAR: Self-contained, can be placed in any tab
 */

import React from 'react';
import { InsightCard } from '../shared/TabComponents';
import { useStreakRewards, STREAK_CONFIG } from '../../hooks/use-streak-rewards';
import { useAccount } from 'wagmi';

interface StreakRewardsCardProps {
  onSaveClick?: () => void;
  className?: string;
}

export function StreakRewardsCard({ onSaveClick, className = '' }: StreakRewardsCardProps) {
  const { isConnected } = useAccount();
  const {
    streak,
    canClaim,
    isEligible,
    estimatedReward,
    nextClaimTime,
    claimG,
  } = useStreakRewards();

  // Not connected state
  if (!isConnected) {
    return (
      <InsightCard
        icon="💰"
        title="Daily Rewards"
        description="Connect your wallet to start earning $G for saving"
        variant="default"
      />
    );
  }

  // No streak yet - prompt to save
  if (!isEligible) {
    return (
      <InsightCard
        icon="🔓"
        title="Unlock Daily Rewards"
        description={`Save $${STREAK_CONFIG.MIN_SAVE_USD}+ today to unlock free daily $G rewards from GoodDollar`}
        impact="Free daily UBI"
        action={
          onSaveClick
            ? {
                label: 'Start Saving',
                onClick: onSaveClick,
              }
            : undefined
        }
        variant="default"
      />
    );
  }

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

  // Has streak - show claim status
  return (
    <InsightCard
      icon={canClaim ? '💚' : '🔥'}
      title={canClaim ? 'Claim Your $G' : `${streak?.daysActive || 0}-Day Streak`}
      description={
        canClaim
          ? `Your daily $G reward is ready! Claim now to keep your streak alive.`
          : `Save $${STREAK_CONFIG.MIN_SAVE_USD}+ to maintain your streak and unlock your daily claim.`
      }
      impact={canClaim ? estimatedReward : `${streak?.daysActive} days active`}
      action={
        canClaim
          ? {
              label: 'Claim $G',
              onClick: claimG,
              loading: isLoading,
            }
          : nextClaimTime
          ? {
              label: `Next claim in ${formatTimeUntil(nextClaimTime)}`,
              onClick: () => {},
              disabled: true,
            }
          : undefined
      }
      variant={canClaim ? 'reward' : 'success'}
    />
  );
}

// Social proof stats - shows community activity
export function RewardsStats({ className = '' }: { className?: string }) {
  // TODO: Fetch from backend or subgraph
  const mockStats = {
    todayClaims: 47,
    totalClaimed: '12,450',
    activeStreaks: 156,
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <div className="bg-green-50 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700">{mockStats.todayClaims}</div>
        <div className="text-[10px] text-green-600">Claims today</div>
      </div>
      <div className="bg-green-50 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700">{mockStats.totalClaimed}</div>
        <div className="text-[10px] text-green-600">$G earned</div>
      </div>
      <div className="bg-green-50 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700">{mockStats.activeStreaks}</div>
        <div className="text-[10px] text-green-600">Active streaks</div>
      </div>
    </div>
  );
}

