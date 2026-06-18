/**
 * Renders the 7 Protection Plan cards as 1080×1920 vertical Story PNGs
 * into `docs/makeathon/assets/stories/`. Same archetype data, vertical
 * composition — Instagram/Reels/TikTok format.
 *
 *   pnpm tsx scripts/render-protection-stories.ts
 */

import React from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { STORY_REGISTRY } from '../components/protection-cards/cards';
import { ARCHETYPE_ORDER, ArchetypeId } from '../components/protection-cards/tokens';
import { STORY_SIZE } from '../components/protection-cards/StoryCard';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(HERE, '..', 'docs', 'makeathon', 'assets', 'stories');

async function loadFromGoogleFonts(family: string, weight: number): Promise<ArrayBuffer> {
  const ieUA = 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)';
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
    { headers: { 'User-Agent': ieUA } },
  );
  if (!cssRes.ok) throw new Error(`${family} ${weight} CSS fetch failed: ${cssRes.status}`);
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\((https:[^)]+)\)/);
  if (!match) throw new Error(`No font URL in CSS for ${family} ${weight}`);
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`${family} ${weight} font fetch failed: ${fontRes.status}`);
  return fontRes.arrayBuffer();
}

const ARCHETYPE_FILENAMES: Record<ArchetypeId, string> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen-vivir',
  confucian: 'confucian',
  gotong_royong: 'gotong-royong',
  islamic_finance: 'islamic-finance',
  global_diversification: 'global-diversification',
  custom: 'custom',
};

async function main() {
  await mkdir(ASSETS_DIR, { recursive: true });

  console.log('Loading Space Grotesk weights…');
  const [regular, medium, bold] = await Promise.all([
    loadFromGoogleFonts('Space Grotesk', 400),
    loadFromGoogleFonts('Space Grotesk', 500),
    loadFromGoogleFonts('Space Grotesk', 700),
  ]);

  for (const id of ARCHETYPE_ORDER) {
    const Card = STORY_REGISTRY[id];
    const element = React.createElement(Card);
    console.log(`[${id}] rendering story…`);
    const svg = await satori(element, {
      width: STORY_SIZE.w,
      height: STORY_SIZE.h,
      fonts: [
        { name: 'Space Grotesk', data: regular, weight: 400, style: 'normal' },
        { name: 'Space Grotesk', data: medium, weight: 500, style: 'normal' },
        { name: 'Space Grotesk', data: bold, weight: 700, style: 'normal' },
      ],
    });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: STORY_SIZE.w } })
      .render()
      .asPng();
    const file = path.join(ASSETS_DIR, `${ARCHETYPE_FILENAMES[id]}-story.png`);
    await writeFile(file, png);
    console.log(`  → ${path.relative(process.cwd(), file)}  (${png.length} bytes)`);
  }

  console.log('\nDone. 7 story PNGs written to docs/makeathon/assets/stories/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
