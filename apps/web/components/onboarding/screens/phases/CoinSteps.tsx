/**
 * CoinSteps — the 3-step coin-minting progress indicator.
 *
 * Each phase mints a coin: numbered gold coin → emerald ✓ when complete.
 * Completed coins are tappable, making back-navigation discoverable.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { Coin } from '../../../shared/FloatingCoins';
import type { Phase } from './phase-config';

export const STEPS: { id: Phase; label: string }[] = [
  { id: 'detect', label: 'You' },
  { id: 'risk', label: 'Risk' },
  { id: 'philosophy', label: 'Plan' },
];

export function CoinSteps({ phase, onNavigate }: { phase: Phase; onNavigate: (p: Phase) => void }) {
  const idx = STEPS.findIndex((s) => s.id === phase);
  const reducedMotion = useReducedMotion();
  return (
    <div
      className="flex items-start justify-center mb-5 select-none"
      role="group"
      aria-label={`Onboarding step ${idx + 1} of ${STEPS.length}`}
    >
      {STEPS.map((s, i) => {
        const isDone = i < idx;
        const isActive = i === idx;
        return (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <div className="w-10 h-[2px] rounded-full mt-[15px] mx-1 overflow-hidden bg-gray-200 dark:bg-gray-700">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                  initial={false}
                  animate={{ width: i <= idx ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => isDone && onNavigate(s.id)}
              disabled={!isDone}
              aria-current={isActive ? 'step' : undefined}
              aria-label={isDone ? `Go back to step ${i + 1}: ${s.label}` : `Step ${i + 1}: ${s.label}`}
              className={`min-w-11 min-h-11 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                isDone ? 'cursor-pointer hover:-translate-y-0.5 transition-transform' : 'cursor-default'
              }`}
            >
              <span className="relative w-8 h-8 flex items-center justify-center">
                {isActive && !reducedMotion && (
                  <motion.span
                    className="absolute -inset-1 rounded-full border-2 border-amber-400/60"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {isDone ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center shadow-sm"
                  >
                    ✓
                  </motion.span>
                ) : (
                  <Coin
                    size={isActive ? 30 : 26}
                    symbol={String(i + 1)}
                    variant="progress"
                    className={isActive ? '' : 'opacity-40 grayscale'}
                  />
                )}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${
                  isActive
                    ? 'text-amber-500'
                    : isDone
                    ? 'text-emerald-500'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              >
                {s.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
