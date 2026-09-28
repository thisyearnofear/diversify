/**
 * LiveLine — one rotating, data-backed line under a tab's object.
 *
 * The grammar comes from the Exchange corridor line: beats breathe on a
 * long dwell while the user is just looking; the moment the user acts
 * (`alive` false) the line stills. A hidden tab doesn't rotate beats
 * nobody can see, reduced motion stays on beat 0, and a shrunk beat
 * array clamps instead of rendering nothing.
 *
 * Screen readers get `aria-live="polite"` only while the line is still —
 * auto-rotation must not spam announcements (`off` while rotating).
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/** Dwell per beat while the line breathes (§5 state rule). */
export const LIVE_LINE_DWELL_MS = 7000;

export interface LiveBeat {
  key: string;
  content: React.ReactNode;
}

export function LiveLine({
  beats,
  alive,
  dwellMs = LIVE_LINE_DWELL_MS,
  className,
  testId,
}: {
  beats: LiveBeat[];
  /** false = the user is acting → the line stills on the current beat. */
  alive: boolean;
  dwellMs?: number;
  /** Class applied to each beat's span (the text grammar is the caller's). */
  className?: string;
  testId?: string;
}): JSX.Element | null {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);
  const rotating = alive && !reduced && beats.length > 1;

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => {
      // Cheap guard: a hidden tab doesn't cycle beats nobody can see.
      if (document.visibilityState === 'visible') {
        setBeat((i) => (i + 1) % beats.length);
      }
    }, dwellMs);
    return () => clearInterval(id);
  }, [rotating, dwellMs, beats.length]);

  // Clamp defensively: if the beats array shrinks mid-rotation (a signal
  // expires), the stored index can transiently exceed it — wrap, never
  // render an empty beat.
  const shown = beats.length > 0 ? beat % beats.length : 0;
  if (beats.length === 0) return null;

  return (
    <span aria-live={rotating ? 'off' : 'polite'} data-testid={testId}>
      {rotating ? (
        // popLayout, not wait: the incoming beat mounts immediately while
        // the outgoing one pops out — the corridor line's own swap grammar,
        // and the only mode whose content swaps synchronously (a `wait`
        // mode would defer the new beat until the exit completes).
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={beats[shown].key}
            className={className}
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 0.18 }}
          >
            {beats[shown].content}
          </motion.span>
        </AnimatePresence>
      ) : (
        <span className={className}>{beats[shown].content}</span>
      )}
    </span>
  );
}
