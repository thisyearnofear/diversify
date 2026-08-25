/**
 * Digital Guardian mark — single source of truth for geometry and palette.
 *
 * Consumed twice, so the live mascot and its raster exports never diverge:
 * - `GuardianMascot.tsx` — interactive React component (moods, gaze, blink)
 * - `scripts/render-guardian-assets.ts` — deterministic SVG→PNG raster
 *   export for icon.png / splash.png / preview.png / embed-image.png
 *
 * Spec: docs/design-language.md §9. Identity: pointed heraldic shield, dark
 * visor screen face, digital square eyes, gold belly coin (the app's Coin
 * motif as the Guardian's core). No mouth — the visor is the face.
 */

/** viewBox is 0 0 100 100 for all renderers. */
export const GUARDIAN_VIEWBOX = 100;

/** Classic pointed shield: apex top, straight shoulders, taper to one point. */
export const SHIELD_D =
  'M50 10 L85 25 V50 C85 75 50 90 50 90 C50 90 15 75 15 50 V25 L50 10 Z';

/** Visor panel inset — the dark screen face the eyes live on. */
export const VISOR_D =
  'M50 20 L75 30 V50 C75 65 50 75 50 75 C50 75 25 65 25 50 V30 L50 20 Z';

/** Semantic palette — ice/edge blue family, visor slate, coin gold. */
export const GUARDIAN_PALETTE = {
  edge: '#2563eb',
  visor: '#1e293b',
  eye: '#60a5fa',
  gold: '#f59e0b',
  ring: '#fde68a',
  iceTop: '#eff6ff',
  iceBottom: '#dbeafe',
  /** Deep slate navy — canonical field for raster compositions. */
  field: '#0f172a',
} as const;

/** Digital eyes: two 8×8 rounded squares on the visor, one per side. */
export const EYES = [
  { x: 35, y: 40, size: 8, rx: 2 },
  { x: 57, y: 40, size: 8, rx: 2 },
] as const;

/** Belly coin: gold disc + lighter inner ring, straddling the visor's edge. */
export const COIN = { cx: 50, cy: 72, r: 8, ringR: 5.2, ringW: 1.6 } as const;

/**
 * Static SVG inner markup (defs + shapes) for the mark in its neutral pose.
 * Used by the raster export script; the live component renders the same
 * geometry from these constants with framer-motion wiring.
 *
 * @param idPrefix unique prefix for gradient defs (multiple marks per SVG)
 */
export function guardianMarkInner(idPrefix: string): string {
  const P = GUARDIAN_PALETTE;
  const body = `${idPrefix}-body`;
  const shade = `${idPrefix}-shade`;
  const coin = `${idPrefix}-coin`;
  const eyes = EYES.map(
    (e) =>
      `<rect x="${e.x}" y="${e.y}" width="${e.size}" height="${e.size}" rx="${e.rx}" fill="${P.eye}"/>`,
  ).join('');
  return `<defs>
  <linearGradient id="${body}" x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="${P.iceTop}"/>
    <stop offset="100%" stop-color="${P.iceBottom}"/>
  </linearGradient>
  <linearGradient id="${shade}" x1="50" y1="55" x2="50" y2="90" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="${P.edge}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${P.edge}" stop-opacity="0.14"/>
  </linearGradient>
  <linearGradient id="${coin}" x1="50" y1="${COIN.cy - COIN.r}" x2="50" y2="${COIN.cy + COIN.r}" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#fcd34d"/>
    <stop offset="100%" stop-color="${P.gold}"/>
  </linearGradient>
</defs>
<path d="${SHIELD_D}" fill="url(#${body})" stroke="${P.edge}" stroke-width="2" stroke-linejoin="round"/>
<path d="${SHIELD_D}" fill="url(#${shade})"/>
<path d="${VISOR_D}" fill="${P.visor}" opacity="0.85"/>
<circle cx="${COIN.cx}" cy="${COIN.cy}" r="${COIN.r}" fill="url(#${coin})"/>
<circle cx="${COIN.cx}" cy="${COIN.cy}" r="${COIN.ringR}" stroke="${P.ring}" stroke-width="${COIN.ringW}" fill="none" opacity="0.9"/>
${eyes}`;
}

/**
 * Complete standalone SVG document of the mark, centered on a field.
 *
 * @param size output width/height in px (1:1 square)
 * @param markScale mark render size as a fraction of `size` (0..1)
 * @param background field color (or 'transparent')
 */
export function guardianMarkSquareSvg(
  size: number,
  markScale = 0.86,
  background: string | 'transparent' = GUARDIAN_PALETTE.field,
): string {
  const bg =
    background === 'transparent'
      ? ''
      : `<rect width="${size}" height="${size}" fill="${background}"/>`;
  const mark = size * markScale;
  const offset = (size - mark) / 2;
  const s = mark / GUARDIAN_VIEWBOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${bg}
<g transform="translate(${offset} ${offset}) scale(${s})">
${guardianMarkInner('sq')}
</g>
</svg>`;
}

/**
 * 1200×630 OG composition: the Guardian emerges from the lower-right over the
 * deep slate field — per §9 raster rules (lower-corner emergence, visually
 * dominant, no chrome, no text). The shield's bottom point and right shoulder
 * crop at the canvas edge to sell the emergence.
 */
export function guardianEmbedSvg(): string {
  const W = 1200;
  const H = 630;
  const mark = 560;
  const s = mark / GUARDIAN_VIEWBOX;
  // Center placed so right overflows ~70px and bottom ~80px → emergence.
  const cx = W - 210;
  const cy = H - 200;
  const P = GUARDIAN_PALETTE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${P.field}"/>
<g transform="translate(${cx} ${cy}) scale(${s}) translate(-50 -50)">
${guardianMarkInner('og')}
</g>
</svg>`;
}
