"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import { Coin } from "../shared/FloatingCoins";

export interface LensCoinDef {
  id: string;
  label: string;
  /** Optional long-form description. Shown in the peek chip (stage) and
   *  carried on the lens; optional because some callers (e.g.
   *  GuardianMobileWizard) only need label + glyph + accent. */
  description?: string;
  glyph: string;
  accent: string;
}

/** How many distinct combine choreographies the stage cycles through. */
export const COMBINE_VARIANT_COUNT = 3;

/** Seconds before the detail panel begins its entrance, per variant —
 *  matched to where each coin choreography hands the moment off. The
 *  parent stage imports this so panel and coins stay in sync. */
export const COMBINE_PANEL_DELAY: readonly number[] = [0.5, 0.6, 0.35];

/**
 * Coin metrics, viewport-aware. Five coins hit visually crowded widths
 * below ~380px, so the coins and gap shrink on compact screens. Every
 * piece of combine math reads `pitch` from this hook — the animation
 * offsets can never disagree with the rendered spacing.
 *
 * Slot width == pitch: each coin sits in a fixed-width slot so the
 * short label under it never pushes the centres apart.
 */
export function useLensCoinMetrics(): {
  coinSize: number;
  gapClass: string;
  pitch: number;
} {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 380px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return compact
    ? { coinSize: 46, gapClass: "gap-0", pitch: 54 }
    : { coinSize: 56, gapClass: "gap-0", pitch: 68 };
}

/** CSS x position (relative to the stage) of slot `index`'s centre —
 *  the point the detail panel blooms from. */
export function combineOriginX(index: number, count: number, pitch: number): string {
  const offset = (index - (count - 1) / 2) * pitch;
  return offset === 0 ? "50%" : `calc(50% + ${offset}px)`;
}

// Per-slot breath + shine durations: slow, coprime, so the row reads as
// five independent living things and never syncs up mechanically.
const BREATH = [5.4, 6.2, 5.8, 6.6, 6.0];
const SHINE = [2.4, 2.7, 2.2, 2.9, 2.5];

interface CoinMotion {
  animate: TargetAndTransition;
  transition: Transition;
}

/** The chosen coin's moment-of-choice beat, per variant. Always ends
 *  dissolved — the parent panel takes over from this exact point. */
function chosenCombine(variant: number): CoinMotion {
  if (variant === 0) {
    // Bloom — celebratory spin, a swell, then it dissolves as the
    // panel's clip-path circle opens from its centre.
    return {
      animate: {
        rotateY: [0, 360],
        scale: [1, 1.3, 1.12, 1.4],
        opacity: [1, 1, 1, 0],
      },
      transition: { duration: 0.75, times: [0, 0.35, 0.7, 1], ease: "easeInOut" },
    };
  }
  if (variant === 1) {
    // Cascade — satisfied double-bounce, then sinks out of the way as
    // the panel cascades in behind it.
    return {
      animate: {
        rotateY: [0, -360],
        y: [0, -16, 0, 10],
        scale: [1, 1.38, 1.22, 1.05],
        opacity: [1, 1, 1, 0],
      },
      transition: { duration: 0.85, times: [0, 0.3, 0.62, 1], ease: "easeInOut" },
    };
  }
  // Burst — a fast double spin, a bright overshoot, then an implosion
  // as the panel erupts outward from it.
  return {
    animate: {
      rotateY: [0, 720],
      scale: [1, 1.6, 0.3],
      opacity: [1, 1, 0],
    },
    transition: { duration: 0.6, times: [0, 0.72, 1], ease: ["easeOut", "easeIn"] },
  };
}

