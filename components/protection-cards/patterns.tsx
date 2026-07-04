/**
 * Per-archetype background patterns (v3 — SVG).
 *
 * Each pattern is *abstract geometry inspired by* a cultural tradition —
 * woven stripes, stepped grids, tessellations, brushmark columns,
 * mosaic stars — never literal religious or copyrighted symbols.
 *
 * v3: converted from div-based to inline SVG for better compositing
 * performance on low-end mobile (the target demographic). SVG elements
 * are GPU-composited as a single layer, vs divs which each create
 * separate stacking contexts.
 *
 * Opacities are intentionally higher (~25-45%) than typical "background
 * texture" because the surface gradient is now per-archetype and bold;
 * the pattern needs to *sit on* it, not fade into it. The visual goal
 * is "carrying the culture's energy", not "subtle accent."
 */

import React from 'react';

export interface PatternProps {
  cardWidth: number;
  cardHeight: number;
  accent: string;
  accentSoft: string;
}

/* ────────────────────────────────────────────────────────────────────
 * SVG frame — shared wrapper. All patterns draw inside this SVG.
 * ──────────────────────────────────────────────────────────────────── */
function PatternFrame({ children, width, height }: { children: React.ReactNode; width: number; height: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Africapitalism — diagonal woven warp + weft.
 * Inspired by West African kente cloth weft/warp grammar. Bright
 * gold + deep brown stripes on the savannah-sunrise surface.
 * ──────────────────────────────────────────────────────────────────── */
export function AfricaWeavePattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const gap = 32;
  const total = Math.ceil((cardWidth + cardHeight) / gap);
  const stripes: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const x = -200 + i * gap;
    stripes.push(
      <rect
        key={`d-${i}`}
        x={x}
        y={-200}
        width={8}
        height={cardHeight + 500}
        fill={i % 4 === 0 ? accentSoft : '#000000'}
        opacity={i % 2 === 0 ? 0.32 : 0.18}
        transform={`rotate(35 ${x} 0)`}
      />,
    );
  }
  // Strong horizontal weft bands
  for (let i = 0; i < 10; i++) {
    stripes.push(
      <rect
        key={`h-${i}`}
        x={0}
        y={40 + i * 108}
        width={cardWidth}
        height={4}
        fill="#000000"
        opacity={0.28}
      />,
    );
  }
  return <PatternFrame width={cardWidth} height={cardHeight}>{stripes}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Buen Vivir — stepped Andean terrace grid.
 * Repeated chakana-adjacent stepped cells filling the surface in a
 * deep-emerald-on-jade register. Reads as cultivated highland.
 * ──────────────────────────────────────────────────────────────────── */
export function BuenVivirTerracePattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const step = 40;
  const cols = Math.ceil(cardWidth / step);
  const rows = Math.ceil(cardHeight / step);
  const blocks: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isStep = (r + c) % 3 === 0;
      const isHL = (r + c) % 7 === 0;
      if (isHL) {
        blocks.push(
          <rect
            key={`${r}-${c}-hl`}
            x={c * step}
            y={r * step}
            width={step - 4}
            height={step - 4}
            fill={accentSoft}
            opacity={0.35}
          />,
        );
      }
      if (isStep) {
        blocks.push(
          <rect
            key={`${r}-${c}-step`}
            x={c * step}
            y={r * step}
            width={step - 4}
            height={step - 4}
            fill="#000000"
            opacity={0.25}
            stroke="#000000"
            strokeWidth={1.5}
            strokeOpacity={0.35}
          />,
        );
      }
    }
  }
  return <PatternFrame width={cardWidth} height={cardHeight}>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Confucian — vertical ink-brush column field.
 * Strong vertical columns evoking calligraphy column flow + horizontal
 * seal lines. Dark ink on cinnabar surface.
 * ──────────────────────────────────────────────────────────────────── */
