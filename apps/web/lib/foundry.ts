/**
 * foundry.ts — the material system as data (design-language § The foundry).
 *
 * Tokens don't pick colors; they *are* a metal. Machined = reserve/calm
 * value, noble = hard assets that never weather, living = emerging-market
 * currencies that patina with real depreciation, ghost = the channel where
 * metal should be. The ring renders the material; the inspector keeps the
 * numbers.
 *
 * Patina is honest weathering: a living leg's curated 5yr depreciation vs
 * USD (constants/currency-risk, same dataset the risk surface reads) scaled
 * to 0–1. Accumulated damage, not last year's weather — the naira gained
 * 13% on the trailing year and is still a −60% instrument. Never
 * fabricated: no dataset entry, no patina.
 */
import { getCurrencyRisk } from '../constants/currency-risk';
import { canonicalToken } from './plan-legs';

export type FoundryMaterial = 'machined' | 'noble' | 'living' | 'ghost';

/**
 * The four metals, light catch at the top edge down to the shade at the
 * near edge. One table so every carrier strikes the same material — the ring
 * reads it as SVG defs, a DOM carrier reads `metalGradientCss`.
 */
export const FOUNDRY_METAL_STOPS: Record<
  FoundryMaterial,
  ReadonlyArray<{ offset: number; color: string }>
> = {
  machined: [
    { offset: 0, color: '#E4E9EE' },
    { offset: 0.5, color: '#ADB9C5' },
    { offset: 1, color: '#7C8996' },
  ],
  noble: [
    { offset: 0, color: '#F6DC8F' },
    { offset: 0.5, color: '#D7AC4B' },
    { offset: 1, color: '#9C7823' },
  ],
  living: [
    { offset: 0, color: '#DD9C5C' },
    { offset: 0.5, color: '#B56E38' },
    { offset: 1, color: '#7A4820' },
  ],
  ghost: [
    { offset: 0, color: '#BEC8D1' },
    { offset: 1, color: '#8B99A5' },
  ],
};

/** The proud lift — a leg off the die, not a color change. */
export const FOUNDRY_PROUD = {
  dx: 0,
  dy: 2.5,
  stdDeviation: 3,
  floodOpacity: 0.45,
} as const;

/** CSS `background-image` for a metal, for carriers without SVG defs. The
 *  direction is the light: `to bottom` across a face, `to right` down a
 *  round post so the highlight stays on the near edge. */
export function metalGradientCss(
  material: FoundryMaterial,
  direction: 'to bottom' | 'to right' = 'to bottom',
): string {
  const stops = FOUNDRY_METAL_STOPS[material]
    .map(({ offset, color }) => `${color} ${offset * 100}%`)
    .join(', ');
  return `linear-gradient(${direction}, ${stops})`;
}

/** The same proud lift as a CSS filter, for DOM carriers. */
export function proudShadowCss(): string {
  return `drop-shadow(0 ${FOUNDRY_PROUD.dy}px ${FOUNDRY_PROUD.stdDeviation}px rgba(0,0,0,${FOUNDRY_PROUD.floodOpacity}))`;
}

/** A token's metal at its mid tone — for the carriers that need one flat
 *  colour beside a struck object (a legend dot, a swatch) and still have to
 *  read as the same material. */
export function metalMidFor(symbol: string): string {
  const stops = FOUNDRY_METAL_STOPS[foundryMaterialFor(symbol)];
  return stops[Math.floor(stops.length / 2)].color;
}

/** The one tint the foundry allows to be named directly: the tarnish a
 *  living leg grows. Shared by every carrier that weathers. */
export const FOUNDRY_VERDIGRIS = '#41705B';

/** Linear-interpolate two hex colors — how relief lifts and sinks on a
 *  metal without inventing a colour the table doesn't have. */
