/**
 * Renders the Digital Guardian mark to the app's static raster assets.
 * Deterministic SVG→PNG via @resvg/resvg-js — the character is the SVG
 * source of truth (apps/web/components/shared/guardian-mark.ts); no AI
 * image model is involved (see docs/design-language.md §9, raster rules).
 *
 *   pnpm render-guardian-assets
 *
 * Outputs (apps/web/public/):
 *   icon.png          1024×1024 — favicon, PWA icon (any + maskable),
 *                     apple-touch-icon: centered mark on the slate field
 *   preview.png       1024×1024 — same composition (external previews)
 *   splash.png        1024×1024 — app splash / share splash image
 *   embed-image.png   1200×630  — OG/twitter card: Guardian emerging from
 *                     the lower-right over the field (lower-corner
 *                     emergence, no text, no chrome)
 */

import { Resvg } from '@resvg/resvg-js';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  guardianEmbedSvg,
  guardianMarkSquareSvg,
} from '../apps/web/components/shared/guardian-mark';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(HERE, '..', 'apps', 'web', 'public');

function renderPng(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } })
    .render()
    .asPng();
}

interface Target {
  file: string;
  svg: string;
  width: number;
  note: string;
}

const TARGETS: Target[] = [
  {
    file: 'icon.png',
    // 0.8 mark scale keeps the full silhouette inside the PWA maskable safe
    // zone (centered circle ≈ 80% of the square).
    svg: guardianMarkSquareSvg(1024, 0.8),
    width: 1024,
    note: 'favicon / PWA icon (any + maskable)',
  },
  {
    file: 'preview.png',
    svg: guardianMarkSquareSvg(1024, 0.8),
    width: 1024,
    note: 'external previews',
  },
  {
    file: 'splash.png',
    svg: guardianMarkSquareSvg(1024, 0.86),
    width: 1024,
    note: 'app / share splash',
  },
  {
    file: 'embed-image.png',
    svg: guardianEmbedSvg(),
    width: 1200,
    note: 'OG + twitter card, lower-right emergence',
  },
];

async function main() {
  for (const t of TARGETS) {
    const png = renderPng(t.svg, t.width);
    const out = path.join(PUBLIC_DIR, t.file);
    await writeFile(out, png);
    console.log(`  → apps/web/public/${t.file}  (${png.length.toLocaleString()} bytes)  ${t.note}`);
  }
  console.log('\nDone. 4 raster assets rendered from the SVG mark.');
  console.log('Visually review the outputs before committing.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
