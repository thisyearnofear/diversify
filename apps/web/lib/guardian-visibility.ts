import type { UserExperienceMode } from '@/context/app/types';

/**
 * Pure helpers for the Guardian visibility preference ("how much of the
 * Guardian's work the surfaces show"). Two axes decide what a user sees:
 *
 *  - the persona they already chose (ExperienceContext) sets the DEFAULT —
 *    beginner → quiet, intermediate/advanced → informed;
 *  - an explicit override, stored per wallet, set by the user in
 *    AutomationSettings or by the agent from a natural-language request.
 *
 * The override is never written implicitly: an absent key keeps the user
 * persona-derived, so persona auto-promotion (swap-count based) keeps
 * flowing through to visibility.
 */

export type GuardianVisibility = 'quiet' | 'informed';
export type GuardianVisibilityOrigin = 'persona' | 'user' | 'agent';

export interface StoredGuardianVisibility {
  visibility: GuardianVisibility;
  /** Who set the override — surfaced so an agent-applied change is legible. */
  by: Exclude<GuardianVisibilityOrigin, 'persona'>;
}

const STORAGE_PREFIX = 'diversifi-guardian-visibility';

export function guardianVisibilityStorageKey(address?: string | null): string {
  return `${STORAGE_PREFIX}-${(address || 'anon').toLowerCase()}`;
}

export function defaultVisibilityForPersona(mode: UserExperienceMode): GuardianVisibility {
  return mode === 'beginner' ? 'quiet' : 'informed';
}

function isStoredValue(value: unknown): value is StoredGuardianVisibility {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.visibility === 'quiet' || v.visibility === 'informed')
    && (v.by === 'user' || v.by === 'agent');
}

export function readStoredVisibility(address?: string | null): StoredGuardianVisibility | null {
  try {
    const raw = localStorage.getItem(guardianVisibilityStorageKey(address));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredVisibility(
  address: string | null | undefined,
  visibility: GuardianVisibility,
  by: StoredGuardianVisibility['by'],
): boolean {
  try {
    localStorage.setItem(
      guardianVisibilityStorageKey(address),
      JSON.stringify({ visibility, by } satisfies StoredGuardianVisibility),
    );
    return true;
  } catch {
    return false;
  }
}
