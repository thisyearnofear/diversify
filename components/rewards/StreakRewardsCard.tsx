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

import React, { useState, useRef, useEffect } from 'react';
import { InsightCard } from '../shared/TabComponents';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { useWalletContext } from '../wallet/WalletProvider';
import { AchievementBadge, AchievementToast, ACHIEVEMENTS, type Badge } from './AchievementBadge';
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

interface StreakRewardsCardProps {
  onSaveClick?: () => void;
  className?: string;
}

export function StreakRewardsCard({ onSaveClick }: StreakRewardsCardProps) {
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
    eligibleForGraduation,
  } = useStreakRewards();

  const [showClaimFlow, setShowClaimFlow] = useState(false);
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
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

  // Watch for newly earned achievements and surface a toast notification.
  // BUGFIX: initialise ref to the CURRENT achievements on first mount so we
  // don't fire a toast for every achievement the user has already earned when
  // the page first loads.
  const prevAchievementsRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (prevAchievementsRef.current === null) {
      // First run — seed with current value so we only toast for future badges
      prevAchievementsRef.current = achievements;
      return;
    }
    const prev = prevAchievementsRef.current;
    const newOnes = achievements.filter(id => !prev.includes(id));
    if (newOnes.length > 0) {
      const badge = ACHIEVEMENTS.find(b => b.id === newOnes[0]);
      if (badge) setPendingToast(badge);
    }
    prevAchievementsRef.current = achievements;
  }, [achievements]);

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

  // No streak yet — show the full onboarding journey card
  if (!isEligible) {
    const noTestnetActivity =
      !crossChainActivity ||
      (crossChainActivity.testnet.totalSwaps === 0 &&
        crossChainActivity.testnet.totalClaims === 0 &&
        !crossChainActivity.graduation.isGraduated);

    return (
      <div className="space-y-3">
        {/* Journey card */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl mt-0.5">🌱</span>
            <div>
              <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-300 mb-0.5">
                Your DiversiFi Journey
              </h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                3 steps to daily G$ UBI + achievements
              </p>
            </div>
          </div>

          {/* Step list */}
          <div className="space-y-2">
            {[
              {
                n: '1',
                icon: '🔄',
                label: 'Make your first swap ($1+)',
                sublabel: 'Unlocks daily G$ claim + First Swap badge',
                done: false,
              },
              {
                n: '2',
                icon: '🛡️',
                label: 'Verify identity on GoodDollar',
                sublabel: 'Required to receive real G$ tokens',
                done: false,
              },
              {
                n: '3',
                icon: '💚',
                label: 'Claim your daily G$',
                sublabel: 'Free UBI, every 24 hours',
                done: false,
              },
            ].map((step) => (
              <div
                key={step.n}
                className="flex items-start gap-2.5 p-2 bg-white/60 dark:bg-black/20 rounded-lg"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">{step.n}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{step.icon}</span>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{step.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{step.sublabel}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {onSaveClick && (
            <button
              onClick={onSaveClick}
              className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition-colors"
            >
              Start with a Swap →
            </button>
          )}
        </div>

        {/* Test Drive teaser — show to all users, not just post-streak */}
        {noTestnetActivity && (
          <div className="p-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 rounded-xl border border-violet-200 dark:border-violet-900/30">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🧪</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-black text-violet-700 dark:text-violet-400 uppercase tracking-wider">
                    Not ready to commit?
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded font-bold uppercase">
                    Free
                  </span>
                </div>
                <p className="text-[10px] text-violet-600 dark:text-violet-500 leading-relaxed mb-2">
                  Try Test Drive on Alfajores — real swaps, no real money. Switch network in the chain selector above.
                </p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: '🧪 Alfajores', href: 'https://faucet.celo.org' },
                    { label: '⚡ Arc', href: 'https://faucet.circle.com' },
                    { label: '📈 Robinhood', href: 'https://faucet.testnet.chain.robinhood.com' },
                  ].map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[10px] font-bold rounded-full hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Achievement toast */}
        {pendingToast && (
          <AchievementToast
            badge={pendingToast}
            onClose={() => setPendingToast(null)}
          />
        )}
      </div>
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
      </div>
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
            <div className="mt-2 py-3 px-4 bg-white/40 dark:bg-black/20 rounded-xl backdrop-blur-sm border border-black/5">
              <div className="flex justify-between items-end mb-2">
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                  Streak Progress
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {streak.daysActive} Days
                </div>
              </div>
              
              <div className="flex gap-1.5 h-2">
                {[...Array(7)].map((_, i) => {
                  const dayIndex = (streak.daysActive - 1) % 7;
                  const isActive = i <= dayIndex;
                  const isCurrent = i === dayIndex;
                  
                  return (
                    <div 
                      key={i} 
                      className={`flex-1 rounded-full transition-all duration-500 ${
                        isActive 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                          : 'bg-gray-200 dark:bg-gray-800'
                      } ${isCurrent ? 'animate-pulse scale-y-125' : ''}`}
                    />
                  );
                })}
              </div>
              
              <div className="flex justify-between mt-2">
                <span className="text-[9px] text-gray-400 font-bold">DAY 1</span>
                <span className="text-[9px] text-gray-400 font-bold">GOAL: 7 DAYS</span>
              </div>
            </div>
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
              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  { label: 'Alfajores', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400' },
                  { label: 'Arc', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
                  { label: 'Robinhood', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
                ].map(({ label, color }) => (
                  <span key={label} className={`px-2 py-0.5 ${color} text-[10px] font-bold rounded-full`}>{label}</span>
                ))}
              </div>
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-black text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
              >
                Get free testnet funds → faucet.circle.com
              </a>
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
            {crossChainActivity.testnet.chainsUsed.includes(44787) && (
              <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-bold rounded-full">Alfajores</span>
            )}
            {crossChainActivity.testnet.chainsUsed.includes(5042002) && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-full">Arc</span>
            )}
            {crossChainActivity.testnet.chainsUsed.includes(46630) && (
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
          onClaimSuccess={() => {
            console.log('[StreakRewards] Claim successful!');
          }}
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
