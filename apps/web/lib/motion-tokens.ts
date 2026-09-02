/**
 * Motion tokens — the one clock grammar.
 *
 * Every tab transition, sheet fold, and confirmation pop uses one of these
 * values so motion feels like a single system (Sylva's "one animation loop"
 * discipline, expressed as shared variants). Reduced-motion callers pass
 * `false` as `initial` and/or `{ duration: 0 }` — these tokens describe the
 * full-motion path only.
 */

/** Default settle — used by InspectorSheet, InstrumentWait, sheet folds. */
export const spring = { type: "spring", stiffness: 280, damping: 28 } as const;

/** Softer settle — large surfaces (hero blocks, ring geometry). */
export const springSoft = { type: "spring", stiffness: 180, damping: 32 } as const;

/** Confirmation pop — selection and plan changes ONLY, one occurrence, never a loop. */
export const springPop = { type: "spring", stiffness: 420, damping: 16 } as const;

/** Quiet reveal — matches the tab transition timing (0.18s ease-out). */
export const reveal = { duration: 0.18, ease: "easeOut" } as const;

/** Draw-in for SVG strokes (route schematics, connectors). One shot. */
export const drawIn = { duration: 0.6, ease: "easeOut" } as const;

/** Stagger interval for line/mask reveals (per index). */
export const STAGGER_STEP_S = 0.05;
