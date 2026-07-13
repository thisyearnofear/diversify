/**
 * GuardianUpdates — compact, non-modal proactive alert surface.
 *
 * The agent may notify proactively but should not open the chat drawer
 * unless the user taps to review or explicitly asks Guardian.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GuardianMascot } from '@/components/shared/GuardianMascot';
import { GUARDIAN_UPDATES_LABEL } from '@/constants/guardian-copy';
import type { GuardianUpdate } from '@/context/AIConversationContext';

export interface GuardianUpdatesProps {
  updates: GuardianUpdate[];
  onOpenReview: (update: GuardianUpdate) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  onMuteType: (type: GuardianUpdate['type']) => void;
}

export function GuardianUpdates({
  updates,
  onOpenReview,
  onDismiss,
  onSnooze,
  onMuteType,
}: GuardianUpdatesProps) {
  const [expandedWhy, setExpandedWhy] = useState<string | null>(null);
  const now = Date.now();
  const active = updates.filter(
    (u) => !u.dismissed && u.expiresAt.getTime() > now &&
      (!u.snoozedUntil || u.snoozedUntil.getTime() <= now),
  );

  if (active.length === 0) return null;

  const latest = active[active.length - 1];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="fixed bottom-36 right-4 left-4 sm:left-auto z-40 sm:w-[24rem] max-w-md pointer-events-auto"
        role="status"
        aria-live="polite"
        aria-label={GUARDIAN_UPDATES_LABEL}
      >
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-800/60 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg shadow-blue-900/10 p-3">
          <div className="flex items-start gap-2.5">
            <div className="relative shrink-0">
              <GuardianMascot size={32} mood="alert" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-200">
                  {GUARDIAN_UPDATES_LABEL} · {active.length} update{active.length === 1 ? '' : 's'}
                </p>
                <time className="text-[10px] text-gray-400 shrink-0">
                  {latest.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5 leading-snug line-clamp-2">
                {latest.summary}
              </p>
              {expandedWhy === latest.id && latest.whyReason && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  {latest.whyReason}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1 mt-2">
                {latest.whyReason && (
                  <button
                    type="button"
                    onClick={() => setExpandedWhy(expandedWhy === latest.id ? null : latest.id)}
                    className="min-h-11 px-2 text-[10px] font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Why am I seeing this?
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenReview(latest)}
                  className="min-h-11 px-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Open review
                </button>
                <button
                  type="button"
                  onClick={() => onSnooze(latest.id)}
                  className="min-h-11 px-2 text-[10px] font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Snooze
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(latest.id)}
                  className="min-h-11 px-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => onMuteType(latest.type)}
                  className="min-h-11 px-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Mute this type
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GuardianUpdates;