/** The unchosen coins' journey into (or out of the way of) the pick. */
function unchosenCombine(
  variant: number,
  dx: number, // horizontal travel needed to land on the chosen coin
  offset: number, // index - chosenIndex: sign points away from the pick
  dist: number, // |offset|
  maxDist: number,
  pitch: number,
): CoinMotion {
  if (variant === 0) {
    // Bloom — arc over the top into the chosen coin, nearest first:
    // the row folds into the pick and is absorbed.
    return {
      animate: {
        x: [0, dx * 0.55, dx],
        y: [0, -36, -4],
        scale: [1, 0.92, 0.08],
        opacity: [1, 1, 0],
      },
      transition: {
        duration: 0.5,
        delay: 0.05 * dist,
        times: [0, 0.55, 1],
        ease: "easeInOut",
      },
    };
  }
  if (variant === 1) {
    // Cascade — tumbling inward, furthest first, like dominoes folding
    // onto the pick.
    const dir = offset === 0 ? 1 : Math.sign(offset);
    return {
      animate: {
        x: [0, dx * 0.6, dx],
        y: [0, 30, 0],
        rotate: [0, -160 * dir, 0],
        scale: [1, 1, 0.08],
        opacity: [1, 1, 0],
      },
      transition: {
        duration: 0.55,
        delay: 0.09 * (maxDist - dist),
        times: [0, 0.55, 1],
        ease: "easeInOut",
      },
    };
  }
  // Burst — the unchosen coins scatter outward and spin away; the pick
  // owns the stage alone.
  return {
    animate: {
      x: [0, offset * pitch * 0.9],
      y: [0, -24 - dist * 12],
      rotate: [0, offset * 50],
      scale: [1, 0.45],
      opacity: [1, 0],
    },
    transition: { duration: 0.4, delay: 0.03 * dist, ease: "easeIn" },
  };
}

type Presentation = "row" | "stage";

