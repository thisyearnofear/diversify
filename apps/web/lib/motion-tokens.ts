/**
 * Motion tokens — the one clock grammar.
 *
 * Every tab transition, sheet fold, and confirmation pop uses one of these
 * values so motion feels like a single system (Sylva's "one animation loop"
 * discipline, expressed as shared variants). Reduced-motion callers pass
 * `false` as `initial` and/or `{ duration: 0 }` — these tokens describe the
 * full-motion path only.
 *
 * Timed motion picks a BAND (`duration.*`), never a hand-typed number: the
 * bands are what make a lateral move read as fast and a commitment read as
 * settled. Choosing a band is the whole decision; the curve follows from it.
 */

/**
 * Duration bands, in seconds.
 *
 * `instant` acknowledges a state change (press feedback) — it must not be
 * perceptible as travel. `fast` is the lateral band: tabs, sheet slides,
 * anything the user just did. `base` is for arrivals that should be watched.
 * `settle` is reserved for commitments (a receipt sealing, a plan changing).
 * `slow` is one-per-surface hero choreography — never a list item.
 *
 * A fast exit paired with a `fast` enter is what makes a hand-off read as
 * overlap rather than as a blink; keep exits in the same band or one lower.
 */
export const duration = {
  instant: 0.1,
  fast: 0.18,
  base: 0.28,
  settle: 0.5,
  slow: 0.8,
} as const;

/**
 * Curves. `out` is the house curve: it covers most of its distance in the
 * first third and then glides to rest, which is why it can be short without
 * feeling clipped. `inOut` is for symmetric moves (a control travelling back
 * to its resting position).
 */
export const easing = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
} as const;
/** Default settle — used by InspectorSheet, InstrumentWait, sheet folds. */
export const spring = { type: "spring", stiffness: 280, damping: 28 } as const;

/** Softer settle — large surfaces (hero blocks, ring geometry). */
export const springSoft = { type: "spring", stiffness: 180, damping: 32 } as const;

/** Confirmation pop — selection and plan changes ONLY, one occurrence, never a loop. */
export const springPop = { type: "spring", stiffness: 420, damping: 16 } as const;

/** Press/hover micro-interaction — quick, no visible overshoot. */
export const springPress = { type: "spring", stiffness: 400, damping: 25 } as const;

/** Quiet reveal — the `fast` band, house curve. */
export const reveal = { duration: duration.fast, ease: "easeOut" } as const;

/** Sturdier reveal for a block that should land, not flash past. */
export const revealBase = { duration: duration.base, ease: easing.out } as const;

/** Draw-in for SVG strokes (route schematics, connectors). One shot. */
export const drawIn = { duration: 0.6, ease: "easeOut" } as const;

/** Stagger interval for line/mask reveals (per index). */
export const STAGGER_STEP_S = 0.05;

/** Stagger interval for per-character reveals (headlines only) — tighter
 *  than a line step so a word reads as one gesture, not a teleprinter. */
export const CHAR_STAGGER_S = 0.022;

export const press = { scale: 0.97 } as const;

export const comparisonSettle = { duration: 0.6, ease: "easeOut" } as const;

/**
 * Tab-pane hand-off. The entering pane travels further and settles on the
 * house curve; the leaving pane clears out faster and recedes slightly, so
 * the swap reads as the new surface arriving over the old one instead of a
 * crossfade with a gap in it. `direction` is the swipe/tab-order sign.
 */
export const PANE_TRAVEL_PX = 40;

export function paneTransition(direction: 1 | -1, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: duration.fast, ease: easing.out } },
      exit: { opacity: 0, transition: { duration: duration.instant, ease: easing.out } },
    };
  }
  return {
    initial: { opacity: 0, x: PANE_TRAVEL_PX * direction, scale: 0.99 },
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { duration: duration.base, ease: easing.out },
    },
    exit: {
      opacity: 0,
      x: -PANE_TRAVEL_PX * direction * 0.75,
      scale: 0.99,
      transition: { duration: duration.fast, ease: easing.out },
    },
  };
}

/**
 * One tactile press grammar for controls across the journey — the same
 * spring + scale on tap, inert under reduced motion. Spread onto
 * motion.button/motion.* elements; never wraps a logic delay.
 */
export function controlMotion(reducedMotion: boolean | null) {
  return reducedMotion
    ? { whileTap: undefined, transition: { duration: 0 } }
    : { whileTap: press, transition: springPress };
}