export function mixMetal(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.replace('#', ''), 16);
  const b = parseInt(hexB.replace('#', ''), 16);
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const r = ch((a >> 16) & 255, (b >> 16) & 255);
  const g = ch((a >> 8) & 255, (b >> 8) & 255);
  const bl = ch(a & 255, b & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/** A metal's relief colors — the lit lip, the shadowed one and the floor —
 *  struck from that metal's own mid stop, never a separate palette. */
export function reliefFor(material: FoundryMaterial): {
  dark: string;
  light: string;
  ink: string;
} {
  const stops = FOUNDRY_METAL_STOPS[material];
  const mid = stops[Math.floor(stops.length / 2)].color;
  return {
    dark: mixMetal(mid, '#000000', 0.45),
    light: mixMetal(mid, '#ffffff', 0.6),
    ink: mixMetal(mid, '#000000', 0.66),
  };
}

/**
 * The struck medallion's shape as fractions of its diameter, so the SVG
 * carrier and the OG image strike one object: the outer edge, the die seam
 * where the second metal was pressed in, the core, and the reeded band.
 */
export const MEDALLION_SHAPE = {
  outer: 0.44,
  seam: 0.3,
  core: 0.28,
  reed: 0.41,
} as const;

/** The medallion is drawn in a 200-unit space; carriers scale the box, not
 *  the numbers. */
export const MEDALLION_VIEW = 200;

/** A radius in that space, rounded — so every carrier writes the same
 *  number into the same attribute. */
export function medallionRadius(part: keyof typeof MEDALLION_SHAPE): number {
  return Math.round(MEDALLION_VIEW * MEDALLION_SHAPE[part]);
}

/** Where a strike lands: the foot of the band, opposite the engraving. The
 *  foundry's chronology puts strikes on the rim, not in the field. */
export const MEDALLION_MARK_D = 'M 90 172 l 6 7 l 15 -17';

/** Reeding — alternating grooves and crests around the band, as dash
 *  geometry so every carrier cuts the same number of nicks. */
export function medallionReed(): {
  radius: number;
  strokeWidth: number;
  dasharray: string;
  crestOffset: number;
} {
  const radius = medallionRadius('reed');
  const arc = (2 * Math.PI * radius) / 44;
  return {
    radius,
    strokeWidth: 7,
    dasharray: `${(arc * 0.2).toFixed(2)} ${(arc * 0.8).toFixed(2)}`,
    crestOffset: arc * 0.5,
  };
}

/** Hard-asset tokens — the one material that never weathers. */
const NOBLE_TOKENS = new Set(['PAXG', 'XAUT', 'BTC', 'WBTC', 'ETH', 'WETH']);

/** Legacy Mento names → their fiat (cUSD/cEUR/cREAL aren't *m suffixed). */
const LEGACY_FIAT: Record<string, string> = {
  cUSD: 'USD',
  cEUR: 'EUR',
  cREAL: 'BRL',
};

/**
 * The fiat a token pegs to, when it pegs to a currency the risk dataset
 * knows. `KESm`→KES, `cREAL`→BRL, `NGN`→NGN. Non-currency tokens (PAXG,
 * USDY, vault rows) and 3-letter codes that aren't tracked currencies
 * (ETH, DAI) return null — no depreciation story to weather.
 */
export function fiatFor(symbol: string): string | null {
  const canonical = canonicalToken(symbol.trim());
  if (LEGACY_FIAT[canonical]) return LEGACY_FIAT[canonical];
  // Strip a trailing qualifier — `USDC (HashKey)` carries a venue note.
  const bare = canonical.replace(/\s*\(.*\)\s*$/, '');
  const code = /^[A-Z]{3}m$/.test(bare)
    ? bare.slice(0, 3)
    : /^[A-Z]{3}$/.test(bare)
      ? bare
      : null;
  if (!code) return null;
  return getCurrencyRisk(code) ? code : null;
}

/**
 * Living metal = a currency the depreciation dataset knows, and that has
 * actually weathered — 5yr vs USD worse than −10%. USD/EUR majors sit in
 * the dataset too; this keeps them machined (they don't patina).
 */
function isLivingFiat(fiat: string): boolean {
  const entry = getCurrencyRisk(fiat);
  return (entry?.depreciation.vsUSD['5yr'] ?? 0) <= -10;
}

export function foundryMaterialFor(symbol: string): FoundryMaterial {
  const canonical = canonicalToken(symbol.trim()).replace(/\s*\(.*\)\s*$/, '');
  if (NOBLE_TOKENS.has(canonical.toUpperCase())) return 'noble';
  const fiat = fiatFor(symbol);
  if (fiat && isLivingFiat(fiat)) return 'living';
  return 'machined';
}

/**
 * Verdigris 0–1 for a living leg: curated 5yr depreciation vs USD, full
 * patina at −60%. Non-living and unknown tokens return 0.
 */
export function patinaFor(symbol: string): number {
  if (foundryMaterialFor(symbol) !== 'living') return 0;
  const fiat = fiatFor(symbol);
  if (!fiat) return 0;
  const dep = getCurrencyRisk(fiat)?.depreciation.vsUSD['5yr'] ?? 0;
  return Math.min(1, Math.max(0, -dep / 60));
}
