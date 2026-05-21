/**
 * GuardianStreakWidget - A retention-focused component that celebrates 
 * user progress and surfaces streak data with a personalized Guardian interaction.
 */

import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { GuardianMascot } from '../shared/GuardianMascot';

export function GuardianStreakWidget() {
  const { daysActive, canClaim, isLoading } = useStreakRewards();
  const reducedMotion = useReducedMotion();

  if (isLoading) return <div className="h-24 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-3xl" />;

  const isCelebration = daysActive > 0 && daysActive % 5 === 0;
  const progressPercent = (daysActive % 7) * 14.28;
  const daysUntilNextReward = 7 - (daysActive % 7);
  const isNearReward = daysUntilNextReward <= 2 && daysUntilNextReward > 0;

  // Add celebratory confetti effect on milestone days
  useEffect(() => {
    if (isCelebration && !reducedMotion) {
      // Trigger celebration animation
      const celebrationEvent = new CustomEvent('streak-celebration', { 
        detail: { days: daysActive } 
      });
      window.dispatchEvent(celebrationEvent);
    }
  }, [daysActive, isCelebration, reducedMotion]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        // Add subtle idle float animation
        y: isCelebration && !reducedMotion ? [0, -4, 0] : 0
      }}
      transition={{
        y: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
      }}
      className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-xl"
      // Add hover lift effect
      whileHover={{ 
        scale: 1.02, 
        shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
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

      {/* Progress Bar with enhanced animation */}
      <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
          initial={{ width: 0 }}
          animate={{ 
            width: `${progressPercent}%`,
            // Add pulsing effect when near reward
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
      
      {/* Celebratory confetti (conditionally rendered) */}
      {isCelebration && !reducedMotion && (
        <div className="pointer-events-none absolute inset-0">
          <ConfettiCanvas days={daysActive} />
        </div>
      )}
    </motion.div>
  );
}

// Simple confetti celebration component
function ConfettiCanvas({ days }: { days: number }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Using CSS animation for confetti - lightweight */}
      <div className="confetti-container">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className="confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              backgroundColor: `hsl(${(i * 360 / 20) % 360}, 80%, 50%)`,
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
