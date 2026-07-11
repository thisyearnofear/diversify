/**
 * GuardianStreakWidget - A retention-focused component that celebrates 
 * user progress and surfaces streak data with a personalized Guardian interaction.
 */

import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { GuardianMascot } from '../shared/GuardianMascot';

const CONFETTI_PIECES = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 17) % 100}%`,
  animationDelay: `${(i % 6) * 0.35}s`,
  backgroundColor: `hsl(${(i * 360) / 20}, 80%, 50%)`,
  width: `${4 + (i % 5) * 2}px`,
  height: `${4 + ((i + 2) % 5) * 2}px`,
}));

export function GuardianStreakWidget() {
  const { streak, canClaim, isLoading } = useStreakRewards();
  const reducedMotion = useReducedMotion();

  const daysActive = streak?.daysActive ?? 0;
  const isCelebration = daysActive > 0 && daysActive % 5 === 0;
  const progressPercent = (daysActive % 7) * 14.28;
  const daysUntilNextReward = 7 - (daysActive % 7);
  const isNearReward = daysUntilNextReward <= 2 && daysUntilNextReward > 0;

  useEffect(() => {
    if (isLoading || !isCelebration || reducedMotion) {
      return;
    }

    const celebrationEvent = new CustomEvent('streak-celebration', {
      detail: { days: daysActive }
    });
    window.dispatchEvent(celebrationEvent);
  }, [daysActive, isCelebration, isLoading, reducedMotion]);

  // Gamification before value confuses first-time visitors: "0 Days —
  // Reward in 7 days" was the first card they saw. Earn the surface first.
  // Checked before the loading state so first-timers never get a skeleton
  // that resolves to nothing; streak holders enter via the motion animation.
  if (daysActive === 0 && !canClaim) {
    return null;
  }

  if (isLoading) {
    return <div className="h-24 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-3xl" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: isCelebration && !reducedMotion ? [0, -4, 0] : 0
      }}
      transition={{
        y: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
      }}
      className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-xl"
      whileHover={{ 
        scale: 1.02,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ 
            scale: isCelebration ? [0.8, 1.2, 1] : 1,
            rotate: isCelebration ? [0, 10, -10, 0] : 0
          }}
          transition={{ 
            duration: 0.6, 
            type: "spring",
            stiffness: 200,
            damping: 20
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <GuardianMascot 
            size={60} 
            mood={isCelebration ? 'happy' : 'protective'} 
          />
        </motion.div>
        
        <div className="flex-1">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Guardian Streak
          </h3>
          <div className="text-3xl font-black text-gray-900 dark:text-white flex items-baseline gap-2">
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {daysActive}
            </motion.span>
            <span className="text-sm font-bold text-gray-500">Days</span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">
            {canClaim ? 'Ready to claim reward! 🎁' : `Reward in ${daysUntilNextReward} days`}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
          initial={{ width: 0 }}
          animate={{ 
            width: `${progressPercent}%`,
            boxShadow: isNearReward && !reducedMotion 
              ? "0 0 0 3px rgba(59, 130, 246, 0.5)" 
              : "none"
          }}
          transition={{ 
            width: { duration: 0.8, ease: "easeOut" },
            boxShadow: { duration: 2, repeat: Infinity, repeatType: "reverse" }
          }}
        />
      </div>
      
      {isCelebration && !reducedMotion && (
        <div className="pointer-events-none absolute inset-0">
          <ConfettiCanvas />
        </div>
      )}
    </motion.div>
  );
}

function ConfettiCanvas() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="confetti-container">
        {CONFETTI_PIECES.map((piece, index) => (
          <div 
            key={index} 
            className="confetti-piece"
            style={piece}
          />
        ))}
      </div>
    </div>
  );
}
