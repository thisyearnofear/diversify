/**
 * Design tokens for the Protection Plan card pipeline (satori + resvg).
 *
 * The DiversiFi app surface is slate-900 → slate-800 → slate-900, matching
 * the live app's hero gradient. Each Protection Plan archetype gets its own
 * accent — the cultural register that makes the plan legible at a glance.
 *
 * Accent values are sourced from `docs/makeathon/protection-plans.md` and
 * mirror Tailwind's named scale so any future Figma variable collection
 * round-trips cleanly.
 */

export const TOKENS = {
  background: '#0a0a0a',
  foreground: '#ffffff',
  muted: '#64748b',
  border: '#1f2937',

  surfaceGradientStart: '#0f172a',
  surfaceGradientMid: '#1e293b',
  surfaceGradientEnd: '#0f172a',
} as const;

/** @deprecated kept only for legacy callers; archetypes now ship their own `surface` triplet. */
export const SURFACE_GRADIENT = `linear-gradient(135deg, ${TOKENS.surfaceGradientStart} 0%, ${TOKENS.surfaceGradientMid} 50%, ${TOKENS.surfaceGradientEnd} 100%)`;

export type ArchetypeId =
  | 'africapitalism'
  | 'buen_vivir'
  | 'confucian'
  | 'gotong_royong'
  | 'islamic_finance'
  | 'global_diversification'
  | 'custom';

export interface ArchetypeSurface {
  /** Top-left corner of the 135° gradient. Deepest tonal value. */
  start: string;
  /** Midpoint — the dominant on-brand color. */
  mid: string;
  /** Bottom-right corner. Highlight; pulls energy out of the surface. */
  end: string;
}

export interface Archetype {
  id: ArchetypeId;
  name: string;
  kicker: string;
  philosophy: string;
  allocation: string[];
  accent: string;
  accentSoft: string;
  /** Per-archetype surface gradient (135°). Replaces the shared dark-slate baseline. */
  surface: ArchetypeSurface;
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  africapitalism: {
    id: 'africapitalism',
    name: 'Africapitalism',
    kicker: 'Protection Plan · Africapitalism',
    philosophy:
      'Keep wealth in African economies. Every cUSD, cEUR, KESm stays close to home.',
    allocation: ['cUSD', 'cEUR', 'KESm', 'COPm'],
    accent: '#d97706',
    accentSoft: '#fbbf24',
    // Savannah sunrise — deep umber → amber → gold.
    surface: { start: '#451a03', mid: '#b45309', end: '#fbbf24' },
  },
  buen_vivir: {
    id: 'buen_vivir',
    name: 'Buen Vivir',
    kicker: 'Protection Plan · Buen Vivir',
    philosophy:
      'Balance material wealth with community and the natural world.',
    allocation: ['COPm', 'BRZ', 'USDC', 'Community fund'],
    accent: '#0d9488',
    accentSoft: '#5eead4',
    // Andean highlands — deep forest → emerald → jade.
    surface: { start: '#022c22', mid: '#047857', end: '#5eead4' },
  },
  confucian: {
    id: 'confucian',
    name: 'Confucian',
    kicker: 'Protection Plan · Confucian',
    philosophy: 'Long-term stability. Low volatility. Patience as a strategy.',
    allocation: ['USDC', 'cUSD', 'RWA Treasuries', 'Bonds'],
    accent: '#b91c1c',
    accentSoft: '#fca5a5',
    // Imperial seal — deep cinnabar → vermilion → coral.
    surface: { start: '#450a0a', mid: '#b91c1c', end: '#fca5a5' },
  },
  gotong_royong: {
    id: 'gotong_royong',
    name: 'Gotong Royong',
    kicker: 'Protection Plan · Gotong Royong',
    philosophy: 'Community-first. Shared risk. We rise together.',
    allocation: ['cUSD', 'IDRT', 'PHPT', 'Community pool'],
    accent: '#ea580c',
    accentSoft: '#fdba74',
    // Indonesian sunset — plum → magenta → pink → coral.
    surface: { start: '#3b0764', mid: '#be185d', end: '#fdba74' },
  },
  islamic_finance: {
    id: 'islamic_finance',
    name: 'Islamic Finance',
    kicker: 'Protection Plan · Islamic Finance',
    philosophy:
      'Sharia-compliant. No interest-bearing assets. Ethical by design.',
    allocation: ['USDC (Sharia)', 'Sukuk', 'Halal RWA'],
    accent: '#059669',
    accentSoft: '#a7f3d0',
    // Alhambra mosaic — deep emerald → teal → turquoise.
    surface: { start: '#022c22', mid: '#0d9488', end: '#5eead4' },
  },
  global_diversification: {
    id: 'global_diversification',
    name: 'Global Diversification',
    kicker: 'Protection Plan · Global',
    philosophy:
      'Geographic diversification across all regions. Maximum spread.',
    allocation: ['USDC', 'cUSD', 'BRZ', 'IDRT', 'Multi-region'],
    accent: '#0284c7',
    accentSoft: '#7dd3fc',
    // Earth from space — deep ocean → sky → cyan.
    surface: { start: '#082f49', mid: '#0369a1', end: '#7dd3fc' },
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    kicker: 'Protection Plan · Custom',
    philosophy: 'Set your own allocation. Your plan, your proof.',
    allocation: ['Configurable', 'Your targets', 'Your regions'],
    accent: '#7c3aed',
    accentSoft: '#e9d5ff',
    // Electric personal — deep violet → purple → magenta highlight.
    surface: { start: '#2e1065', mid: '#7e22ce', end: '#f0abfc' },
  },
};

export const ARCHETYPE_ORDER: ArchetypeId[] = [
  'africapitalism',
  'buen_vivir',
  'confucian',
  'gotong_royong',
  'islamic_finance',
  'global_diversification',
  'custom',
];

export function alpha(hex: string, opacity: number): string {
  // Normalize 3-char hex (#abc) to 6-char (#aabbcc) so satori parses cleanly.
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${h}${a}`;
}

export function formatCardDate(d: Date): string {
  return d
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
}

export const CARD_SIZE = 1080;
