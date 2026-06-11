/**
 * TabNavHint — First-visit swipe/tap hint for the tab bar.
 *
 * Shows a small animated indicator above the tab bar on the user's first
 * visit, hinting that they can swipe left/right or tap tabs to navigate.
 * Fades after 3 tab changes or when the user dismisses it.
 *
 * Per the Core Principles:
 *   - ENHANCEMENT FIRST: lives in the existing TabNavigation component's
 *     import space; no new top-level surfaces.
 *   - PERFORMANT: minimal renders, no fetches, no state outside the hook.
 *   - MODULAR: the hint component is purely presentational — the
 *     useTabDiscovery hook owns the state.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabDiscovery } from '@/hooks/use-tab-discovery';

export function TabNavHint() {
    const { showHint, dismiss } = useTabDiscovery();

    return (
        <AnimatePresence>
            {showHint && (
                <motion.div
                    key="tab-nav-hint"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                >
                    <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl flex items-center gap-2">
                        <motion.span
                            animate={{ x: [-2, 2, -2] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            ←
                        </motion.span>
                        <span>Swipe or tap to explore</span>
                        <motion.span
                            animate={{ x: [2, -2, 2] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            →
                        </motion.span>
                        <button
                            onClick={dismiss}
                            className="text-white/60 hover:text-white ml-1 pointer-events-auto"
                            aria-label="Dismiss hint"
                        >
                            ✕
                        </button>
                    </div>
                    {/* Arrow pointing down to the tab bar */}
                    <div className="flex justify-center mt-1">
                        <div className="w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 -translate-y-1/2" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
