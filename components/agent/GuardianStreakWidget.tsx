/**
 * GuardianStreakWidget - A retention-focused component that celebrates 
 * user progress and surfaces streak data with a personalized Guardian interaction.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { GuardianMascot } from '../shared/GuardianMascot';

export function GuardianStreakWidget() {
  const { daysActive, canClaim, isLoading } = useStreakRewards();

  if (isLoading) return <div className="h-24 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-3xl" />;

  const isCelebration = daysActive > 0 && daysActive % 5 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-xl"
    >
      <div className="flex items-center gap-4">
        <GuardianMascot 
            size={60} 
            mood={isCelebration ? 'happy' : 'protective'} 
        />
        
        <div className="flex-1">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Guardian Streak
          </h3>
          <div className="text-3xl font-black text-gray-900 dark:text-white flex items-baseline gap-2">
            {daysActive}
            <span className="text-sm font-bold text-gray-500">Days</span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">
            {canClaim ? 'Ready to claim reward! 🎁' : 'Keep protecting your wealth!'}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
            className="h-full bg-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${(daysActive % 7) * 14.28}%` }}
        />
      </div>
    </motion.div>
  );
}
