// Single source of truth for main navigation tab IDs.
// Keep in sync with pages/index.tsx render switch + TabNavigation items.
// Protect leads — it's the primary action and the first thing visitors see.

import type { UserExperienceMode } from '@/context/app/types';

export const TAB_IDS = ["protect", "overview", "exchange", "agent", "info"] as const;
export type TabId = (typeof TAB_IDS)[number];

/**
 * Which tabs appear in each experience mode.
 * Simple dock (design-language §5): beginner = Shield / Home / Exchange.
 * Learn is absorbed onto Shield's picker — do not put it back in Simple.
 */
export const TAB_VISIBILITY: Record<UserExperienceMode, readonly TabId[]> = {
  beginner: ['protect', 'overview', 'exchange'],
  intermediate: TAB_IDS,
  advanced: TAB_IDS,
};

export function getVisibleTabIds(mode: UserExperienceMode): readonly TabId[] {
  return TAB_VISIBILITY[mode] ?? TAB_IDS;
}

export function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

// Legacy tab IDs from older versions. Used only for storage migration/back-compat.
export const LEGACY_TAB_MAP: Record<string, TabId> = {
  analytics: "overview",
  strategies: "overview",
  rewards: "overview",
  oracle: "protect",
  guardian_setup: "protect",
  swap: "exchange",
  trade: "exchange",
};
