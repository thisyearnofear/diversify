# Design Language — surface principles for DiversiFi

How DiversiFi screens earn (or lose) their user's attention. These rules
were extracted from the Phase 2 "risk moment" and Phase 3 "philosophy"
reworks (2026-08-24) and apply to every surface: onboarding, tabs,
modals, cards, empty states, funnels.

The short version lives in `AGENTS.md` under **Surface design principles**.
This doc is the long version: reasoning, patterns, and review checklist.

---

## 1. The screen has one job

Every surface exists to make one thing happen. Phase 2's job: *make the
number land*. Phase 3's job: *pick a philosophy*. If you can't finish the
sentence "this screen exists to ___", the screen has two jobs, and you
should split it.

Everything else sorts into two permitted tiers:

- **Trust** — why the numbers are credible (data source, freshness,
  method). Must be *quiet*.
- **Transition** — what happens next. Must be *one line*.

Anything that's neither the job, trust, nor transition gets cut or
moved. Example: the SME business waitlist used to sit mid-scroll in the
risk moment — an email form interrupting the emotional beat. It moved
behind a disclosure.

**Measure:** the CTA must be in or near the first viewport (~600px of
content). Scroll depth between insight and action is where users leave;
every element between the aha and the action is a chance to stop.

**Surfaces are solid.** Translucency is for accents and badges — never for
the ground that text sits on. A card body is `bg-white dark:bg-gray-900`
(or a *high*-alpha hero gradient); accent color arrives via borders, top
edges, and small state pills. A 3–8% alpha wash over a patterned or
gradient backdrop is glass, and glass loses to the pattern every time —
the text disappears first. If decoration and readability compete,
readability wins and the decoration drops to quiet.

## 2. One object gets the color

Expressiveness is a budget, spent in one place. The dark slate risk card
owns the phase: amber hero number, gold accents, glow. Everything else on
that phase drops to quiet gray. A gallery wall is white so the painting
hits harder — the rework didn't tone down the design language, it
*concentrated* it.

Don't let secondary elements compete: no amber-box next to blue-box next
to badge-chip-strip. When you find two accents fighting, one of them is
wrong, and it's usually the new one.

## 3. Every text block says something no other block says

The review test: read each text block and name its job. If two blocks
share a job, merge or delete one.

Concrete failure this fixed — "this is honest historical data" was said
three times in phase 2 ("Historical data, not a projection" in the
subtitle, "curated… not live FX… not investment advice" in the footer,
"A past comparison, not advice" in the counterfactual), and the meaning
of the minus sign was explained twice. The honesty instinct was right;
the repetition wasn't. Each statement now appears exactly once.

**Watch particularly for:**
- Meta-lectures — sentences about the app's taxonomy ("Philosophy
  answers what you value. Money purpose answers when you need it.")
  instead of about the user.
- Explainers of symbols — if you're explaining what "−72%" means in a
  footnote, the number should carry the meaning instead (see §6).
- Redundant chrome — the card's "Nigeria · NGN" header under an H2 that
  already said "Your 🇳🇬 NGN in context."

## 4. Controls are the motif, not decoration

The design system owns a coin primitive (`Coin` in
`components/shared/FloatingCoins.tsx`), coin steps, tilt, flip springs,
and `FloatingCoins`. Rule: **the coins do work**.

- Phase 3 lens selection used to be five text cards. It's now
  `LensCoinSelector` — five flickable coins, each with a per-lens accent;
  tapping flips the coin (the minting animation doing real work) and
  unfolds its archetypes.
- The segmented control (1Y/3Y/5Y in the risk card) is the *same
  control* used for money purpose (Soon/Years/By date) one phase later.
  Users learn a control once; the design loans that learning forward.

When you need a new control, first check whether an existing motif can
carry it. Inventing a new control idiom costs the user learning you
already paid for once.

## 5. Motion does work; tabs are instruments

Animation budget goes to motion that *reveals, selects, or confirms* —
not to ambient freshness.

Working motion (all framer-motion, **no GSAP** — one runtime, already in
the bundle):

- **Flick carousel** (`LensCoinSelector`): `drag` + `dragElastic` +
  `dragSnapToOrigin` + velocity threshold (`FLICK_VELOCITY`). Momentum
  makes the row feel physical.
- **Rubber-band tilt**: `useTransform(x, v => clamp(v * 0.02))` —
  rotation proportional to drag displacement. The object argues back.
- **Origami fold** (`rotateX` from `transformOrigin: top`): the reveal
  IS the transition — no fade-through-a-middle-state. `InspectorSheet`
  uses this when a selection opens.
