/**
 * Per-archetype background patterns (v2 — cranked).
 *
 * Each pattern is *abstract geometry inspired by* a cultural tradition —
 * woven stripes, stepped grids, tessellations, brushmark columns,
 * mosaic stars — never literal religious or copyrighted symbols.
 *
 * Opacities are intentionally higher (~25-45%) than typical "background
 * texture" because the surface gradient is now per-archetype and bold;
 * the pattern needs to *sit on* it, not fade into it. The visual goal
 * is "carrying the culture's energy", not "subtle accent."
 */

import React from 'react';
import { alpha } from './tokens';

export interface PatternProps {
  cardWidth: number;
  cardHeight: number;
  accent: string;
  accentSoft: string;
}

/* ────────────────────────────────────────────────────────────────────
 * Africapitalism — diagonal woven warp + weft.
 * Inspired by West African kente cloth weft/warp grammar. Bright
 * gold + deep brown stripes on the savannah-sunrise surface.
 * ──────────────────────────────────────────────────────────────────── */
export function AfricaWeavePattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const stripes: React.ReactNode[] = [];
  const stripeW = 8;
  const gap = 32;
  const total = Math.ceil((cardWidth + cardHeight) / gap);
  for (let i = 0; i < total; i++) {
    stripes.push(
      <div
        key={`d-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: -200,
          left: -200 + i * gap,
          width: stripeW,
          height: cardHeight + 500,
          background: alpha(i % 4 === 0 ? accentSoft : '#000000', i % 2 === 0 ? 0.32 : 0.18),
          transform: 'rotate(35deg)',
          transformOrigin: 'top left',
        }}
      />,
    );
  }
  // Strong horizontal weft bands
  for (let i = 0; i < 10; i++) {
    stripes.push(
      <div
        key={`h-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 40 + i * 108,
          height: 4,
          background: alpha('#000000', 0.28),
        }}
      />,
    );
  }
  return <PatternFrame>{stripes}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Buen Vivir — stepped Andean terrace grid.
 * Repeated chakana-adjacent stepped cells filling the surface in a
 * deep-emerald-on-jade register. Reads as cultivated highland.
 * ──────────────────────────────────────────────────────────────────── */
export function BuenVivirTerracePattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const blocks: React.ReactNode[] = [];
  const step = 40;
  const cols = Math.ceil(cardWidth / step);
  const rows = Math.ceil(cardHeight / step);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isStep = (r + c) % 3 === 0;
      const isHL = (r + c) % 7 === 0;
      blocks.push(
        <div
          key={`${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: r * step,
            left: c * step,
            width: step - 4,
            height: step - 4,
            background: isHL ? alpha(accentSoft, 0.35) : isStep ? alpha('#000000', 0.25) : 'transparent',
            border: isStep ? `1.5px solid ${alpha('#000000', 0.35)}` : 'none',
          }}
        />,
      );
    }
  }
  return <PatternFrame>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Confucian — vertical ink-brush column field.
 * Strong vertical columns evoking calligraphy column flow + horizontal
 * seal lines. Dark ink on cinnabar surface.
 * ──────────────────────────────────────────────────────────────────── */
export function ConfucianColumnPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const cols: React.ReactNode[] = [];
  const colW = 6;
  const gap = 48;
  const total = Math.ceil(cardWidth / gap);
  for (let i = 0; i < total; i++) {
    const tall = i % 2 === 0;
    cols.push(
      <div
        key={`col-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: tall ? 40 : 120,
          left: 20 + i * gap,
          width: colW,
          height: tall ? cardHeight - 80 : cardHeight - 240,
          background: alpha(i % 5 === 0 ? accentSoft : '#000000', i % 3 === 0 ? 0.40 : 0.22),
        }}
      />,
    );
  }
  // Seal-frame horizontal lines
  for (let i = 0; i < 5; i++) {
    cols.push(
      <div
        key={`seal-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          left: 60,
          right: 60,
          top: 140 + i * 200,
          height: 3,
          background: alpha('#000000', 0.45),
        }}
      />,
    );
  }
  return <PatternFrame>{cols}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Gotong Royong — kawung-adjacent diamond/dot tessellation.
 * Bigger, bolder diamonds in the Indonesian batik grammar over the
 * sunset gradient. Reads as cultivated batik cloth, not background.
 * ──────────────────────────────────────────────────────────────────── */
export function GotongDiamondPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const blocks: React.ReactNode[] = [];
  const cell = 90;
  const cols = Math.ceil(cardWidth / cell) + 1;
  const rows = Math.ceil(cardHeight / cell) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = r % 2 === 0 ? 0 : cell / 2;
      const cx = c * cell + offsetX;
      const cy = r * cell;
      blocks.push(
        <div
          key={`d-${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: cy,
            left: cx,
            width: 36,
            height: 36,
            transform: 'rotate(45deg)',
            border: `2.5px solid ${alpha(accentSoft, 0.55)}`,
            background: alpha('#000000', 0.18),
          }}
        />,
      );
      blocks.push(
        <div
          key={`p-${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: cy + 14,
            left: cx + 14,
            width: 8,
            height: 8,
            borderRadius: 4,
            background: alpha(accentSoft, 0.85),
          }}
        />,
      );
    }
  }
  return <PatternFrame>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Islamic Finance — Alhambra-adjacent star+cross tessellation.
 * Dense overlapping rotated squares forming a real tile-grid feel
 * over the emerald surface. Reads as a mosaic wall, not wallpaper.
 * ──────────────────────────────────────────────────────────────────── */
export function IslamicTessellationPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const blocks: React.ReactNode[] = [];
  const cell = 100;
  const cols = Math.ceil(cardWidth / cell) + 1;
  const rows = Math.ceil(cardHeight / cell) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cell;
      const cy = r * cell;
      blocks.push(
        <div
          key={`s-${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: cy,
            left: cx,
            width: 48,
            height: 48,
            border: `2px solid ${alpha(accentSoft, 0.55)}`,
            background: alpha('#000000', 0.10),
          }}
        />,
      );
      blocks.push(
        <div
          key={`r-${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: cy,
            left: cx,
            width: 48,
            height: 48,
            border: `2px solid ${alpha(accentSoft, 0.55)}`,
            background: alpha('#000000', 0.10),
            transform: 'rotate(45deg)',
          }}
        />,
      );
      // Center dot for each tessellation
      blocks.push(
        <div
          key={`c-${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: cy + 21,
            left: cx + 21,
            width: 6,
            height: 6,
            borderRadius: 3,
            background: alpha(accentSoft, 0.85),
          }}
        />,
      );
    }
  }
  return <PatternFrame>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Global — luminous meridian grid + region pins.
 * Cyan latitudes + longitudes on the deep-ocean surface. Reads as
 * a navigation chart.
 * ──────────────────────────────────────────────────────────────────── */