export function ConfucianColumnPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const gap = 48;
  const total = Math.ceil(cardWidth / gap);
  const cols: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const tall = i % 2 === 0;
    const x = 20 + i * gap;
    cols.push(
      <rect
        key={`col-${i}`}
        x={x}
        y={tall ? 40 : 120}
        width={6}
        height={tall ? cardHeight - 80 : cardHeight - 240}
        fill={i % 5 === 0 ? accentSoft : '#000000'}
        opacity={i % 3 === 0 ? 0.40 : 0.22}
      />,
    );
  }
  // Seal-frame horizontal lines
  for (let i = 0; i < 5; i++) {
    cols.push(
      <rect
        key={`seal-${i}`}
        x={60}
        y={140 + i * 200}
        width={cardWidth - 120}
        height={3}
        fill="#000000"
        opacity={0.45}
      />,
    );
  }
  return <PatternFrame width={cardWidth} height={cardHeight}>{cols}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Gotong Royong — kawung-adjacent diamond/dot tessellation.
 * Bigger, bolder diamonds in the Indonesian batik grammar over the
 * sunset gradient. Reads as cultivated batik cloth, not background.
 * ──────────────────────────────────────────────────────────────────── */
export function GotongDiamondPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const cell = 90;
  const cols = Math.ceil(cardWidth / cell) + 1;
  const rows = Math.ceil(cardHeight / cell) + 1;
  const blocks: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = r % 2 === 0 ? 0 : cell / 2;
      const cx = c * cell + offsetX;
      const cy = r * cell;
      blocks.push(
        <rect
          key={`d-${r}-${c}`}
          x={cx - 18}
          y={cy - 18}
          width={36}
          height={36}
          transform={`rotate(45 ${cx} ${cy})`}
          fill="#000000"
          opacity={0.18}
          stroke={accentSoft}
          strokeWidth={2.5}
          strokeOpacity={0.55}
        />,
      );
      blocks.push(
        <circle
          key={`p-${r}-${c}`}
          cx={cx + 14}
          cy={cy + 14}
          r={4}
          fill={accentSoft}
          opacity={0.85}
        />,
      );
    }
  }
  return <PatternFrame width={cardWidth} height={cardHeight}>{blocks}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Islamic Finance — Alhambra-adjacent star+cross tessellation.
 * Dense overlapping rotated squares forming a real tile-grid feel
 * over the emerald surface. Reads as a mosaic wall, not wallpaper.
 * ──────────────────────────────────────────────────────────────────── */
