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
import { useStreakRewards, STREAK_CONFIG } from '../../hooks/use-streak-rewards';
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

  // No streak yet - prompt to swap
  if (!isEligible) {
    return (
      <InsightCard
        icon="🔓"
        title="Unlock Daily G$ Claim"
        description="Swap $1+ today to unlock your free daily G$ claim from GoodDollar"
        impact="Free daily UBI"
        action={
          onSaveClick
            ? {
              label: 'Make a Swap',
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
    <>
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
  // TODO: Fetch from backend or subgraph
  const mockStats = {
    todayClaims: 47,
    totalClaimed: '12,450',
    activeStreaks: 156,
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700 dark:text-green-300">{mockStats.todayClaims}</div>
        <div className="text-xs text-green-600 dark:text-green-400">Claims today</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700 dark:text-green-300">{mockStats.totalClaimed}</div>
        <div className="text-xs text-green-600 dark:text-green-400">G$ earned</div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
        <div className="text-lg font-bold text-green-700 dark:text-green-300">{mockStats.activeStreaks}</div>
        <div className="text-xs text-green-600 dark:text-green-400">Active streaks</div>
      </div>
    </div>
  );
}