- **Blur-swap** (`phaseVariants`/`staggerChild` in onboarding): content
  swaps through a 6px blur, never a y-jump.
- **Count-up** (`AnimatedNumber`): the number arrives as a punch.

Each tab is an **instrument**, not a feed of cards:

1. **Object** — the thing you manipulate (risk moment, exposure dial,
   plan ring, swap ticket, Guardian ledger, wealth-protection calculator).
   First viewport. This is the one object that gets the color (§2).
2. **Inspector** — opens from a selection (`InspectorSheet`). Empty
   selection means the sheet is closed, not a stack of closed rows.
3. **One CTA** — attached to the inspector or the object's current
   shape. A second button with the same destination is a bug.
4. **Morph** — the same screen changes shape with user state and
   persona (no plan → picker; empty → fund; gap → rebalance; aligned →
   quiet). Persona retargets the object; it does not reorder a module
   list. Leftover jobs go to Ask Guardian, not a basement of features.

`DisclosureSection` is not IA. Accordion rows are a density tactic.
Disclosure is allowed only for **trust footnotes** (data source, method).

Review test: *does this block change the object, the inspector, or the
one CTA?* If not, it leaves the tab.

### Instrument utility rails (fail = revert)

A tab change that fails any of these is the old stack. Do not ship it.

1. **One job per tab.** Home sees. Shield decides. Exchange acts. Learn is
   not a peer tab in Simple mode.
2. **Selection rewrites the artefact.** If a tap only opens a paragraph,
   it does not ship.
3. **One CTA, on a tab that is in the dock.** `navigateToSwap` into a
   hidden Exchange tab is a bug.
4. **Persona morphs the object, it does not add a module.** Caribbean
   netting stays an Exchange shape. Yield annotates the quote. RWA is a
   ring token. Payment cycle is a Shield inspector body.
5. **Nothing sits above the object** except a real error. Banners,
   scorecards, honesty strips, and “next step” journeys are object /
   status / footnote — or they leave.
6. **No restored cards.** `ProtectionScorecard`, `ProtectionJourney`,
   `BestYieldCard`, `RwaAssetCards`, `OptimizationInsight`,
   `SavingsLoopCard` may donate numbers and copy. They may not return as
   sections.

Simple + Intermediate dock: Shield / Home / Exchange (+ Guardian on intermediate). Learn is absorbed onto Shield’s
picker (and optionally Home amount-inspect) — not a peer tab until Advanced.
Home is always the Risk Theater — the coin stage (`CurrencyMomentCard`/`InflationMomentCard`) is
the one expressive object; tap the coin to flip to a fanned holdings stack (same flick/flip motif as `LensCoinSelector`);
holdings are also a quiet strip (stacked bar + chips) beneath it, never a second `AllocationRing`. Shield alone owns the
`AllocationRing` (hole = gap when a slice is selected, ghost/hatch for
RWA). Home never renders a ring.

Header: `ChainPill` is **always visible** on `sm+` — including Simple
mode (2026-09-03 tester feedback supersedes Wave 3's hidden-in-beginner
rule). "See the chain without hunting" beats mode-based hiding; the
toggle, not the pill, is the thing Simple mode hides.

Reduced-motion is a real mode, not an afterthought: flick/drag/tilt off,
tap stays, content identical. Gate with `useReducedMotion()` (see
`LensCoinSelector`).

**Waiting is still an instrument.** Gray card skeletons fake a layout
that isn't there yet — they look like furniture, not a pause. While the
object is settling, keep the same first-viewport grammar: one `Coin`
gets the colour, one line names the job ("Reading your wallet"). Motion
is a spring reveal plus a **single** shine (`shine="once"`), never an
infinite pulse or bob. Primitive: `InstrumentWait`. Reduced-motion: a
static coin and the same copy. Inline number placeholders (HeroValue's
bar so "$0 loading" ≠ "$0 empty") stay as quiet bars — a coin there
would compete with the object.

## 6. Numbers carry their own meaning

The best copy edit is deletion into the number itself.

- Before: `−72%` … footer: "Negative means NGN bought less of the
  benchmark over this period."
- After: hero subline reads "vs 🏅 Gold · 5 years — **your NGN bought
  72% less**". The explainer line is gone; the number says it.

The gold counterfactual works the same way: not "depreciation
illustration" but "Had 20% of NGN 15,000,000 followed gold: NGN
2,160,000 more kept." — magnitude in the visitor's own money, no mental
FX, no percentages to convert. (`exampleSavingsFor` + `calculateCounterfactual`
in `constants/currency-risk.ts` do the currency-local math.)