export function IslamicTessellationPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const cell = 100;
  const cols = Math.ceil(cardWidth / cell) + 1;
  const rows = Math.ceil(cardHeight / cell) + 1;
  const blocks: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cell;
      const cy = r * cell;
      blocks.push(
        <rect
          key={`s-${r}-${c}`}
          x={cx}
          y={cy}
          width={48}
          height={48}
          fill="#000000"
          opacity={0.10}
          stroke={accentSoft}
          strokeWidth={2}
          strokeOpacity={0.55}
        />,
      );
      blocks.push(
        <rect
          key={`r-${r}-${c}`}
          x={cx}
          y={cy}
          width={48}
          height={48}
          transform={`rotate(45 ${cx + 24} ${cy + 24})`}
          fill="#000000"
          opacity={0.10}
          stroke={accentSoft}
          strokeWidth={2}
          strokeOpacity={0.55}
        />,
      );
      // Center dot for each tessellation
      blocks.push(
        <circle
          key={`c-${r}-${c}`}
          cx={cx + 24}
          cy={cy + 24}
          r={3}
          fill={accentSoft}
          opacity={0.85}
        />,
      );
    }
  }
  return <PatternFrame width={cardWidth} height={cardHeight}>{blocks}</PatternFrame>;
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
      <rect
        key={`v-${i}`}
        x={(cardWidth / cols) * i}
        y={0}
        width={1.5}
        height={cardHeight}
        fill={accentSoft}
        opacity={i === cols / 2 ? 0.65 : 0.30}
      />,
    );
  }
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    lines.push(
      <rect
        key={`h-${i}`}
        x={0}
        y={(cardHeight / rows) * i + cardHeight / rows / 2}
        width={cardWidth}
        height={1.5}
        fill={accentSoft}
        opacity={i === Math.floor(rows / 2) ? 0.65 : 0.28}
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
      <circle
        key={`p-${i}`}
        cx={p.x * cardWidth}
        cy={p.y * cardHeight}
        r={6}
        fill={accentSoft}
        opacity={0.95}
        stroke="#ffffff"
        strokeWidth={2}
        strokeOpacity={0.7}
      />,
    );
  });
  return <PatternFrame width={cardWidth} height={cardHeight}>{lines}</PatternFrame>;
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
      <circle
        key={`s-${i}`}
        cx={x}
        cy={y}
        r={r}
        fill={isBright ? accentSoft : '#ffffff'}
        opacity={isBright ? 0.85 : 0.42}
      />,
    );
  }
  // Streaks of accent light
  for (let i = 0; i < 5; i++) {
    const y = seed(i * 100 + 7) * cardHeight;
    dots.push(
      <rect
        key={`streak-${i}`}
        x={0}
        y={y}
        width={cardWidth}
        height={1}
        fill={accentSoft}
        opacity={0.35}
      />,
    );
  }
  return <PatternFrame width={cardWidth} height={cardHeight}>{dots}</PatternFrame>;
}

/* ────────────────────────────────────────────────────────────────────
 * Pan-Caribbean — layered swell lines + archipelago arc.
 * Horizontal wave bands (ocean swell grammar) with a sweeping arc of
 * island dots echoing the Antilles chain. Turquoise on deep-sea surface.
 * ──────────────────────────────────────────────────────────────────── */
export function CaribbeanSwellPattern({ cardWidth, cardHeight, accent, accentSoft }: PatternProps) {
  const parts: React.ReactNode[] = [];
  // Swell bands — pairs of thin lines with alternating tilt, like
  // rendered ocean current charts.
  const bandGap = 72;
  const rows = Math.ceil(cardHeight / bandGap) + 2;
  for (let i = 0; i < rows; i++) {
    const tilt = i % 2 === 0 ? -2.5 : 2.5;
    const y = i * bandGap;
    parts.push(
      <rect
        key={`swell-${i}`}
        x={-60}
        y={y}
        width={cardWidth + 120}
        height={3}
        fill={i % 3 === 0 ? accentSoft : '#000000'}
        opacity={i % 3 === 0 ? 0.4 : 0.22}
        transform={`rotate(${tilt} ${cardWidth / 2} ${y})`}
      />,
    );
    parts.push(
      <rect
        key={`swell-echo-${i}`}
        x={-60}
        y={y + 10}
        width={cardWidth + 120}
        height={1.5}
        fill="#000000"
        opacity={0.14}
        transform={`rotate(${tilt} ${cardWidth / 2} ${y + 10})`}
      />,
    );
  }
  // Archipelago arc — island dots sweeping from lower-left to upper-right,
  // sized irregularly like a real island chain.
  const islands = 9;
  for (let i = 0; i < islands; i++) {
    const t = i / (islands - 1);
    const x = 60 + t * (cardWidth - 140);
    const y = cardHeight * 0.72 - Math.sin(t * Math.PI * 0.9) * cardHeight * 0.38;
    const r = 7 + ((i * 13) % 4) * 4;
    parts.push(
      <circle
        key={`isle-${i}`}
        cx={x}
        cy={y}
        r={r}
        fill={i % 3 === 0 ? accentSoft : accent}
        opacity={i % 3 === 0 ? 0.8 : 0.5}
        stroke={accentSoft}
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />,
    );
  }
  return <PatternFrame width={cardWidth} height={cardHeight}>{parts}</PatternFrame>;
}
