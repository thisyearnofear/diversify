/**
 * GuardianStateScrollytelling — Visual 4-state pipeline for the Protect page.
 *
 * Renders the idle → authorized → funded → monitoring state machine as a
 * vertical step indicator showing what each state means and where the user
 * currently is. For the unconnected state, "idle" is highlighted as the
 * current position and the pipeline serves as an educational preview.
 *
 * Per the Core Principles:
 *   - DRY: uses the same 4-state model from guardian-tier-state.ts as the
 *     rest of the app (deriveGuardianTierState / GUARDIAN_TIER_STATE_LABELS).
 *   - MODULAR: pure presentational component, no hooks, no data fetching.
 *   - PERFORMANT: no fetches, no side effects, no re-renders from data.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { GUARDIAN_TIER_STATE_LABELS } from '@diversifi/shared';
import type { GuardianTierState } from '@diversifi/shared';

interface GuardianStateStep {
    state: GuardianTierState;
    icon: string;
    description: string;
}

const STEPS: GuardianStateStep[] = [
    {
        state: 'idle',
        icon: '🔒',
        description: 'The Guardian is ready — approve protection in your wallet to start.',
    },
    {
        state: 'authorized',
        icon: '✍️',
        description: 'You set a daily spending cap. The Guardian waits for funding.',
    },
    {
        state: 'funded',
        icon: '💰',
        description: 'Funds are deposited. The Guardian is ready to act.',
    },
    {
        state: 'monitoring',
        icon: '🛡️',
        description: 'Active protection. Swaps execute within your limits automatically.',
    },
];

interface GuardianStateScrollytellingProps {
    /** Current state of the Guardian. Defaults to 'idle' for unconnected users. */
    currentState?: GuardianTierState;
}

export function GuardianStateScrollytelling({
    currentState = 'idle',
}: GuardianStateScrollytellingProps) {
    const currentIndex = STEPS.findIndex((s) => s.state === currentState);

    return (
        <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/10 p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">
                Protection Setup Steps
            </h3>
            <div className="relative">
                {/* Vertical connecting line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-indigo-200 dark:bg-indigo-800 rounded-full" />

                <div className="space-y-5">
                    {STEPS.map((step, i) => {
                        const isCurrent = i === currentIndex;
                        const isPast = i < currentIndex;
                        const isFuture = i > currentIndex;

                        return (
                            <motion.div
                                key={step.state}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.08, duration: 0.2 }}
                                className="relative flex items-start gap-3 pl-8"
                            >
                                {/* Step dot */}
                                <div
                                    className={`absolute left-0 top-0.5 w-[30px] h-[30px] rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                                        isCurrent
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-110 ring-4 ring-indigo-100 dark:ring-indigo-900'
                                            : isPast
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                                    }`}
                                >
                                    {isPast ? '✓' : step.icon}
                                </div>

                                {/* Content */}
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
