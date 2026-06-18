/**
 * RegionGrid — shared DiversiFi-native background motif.
 *
 * Faint dot grid suggesting longitude/latitude coordinates over a dark
 * slate surface. Reads as "global / multi-region" without literal flags
 * or maps. Tints to the archetype accent so each card carries its own
 * tonal register even when the grid spacing is uniform.
 *
 * Sized via explicit `cardWidth`/`cardHeight` because satori 0.26's
 * percentage positioning is uneven for absolutely-positioned elements
 * (lesson paid for during the SportWarren rebuild).
 */

import React from 'react';
import { alpha } from './tokens';

export interface RegionGridProps {
  cardWidth: number;
  cardHeight: number;
  accent: string;
  opacity?: number;
  spacing?: number;
}

export function RegionGrid({
  cardWidth,
  cardHeight,
  accent,
  opacity = 0.10,
  spacing = 60,
}: RegionGridProps) {
  const cols = Math.floor(cardWidth / spacing);
  const rows = Math.floor(cardHeight / spacing);
  const offsetX = (cardWidth - (cols - 1) * spacing) / 2;
  const offsetY = (cardHeight - (rows - 1) * spacing) / 2;
  const dotColor = alpha(accent, opacity);

  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const radius = (r + c) % 5 === 0 ? 3 : 1.5;
      dots.push(
        <div
          key={`${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: offsetY + r * spacing - radius,
            left: offsetX + c * spacing - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            background: dotColor,
          }}
        />,
      );
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {dots}
    </div>
  );
}
