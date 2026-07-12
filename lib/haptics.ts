/**
 * Haptic feedback utility for mobile devices.
 *
 * Provides consistent vibration patterns across the app for key user actions.
 * Falls back gracefully on devices that don't support vibration API.
 * Respects reduced-motion preferences.
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  error: [50, 30, 50],
  warning: [30, 20, 30],
};

/**
 * Trigger haptic feedback. Safe to call anywhere - no-ops on unsupported devices.
 */
export function haptic(pattern: HapticPattern = 'medium'): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('vibrate' in navigator)) return;

  try {
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
