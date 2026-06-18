/**
 * Per-archetype background patterns.
 *
 * Replaces the uniform RegionGrid with a distinct geometric vocabulary
 * for each card. Patterns are **abstract geometry inspired by** the
 * culture — woven stripes, stepped grids, tessellations, brushmark
 * columns — never literal religious or copyrighted symbols.
 *
 * All patterns absolute-positioned inside a 1080×1080 frame; opacity
 * tuned to read peripheral without competing with hero or type.
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
 * Africapitalism — diagonal woven stripe field.
 * Inspired by West African textile weft/warp grammar without copying
 * any kente colorway or specific cloth.
 * ──────────────────────────────────────────────────────────────────── */
export function AfricaWeavePattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const stripes: React.ReactNode[] = [];
  const stripeW = 6;
  const gap = 36;
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
          background: alpha(i % 4 === 0 ? accentSoft : accent, i % 2 === 0 ? 0.08 : 0.05),
          transform: 'rotate(35deg)',
          transformOrigin: 'top left',
        }}
      />,
    );
  }
  // Horizontal weft bands
  for (let i = 0; i < 8; i++) {
    stripes.push(
      <div
        key={`h-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 60 + i * 130,
          height: 2,
          background: alpha(accent, 0.10),
        }}
      />,
    );
  }
  return <PatternFrame>{stripes}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Buen Vivir — stepped-grid horizon field.
 * Andean terrace + chakana-adjacent stepped grammar.
 * ──────────────────────────────────────────────────────────────────── */
export function BuenVivirTerracePattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const blocks: React.ReactNode[] = [];
  const step = 36;
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
            background: isHL ? alpha(accentSoft, 0.08) : isStep ? alpha(accent, 0.05) : 'transparent',
            border: isStep ? `1px solid ${alpha(accent, 0.10)}` : 'none',
          }}
        />,
      );
    }
  }
  return <PatternFrame>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Confucian — vertical ink-brush column field.
 * Suggests calligraphy column flow without using any literal character.
 * Restrained vermilion register.
 * ──────────────────────────────────────────────────────────────────── */
export function ConfucianColumnPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const cols: React.ReactNode[] = [];
  const colW = 4;
  const gap = 56;
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
          left: 30 + i * gap,
          width: colW,
          height: tall ? cardHeight - 80 : cardHeight - 240,
          background: alpha(i % 5 === 0 ? accentSoft : accent, i % 3 === 0 ? 0.10 : 0.05),
        }}
      />,
    );
  }
  // Horizontal seal-line accents
  for (let i = 0; i < 3; i++) {
    cols.push(
      <div
        key={`seal-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          left: 80,
          right: 80,
          top: 200 + i * 280,
          height: 1,
          background: alpha(accent, 0.18),
        }}
      />,
    );
  }
  return <PatternFrame>{cols}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Gotong Royong — kawung-adjacent diamond/dot tessellation.
 * Inspired by Indonesian batik geometric vocabulary; uses repeated
 * rotated squares with central dots, not any specific motif.
 * ──────────────────────────────────────────────────────────────────── */
export function GotongDiamondPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const blocks: React.ReactNode[] = [];
  const cell = 80;
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
            width: 24,
            height: 24,
            transform: 'rotate(45deg)',
            border: `1.5px solid ${alpha(accent, 0.18)}`,
          }}
        />,
      );
      blocks.push(
        <div
          key={`p-${r}-${c}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: cy + 9,
            left: cx + 9,
            width: 6,
            height: 6,
            borderRadius: 3,
            background: alpha(accentSoft, 0.25),
          }}
        />,
      );
    }
  }
  return <PatternFrame>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Islamic Finance — 8-point star tessellation.
 * Repeating rotated squares creating the classic Alhambra-adjacent
 * star-and-cross grid. Abstract geometry, no religious imagery.
 * ──────────────────────────────────────────────────────────────────── */
export function IslamicTessellationPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const blocks: React.ReactNode[] = [];
  const cell = 90;
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
            width: 36,
            height: 36,
            border: `1.5px solid ${alpha(accent, 0.14)}`,
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
            width: 36,
            height: 36,
            border: `1.5px solid ${alpha(accent, 0.14)}`,
            transform: 'rotate(45deg)',
          }}
        />,
      );
    }
  }
  return <PatternFrame>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Global — longitude / latitude meridian grid with region markers.
 * Reads as a world chart abstraction without using any flag or
 * continent silhouette.
 * ──────────────────────────────────────────────────────────────────── */
export function GlobalMeridianPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const lines: React.ReactNode[] = [];
  // Verticals (longitudes)
  const cols = 12;
  for (let i = 0; i < cols; i++) {
    lines.push(
      <div
        key={`v-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: (cardWidth / cols) * i,
          width: 1,
          height: cardHeight,
          background: alpha(accent, i === cols / 2 ? 0.22 : 0.08),
        }}
      />,
    );
  }
  // Horizontals (latitudes)
  const rows = 7;
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
          height: 1,
          background: alpha(accent, i === Math.floor(rows / 2) ? 0.20 : 0.07),
        }}
      />,
    );
  }
  // Region pin dots
  const pins = [
    { x: 0.18, y: 0.30 },
    { x: 0.35, y: 0.55 },
    { x: 0.62, y: 0.25 },
    { x: 0.78, y: 0.65 },
    { x: 0.50, y: 0.78 },
    { x: 0.88, y: 0.40 },
  ];
  pins.forEach((p, i) => {
    lines.push(
      <div
        key={`p-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: p.y * cardHeight - 4,
          left: p.x * cardWidth - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          background: alpha(accentSoft, 0.65),
        }}
      />,
    );
  });
  return <PatternFrame>{lines}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Custom — scattered dot field with subtle accent burst.
 * Suggests user-controlled, configurable space.
 * ──────────────────────────────────────────────────────────────────── */
export function CustomScatterPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const dots: React.ReactNode[] = [];
  // Deterministic pseudo-random scatter
  const seed = (i: number) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 90; i++) {
    const x = seed(i * 2) * cardWidth;
    const y = seed(i * 2 + 1) * cardHeight;
    const r = 1 + seed(i * 3) * 3;
    const useAccent = i % 5 === 0;
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
          background: alpha(useAccent ? accentSoft : accent, useAccent ? 0.55 : 0.18),
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
