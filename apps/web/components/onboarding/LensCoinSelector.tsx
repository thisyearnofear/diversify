"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import { Coin } from "../shared/FloatingCoins";
import { FlickScrollRow, useDidDrag } from "../shared/FlickScrollRow";
import { press, spring, springPop, springPress } from "@/lib/motion-tokens";

export interface LensCoinDef {
  id: string;
  label: string;
  /** Optional long-form description. Shown in the peek chip (stage) and
   *  carried on the lens; optional because some callers (e.g.
   *  GuardianPlanSwitcher) only need label + glyph + accent. */
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 380px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
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
   * active coin spins on its turntable. Used by GuardianPlanSwitcher.
   *
   * 'stage' — one tap opens the lens. Saving the plan is a separate
   *   explicit action in the parent, never a second-tap gesture.
   */
  presentation?: Presentation;
  /** Which combine choreography to play (stage only). The parent cycles
   *  this 0→1→2 on each selection. */
  combineVariant?: number;
  /** Remount counter for the row (stage only): the parent bumps it when
   *  returning from the detail view so coins burst back out of the old
   *  convergence point instead of just fading in. */
  emergeKey?: number;
  /** Row presentation only: render inside a FlickScrollRow, start-aligned,
   *  and scroll the selected coin into view. Off-row taps are drag-guarded
   *  via `useDidDrag`, so a drag release is not a choice. */
  scrollable?: boolean;
  /** Called with the tapped coin's centre (client coords) so callers can
   *  report a tap origin to an ambient layer. */
  onTapPoint?: (clientX: number, clientY: number) => void;
  alive?: boolean;
  labelMode?: "compact" | "full";
}

/**
 * LensCoinSelector — the value-lens coins.
 *
 * Both presentations fix the mystery-meat problem: every coin carries
 * a one-word label beneath it, so the five options are scannable at a
 * glance (icon + text beats icon alone). One tap opens the detail stage.
 */