## 7. Honesty is styled as restraint

Visibility of disclaimers is inversely proportional to how much they
work. One plain line — "● Live 1Y · Data as of 2026-08-24 · history, not
advice." — beats a badge strip with a chip for every sub-claim. Plain
words are the trust signal; chrome undermines it. Never fabricate
numbers to fill a gap (per AGENTS.md Wave 8 — expired cache before a
fake `+0.0%`); apply the same rule to copy: no claim you're not making
truthfully somewhere verifiable.

**Chain-agnostic trust:** DiversiFi settles on 5 networks (0G, Arbitrum, Celo, HashKey, Robinhood — all at `0x3BCf…369C`) and the Guardian carries `AgenticID #1` on 0G (`0x6815…33D60`, 0G Storage root). The UI stays chain-agnostic by default: one quiet line — `Verified · Evidence mirrored` with a `✓` — in the trust tier (`TrustFootnote` / `InstrumentShell status`), not the object. No chain names, no hex in the first viewport. Detail is progressive disclosure: tapping `Verified` rewrites the artefact in place to the 5 dots + shared address + `Guardian #1` + explorer `0G/Celoscan/Arbiscan` links and the `/api/agent/zero-g-ledger?verify=<hash>` check (`LiveProofCard` lazy `✓`). Beginners never see a hex until they care; reviewers get the exact vision sentence in one tap. Header `GuardianMascot` tooltip reads `Portable Guardian · portable across wallets`, not `ERC-721`.

## 8. PR checklist for any new surface

- [ ] One sentence states the screen's job; if it needs "and", split it.
- [ ] CTA in or near first viewport on mobile (~600px content above it).
- [ ] Each text block names a job that no other block names.
- [ ] One expressive object; everything else quiet.
- [ ] Controls reuse an existing motif (coin, segmented control, ring).
- [ ] Name the object, what selection opens, the one CTA, and which
      persona morphs the object. A new `*Card` or `DisclosureSection`
      as a tab sibling is out of contract.
- [ ] Motion reveals/selects/confirms; no ambient decoration.
- [ ] Reduced-motion path verified.
- [ ] Disclaimers/honesty copy appear exactly once, in plain words.
- [ ] No email form or input interrupting an emotional beat.
- [ ] Parse budget: count words. If a "moment" screen exceeds ~80
      visible words, something can be folded, merged, or cut.

---

## 9. The Guardian — mascot spec

The Guardian is the app's personified presence: **protective tech, not a toy.**
It carries the same constraint system as the app's design grammar (coins
decide, numbers convince, one button acts).

**Identity history (why the spec looks like this):** The original Guardian
(pre-2026-08) was a digital shield — pointed silhouette, dark visor, square
blue eyes. The 2026-08-25 "Rounded Guardian" redesign softened everything into
a kawaii blob (domed head, cheek bulges, round cartoon eyes, no points), and
the AI raster candidates generated for it (GPT Image 2,
`docs/mascot-raster-brief.md`) made the problem concrete: cute, beveled,
toy-like — the robustness was gone. The current spec restores the digital
shield's visual DNA and keeps the redesign's motion discipline.

**Core rules (non-negotiable):**
- One dominant silhouette: the **pointed heraldic shield** — apex top, straight
  shoulders, tapering to one point below. The point is the identity; do not
  round it away again.
- **Dark visor screen face** (`#1e293b`) inset in the shield — the eyes live on
  a screen. **No mouth, ever** — the visor is the face; the eyes do the talking.
- Two **digital square eyes** (8×8, rx 2, `#60a5fa`), mood-driven reshaping
  only. Squared eyes read as tech, not kawaii.
- **Pale ice armor** fill (`#eff6ff → #dbeafe`) with the **2px blue edge**
  (`#2563eb`) defining the form, plus a barely-there bottom shade
  (blue 0→14%). No glow, no cast shadow.
- **Belly coin** — gold `#f59e0b`, identical to the Coin primitive — sits low,
  straddling the visor's bottom edge: the app's motif as the Guardian's core.
  Always present, even at small sizes.
- Three semantic colors: ice/edge blue family, visor slate, coin gold.
- Readable at 32×32. At ≤48px: "compact" mode — shield + eyes + coin, no
  thinking dots. If a feature disappears at 32px, the compact mark must
  survive without it.

