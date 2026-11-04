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

/** CSS `background-image` for a metal, for carriers without SVG defs. */
export function metalGradientCss(material: FoundryMaterial): string {
  const stops = FOUNDRY_METAL_STOPS[material]
    .map(({ offset, color }) => `${color} ${offset * 100}%`)
    .join(', ');
  return `linear-gradient(to bottom, ${stops})`;
}

/** The same proud lift as a CSS filter, for DOM carriers. */
export function proudShadowCss(): string {
  return `drop-shadow(0 ${FOUNDRY_PROUD.dy}px ${FOUNDRY_PROUD.stdDeviation}px rgba(0,0,0,${FOUNDRY_PROUD.floodOpacity}))`;
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
