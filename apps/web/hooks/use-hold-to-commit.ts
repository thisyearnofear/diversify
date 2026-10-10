/**
 * useHoldToCommit — press-and-hold commit for irreversible grants.
 *
 * The interaction contract: sustained intent, not a tap. Progress fills
 * over `durationMs` while the pointer (or Space/Enter) stays down;
 * releasing early drains the fill and commits nothing. Firing `onCommit`
 * happens inside the pointer's transient-activation window, so wallet
 * popups opened by the callback are not blocked.
 *
 * The seal visualizes the fill (`holdProgress` → `RiveProtectionSeal`);
 * this hook owns the semantics so the behavior is unit-testable and the
 * reduced-motion static seal supports the same commit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { haptics } from '@/lib/haptics';

const DEFAULT_DURATION_MS = 1400;
const DRAIN_MS = 180;

interface HoldToCommitOptions {
  /** Hold time required to commit. Default 1400ms. */
  durationMs?: number;
  /** Called exactly once when the fill completes during a press. */
  onCommit: () => void;
}

export function useHoldToCommit({ durationMs = DEFAULT_DURATION_MS, onCommit }: HoldToCommitOptions) {
  const reducedMotion = useReducedMotion();
  const [progress, setProgressState] = useState(0);
  const [holding, setHolding] = useState(false);

  const progressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const committedRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const setProgress = useCallback((p: number) => {
    progressRef.current = p;
    setProgressState(p);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stopRaf, [stopRaf]);

  const endPress = useCallback(() => {
    setHolding(false);
    stopRaf();
    const from = progressRef.current;
    if (committedRef.current) {
      committedRef.current = false;
      setProgress(0);
      return;
    }
    // Released early — drain the fill so the object settles, never snaps.
    if (from <= 0 || reducedMotion) {
      setProgress(0);
      return;
    }
    let drainStart: number | null = null;
    const drain = (now: number) => {
      if (drainStart === null) drainStart = now;
      const t = Math.min(1, (now - drainStart) / DRAIN_MS);
      setProgress(from * (1 - t));
      if (t < 1) rafRef.current = requestAnimationFrame(drain);
    };
    rafRef.current = requestAnimationFrame(drain);
  }, [reducedMotion, setProgress, stopRaf]);

  const beginPress = useCallback(() => {
    stopRaf();
    committedRef.current = false;
    setHolding(true);
    // The clock is seeded from the first rAF timestamp, not the press
    // event — the same epoch as every subsequent tick, whatever rAF's
    // epoch happens to be (fake timers included).
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / durationMs);
      if (p >= 1) {
        committedRef.current = true;
        setProgress(1);
        haptics.confirm();
        rafRef.current = null;
        onCommitRef.current();
        return;
      }
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, setProgress, stopRaf]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // jsdom / older browsers — capture is best-effort.
      }
      beginPress();
    },
    [beginPress],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault(); // Space would scroll / re-click on keyup.
      beginPress();
    },
    [beginPress],
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      endPress();
    },
    [endPress],
  );

  const onContextMenu = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault(); // Long-press must not summon the context menu.
  }, []);

  return {
    progress,
    holding,
    bind: {
      onPointerDown,
      onPointerUp: endPress,
      onPointerCancel: endPress,
      onLostPointerCapture: endPress,
      onKeyDown,
      onKeyUp,
      onContextMenu,
    },
  };
}