export function GlobalMeridianPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const lines: React.ReactNode[] = [];
  const cols = 14;
  for (let i = 0; i < cols; i++) {
    lines.push(
      <div
        key={`v-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: (cardWidth / cols) * i,
          width: 1.5,
          height: cardHeight,
          background: alpha(accentSoft, i === cols / 2 ? 0.65 : 0.30),
        }}
      />,
    );
  }
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    lines.push(
      <div
        key={`h-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: (cardHeight / rows) * i + cardHeight / rows / 2,
          width: cardWidth,
          height: 1.5,
          background: alpha(accentSoft, i === Math.floor(rows / 2) ? 0.65 : 0.28),
        }}
      />,
    );
  }
  // Brighter region pin dots scattered
  const pins = [
    { x: 0.18, y: 0.30 },
    { x: 0.35, y: 0.55 },
    { x: 0.62, y: 0.25 },
    { x: 0.78, y: 0.65 },
    { x: 0.50, y: 0.78 },
    { x: 0.88, y: 0.40 },
    { x: 0.12, y: 0.70 },
    { x: 0.45, y: 0.18 },
  ];
  pins.forEach((p, i) => {
    lines.push(
      <div
        key={`p-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: p.y * cardHeight - 6,
          left: p.x * cardWidth - 6,
          width: 12,
          height: 12,
          borderRadius: 6,
          background: alpha(accentSoft, 0.95),
          border: `2px solid ${alpha('#ffffff', 0.7)}`,
        }}
      />,
    );
  });
  return <PatternFrame>{lines}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Custom — bright confetti/spark scatter.
 * Deterministic pseudo-random dot field — reads as personalized
 * particles over the electric violet surface.
 * ──────────────────────────────────────────────────────────────────── */
export function CustomScatterPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const dots: React.ReactNode[] = [];
  const seed = (i: number) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 140; i++) {
    const x = seed(i * 2) * cardWidth;
    const y = seed(i * 2 + 1) * cardHeight;
    const r = 1.5 + seed(i * 3) * 4;
    const isBright = i % 4 === 0;
    dots.push(
      <div
        key={`s-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: y - r,
          left: x - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          background: alpha(isBright ? accentSoft : '#ffffff', isBright ? 0.85 : 0.42),
        }}
      />,
    );
  }
  // Streaks of accent light
  for (let i = 0; i < 5; i++) {
    const y = seed(i * 100 + 7) * cardHeight;
    dots.push(
      <div
        key={`streak-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: y,
          left: 0,
          right: 0,
          height: 1,
          background: alpha(accentSoft, 0.35),
        }}
      />,
    );
  }
  return <PatternFrame>{dots}</PatternFrame>;
}

/* ─────────────────────────────────────────────────────────────────── */
function PatternFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
}
