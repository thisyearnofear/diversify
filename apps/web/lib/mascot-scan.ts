/**
 * The Guardian's scan — a pure, clock-free saccade schedule.
 *
 * Lesson from bloub's frame-measured reconstruction: the life of a face
 * is drift and blinking, and real looking is saccadic — dwell on a
 * point of interest, dart, dwell. A fixed sequence on a fixed interval
 * reads as a metronome, not attention.
 *
 * `saccadeAt(seed, index)` is deterministic: same seed + index always
 * returns the same gaze target and dwell. The component walks indices
 * with per-saccade timeouts — the schedule itself is a pure function,
 * so tests and the frozen-frame lab see identical poses.
 */

export interface Saccade {
  /** Gaze target in the mascot's normalized space, each axis ~[-1, 1]. */
  x: number;
  y: number;
  /** How long the eyes hold this point before darting. */
  dwellMs: number;
}

/** mulberry32 — tiny seed-stable PRNG; decorrelates per saccade index. */
function unit(seed: number, index: number, salt: number): number {
  let a = (seed ^ (index * 2654435761) ^ (salt * 40503)) >>> 0;
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const DWELL_MIN = 1200;
const DWELL_SPAN = 2200;
/** Every few saccades the eyes come home — rest between scans. */
const CENTER_EVERY = 5;

export function saccadeAt(seed: number, index: number): Saccade {
  if (index % CENTER_EVERY === CENTER_EVERY - 1) {
    return { x: 0, y: -0.1, dwellMs: DWELL_MIN + Math.round(unit(seed, index, 7) * 900) };
  }
  const r = (salt: number) => unit(seed, index, salt);
  // Points of interest, not a sweep: land on discrete gaze targets
  // across the board, biased slightly upward — reading, not scowling.
  return {
    x: Math.round((r(1) * 1.4 - 0.7) * 20) / 20,
    y: Math.round((-0.2 + r(2) * 0.4) * 20) / 20,
    dwellMs: DWELL_MIN + Math.round(r(3) * DWELL_SPAN),
  };
}
