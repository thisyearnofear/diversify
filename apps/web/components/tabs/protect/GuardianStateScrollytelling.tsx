/**
 * GuardianStateScrollytelling — Visual pipeline for the Protect page.
 *
 * `variant="compact"` collapses four internal tiers into two user-facing
 * steps: setup vs actively protecting.
 */

import React from 'react';
import { motion } from 'framer-motion';
// Deep leaf import — NOT the barrel — keeps the agent-tier stack out of first-load.
import {
  GUARDIAN_TIER_STATE_LABELS,
  GUARDIAN_USER_FACING_LABELS,
  collapseGuardianTierForUser,
  type GuardianTierState,
} from '@diversifi/shared/src/services/vault/guardian-tier-state';

interface GuardianStateStep {
  state: GuardianTierState;
  icon: string;
  description: string;
}

const STEPS: GuardianStateStep[] = [
  {
    state: 'idle',
    icon: '🔒',
    description: 'Set a daily limit and approve Auto-Saver to start protecting your savings.',
  },
  {
    state: 'authorized',
    icon: '✍️',
    description: 'Daily limit is set. Auto-Saver is waiting for funds.',
  },
  {
    state: 'funded',
    icon: '💰',
    description: 'Funds are in. Auto-Saver is ready to act on your behalf.',
  },
  {
    state: 'monitoring',
    icon: '🛡️',
    description: 'Auto-Saver is on. It swaps within your limits when conditions change.',
  },
];

const COMPACT_STEPS = [
  {
    key: 'setup' as const,
    icon: '🔒',
    label: GUARDIAN_USER_FACING_LABELS.setup,
    description: 'Connect, set your daily limit, and add savings to get started.',
  },
  {
    key: 'active' as const,
    icon: '🛡️',
    label: GUARDIAN_USER_FACING_LABELS.active,
    description: 'Auto-Saver watches markets and protects within the limits you set.',
  },
];

interface GuardianStateScrollytellingProps {
  /** Current state of the Guardian. Defaults to 'idle' for unconnected users. */
  currentState?: GuardianTierState;
  variant?: 'full' | 'compact';
}

export function GuardianStateScrollytelling({
  currentState = 'idle',
  variant = 'full',
}: GuardianStateScrollytellingProps) {
  if (variant === 'compact') {
    const facing = collapseGuardianTierForUser(currentState);
    const currentIndex = facing === 'active' ? 1 : 0;

    return (
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/10 p-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
          Auto-Saver Status
        </h3>
        <div className="flex gap-2">
          {COMPACT_STEPS.map((step, i) => {
            const isCurrent = i === currentIndex;
            const isPast = i < currentIndex;
            return (
              <div
                key={step.key}
                className={`flex-1 rounded-xl p-3 border text-left transition-colors ${
                  isCurrent
                    ? 'border-indigo-300 dark:border-indigo-600 bg-white dark:bg-indigo-950/30 shadow-sm'
                    : isPast
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-gray-200 dark:border-gray-700 opacity-60'
                }`}
              >
                <div className="text-lg mb-1" aria-hidden="true">
                  {isPast ? '✓' : step.icon}
                </div>
                <div className="text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-200">
                  {step.label}
                </div>
                {isCurrent && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                    {step.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.state === currentState);

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/10 p-5">
      <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">
        Protection Setup Steps
      </h3>
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-indigo-200 dark:bg-indigo-800 rounded-full" />

        <div className="space-y-5">
          {STEPS.map((step, i) => {
            const isCurrent = i === currentIndex;
            const isPast = i < currentIndex;

            return (
              <motion.div
                key={step.state}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.2 }}
                className="relative flex items-start gap-3 pl-8"
              >
                <div
                  className={`absolute left-0 top-0.5 w-[30px] h-[30px] rounded-full flex items-center justify-center text-sm transition-colors duration-300 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-110 ring-4 ring-indigo-100 dark:ring-indigo-900'
                      : isPast
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {isPast ? '✓' : step.icon}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        isCurrent
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : isPast
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {GUARDIAN_TIER_STATE_LABELS[step.state]}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                        You are here
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 leading-relaxed ${
                      isCurrent || isPast
                        ? 'text-gray-600 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
