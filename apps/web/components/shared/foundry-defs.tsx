/**
 * FoundryDefs — the four metals as SVG defs, struck from `lib/foundry`.
 *
 * The ring and any DOM/SVG carrier that needs a `url(#…)` paint reference
 * render this inside its own `<defs>`, so a metal is defined once for the
 * whole product. Carriers without SVG paint servers read `metalGradientCss`.
 */

import React from 'react';
import {
  FOUNDRY_METAL_STOPS,
  FOUNDRY_PROUD,
  type FoundryMaterial,
} from '@/lib/foundry';

const MATERIALS: readonly FoundryMaterial[] = ['machined', 'noble', 'living', 'ghost'];

export function metalPaintId(uid: string, material: FoundryMaterial): string {
  return `metal-${material}-${uid}`;
}

export function proudFilterId(uid: string): string {
  return `proud-${uid}`;
}

export function FoundryDefs({ uid }: { uid: string }) {
  return (
    <>
      {MATERIALS.map((material) => (
        <linearGradient
          key={material}
          id={metalPaintId(uid, material)}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          {FOUNDRY_METAL_STOPS[material].map(({ offset, color }) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
      ))}
      {/* The selected leg sits proud of the plate — a lift off
          the die, not a color change. */}
      <filter
        id={proudFilterId(uid)}
        x="-40%"
        y="-40%"
        width="180%"
        height="180%"
      >
        <feDropShadow
          dx={FOUNDRY_PROUD.dx}
          dy={FOUNDRY_PROUD.dy}
          stdDeviation={FOUNDRY_PROUD.stdDeviation}
          floodColor="#000"
          floodOpacity={FOUNDRY_PROUD.floodOpacity}
        />
      </filter>
    </>
  );
}
