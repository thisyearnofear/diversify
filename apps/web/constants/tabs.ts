// Single source of truth for main navigation tab IDs.
// Keep in sync with pages/index.tsx render switch + TabNavigation items.
// Protect leads — it's the primary action and the first thing visitors see.

import type { UserExperienceMode } from '@/context/app/types';

export const TAB_IDS = ["protect", "overview", "exchange", "agent"] as const;
export type TabId = (typeof TAB_IDS)[number];

/** Display labels — one source, personas never rename or reorder tabs. */
export const TAB_LABELS: Record<TabId, string> = {
  protect: "Shield",
  overview: "Home",
  exchange: "Exchange",
  agent: "Guardian",
};

/**
 * Which tabs appear in each experience mode.
 * Simple dock (design-language §5): simple = Shield / Home / Exchange.
 * Full shows all four — and Guardian joins the dock the first time it
 * is requested, which switches Simple → Full. There is no Learn tab:
 * the calculator lives in Shield's empty-wallet inspector.
 * Order is always TAB_IDS filtered by visibility — personas never
 * reorder the dock.
 */
export const TAB_VISIBILITY: Record<UserExperienceMode, readonly TabId[]> = {
  simple: ['protect', 'overview', 'exchange'],
  full: TAB_IDS,
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
  info: "protect",
  swap: "exchange",
  trade: "exchange",
};