**Mood inventory (five states — eyes only):**
| Mood | Eyes | Extra | When |
|---|---|---|---|
| happy | full squares | — | strategy aligned, streaks |
| neutral | full squares | — | idle, waiting |
| thinking | squashed (scaleY 0.8), slow x-wander | two signal dots above-right | AI processing |
| protective | narrow slit (scaleY 0.35), gaze drops | — | shield active |
| alert | enlarged (1.25×), gaze lifts | — | notifications |

**Motion rules (§5):**
- Mood animations communicate state only — they are legitimate (confirms).
- Zero ambient loops: no bob, no glow pulse, no breathing shadow (all three
  existed in the pre-redesign original and are retired for good). The Guardian
  draws in once (pathLength 0→1) and settles on mount (spring scale 0.92→1)
  then is still.
- **Life comes from attention, not idling.** `gaze="pointer"` lets the eyes
  follow the user's pointer — awareness, not ambience. It only moves when
  you move: rAF-throttled, spring-damped pursuit, capped at ±4/±2.5 viewBox
  units, cleaned up on unmount. Use it on greeting surfaces
  (`WelcomeScreen`, AIChat empty state); keep it off on utility surfaces.
  A fixed `{x, y}` target (each axis [-1, 1]) is available for directed
  attention. Moods also settle on springs (`MOOD_SPRING`), never linear snaps.
- Reduced motion: no keyframes, no repeats, no gaze tracking. Moods render
  discretely (eye shape still reflects mood; gaze is static). Motion budget
  stays spent on work that reveals or confirms.

**Raster assets (icon.png, OG image, splash):**
- Render from the SVG source — deterministic export, character-faithful.
  AI image generation is **not** the production path for the mark: the
  2026-08-25 GPT Image 2 tests (see `docs/mascot-raster-brief.md`) came back
  cutesy and beveled. The SVG IS the mascot; rasters are screenshots of it.
- Single source of truth: `apps/web/components/shared/guardian-mark.ts` holds
  the geometry + palette; the live component AND
  `pnpm render-guardian-assets` (`scripts/render-guardian-assets.ts`,
  satori-free Resvg pipeline) both consume it, so exports never diverge.
  Outputs: `icon.png` 1024², `preview.png` 1024², `splash.png` 1024²
  (centered mark on the slate field), `embed-image.png` 1200×630
  (lower-right emergence). Re-run after any mark change.
- Composition when placing the mark: lower-corner emergence for wide
  formats; centered for square formats with the mark ≥80% of the canvas to
  survive PWA maskable safe zones. Solid named background (canonical field:
  deep slate navy `#0f172a`). Never bottom-center the character in wide
  formats. Clean square outer corners, no presentation chrome, no text.

**Blink (life without ambience):**
- The Guardian blinks — but only as a **transition confirmation** (§5):
  once after the mount draw-in settles, and once on every mood change.
  There is no periodic idle blink; that would be an ambient loop.
- Skipped entirely in compact mode and reduced motion.

## Where the primitives live

| Primitive | Path | Used for |
|---|---|---|
| `Coin`, `FloatingCoins` | `apps/web/components/shared/FloatingCoins.tsx` | coin motif, ambient field |
| `GuardianMascot` | `apps/web/components/shared/GuardianMascot.tsx` | digital shield mascot, mood + gaze system |
| `LensCoinSelector` | `apps/web/components/onboarding/LensCoinSelector.tsx` | flickable selection row |
| `InstrumentShell` | `apps/web/components/shared/InstrumentShell.tsx` | tab layout: object + inspector + status |
| `InspectorSheet` | `apps/web/components/shared/InspectorSheet.tsx` | selection-bound fold/sheet; closed when idle |
| `AllocationRing` | `apps/web/components/shared/AllocationRing.tsx` | plan ring, exposure dial |
| `AnimatedNumber` | `apps/web/components/shared/AnimatedNumber.tsx` | count-up data punches |
| `ShimmerText` | `apps/web/components/shared/ShimmerText.tsx` | CTA text (use sparingly) |
| `TokenIcon` | `apps/web/components/shared/TokenIcon.tsx` | real token logos w/ coin fallback |
| `phaseVariants`, `staggerChild` | onboarding screens | blur-swap transitions |
| segmented control | risk card + money purpose | period/purpose selector |
| `.scrollbar-hide` | `globals.css` | horizontal chip strips |
| currency-risk data | `apps/web/constants/currency-risk.ts` | depreciation, counterfactuals, events |

Grammar of the app: **coins decide, numbers convince, one button acts.**
