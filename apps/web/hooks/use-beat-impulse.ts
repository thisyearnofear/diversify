/**
 * useBeatImpulse — plays the shown beat's physical signature on an
 * object, once per beat per mount.
 *
 * The beat→object event (design-language: the news happens TO the
 * object, the caption explains it). LiveLine reports the beat key;
 * beatImpulseForKey classifies it; this hook fires the signature via
 * animation controls — never a remount, never a loop.
 *
 * Once per beat: a re-shown key (rotation wrap) does NOT replay its
 * signature — a one-shot that repeats every dwell reads as wallpaper,
 * not a fact landing. A genuinely new beat still fires; a re-staged
 * object (reset) plays its beats fresh. Reduced motion skips the move
 * entirely — the beat text still shows.
 *
 * Mount suppression is the HOST's job, not this hook's: the stage's own
 * arrival owns the first move, so hosts report beats through
 * useBeatReporter, which stays silent on the first shown beat and
 * reports every later one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnimationControls, useReducedMotion } from 'framer-motion';
import type { TargetAndTransition } from 'framer-motion';
import { BEAT_IMPULSE, beatImpulseForKey, publishBeat } from '@/lib/beat-impulse';
import { trackFunnelEvent } from '@/lib/analytics';

export interface BeatImpulseOpts {
  /** Flip x-signatures — the beam's right coin pulls left, toward the
   *  pair (the pull is always toward the other side of the scale). */
  mirror?: boolean;
  /** Funnel surface tag — fires `beat_impulse` only when a signature
   *  actually plays, so the read is "choreography seen", not armed. */
  surface?: string;
}

function mirrored(t: TargetAndTransition): TargetAndTransition {
  const x = t.x;
  if (x === undefined) return t;
  return {
    ...t,
    x: Array.isArray(x)
      ? x.map((v) => (typeof v === 'number' ? -v : v))
      : typeof x === 'number'
        ? -x
        : x,
  };
}

export function useBeatImpulse(
  beatKey: string | null,
  enabled: boolean,
  opts?: BeatImpulseOpts,
) {
  const controls = useAnimationControls();
  const reduced = useReducedMotion();
  const impulse = beatImpulseForKey(beatKey);
  // The played ledger: a beat's signature fires the first time that
  // beat is SHOWN while armed — rotation wraps stay still after.
  const played = useRef(new Set<string>());
  // The exposed class is what is armed — while disabled, reduced, or
  // already played the object moves nothing, so it reports nothing
  // (`data-impulse="none"` is the honest reading).
  const armed =
    enabled && !reduced && impulse && beatKey && !played.current.has(beatKey)
      ? impulse
      : null;

  useEffect(() => {
    // The render-time check arms the signature; this guard makes the
    // fire idempotent — a StrictMode double-effect must not start the
    // signature twice or double-count the funnel event.
    if (!armed || !beatKey || played.current.has(beatKey)) return;
    played.current.add(beatKey);
    controls.start(
      opts?.mirror ? mirrored(BEAT_IMPULSE[armed]) : BEAT_IMPULSE[armed],
    );
    if (opts?.surface) {
      trackFunnelEvent('beat_impulse', { surface: opts.surface, kind: armed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, armed, controls]);

  const reset = useCallback(() => {
    played.current.clear();
    controls.set({ x: 0, y: 0, scale: 1 });
  }, [controls]);

  return { controls, impulse: armed, reset };
}

/**
 * The host-side beat reporter: swallows the FIRST beat LiveLine reports
 * (the stage's arrival already moved), then surfaces every later key.
 * `reset` re-arms the first-beat silence for a re-staged object — a new
 * pair's re-weigh IS its signature, so its first beat stays quiet too.
 */
export function useBeatReporter(surface?: string): {
  beatKey: string | null;
  reportBeat: (key: string) => void;
  reset: () => void;
} {
  const [beatKey, setBeatKey] = useState<string | null>(null);
  // The arrival beat stays silent however often a remount echoes it —
  // only a DIFFERENT key proves the opening is over and arms the
  // signatures (StrictMode double-effects and still/rotating remounts
  // re-report the same beat; a rotation wrap re-shows it and fires).
  const first = useRef<string | null>(null);
  const armed = useRef(false);
  const reportBeat = useCallback((key: string) => {
    if (!armed.current) {
      if (first.current === null || first.current === key) {
        first.current = key;
        return;
      }
      armed.current = true;
    }
    setBeatKey(key);
    publishBeat({ surface, key });
  }, [surface]);
  const reset = useCallback(() => {
    first.current = null;
    armed.current = false;
    setBeatKey(null);
  }, []);
  return { beatKey, reportBeat, reset };
}

const DWELL_BUCKETS = ['<5s', '5-15s', '15-60s', '60s+'] as const;

export function dwellBucket(ms: number): (typeof DWELL_BUCKETS)[number] {
  return ms < 5_000
    ? DWELL_BUCKETS[0]
    : ms < 15_000
      ? DWELL_BUCKETS[1]
      : ms < 60_000
        ? DWELL_BUCKETS[2]
        : DWELL_BUCKETS[3];
}

/**
 * useInstrumentDwell — the coarse "time-on-instrument" read. The clock
 * starts when the instrument first breathes (alive — mounted and at
 * rest, so a kept-mounted hidden tab doesn't bank dwell it never had)
 * and fires once on the user's first act, bucketed. Answers "does
 * anyone sit with the object before acting?" — never what they did.
 */
export function useInstrumentDwell(
  surface: string,
  alive: boolean,
  acted: boolean,
) {
  const since = useRef<number | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    if (since.current === null && alive) since.current = Date.now();
    if (!fired.current && acted && since.current !== null) {
      fired.current = true;
      trackFunnelEvent('instrument_dwell', {
        surface,
        dwell: dwellBucket(Date.now() - since.current),
      });
    }
  }, [alive, acted, surface]);
}
