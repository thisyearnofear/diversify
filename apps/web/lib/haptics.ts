/**
 * Haptic feedback utility for mobile devices.
 *
 * Provides consistent vibration patterns across the app for key user actions.
 * Falls back gracefully on devices that don't support vibration API.
 * Respects reduced-motion preferences.
 *
 * Inside a Farcaster mini-app host the patterns route to the host's native
 * haptics (`sdk.haptics.*`) — the only way to reach the Taptic Engine on
 * iOS, where `navigator.vibrate` does not exist. `use-app-init` registers
 * the host once it has confirmed the capability; until then (and
 * everywhere else) the vibrate path is used.
 */

import { getFeel } from './feel';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  error: [50, 30, 50],
  warning: [30, 20, 30],
};

/** The subset of the Farcaster mini-app haptics API we drive. */
export interface HapticHost {
  impactOccurred?: (type: 'light' | 'medium' | 'heavy') => Promise<void> | void;
  notificationOccurred?: (type: 'success' | 'warning' | 'error') => Promise<void> | void;
  selectionChanged?: () => Promise<void> | void;
}

let host: HapticHost | null = null;

/** Route haptics through a native host (Farcaster mini-app). Pass null to detach. */
export function registerHapticHost(next: HapticHost | null): void {
  host = next;
}

function prefersReducedMotion(): boolean {
  // matchMedia is absent in some test/jsdom environments — haptics must
  // never break the app, so treat its absence as "no preference signal".
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function fireHost(pattern: HapticPattern): boolean {
  if (!host) return false;
  let result: Promise<void> | void | undefined;
  switch (pattern) {
    case 'success':
    case 'error':
    case 'warning':
      result = host.notificationOccurred?.(pattern);
      break;
    case 'light':
      result = host.selectionChanged ? host.selectionChanged() : host.impactOccurred?.('light');
      break;
    default:
      result = host.impactOccurred?.(pattern);
  }
  // Host calls are async bridge messages; a rejected one is just silence.
  if (result && typeof (result as Promise<void>).catch === 'function') {
    (result as Promise<void>).catch(() => {});
  }
  return true;
}

/**
 * Trigger haptic feedback. Safe to call anywhere - no-ops on unsupported devices.
 */
export function haptic(pattern: HapticPattern = 'medium'): void {
  if (typeof window === 'undefined') return;
  if (prefersReducedMotion()) return;
  if (getFeel() === 'silent') return;

  try {
    if (fireHost(pattern)) return;
    if (!('vibrate' in navigator)) return;
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Haptics must never break the app.
  }
}

/**
 * Convenience wrappers for common haptic patterns.
 */
export const haptics = {
  tap: () => haptic('light'),
  confirm: () => haptic('success'),
  error: () => haptic('error'),
  warning: () => haptic('warning'),
};