interface LensCoinSelectorProps {
  lenses: LensCoinDef[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Accessible group name (e.g. "Strategies"). */
  ariaLabel?: string;
  /**
   * 'row' (default) — a plain picker row: full stack stays visible,
   * active coin spins on its turntable. Used by GuardianMobileWizard.
   *
   * 'stage' — preview-then-commit: the first tap peeks (coin lifts,
   *   name + one-liner chip appears), the second tap on the same coin
   *   commits and runs the combine choreography. Flick left/right to
   *   move the peek between coins.
   */
  presentation?: Presentation;
  /** Which combine choreography to play (stage only). The parent cycles
   *  this 0→1→2 on each selection. */
  combineVariant?: number;
  /** Remount counter for the row (stage only): the parent bumps it when
   *  returning from the detail view so coins burst back out of the old
   *  convergence point instead of just fading in. */
  emergeKey?: number;
}

/**
 * LensCoinSelector — the value-lens coins.
 *
 * Both presentations fix the mystery-meat problem: every coin carries
 * a one-word label beneath it, so the five options are scannable at a
 * glance (icon + text beats icon alone). The stage adds a two-tap
 * preview gate — coins are theatrical, committing to one opens a
 * full-stage bloom, so the first tap previews rather than commits.
 */
export function LensCoinSelector({
  lenses,
  selected,
  onSelect,
  ariaLabel = "Values lenses",
  presentation = "row",
  combineVariant = 0,
  emergeKey = 0,
}: LensCoinSelectorProps) {
  const reduceMotion = useReducedMotion();
  const { coinSize, gapClass, pitch } = useLensCoinMetrics();
  const selectedIndex = lenses.findIndex((l) => l.id === selected);
  const combining = presentation === "stage" && selectedIndex >= 0;

  // Peek (preview-then-commit), stage only: first tap lifts the coin and
  // names it; second tap on the same coin commits. Flick cycles the peek.
  const [peekedId, setPeekedId] = useState<string | null>(null);
  const peekedIndex = lenses.findIndex((l) => l.id === peekedId);

  // Remember the last chosen slot so that when the user returns to the
  // row, the coins can burst back out of that exact point.
  const lastSelectedRef = useRef(-1);
  if (selectedIndex >= 0) lastSelectedRef.current = selectedIndex;

  const handleCoinTap = (lens: LensCoinDef) => {
    if (presentation !== "stage") {
      onSelect(lens.id);
      return;
    }
    if (peekedId === lens.id) {
      // Second tap — commit to the combine.
      setPeekedId(null);
      onSelect(lens.id);
    } else {
      setPeekedId(lens.id);
    }
  };

  // Flick/swipe — moves the peek one slot over. Direction reads like a
  // carousel: content follows the finger (flick left → next).
  const handlePanEnd = (_e: unknown, info: PanInfo) => {
    if (presentation !== "stage" || combining || reduceMotion) return;
    if (Math.abs(info.offset.x) < 50 && Math.abs(info.velocity.x) < 350) return;
    const dir = info.offset.x < 0 || info.velocity.x < 0 ? 1 : -1;
    const base = peekedIndex >= 0 ? peekedIndex : dir === 1 ? -1 : lenses.length;
    const next = Math.min(lenses.length - 1, Math.max(0, base + dir));
    if (next !== peekedIndex && next >= 0 && next < lenses.length) {
      setPeekedId(lenses[next].id);
    }
  };

  const peekedLens = peekedIndex >= 0 ? lenses[peekedIndex] : null;

  const row = (
    <div
      className={`flex items-center justify-center ${gapClass}`}
      role="radiogroup"
      aria-label={ariaLabel}
      style={combining ? { pointerEvents: "none" } : undefined}
    >
      {lenses.map((lens, i) => (
        <LensCoinButton
          key={`${lens.id}-${emergeKey}`}
          lens={lens}
          index={i}
          count={lenses.length}
          selectedIndex={selectedIndex}
          peeked={lens.id === peekedId && !combining}
          combining={combining}
          variant={combineVariant}
          pitch={pitch}
          coinSize={coinSize}
          lastSelected={lastSelectedRef.current}
          reduceMotion={reduceMotion ?? false}
          onTap={handleCoinTap}
        />
      ))}
    </div>
  );

  if (presentation !== "stage") {
    return <div className="flex items-center justify-center select-none">{row}</div>;
  }

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center select-none"
      aria-hidden={combining || undefined}
      onPanEnd={handlePanEnd}
      // Vertical scrolling stays native; horizontal swipes belong to the peek.
      style={{ touchAction: "pan-y" }}
    >
      {row}

      {/* Peek chip — names the tapped coin and teaches the second tap. */}
      <AnimatePresence>
        {peekedLens && !combining && (
          <div
            key={peekedLens.id}
            className="absolute top-1 left-0 right-0 flex justify-center z-10 pointer-events-none"
          >
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 max-w-full rounded-full bg-slate-900/90 border px-3 py-1.5 shadow-lg"
              style={{ borderColor: `${peekedLens.accent}55` }}
            >
              <span className="text-xs font-black text-white whitespace-nowrap">
                {peekedLens.label}
              </span>
              {peekedLens.description && (
                <span className="text-[10px] text-slate-400 truncate max-w-[180px] sm:max-w-[240px]">
                  {peekedLens.description}
                </span>
              )}
              <span
                className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap"
                style={{ color: peekedLens.accent }}
              >
                tap again
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface LensCoinButtonProps {
  lens: LensCoinDef;
  index: number;
  count: number;
  selectedIndex: number;
  peeked: boolean;
  combining: boolean;
  variant: number;
  pitch: number;
  coinSize: number;
  lastSelected: number;
  reduceMotion: boolean;
  onTap: (lens: LensCoinDef) => void;
}

function LensCoinButton({
  lens,
  index,
  count,
  selectedIndex,
  peeked,
  combining,
  variant,
  pitch,
  coinSize,
  lastSelected,
  reduceMotion,
  onTap,
}: LensCoinButtonProps) {
  const isActive = index === selectedIndex;
  const breath = BREATH[index % BREATH.length];
  const shine = SHINE[index % SHINE.length];
  const shortLabel = lens.label.split(" ")[0];

  let animate: TargetAndTransition;
  let transition: Transition;
  let initial: TargetAndTransition | false = false;

  if (combining) {
    if (reduceMotion) {
      animate = { opacity: 0 };
      transition = { duration: 0.15 };
    } else {
      const dx = (selectedIndex - index) * pitch;
      const offset = index - selectedIndex;
      const dist = Math.abs(offset);
      const maxDist = Math.max(selectedIndex, count - 1 - selectedIndex);
      const spec = isActive
        ? chosenCombine(variant)
        : unchosenCombine(variant, dx, offset, dist, maxDist, pitch);
      animate = spec.animate;
      transition = spec.transition;
    }
  } else if (isActive) {
    // Active pick in a plain row — continuous turntable.
    animate = {
      x: 0,
      rotateY: reduceMotion ? 0 : [0, 360],
      scale: 1.15,
      opacity: 1,
    };
    transition = {
      x: { type: "spring", stiffness: 280, damping: 20 },
      rotateY: { duration: 4, repeat: Infinity, ease: "linear" },
      scale: { type: "spring", stiffness: 280, damping: 18 },
    };
  } else {
    // Idle (or peeked — the peek lifts the coin and stills the breath).
    // Entrance doubles as the (reverse) burst when returning from the
    // detail view.
    animate = {
      x: 0,
      scale: peeked ? 1.08 : 0.92,
      opacity: peeked ? 1 : 0.95,
      y: reduceMotion || peeked ? 0 : [0, -1.5, 0, 1, 0],
      rotate: reduceMotion || peeked ? 0 : [-0.8, 0.8, -0.4, 0.4, 0],
    };

    if (lastSelected >= 0 && !reduceMotion) {
      // Burst back out of the point the previous pick collapsed into —
      // the exact reverse of the combine. Inner coins fire first.
      const dist = Math.abs(index - lastSelected);
      initial = {
        x: (lastSelected - index) * pitch,
        y: 6,
        scale: 0.15,
        opacity: 0,
      };
      transition = {
        x: { type: "spring", stiffness: 300, damping: 26, delay: 0.05 * dist },
        scale: { type: "spring", stiffness: 300, damping: 24, delay: 0.05 * dist },
        opacity: { duration: 0.25, delay: 0.05 * dist },
        y: { duration: breath, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: breath * 0.9, repeat: Infinity, ease: "easeInOut" },
      };
    } else {
      // First mount (or reduced motion) — a soft staggered entry.
      const entryDelay = reduceMotion ? 0 : index * 0.05;
      initial = reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 };
      transition = {
        x: { type: "spring", stiffness: 300, damping: 26, delay: entryDelay },
        scale: { type: "spring", stiffness: 260, damping: 22, delay: entryDelay },
        opacity: { duration: 0.2, delay: entryDelay },
        y: { duration: breath, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: breath * 0.9, repeat: Infinity, ease: "easeInOut" },
      };
    }
  }

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={isActive || peeked}
      aria-label={lens.label}
      tabIndex={combining ? -1 : undefined}
      onClick={() => onTap(lens)}
      whileTap={combining ? undefined : { scale: 0.92 }}
      whileHover={combining || isActive || peeked ? undefined : { scale: 1.1, y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      // Fixed slot width == pitch: centres stay exactly pitch apart no
      // matter how wide the label, keeping the combine math honest.
      style={{ width: pitch }}
      className="min-h-11 flex flex-col items-center justify-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
    >
      <span
        className="flex items-center justify-center min-w-11 min-h-11 rounded-full"
        style={
          {
            ['--lens-accent' as string]: lens.accent,
            ['--lens-accent-soft' as string]: isActive
              ? `${lens.accent}80`
              : `${lens.accent}55`,
          } as React.CSSProperties
        }
      >
        <motion.span
          className={`block ${
            isActive || peeked ? 'lens-coin-active lens-coin-pulse' : 'lens-coin-idle'
          }`}
          initial={initial}
          animate={animate}
          transition={transition}
          style={{ transformPerspective: 400 }}
        >
          <Coin
            size={coinSize}
            symbol={lens.glyph}
            color={lens.accent}
            variant="selection"
            shine={!reduceMotion}
            shineDuration={shine}
          />
        </motion.span>
      </span>
      {/* Label row: one-word practical label (always) + one-line
          translation of the philosophy's practical meaning. */}
      <div
        className={`mt-1 text-center leading-tight truncate max-w-full ${
          isActive || peeked ? '' : 'text-gray-500 dark:text-slate-500'
        }`}
        style={isActive || peeked ? { color: lens.accent } : undefined}
      >
        <span className="text-[10px] font-bold block truncate">{shortLabel}</span>
        <span className="text-[9px] block truncate opacity-80">
          {lens.description ? truncate(lens.description, 60) : ''}
        </span>
      </div>
    </motion.button>
  );
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cutoff = text.slice(0, maxLen).lastIndexOf(' ');
  return (cutoff > 0 ? text.slice(0, cutoff) : text.slice(0, maxLen - 1)) + '…';
}
