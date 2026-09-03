/**
 * palette.ts — the one place UI colors come from.
 *
 * Design language §2 ("one object gets the color"): every accent in the
 * app derives from an archetype's accent token. Raw hex literals in
 * components break dark-mode adaptation and let accents drift per file,
 * so components import from here instead of hardcoding values.
 *
 * Excluded from the hex ban (spec'd values, not UI theming):
 * - `protection-cards/tokens.ts` (archetype token source itself)
 * - `protection-cards/patterns.tsx` (satori card fill invariants)
 * - `shared/guardian-mark.ts` (§9 mascot spec palette)
 */

import { ARCHETYPES, strategyToArchetype } from '../protection-cards/tokens';

/** The quiet color (slate-500) — everything that does NOT get the color. */
export const QUIET_GRAY = '#64748b';

/** Default accent when no philosophy is selected (blue-600). */
export const DEFAULT_ACCENT = '#2563eb';

// Legacy strategy keys with no archetype mapping keep their historical hues.
const STRATEGY_ACCENT_OVERRIDES: Record<string, string> = {
  halo: ARCHETYPES.custom.accent,
  taco: ARCHETYPES.global_diversification.accent,
};

/**
 * The accent for a strategy key: the archetype's own accent token, a
 * legacy override, or the default blue.
 */
export function strategyAccent(strategyKey: string | null | undefined): string {
  const archetypeId = strategyToArchetype(strategyKey);
  if (archetypeId) return ARCHETYPES[archetypeId].accent;
  if (strategyKey && STRATEGY_ACCENT_OVERRIDES[strategyKey]) {
    return STRATEGY_ACCENT_OVERRIDES[strategyKey];
  }
  return DEFAULT_ACCENT;
}

/** Canonical per-token brand colors for rings, chips, and legend rows. */
export const TOKEN_COLORS: Record<string, string> = {
  PAXG: '#f59e0b',
  USDY: '#84cc16',
  cUSD: '#0ea5e9',
  USDC: '#2563eb',
  cEUR: '#14b8a6',
  cREAL: '#22c55e',
  KESm: '#a855f7',
  COPm: '#ec4899',
  PHPm: '#f97316',
};

export function tokenColor(symbol: string | null | undefined): string {
  return (symbol && TOKEN_COLORS[symbol]) || QUIET_GRAY;
}

/** Curated coin tints for fallback asset icons — warm, saturated, legible
 * on both light and dark chip backgrounds. */
export const COIN_TINTS = [
  '#f59e0b', // gold
  '#0d9488', // teal
  '#0284c7', // sky
  '#b91c1c', // cinnabar
  '#ea580c', // tangerine
  '#7c3aed', // violet
  '#be185d', // magenta
  '#059669', // emerald
];

/** The Coin motif's gold — shared by the Guardian belly-coin and defaults. */
export const GOLD = '#f59e0b';

/** Bullion gold (the metallic gold used for XAU/gold-asset coins). */
export const GOLD_METAL = '#d4af37';

/** Semantic status ring colors (success / caution / danger). */
export const STATUS_COLORS = {
  good: '#10b981', // emerald-500
  warn: '#f59e0b', // amber-500
  bad: '#ef4444', // red-500
} as const;

/** Benchmark asset colors for currency-risk "aha" cards (USD / EUR / XAU). */
export const BENCHMARK_COLORS = {
  USD: '#2563eb', // blue-600
  EUR: '#14b8a6', // teal-500
  XAU: GOLD,
} as const;

/** Ring tints for strategies whose ring color is semantic, not accent. */
export const STRATEGY_RING_TINTS: Record<string, string> = {
  halo: '#fbbf24', // amber-400 — hard assets read as gold
  taco: '#22c55e', // green-500 — neutrality reads as green
};

/** Chain brand colors (official brand values, not theme tokens). */
export const CHAIN_BRAND_COLORS: Record<string, string> = {
  BNB: '#FCFF52',
  CELO: '#FCFF52',
  opBNB: '#D69E2E',
  base: '#0052FF',
  ethereum: '#627EEA',
};
