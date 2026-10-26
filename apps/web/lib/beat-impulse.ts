/**
 * beat-impulse — the beat→object event contract.
 *
 * A LiveLine beat doesn't just rotate text under the object: each beat
 * class carries a physical signature the object plays once — the news
 * happens TO the coin, the caption explains it. Classification is by
 * the beat-key grammar from live-lines.ts / stamps.ts / corridor-voice.
 *
 * Data motion, not decoration: every impulse is one-shot (the beat
 * lands, the object settles), keyed to the beat currently shown, and
 * dead under reduced motion or once the user acts.
 */
import type { TargetAndTransition } from 'framer-motion';

export type BeatImpulse =
  | 'signal' // a fresh macro signal — the object absorbs a shock
  | 'voice' // the corridor's own register — the pull, acted
  | 'japa' // NGN's authored voice — the money trying to leave
  | 'watch' // standing cadence — one slow breath
  | 'coming' // a dated event ahead — a small lift
  | 'risk' // a dated risk event — the weight of what happened
  | 'cycle' // guardian watching a payment — a quiet tick
  | 'settle'; // any other keepable fact — a quiet press

export function beatImpulseForKey(key: string | null | undefined): BeatImpulse | null {
  if (!key) return null;
  if (key.startsWith('signal-')) return 'signal';
  // One authored voice so far: 'japa' is the naira's register — the
  // money reaching for the exit. Other corridor voices stay on the
  // generic lean until each earns its own signature against real
  // corridor users; the dialect grows one voice at a time.
  if (key === 'voice-NGN') return 'japa';
  if (key.startsWith('voice-')) return 'voice';
  if (key.startsWith('coming-')) return 'coming';
  if (key.startsWith('watch-') || key.startsWith('control-')) return 'watch';
  if (key.startsWith('risk-') || key.startsWith('past-')) return 'risk';
  if (key.startsWith('cycle-')) return 'cycle';
  // drift-*, staples, and anything else sourced and keepable still
  // lands — a fact never arrives with no physical signature.
  return 'settle';
}

/**
 * The signature per class. Transform-only, sub-4px — the object
 * notices, never performs. Each is a single burst; replay is driven
 * by the beat key changing, never a loop.
 */
export const BEAT_IMPULSE: Record<BeatImpulse, TargetAndTransition> = {
  // The shock: a quick tremor the object absorbs, back to rest.
  signal: { x: [0, -2.5, 2.5, -1.5, 1, 0], transition: { duration: 0.45, ease: 'easeOut' } },
  // The pull: the local coin leans toward the benchmark, holds, returns.
  voice: { x: [0, 4, 4, 0], transition: { duration: 0.9, times: [0, 0.35, 0.7, 1], ease: 'easeInOut' } },
  // Japa — "the money is trying to leave": a reach, a waver, a second
  // reach FURTHER, then the settle. Restless where the generic voice is
  // a single lean. The only per-voice signature so far — strongest meme
  // first, the rest wait for validation.
  japa: { x: [0, 3.5, 2, 5.5, 0], transition: { duration: 1.1, times: [0, 0.3, 0.52, 0.78, 1], ease: 'easeInOut' } },
  // The cadence: one slow breath on the standing watch.
  watch: { scale: [1, 1.035, 1], transition: { duration: 0.8, ease: 'easeInOut' } },
  // The ahead: a small lift toward something dated, settles.
  coming: { y: [0, -3, 0], transition: { duration: 0.6, ease: 'easeOut' } },
  // The weight: a short downward press — the mass of what happened.
  risk: { y: [0, 3, 0], transition: { duration: 0.55, ease: 'easeOut' } },
  // The tick: Guardian's quiet "still watching."
  cycle: { x: [0, 2, 0], transition: { duration: 0.4, ease: 'easeOut' } },
  // The fact: a single quiet press — struck, kept.
  settle: { scale: [1, 0.97, 1], transition: { duration: 0.4, ease: 'easeOut' } },
};

/**
 * The Guardian's beat signature isn't a shake — it's a posture. The
 * news it watches lands on its face: a fresh print, a dated danger or
 * an event ahead widens the eyes (alert); a standing cadence or a
 * watched payment narrows them (thinking). Flavor facts (voice, the
 * pair's story, keepable settles) never move it — the agent reacts to
 * events, not decoration.
 */
export const GUARDIAN_BEAT_MOOD: Partial<
  Record<BeatImpulse, 'alert' | 'thinking'>
> = {
  signal: 'alert',
  coming: 'alert',
  risk: 'alert',
  cycle: 'thinking',
  watch: 'thinking',
};

/**
 * BeatBus — one process-wide pulse for beats that already landed on an
 * object's LiveLine. Reporters publish {surface, key}; shell consumers
 * (the FAB mascot) subscribe and play the same posture the tab's object
 * would. No replay, no queue: a beat heard late is no beat at all.
 */
export interface BeatEvent {
  surface: string | undefined;
  key: string;
}

const beatSubscribers = new Set<(event: BeatEvent) => void>();

export function publishBeat(event: BeatEvent): void {
  beatSubscribers.forEach((fn) => fn(event));
}

export function subscribeBeats(fn: (event: BeatEvent) => void): () => void {
  beatSubscribers.add(fn);
  return () => beatSubscribers.delete(fn);
}
