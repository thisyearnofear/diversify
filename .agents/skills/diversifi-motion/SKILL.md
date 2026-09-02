---
name: diversifi-motion
description: DiversiFi's motion techniques — count-up numbers, pointer tilt, masked line reveals, draw-in paths, plan-change pops, dock magnification, progressive-blur footnotes, keep-mounted Home. Framer-motion only (no GSAP per design contract), reduced-motion first-class. Use when adding or editing any animation in apps/web.
---

# DiversiFi motion techniques

Contract: **framer-motion only** (design-language §5 bans GSAP). Motion reveals,
selects, confirms — it never loops. Reduced motion is a first-class mode: gate
with `useReducedMotion()` for JSX effects; `MotionConfig reducedMotion="user"`
in AppProviders is the global backstop, not a substitute.

## Tokens first

Never hand-write spring constants. Import from `apps/web/lib/motion-tokens.ts`:

- `spring` (280/28) — default settle: sheets, waits, folds
- `springSoft` (180/32) — large surfaces (heroes, ring geometry)
- `springPop` (420/16) — selection/plan-change confirmation, ONE occurrence
- `reveal` (0.18s ease-out) — quiet reveals, matches tab transitions
- `drawIn` (0.6s ease-out) — SVG stroke draw-ins
- `STAGGER_STEP_S` (0.05) — per-line stagger for reveals

## Techniques (each exists as code — reuse, don't reinvent)

### 1. Count-up — `useCountUp(target, { format })`
`apps/web/hooks/use-count-up.ts`. For money numbers that carry meaning
(design-language §6). Renders a MotionValue string; put it inside
`<motion.span>{value}</motion.span>`. Reduced motion renders the final value
instantly. Key the parent (`key={selection}`) to re-run the count on selection.
Used by: Home dial center, Shield ring center, Learn preserved number, Home
moment delta.

### 2. Pointer tilt — `usePointerTilt(enabled)`
`apps/web/hooks/use-pointer-tilt.ts`. The ONE expressive pointer interaction:
object leans ±7° toward the cursor through `springSoft`, settles to zero on
leave. Dead under reduced motion and for touch pointers. Spread `tilt.style`
(with `transformPerspective: 900`) and `tilt.props` onto a `motion.div`
wrapping the object. Used by: CurrencyMomentCard coin stage, HomeExposureDial.

### 3. Masked line reveal — `MaskedReveal`
`apps/web/components/shared/MaskedReveal.tsx`. Hero lines rise out of
overflow-hidden masks, staggered by `STAGGER_STEP_S`. One shot per mount.
Use for hero headlines only — never list items, never loops.

### 4. Path draw-in — `pathLength` animation
For route/connector schematics: `initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
transition={drawIn}`. One shot. Reduced motion: `initial={false}` and
`transition={{ duration: 0 }}`. See `apps/web/components/swap/RouteSchematic.tsx`.

### 5. Confirmation pop — `springPop`
Scale 0.86→1 on the thing that changed (archetype badge, selected bar). One
occurrence keyed to the change (`key={archetype.id}`), never periodic.

### 6. Waiting — `InstrumentWait`
`apps/web/components/shared/InstrumentWait.tsx`. Waiting is an instrument, not
gray furniture: one coin gets the color, one line names the job ("Reading
Guardian state" — never "Loading…"), spring reveal + a single `shine="once"`.
Reduced motion: static coin, same copy.

### 7. Dock magnification — desktop tab rail
`apps/web/components/ui/TabNavigation.tsx` (DesktopRail). Sylva's spring dock,
scoped to this app's contract: the hovered tab springs to `{ scale: 1.18,
y: -4 }`, immediate neighbors ease to `{ scale: 1.05, y: 0 }` — damped springs
from the tokens, never raw pointer input. **Triple gate** before enabling:
`!useReducedMotion()` AND `matchMedia('(hover: hover) and (pointer: fine)')`
AND desktop layout. Touch and reduced-motion paths render the rail exactly as
before. Proximity magnification is for rails only — never apply it to content
cards or CTAs.

### 8. Progressive-blur footnote — `TrustFootnote`
`apps/web/components/shared/TrustFootnote.tsx`. Trust notes (source, method,
"as of" timestamps) sit quiet at the bottom of an instrument: the first line
is always readable, the tail dissolves under a downward `maskImage`
linear-gradient + `blur(0.6px)`. Hover/focus/tap expands to full clarity with
correct `aria-expanded`. Blur here is a **stillness affordance, not a hide** —
content is always in the DOM, nothing is gated. Pure CSS (`backdrop-filter`
family + mask), zero JS per frame. Use for provenance only; never wrap a
number that belongs in the object (design-language §6).

### 9. Keep-mounted Home — `TabContentRouter`
`apps/web/components/app/TabContentRouter.tsx`. The Overview pane survives tab
switches hidden (`visibility: hidden` + `pointerEvents: "none"` +
`aria-hidden`) instead of unmounting — no refetch, no skeleton, no count-up
replay when the user returns. Gated: skipped in test environments
(`NODE_ENV === "test"`) so suites exercise the classic unmount path, and
`NEXT_PUBLIC_KEEP_MOUNTED_HOME=false` is the kill switch. `AnimatePresence`
runs `mode="popLayout"` to keep transitions smooth in both layouts. Only the
Overview pane is kept mounted — other tabs unmount normally. Hidden panes must
not rely on `inert` (React 18 warns); `visibility: hidden` already removes
focusability.

## Reduced-motion checklist for any new animation

1. Does it loop? Delete it or gate it behind a completed state.
2. JSX transforms → gate `initial`/`transition` with `useReducedMotion()`.
3. `whileHover` → `reducedMotion ? undefined : { ... }`.
4. CSS keyframes → wrap in `@media (prefers-reduced-motion: no-preference)`
   (see `.coin-float`, `.coin-shine` in globals.css).
5. SVG filters/blur never animate. (Progressive blur is exempt: the blur is
   static and toggles — it never animates between values.)
6. Proximity/pointer effects (dock, tilt) also gate on pointer capability:
   `(hover: hover) and (pointer: fine)` — touch never gets half-on effects.

## Performance guardrails

- `filter: blur()` never animates; ambient fields cap blur at 3px on ≤3 coins.
- Ambient CSS loops pause when `document.visibilityState === 'hidden'`
  (FloatingCoins does this).
- `content-visibility: auto` on below-the-fold status/footnote sections
  (TrustFootnote uses it on the blurred tail).
- Keep-mounted panes must stop pointer events and stay out of the a11y tree —
  hidden ≠ interactive.
