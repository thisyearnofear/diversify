/**
 * WorldAnswerCard — the flag-coin face of the "Ask the World" fast path.
 *
 * Renders a deterministic WorldAnswer (computed by ask-world-facts, no LLM)
 * inside the assistant bubble: MaskedReveal headline, a FlickScrollRow of
 * flag-coin chips (matched economies "light up" with one shine sweep), and
 * the honesty badge — measured latency, named source, dated as-of, and the
 * word "live" only when the data actually is.
 *
 * Chips are deliberately non-interactive: a factual answer is not a
 * control. Follow-up "so what should I do?" is a new message and correctly
 * routes to the advisor.
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Coin } from '../shared/FloatingCoins';
import FlickScrollRow from '../shared/FlickScrollRow';
import { MaskedReveal } from '../shared/MaskedReveal';
import { springSoft, STAGGER_STEP_S } from '@/lib/motion-tokens';
import { worldBadgeCopy } from '@/lib/agent/ask-world-facts';
import type { WorldAnswer } from '@/lib/agent/ask-world-types';

export interface WorldAnswerCardProps {
    answer: WorldAnswer;
}

export function WorldAnswerCard({ answer }: WorldAnswerCardProps) {
    const reduced = useReducedMotion();
    const { entries, badge, headline, omittedCount } = answer;

    return (
        <div className="space-y-2.5 max-w-[300px]" data-testid="world-answer-card">
            <MaskedReveal
                as="p"
                lines={headline}
                lineClassName="text-sm font-black leading-snug"
            />

            {entries.length > 0 ? (
                <FlickScrollRow chevrons={false} className="gap-2 py-1">
                    {entries.map((e, i) => (
                        <motion.span
                            key={`${e.code ?? e.country}-${i}`}
                            initial={reduced ? false : { opacity: 0, y: 8, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={
                                reduced
                                    ? { duration: 0 }
                                    : { ...springSoft, delay: i * STAGGER_STEP_S }
                            }
                            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-2 py-1"
                            data-testid="world-answer-chip"
                        >
                            <Coin
                                size={20}
                                symbol={e.flag}
                                variant="asset"
                                shine={!reduced && e.isLive ? 'once' : false}
                                shineDelay={0.4 + i * STAGGER_STEP_S}
                            />
                            <span className="text-[11px] font-bold">
                                {e.code ?? e.country}
                            </span>
                            <span
                                className={`text-[11px] font-black tabular-nums ${
                                    e.value < 0
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-emerald-700 dark:text-emerald-300'
                                }`}
                            >
                                {e.valueLabel}
                            </span>
                        </motion.span>
                    ))}
                </FlickScrollRow>
            ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    No matching entries in our data.
                </p>
            )}

            {omittedCount > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {omittedCount} {omittedCount === 1 ? 'entry' : 'entries'} without
                    data were left out.
                </p>
            )}

            <p
                className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug"
                data-testid="world-answer-badge"
            >
                {worldBadgeCopy(badge)}
            </p>
        </div>
    );
}

export default WorldAnswerCard;
