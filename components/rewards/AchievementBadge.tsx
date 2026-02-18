/**
 * AchievementBadge - Gamification badges for test drive engagement
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Extends existing rewards system
 * - CONSOLIDATION: Located in rewards/ domain
 * - DRY: Uses useStreakRewards hook
 * - CLEAN: Presentation layer only
 */

import React from 'react';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

// Achievement definitions
export const ACHIEVEMENTS: Badge[] = [
  { id: 'first-swap', name: 'First Swap', description: 'Completed your first swap', icon: '🔄', color: 'from-emerald-500 to-teal-500', rarity: 'common' },
  { id: 'multi-chain-explorer', name: 'Multi-Chain Explorer', description: 'Used 2+ testnet chains', icon: '⛓️', color: 'from-blue-500 to-indigo-500', rarity: 'rare' },
  { id: 'speed-demon', name: 'Speed Demon', description: 'Tested on Arc', icon: '⚡', color: 'from-amber-500 to-orange-500', rarity: 'rare' },
  { id: 'stock-trader', name: 'Stock Trader', description: 'Traded on Robinhood', icon: '📈', color: 'from-violet-500 to-purple-500', rarity: 'rare' },
  { id: 'mento-master', name: 'Mento Master', description: 'Used Alfajores', icon: '💱', color: 'from-cyan-500 to-blue-500', rarity: 'common' },
  { id: 'power-tester', name: 'Power Tester', description: '5+ testnet actions', icon: '🧪', color: 'from-pink-500 to-rose-500', rarity: 'epic' },
  { id: 'volume-trader', name: 'Volume Trader', description: '$100+ testnet volume', icon: '💰', color: 'from-amber-500 to-yellow-500', rarity: 'epic' },
  { id: 'daily-claimer', name: 'Daily Claimer', description: '3+ G$ claims', icon: '💚', color: 'from-green-500 to-emerald-500', rarity: 'common' },
  { id: 'ready-to-graduate', name: 'Ready to Graduate', description: 'Eligible for mainnet', icon: '🎓', color: 'from-indigo-500 to-violet-500', rarity: 'legendary' },
  { id: 'mainnet-pioneer', name: 'Mainnet Pioneer', description: 'Graduated to mainnet', icon: '🚀', color: 'from-orange-500 to-red-500', rarity: 'legendary' },
];

interface AchievementBadgeProps {
  achievementIds: string[];
  compact?: boolean;
}

export function AchievementBadge({ achievementIds, compact = false }: AchievementBadgeProps) {
  const earnedBadges = ACHIEVEMENTS.filter(b => achievementIds.includes(b.id));
  
  if (earnedBadges.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {earnedBadges.slice(0, 3).map(badge => (
            <div
              key={badge.id}
              className={`w-7 h-7 rounded-full bg-gradient-to-r ${badge.color} flex items-center justify-center text-xs border-2 border-white dark:border-gray-800`}
              title={badge.name}
            >
              {badge.icon}
            </div>
          ))}
        </div>
        {earnedBadges.length > 3 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">+{earnedBadges.length - 3}</span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {ACHIEVEMENTS.map(badge => {
        const isEarned = achievementIds.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={`p-2 rounded-xl text-center transition-all ${
              isEarned
                ? `bg-gradient-to-r ${badge.color} text-white shadow-sm`
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-50'
            }`}
            title={badge.description}
          >
            <div className="text-lg">{badge.icon}</div>
          </div>
        );
      })}
    </div>
  );
}

// Toast notification for new achievements
export function AchievementToast({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom duration-500">
      <div className={`bg-gradient-to-r ${badge.color} text-white rounded-2xl p-4 shadow-2xl max-w-sm`}>
        <div className="flex items-start gap-3">
          <div className="text-3xl">{badge.icon}</div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-white/80 mb-1">Achievement Unlocked!</div>
            <div className="font-bold text-lg">{badge.name}</div>
            <div className="text-sm text-white/90">{badge.description}</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">×</button>
        </div>
      </div>
    </div>
  );
}