export function LensCoinSelector({
  lenses,
  selected,
  onSelect,
  ariaLabel = "Values lenses",
  presentation = "row",
  combineVariant = 0,
  emergeKey = 0,
  scrollable = false,
  onTapPoint,
  alive = true,
  labelMode = "compact",
}: LensCoinSelectorProps) {
  const reduceMotion = useReducedMotion();
  const { coinSize, gapClass, pitch } = useLensCoinMetrics();
  const selectedIndex = lenses.findIndex((l) => l.id === selected);
  const combining = presentation === "stage" && selectedIndex >= 0;

  // Remember the last chosen slot so that when the user returns to the
  // row, the coins can burst back out of that exact point.
  const lastSelectedRef = useRef(-1);
  if (selectedIndex >= 0) lastSelectedRef.current = selectedIndex;

  const handleCoinTap = (lens: LensCoinDef) => {
    onSelect(lens.id);
  };

  const effectiveLabelMode = presentation === "row" ? labelMode : "compact";

  // Scrollable row: keep the selected coin visible after selection.
  const scrollRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollable || selectedIndex < 0) return;
    const selectedEl = scrollRowRef.current?.querySelector<HTMLElement>(
      '[aria-checked="true"]',
    );
    if (selectedEl && typeof selectedEl.scrollIntoView === "function") {
      selectedEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [scrollable, selectedIndex]);

  const row = (
    <div
      ref={scrollRowRef}
      className={`flex items-center ${scrollable ? "justify-start" : "justify-center"} ${gapClass}`}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (combining || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
        const index = buttons.findIndex((button) => button === document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
        if (presentation === "row") onSelect(lenses[next].id);
      }}
      style={combining ? { pointerEvents: "none" } : undefined}
    >
      {lenses.map((lens, i) => (
        <LensCoinButton
          key={`${lens.id}-${emergeKey}`}
          lens={lens}
          index={i}
          count={lenses.length}
          selectedIndex={selectedIndex}
          peeked={false}
          combining={combining}
          variant={combineVariant}
          pitch={pitch}
          coinSize={coinSize}
          lastSelected={lastSelectedRef.current}
          reduceMotion={reduceMotion ?? false}
          alive={effectiveLabelMode === "full" || presentation === "stage" ? false : alive}
          labelMode={effectiveLabelMode}
          onTap={handleCoinTap}
          onTapPoint={onTapPoint}
        />
      ))}
    </div>
  );

  if (presentation !== "stage") {
    if (scrollable) {
      return (
        <div className="select-none">
          {/* pt-2 — the track's overflow-x also clips vertically (spec:
              a non-visible axis forces the other to auto), so the active
              coin's ✓ badge (-top-1), its 2px accent ring and the 1.15×
              scale overhang need real headroom or they slice at the top
              edge. */}
          <FlickScrollRow className="px-1 pt-2 pb-1">{row}</FlickScrollRow>
        </div>
      );
    }
    return <div className="flex items-center justify-center select-none">{row}</div>;
  }

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center select-none"
      aria-hidden={combining || undefined}
      style={{ touchAction: "pan-y" }}
    >
      {row}
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
  alive: boolean;
  labelMode: "compact" | "full";
  onTap: (lens: LensCoinDef) => void;
  onTapPoint?: (clientX: number, clientY: number) => void;
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
  alive,
  labelMode,
  onTap,
  onTapPoint,
}: LensCoinButtonProps) {
  const isActive = index === selectedIndex;
  // A click that ends a FlickScrollRow drag is not a choice. Outside a
  // row the context defaults to never-dragged, so taps still work.
  const didDragRef = useDidDrag();
  const breath = BREATH[index % BREATH.length];
  const shine = SHINE[index % SHINE.length];
  const shortLabel = lens.label.split(" ")[0];

  let animate: TargetAndTransition;
  let transition: Transition;
  let initial: TargetAndTransition | false = false;

  if (combining) {
    if (reduceMotion) {
      animate = { opacity: 0 };
      transition = { duration: 0 };
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
  } else if (!alive) {
    animate = {
      x: 0,
      y: 0,
      rotate: 0,
      rotateY: 0,
      scale: isActive ? 1.15 : peeked ? 1.08 : 0.92,
      opacity: isActive || peeked ? 1 : 0.95,
    };
    transition = { duration: 0 };
    initial = false;
  } else if (isActive) {
    // Active pick in a plain row — continuous turntable.
    const spin = labelMode === "full" ? 0 : reduceMotion ? 0 : [0, 360];
    animate = {
      x: 0,
      rotateY: spin,
      scale: 1.15,
      opacity: 1,
    };
    transition = {
      x: spring,
      rotateY: { duration: 4, repeat: Infinity, ease: "linear" },
      scale: springPop,
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
        x: { ...spring, delay: 0.05 * dist },
        scale: { ...spring, delay: 0.05 * dist },
        opacity: { duration: 0.25, delay: 0.05 * dist },
        y: { duration: breath, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: breath * 0.9, repeat: Infinity, ease: "easeInOut" },
      };
    } else {
      // First mount (or reduced motion) — a soft staggered entry.
      const entryDelay = reduceMotion ? 0 : index * 0.05;
      initial = reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 };
      transition = {
        x: { ...spring, delay: entryDelay },
        scale: { ...spring, delay: entryDelay },
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
      onClick={(e) => {
        if (didDragRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onTapPoint?.(rect.left + rect.width / 2, rect.top + rect.height / 2);
        onTap(lens);
      }}
      whileTap={combining || reduceMotion ? undefined : press}
      whileHover={combining || reduceMotion || !alive || isActive || peeked ? undefined : { scale: 1.1, y: -3 }}
      transition={springPress}
      // Fixed slot width == pitch: centres stay exactly pitch apart no
      // matter how wide the label, keeping the combine math honest.
      style={labelMode === "full" ? { width: 144 } : { width: pitch }}
      className={`min-h-11 ${labelMode === "full" ? "shrink-0" : ""} flex flex-col items-center justify-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70`}
    >
      <span
        className="relative flex items-center justify-center min-w-11 min-h-11 rounded-full"
        style={
          {
            ['--lens-accent' as string]: lens.accent,
            ['--lens-accent-soft' as string]: isActive
              ? `${lens.accent}80`
              : `${lens.accent}55`,
            ...(labelMode === "full" && isActive
              ? { boxShadow: `0 0 0 2px ${lens.accent}` }
              : {}),
          } as React.CSSProperties
        }
      >
        {labelMode === "full" && isActive && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 z-10 flex size-5 items-center justify-center rounded-full text-2xs font-black text-white"
            style={{ background: lens.accent }}
          >
            ✓
          </span>
        )}
        <motion.span
          className={`block ${
            isActive || peeked
              ? `lens-coin-active${alive && labelMode !== 'full' ? ' lens-coin-pulse' : ''}`
              : 'lens-coin-idle'
          }`}
          initial={initial}
          animate={animate}
          transition={transition}
          style={{ transformPerspective: 400 }}
        >
          <Coin
            size={labelMode === "full" ? 64 : coinSize}
            symbol={lens.glyph}
            color={lens.accent}
            variant="selection"
            shine={!reduceMotion && alive}
            shineDuration={shine}
          />
        </motion.span>
      </span>
      {/* Label row: one-word practical label (always) + one-line
          translation of the philosophy's practical meaning. */}
      {labelMode === "full" ? (
        <div className="mt-1.5 text-center leading-tight">
          <span
            className="text-sm font-bold block whitespace-normal text-gray-900 dark:text-white"
          >
            {lens.label}
          </span>
        </div>
      ) : (
        <div
          className={`mt-1.5 text-center leading-tight max-w-full ${
            isActive || peeked ? '' : 'text-ink-muted'
          }`}
          style={isActive || peeked ? { color: lens.accent } : undefined}
        >
          <span className="text-xs font-semibold block">{shortLabel}</span>
        </div>
      )}
    </motion.button>
  );
}