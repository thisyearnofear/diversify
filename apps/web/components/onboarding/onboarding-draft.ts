/**
 * Onboarding draft — survives reloads/remounts within the tab (sessionStorage
 * only). UI fields are drafts: nothing here writes a strategy, profile, or
 * financial state. Storage failures (disabled storage, corrupted JSON) are
 * non-blocking — a bad draft simply starts fresh.
 */

import { MONEY_PURPOSES, type MoneyPurpose } from '@/constants/money-purpose';
import { ARCHETYPE_ORDER, type ArchetypeId } from '../protection-cards/tokens';
import {
  VALUES_LENSES,
  type Phase,
  type ValuesLens,
} from './screens/phases/phase-config';
import { ISO_COUNTRY_CODES } from '@diversifi/shared/src/constants/countries';

export interface OnboardingDraft {
  version: 1;
  phase: Phase;
  moneyPurpose: MoneyPurpose | null;
  selectedLens: ValuesLens | null;
  selectedArchetype: ArchetypeId | null;
  showAllApproaches: boolean;
  countryCode: string | null;
}

export const ONBOARDING_DRAFT_KEY = 'diversifi.onboarding.draft.v1';

const PHASES: Phase[] = ['detect', 'risk', 'philosophy'];

function validate(raw: unknown): OnboardingDraft | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== 1) return null;
  if (!PHASES.includes(d.phase as Phase)) return null;
  if (
    d.moneyPurpose !== null &&
    !MONEY_PURPOSES.some((p) => p.value === d.moneyPurpose)
  )
    return null;
  if (
    d.selectedLens !== null &&
    !VALUES_LENSES.some((l) => l.id === d.selectedLens)
  )
    return null;
  if (
    d.selectedArchetype !== null &&
    !ARCHETYPE_ORDER.includes(d.selectedArchetype as ArchetypeId)
  )
    return null;
  if (typeof d.showAllApproaches !== 'boolean') return null;
  if (
    d.countryCode !== null &&
    (typeof d.countryCode !== 'string' ||
      !ISO_COUNTRY_CODES.includes(d.countryCode.toUpperCase()))
  )
    return null;
  const draft = { ...(d as unknown as OnboardingDraft) };
  // An archetype outside its lens is meaningless without "all approaches".
  if (
    draft.selectedArchetype &&
    draft.selectedLens &&
    !draft.showAllApproaches &&
    !VALUES_LENSES.find((l) => l.id === draft.selectedLens)?.archetypes.includes(draft.selectedArchetype)
  ) {
    draft.selectedArchetype = null;
  }
  return { ...draft, countryCode: draft.countryCode?.toUpperCase() ?? null };
}

export function readOnboardingDraft(): OnboardingDraft | null {
  try {
    // A finished onboarding takes precedence over any stale draft.
    if (localStorage.getItem('onboardingCompleted') === 'true') return null;
    const raw = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(draft: OnboardingDraft): void {
  try {
    sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage disabled — draft is best-effort */ }
}

export function clearOnboardingDraft(): void {
  try {
    sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch { /* noop */ }
}
