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

import React, { useState, useEffect } from 'react';
import { CompactStreakBanner } from './streak/CompactStreakBanner';
import { MilestoneProgress } from './streak/MilestoneProgress';
import { StreakProgressVisualizer } from './streak/StreakProgressVisualizer';
import { InsightCard } from '../shared/TabComponents';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { useWalletContext } from '../wallet/WalletProvider';
import { AchievementBadge, AchievementToast, ACHIEVEMENTS, type Badge } from './AchievementBadge';
import { NETWORKS } from '../../config';
import dynamic from 'next/dynamic';

const DISMISSED_KEY = 'diversifi_streak_dismissed';

// Lazy load claim flow for better performance
const GoodDollarClaimFlow = dynamic(() => import('../gooddollar/GoodDollarClaimFlow'), {
  ssr: false,
});

// Lazy load graduation modal
const GraduationModal = dynamic(() => import('./GraduationModal'), {
  ssr: false,
});

const DISMISSED_KEY_EXPORT = 'diversifi_streak_dismissed';

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
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">G$ Streak Hidden</span>
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
  const { isConnected, switchNetwork } = useWalletContext();
  const {
    streak,
    canClaim,
    isEligible,
    isWhitelisted,
    entitlement,
    estimatedReward,
    nextClaimTime,
    verifyIdentity,
    isLoading,
    crossChainActivity,
    achievements,
    newlyEarnedAchievements,
    eligibleForGraduation,
  } = useStreakRewards();

  const [showClaimFlow, setShowClaimFlow] = useState(false);
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  // Start compact when an active streak exists but claiming isn't available yet —
  // prevents the card from occupying full height in the banner stack by default.
  // The useEffect below auto-expands it as soon as canClaim becomes true.
  const [isCompact, setIsCompact] = useState(true);
  const [pendingToast, setPendingToast] = useState<Badge | null>(null);

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

  // Toast for newly earned achievements (computed in hook/module).
  useEffect(() => {
    if (newlyEarnedAchievements.length === 0) return;
    const badge = ACHIEVEMENTS.find(b => b.id === newlyEarnedAchievements[0]);
    if (badge) setPendingToast(badge);
  }, [newlyEarnedAchievements]);

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

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await verifyIdentity();
      // Keep loading for a bit while they are redirected
      setTimeout(() => setIsVerifying(false), 5000);
    } catch {
      setIsVerifying(false);
    }
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

  // No streak yet — enhance the existing InsightCard with a secondary testnet link.
  // Deliberately ONE card (PREVENT BLOAT / ENHANCEMENT FIRST).
  if (!isEligible) {
    return (
      <>
        <InsightCard
          icon="🌱"
          title="Unlock Daily G$"
          description="Swap $1+ to unlock your free daily G$ UBI claim and earn your First Swap badge."
          impact="Free daily UBI"
          action={
            onSaveClick
              ? { label: 'Make a Swap →', onClick: onSaveClick }
              : undefined
          }
          variant="default"
        >
          {/* Secondary option — one line, no new card */}
          <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Not ready to use real money?</span>
            <button
              onClick={() => switchNetwork?.(NETWORKS.ALFAJORES.chainId)}
              className="text-[10px] font-black text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
            >
              🧪 Try Testnet →
            </button>
          </div>
        </InsightCard>

        {pendingToast && (
          <AchievementToast badge={pendingToast} onClose={() => setPendingToast(null)} />
        )}
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
  return (
    <>
      <div className="relative">
        <InsightCard
          icon={!isWhitelisted ? '🛡️' : (canClaim ? '💚' : '🔥')}
          title={!isWhitelisted ? 'Verification Required' : (canClaim ? 'Claim Your G$' : `${streak?.daysActive || 0}-Day Streak`)}
          description={
            !isWhitelisted
              ? "Your streak is active! Now complete face verification on GoodDollar to start claiming your daily UBI."
              : canClaim
                ? `Your daily G$ is ready! Claim ${entitlement !== '0' ? entitlement + ' G$' : estimatedReward} now.`
                : `Swap $1+ to maintain your streak and unlock your daily G$ claim.`
          }
          impact={!isWhitelisted ? "Identity Pending" : (canClaim ? (entitlement !== '0' ? entitlement + ' G$' : estimatedReward) : `${streak?.daysActive} days active`)}
          action={
            !isWhitelisted
              ? {
                label: 'Verify with Face Scan',
                onClick: handleVerify,
                loading: isVerifying,
              }
              : canClaim
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
          variant={!isWhitelisted ? 'urgent' : (canClaim ? 'reward' : 'success')}
        >
          {/* Enhanced Streak Visualizer */}
          {isEligible && streak && isWhitelisted && (
            <StreakProgressVisualizer daysActive={streak.daysActive} />
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

      {/* Milestone Progress - Show next achievement */}
      {isEligible && streak && streak.daysActive > 0 && !isCompact && (
        <MilestoneProgress daysActive={streak.daysActive} />
      )}

      {/* Test Drive Teaser — shown when user has a streak but hasn't tried testnet yet */}
      {isEligible && !isCompact && crossChainActivity &&
        crossChainActivity.testnet.totalSwaps === 0 &&
        crossChainActivity.testnet.totalClaims === 0 &&
        !crossChainActivity.graduation.isGraduated && (
        <div className="mt-3 p-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 rounded-lg border border-violet-200 dark:border-violet-900/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🧪</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-1">
                Test Drive Available
              </div>
              <p className="text-[10px] text-violet-600 dark:text-violet-500 leading-relaxed mb-2">
                Explore 3 testnets risk-free. Earn badges. Graduate to mainnet when ready.
              </p>
              {/* Direct network switch — one tap, no chain-selector hunting */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => switchNetwork?.(NETWORKS.ALFAJORES.chainId)}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black rounded-lg transition-colors active:scale-95"
                >
                  🧪 Try Testnet →
                </button>
                <a
                  href="https://faucet.celo.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-violet-500 dark:text-violet-400 hover:underline"
                >
                  Get free funds →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Chain Activity & Achievements — shown once testnet activity exists */}
      {crossChainActivity && (crossChainActivity.testnet.totalSwaps > 0 || crossChainActivity.testnet.totalClaims > 0) && !isCompact && (
        <div className="mt-3 p-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10 rounded-lg border border-violet-200 dark:border-violet-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-violet-700 dark:text-violet-400 uppercase tracking-wider">
              Test Drive Progress
            </span>
            {achievements.length > 0 && (
              <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                {achievements.length} 🏆
              </span>
            )}
          </div>
          
          {/* Chain badges */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {crossChainActivity.testnet.chainsUsed.includes(NETWORKS.ALFAJORES.chainId) && (
              <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-bold rounded-full">Alfajores</span>
            )}
            {crossChainActivity.testnet.chainsUsed.includes(NETWORKS.ARC_TESTNET.chainId) && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-full">Arc</span>
            )}
            {crossChainActivity.testnet.chainsUsed.includes(NETWORKS.RH_TESTNET.chainId) && (
              <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[10px] font-bold rounded-full">Robinhood</span>
            )}
            {crossChainActivity.graduation.isGraduated && (
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full">Mainnet 🚀</span>
            )}
          </div>

          {/* Achievement badges */}
          {achievements.length > 0 && (
            <div className="mb-3">
              <AchievementBadge achievementIds={achievements} compact />
            </div>
          )}

          {/* Graduation CTA */}
          {eligibleForGraduation && !crossChainActivity.graduation.isGraduated && (
            <button
              onClick={() => setShowGraduationModal(true)}
              className="w-full py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all"
            >
              🎓 Graduate to Mainnet
            </button>
          )}
        </div>
      )}

      {/* Claim Flow Modal */}
      {showClaimFlow && (
        <GoodDollarClaimFlow
          onClose={() => setShowClaimFlow(false)}
          onClaimSuccess={() => setShowClaimFlow(false)}
        />
      )}

      {/* Graduation Modal */}
      {showGraduationModal && (
        <GraduationModal
          isOpen={showGraduationModal}
          onClose={() => setShowGraduationModal(false)}
          onGraduate={() => {
            setShowGraduationModal(false);
          }}
        />
      )}

      {/* Achievement toast — portal-rendered so it overlays correctly */}
      {pendingToast && (
        <AchievementToast
          badge={pendingToast}
          onClose={() => setPendingToast(null)}
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
