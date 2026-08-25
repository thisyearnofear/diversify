"use client";

import React from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { Coin } from "../shared/FloatingCoins";

export interface LensCoinDef {
  id: string;
  label: string;
  glyph: string;
  accent: string;
}

interface LensCoinSelectorProps {
  lenses: LensCoinDef[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Accessible group name (e.g. "Strategies"). */
  ariaLabel?: string;
  /** Let the row wrap instead of single-file (for longer option lists). */
  wrap?: boolean;
  /** Optional shared-layout id factory. When set, the tapped coin carries
      a `layoutId` so the surface continuing the choice can fly it in
      (hero transition). Leave unset for standalone rows. */
  coinLayoutId?: (id: string) => string;
}

/** Velocity (px/s) for a flick to advance the selection one step. */
const FLICK_VELOCITY = 500;

/**
 * LensCoinSelector — a row of values-lens coins instead of text cards.
 *
 * Tap to select; drag with momentum to flick to the next lens. The strip
 * rubber-bands back to rest on release, tilting slightly under displacement
 * (borrowed from the GSAP trail motif physics: displacement -> rotation).
 *
 * Styling notes:
 * - Active coin springs up + flips (shared coin motif, no new variants).
 * - Inactive coins sit grayscale/dimmed so the row reads as a choice,
 *   not decoration.
 * - Reduced-motion: drag + tilt off; tap stays.
 */
export function LensCoinSelector({ lenses, selected, onSelect, ariaLabel = "Values lenses", wrap = false, coinLayoutId }: LensCoinSelectorProps) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  // Rubber-band tilt: small rotation proportional to drag displacement.
  const rotate = useTransform(x, (v) => Math.max(-4, Math.min(4, v * 0.02)));

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.velocity.x) < FLICK_VELOCITY) return;
    const dir = info.velocity.x < 0 ? 1 : -1;
    const current = lenses.findIndex((l) => l.id === selected);
    const next = Math.min(
      lenses.length - 1,
      Math.max(0, current + dir),
    );
    if (next === current) return;
    onSelect(lenses[next].id);
  };

  return (
    <div
      className="flex items-center justify-center gap-3 select-none cursor-grab active:cursor-grabbing"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      <motion.div
        className={`flex items-center justify-center gap-3${wrap ? " flex-wrap" : ""}`}
        drag={reduceMotion ? false : "x"}
        dragElastic={0.6}
        dragSnapToOrigin
        style={{ x, rotate }}
        onDragEnd={handleDragEnd}
      >
        {lenses.map((lens) => {
          const isActive = lens.id === selected;
          return (
            <motion.button
              key={lens.id}
              layoutId={coinLayoutId ? coinLayoutId(lens.id) : undefined}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={lens.label}
              onClick={() => onSelect(lens.id)}
              whileTap={{ scale: 0.92 }}
              whileHover={isActive ? undefined : { scale: 1.06 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="min-w-11 min-h-11 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
              style={
                isActive
                  ? ({ ['--lens-accent' as string]: lens.accent, ['--lens-accent-soft' as string]: `${lens.accent}80` } as React.CSSProperties)
                  : undefined
              }
            >
              <motion.span
                className={`block ${isActive ? 'lens-coin-active lens-coin-pulse' : ''}`}
                animate={{
                  scale: isActive ? 1.12 : 0.86,
                  rotateY: isActive ? 360 : 0,
                  opacity: isActive ? 1 : 0.5,
                  filter: isActive ? "grayscale(0%)" : "grayscale(60%)",
                }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                style={{ transformPerspective: 400 }}
              >
                <Coin size={44} symbol={lens.glyph} color={lens.accent} variant="selection" />
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
