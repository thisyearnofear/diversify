/**
 * rive-color.ts — host-side helpers for driving view-model color properties
 * on Rive objects (design-language §5 scoped exception).
 *
 * Colors cross the WASM boundary as channels, not hex strings, so every
 * bound accent goes through `hexToRgb`. `shadeHex` derives the light/dark
 * gradient stops the claim coin binds from one accent.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Lighten (positive amt) or darken (negative) a hex color toward white/black.
 * amt is a 0–1 fraction of the distance.
 */
export function shadeHex(hex: string, amt: number): Rgb {
  const { r, g, b } = hexToRgb(hex);
  const t = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  return {
    r: Math.round(r + (t - r) * k),
    g: Math.round(g + (t - g) * k),
    b: Math.round(b + (t - b) * k),
  };
}
