// Single source of truth for main navigation tab IDs.
// Keep in sync with pages/index.tsx render switch + TabNavigation items.
// Protect leads — it's the primary action and the first thing visitors see.

export const TAB_IDS = ["protect", "overview", "exchange", "agent", "info"] as const;
export type TabId = (typeof TAB_IDS)[number];

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
