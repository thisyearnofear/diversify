/**
 * The comparison horizon a visitor last looked at (1Y/3Y/5Y), carried from
 * onboarding's risk moment into Home's coin stage for the session.
 *
 * Why: onboarding opens on 5Y ("your NGN bought 72% less") while Home opened
 * on 1Y — the same currency told two opposite-looking stories within 30
 * seconds. Home now continues the story the visitor just read; the 1Y/3Y/5Y
 * control still changes it. Session-scoped, never persisted across visits.
 */
import type { Horizon } from './currency-risk';

const KEY = 'diversifi.moment.horizon';
const VALID: readonly Horizon[] = ['1yr', '3yr', '5yr'];

export function readMomentHorizon(): Horizon | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(KEY);
    return v && (VALID as readonly string[]).includes(v) ? (v as Horizon) : null;
  } catch {
    return null;
  }
}

export function writeMomentHorizon(h: Horizon): void {
  try {
    sessionStorage.setItem(KEY, h);
  } catch {
    /* best-effort */
  }
}
