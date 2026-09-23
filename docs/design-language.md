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

**The shell owns the surface.** `InstrumentShell` renders the one card
(`rounded-2xl border bg-white px-4 py-5 shadow-sm` + dark pair) for every
tab and every connection morph — Shield, Home, Exchange, Guardian, Learn,
connected or not. Objects render bare inside it: the moment card, the
swap ticket, and the ring carry no card chrome of their own. A tab that
wraps its object in its own card (or a shell that skips the card) is out
of contract — that drift is exactly what users read as "the tabs feel
like different apps". **The shell also owns the identity tint:** the
archetype pattern renders through the shell's `pattern` slot — INSIDE the
card, above its solid background, below the content. Painting it as a
sibling under the opaque card makes it invisible; painting it over the
content fights the text.

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
plus one ambient behaviour while the user is browsing (see the state
rule below). What it never goes to is decoration during an action.

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
- **Flick scroll row** (`FlickScrollRow`, powered by `useDragToScroll`): the ONLY sanctioned horizontal scroll row — new rows compose the primitive instead of re-rolling `overflow-x-auto`. Native touch, pointer drag with momentum on mouse/pen, chevron buttons; `snap-proximity`, never `snap-mandatory` (a snap that yanks the gesture out of the user's hand is motion fighting the user). Interactive children guard with `useDidDrag()` inside a child component (a body-level call reads the never-drag default and silently no-ops); drag-release swallows exactly one click, a new press revokes the trap. Live users: philosophy picker, Home holdings coins, BestYield chain toolbar, onboarding ArchetypeStrip.

**Rive objects (scoped exception).** A self-contained interactive object —
a coin that flips, lands, and shines on claim; a celebration artefact — may
be authored in Rive (`.rml` source under `apps/web/rive/`, compiled `.riv`
served from `apps/web/public/rive/`). Rive owns the *inside* of the object;
framer-motion still owns all UI motion (reveals, folds, tilts, transitions
between screen states). Rules: one-shot choreography only — no ambient
loops, same budget as everything above; reduced-motion renders the static
primitive fallback (`Coin` SVG), never a playing canvas; text stays in the
DOM (the `canvas-lite` runtime ships no text engine — bake text into the
.riv only if the full canvas runtime is deliberately chosen); the WASM
runtime loads on demand behind a `ssr: false` dynamic import — never in the
initial bundle. Live objects (all `apps/web/components/shared/Rive*.tsx`,
rebuilt via `pnpm rive:build`): `claim-coin` mints on claim + swap-success
(accent binds to the token's brand color), `net-pair` converges two
currency-tinted coins and seals on settlement (FX netting card),
`protection-seal` stamps ring + shield + check when a plan arms (Shield
ring header), `guardian` postures the agent status chip
(watching/acting/alert/resting), `verified-seal` stamps on confirmed
on-chain evidence (`VerifiedEvidence`). Host state crosses the WASM
boundary through view-model binds (colors as RGB channels, booleans,
strings) and file-written triggers fire frame-accurate haptics — never
deprecated SM inputs or `onStateChange`. Every mounted object gets
`useViewModelInstance(vm, { useNew: true })`: sharing the file's default
instance across two canvases crashes the lite WASM.

Backdrop coins obey the same budget. The app-shell field (`ShellCoinField`)
settles once on arrival — the reveal of the post-onboarding scene — and
re-settles once when the philosophy accent changes (a confirmation). The
onboarding `.coin-float` drift loop does not cross into the app: in-app,
the motif is still life in the desktop margins, and the tab's object keeps
the motion budget. The field's one hero coin plays a single shine sweep
after it lands (`shine="once"` delayed past its settle — the
`InstrumentWait` grammar), and the AIChat empty-state greeting headline
rises once via `MaskedReveal`. One occurrence each, then still.

### Motion is a state function — browsing is alive, acting is still

The tabs are not museums. While the user is *browsing* — reading,
flicking, weighing a pair — the one expressive object may breathe:
on Exchange's pair stage the ⇅ pivot coin carries a slow shine loop
(metal catching light; the motion IS the material, not decoration on
it) and the corridor line rotates its beats — the provenance sentence,
then each side's watch cadence — on a 7-second dwell. This is the
difference from a DEX: the pair feels weighed before it's moved.

The moment the user *acts* — an amount typed, a preview open, a quote or
execution in flight — the object stills completely. Stillness is how the
instrument says "I'm listening"; ambient motion during an action reads
as the app talking over you. On Exchange the split is structural: the
stage breathes (`alive`), the ticket renders `alive={false}` — the
acting mode is still by construction, not by a flag the user tripped.

Rules for ambient life:

- One ambient behaviour per object, long dwell (≥5s), never a pulsing CTA.
- Ambient motion may only re-surface existing facts (a shine, a beat
  rotation) — never introduce a new text block or a decorative loop.
- Reduced motion gets identical content, static: the shine is CSS-gated
  under `prefers-reduced-motion`, beat rotation is JS-gated.

### The density contract — depth layers, finite verbs, owned motifs

Each new primitive is cheap; the risk is the sum. Three rules keep it:

**Depth layers.** Every fact lives at a layer: L0 the object itself, L1
one line (the corridor sentence, the status tier), L2 the inspector
(origin / backing / keys + event trail + watch), L3 Ask Guardian. New
information *enters* at L2 or L3; promotion to L1 requires evicting
what's already there. Verbosity is allowed behind a tap, never at rest.

**Verbs are finite.** The gesture set is closed: tap selects or
inspects, flip reveals the coin's back, flick browses a
`FlickScrollRow`, preview drafts, commit persists. A new feature maps
onto an existing verb; adding a gesture requires retiring one. Nouns
are infinite — any artefact may carry the verbs.

**Motifs have owners.** Home owns the coin stage + holdings row, Shield
the ring, Exchange the pair stage (balance beam + coins) + story strip +
journey rail, Guardian the mark. A new
motif needs an owner and displaces nothing else's claim — otherwise
every surface wears every motif, which is the cards problem in a nicer
costume.

Tripwire: `corridor-context.test.tsx` asserts the resting corridor line
stays under a word budget — sediment fails CI, not review.

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

**Ask Guardian is a session thread, not a durable journal.** The visible
chat lives only while the drawer is open: closing it or choosing "New
conversation" clears the transcript so the next open is empty — matching
the triad's reset-to-instrument feel. Server-side memory (Cognee /
Tablestore) may still shape *advice* until the user explicitly forgets
it; that is separate from the bubbles on screen. Do not reintroduce
`localStorage` transcript persistence without a product decision to
revert this stance. Empty state stays quiet (one line + starters) —
trust footnotes belong behind recommendations, not in the first paint.

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
   ring token. Payment cycle is a Shield inspector body. The morph is the
   object's *default* for its persona — connected or not — and every other
   persona reaches it through the status rail ("FX netting: match
   currencies directly →" ↔ "Swap ticket →"), never a new tab. A wallet
   is not required to *see* the engine: walletless visitors run it as a
   dry-run observer (real pool, real mid-market, nothing persisted) and
   the card says so.
5. **Unconnected is a morph too.** The object stays: Home's moment card
   works walletless (geo data, not wallet data), Exchange's ticket CTA
   becomes the connect button, Shield's philosophy picker stays the object
   (choosing a lens rewrites the ghost ring — no funds needed), and the
   Agent tab's object is the Guardian itself (`gaze="pointer"`, the
   sanctioned third gaze surface). Never swap the object for a hero-card +
   proof-card + how-it-works stack. All four share one status tier:
   `UnconnectedStatusTier` (Verified evidence line + demo text link).
6. **Nothing sits above the object** except a real error. Banners,
   scorecards, honesty strips, and “next step” journeys are object /
   status / footnote — or they leave.
7. **No restored cards.** `ProtectionScorecard`, `ProtectionJourney`,
   `BestYieldCard`, `RwaAssetCards`, `OptimizationInsight`,
   `SavingsLoopCard` may donate numbers and copy. They may not return as
   sections.

Simple + Intermediate dock: Shield / Home / Exchange (+ Guardian on intermediate). Learn is absorbed onto Shield’s
picker (and optionally Home amount-inspect) — not a peer tab until Advanced.
Home is always the Risk Theater — the coin stage (`CurrencyMomentCard`/`InflationMomentCard`) is
the one expressive object; holdings are a quiet coin row beneath it — one `Coin` per region, sized by share — never
a second `AllocationRing`; tapping a coin dims the others and opens the region `InspectorSheet`. Shield alone owns the
`AllocationRing` (hole = gap when a slice is selected, ghost/hatch for
RWA). Home never renders a ring.

Exchange's resting object is the PAIR — two currency coins weighed on a
money-changer's balance beam (`PairStage`). The beam is data, not
decoration: it tilts toward the weaker side by the corridor's 5y drift
(`Corridor.drift` — the cross-rate between the two fiats, or the fiat's
vs-gold track for a gold pair), mapped `min(14, 14·√(points/100))` and
perfectly level when the pair roughly held level (<5 pts) or has
nothing to say. The coins
drop onto the beam ends on mount, then the beam settles like a real
scale — an underdamped spring with a small overshoot and wobble, then
rest. The ⇅ pivot coin sits on its fulcrum at center and carries the
shine loop; tapping it swaps the sides and the beam swings across. Tap
a coin with a story to flip it — the label beneath rewrites to its
provenance back (flag + phrase, issuer + keys, `ProvenanceCoinBack`),
one coin at a time; a coin with no back is just an icon. Tap a label
(`KESm ▾`) to change that side — the stage opens `TokenPickerSheet`
itself, fed by the shared `useTokenPickerItems` hook so both pickers
read the same compliance/badge/balance list. Below the beam the
corridor line rotates its beats (alive); a `StoryPairStrip` of
signature pairs sits under the stage — connected, it leads with what
the wallet holds (each held token vs USDm, EURm when the held token IS
USDm); walletless, with the visitor's region token. Only pairs with
provenance on both sides are offered; no chip ever selects a story
that isn't there.

The ticket is the stage's acting mode — reached by one CTA ("Move
savings") and still by construction (no shine, no beat rotation). The
stage→ticket morph is the showpiece: inside `LayoutGroup` the end coins
fly into the token pills (`coinLayoutId` `pair-coin-from/to`), the pivot
becomes the ⇅ switch, the beam fades, and the fields stagger in. "←
Pair" collapses back and clears the amount. The mode persists per
session (`sessionStorage` `diversifi.exchange.mode`); any real intent —
an amount, a quote in flight, a leg-2 hint, a phone recipient — forces
the ticket, so Guardian/Home prefills never land on the stage.

Settlement returns to the pair. A completed swap clears the amount,
acknowledges the controller back to idle, and reopens the stage holding
a `PairReceipt` — the spent coin travels the beam into the destination
and a single emerald seal ring pulses once; the destination's mint-mark
becomes a persistent ✓ for the receipt's life. That travel + seal is
the one confirm — no confetti, nothing loops, the beam keeps its tilt
because the history hasn't changed. The receipt's numbers are honest:
the quoted output is labelled "at quote", never presented as the settled
amount; a null quote shows no number at all. The goods line and the
"Settled on {chain} · View transaction ↗" link carry the same provenance
authority as the corridor line; a claimable reward gets one quiet
emerald line. The casino modal is retired — "Swap Successful!", a
fabricated "+5% Protection Score", and an "Annual Savings" estimate
presented as fact all broke the honesty contract. A via-hub leg-1
completion is the exception: it advances the ticket to leg 2 in place,
with no receipt.

Under the stage sits the pair's memory: the journey rail, "Where your
savings have lived". It is derived only from the wallet's Celo ERC-20
transfers, mapped by contract address (on-chain symbols lie — USDm
reports `CUSD`, so `token.symbol` is never read). Each station is a
currency the wallet has received, in order of first arrival; settled
legs are only transactions with exactly one outbound and one inbound
currency token — anything more ambiguous is skipped, never guessed.
Stations the wallet still holds sit full opacity on solid connectors;
departed ones dim to 40% on dashes. When pagination didn't reach the
wallet's first transfer the rail says "Recent history", not "Since" —
we can't claim a start date we didn't reach. Tapping it opens the
journey inspector: settled legs newest first with real explorer links,
no "at quote" because these amounts already settled.

The slot has three states, and connecting adds you — it never unlocks
the world. Connected, it is your own rail. Walletless, the same slot
holds one quiet invite — "Your own journey appears here when you
connect · View any wallet →" — whose second half unfolds a single-line
address input in place (no card, no modal, Escape collapses). A pasted
public address renders the same rail in read-only dress: labelled
"Viewing 0x… · read-only", never marked held — we don't know that
wallet's balances, so every station is neutral on solid connectors and
the summary drops "still held". No history says so; a failed fetch says
"Couldn't read that wallet right now" rather than showing partial data.
The looked-up address lives in state alone — sessionStorage keeps only
the derived-history cache, and connecting clears the lookup. The pair
itself persists the same way (`diversifi.exchange.pair`), so what a
visitor explored survives into the connected tab; a prefill always
beats the stored pair.

The beam is also a time machine. The corridor line's trailing "in 5
years" is a segmented control — `1y · 3y · 5y` — that re-weighs the
scale to that window's drift (the tilt literally recomputes, settling
with the same underdamped spring). The first tap pins the top line to
the what-if: "Moved to the dollar in 2020, savings that buy 10 bags of
rice today would buy ~25" — and a chosen view never rotates away. The
math is ratios only, no FX rate: two depreciation tracks divided, and
the goods count prices today's staple in local units. Every what-if is
labelled "What if · data to Jul 2025" — the as-of is disclosed, and the
multiplier is honest in both directions (dollars→naira shows ~0.4, not
a sales pitch). It's about *the move*, not the currency — Home owns
"your currency vs a benchmark", Exchange owns "had you made this move".
A pair change resets to the resting 5y view.

Exchange's story is provenance: the pair teaches tokens as money
with an origin. The corridor line leads with the provenance sentence
("from Kenya's floating shilling to allocated gold in a London vault")
over the 5y corridor track, both tappable into the pair inspector where
each token answers the same three questions — Origin (place + authority),
Backing (issuer + reserves), Keys (who can change the rules) — plus one
dated moment and its sources. Copy comes from the curated
`token-provenance.ts` registry; tokens without an entry render nothing,
and pairs with no fiat meaning still tell a story (USDC vs USDm is
governance, not FX). The persona picks which line leads — the same
three facts, reordered: Islamic finance reads Backing first
(interest-bearing or not), Buen Vivir reads Keys first (who governs),
everything else reads Origin first (`leadForStrategy`). The coin-back
gesture teaches provenance at the moment of choice: in
`TokenPickerSheet`, tapping a token's icon flips the row to its
reverse — the same `ProvenanceCoinBack` the stage's coins show — while
the row body still selects. The inspector tells the story in three
tenses: past (the dated `riskEvents` trail under each side, newest
first), present (origin, backing, keys), future (`watch` — the cadence
and mechanism that will decide what happens next, e.g. "CBN Monetary
Policy Committee — how the float is defended is decided there", never
an invented date or a predicted direction). On the stage the corridor
line rotates between the story and each side's beat — a standing
`watch` cadence, superseded by a fresh dated macro signal when the
anchored ledger holds one (`corridorSignalsFor` reads the shared proof
feed and renders rows that carry readable text; an on-chain row whose
reasoning has no off-chain echo leaves the standing `watch` in place
rather than showing a hash — Firecrawl credits are spent only when a
watched page changes, so a live beat costs nothing extra). The ticket
answers in staples before dollars: the From row's ≈ equivalent leads
with the fiat's curated `goodsAnchor` ("6 bags of rice · $292.80"), and
the To row names what a real quote buys where it lands — the remittance
reading a DEX can't give. Currencies without a staple keep the plain
≈ $; absence is honest.

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
- [ ] Motion reveals/selects/confirms, or is the object's ONE ambient
      browsing behaviour (shine loop, beat rotation) — total stillness
      once the user acts.
- [ ] New facts name their depth layer (L0 object / L1 line / L2
      inspector / L3 Guardian); an L1 addition evicts, never stacks.
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
`docs/internal/mascot-raster-brief.md`) made the problem concrete: cute, beveled,
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
  2026-08-25 GPT Image 2 tests (see `docs/internal/mascot-raster-brief.md`) came back
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
| `Coin`, `FloatingCoins`, `ShellCoinField` | `apps/web/components/shared/FloatingCoins.tsx` | coin motif; drift fields (onboarding), one-shot shell backdrop (in-app) |
| `GuardianMascot` | `apps/web/components/shared/GuardianMascot.tsx` | digital shield mascot, mood + gaze system |
| `LensCoinSelector` | `apps/web/components/onboarding/LensCoinSelector.tsx` | flickable selection row |
| `InstrumentShell` | `apps/web/components/shared/InstrumentShell.tsx` | tab layout: object + inspector + status — the ONE surface card + its `pattern` identity slot (§1: the shell owns the surface) |
| `InspectorSheet` | `apps/web/components/shared/InspectorSheet.tsx` | selection-bound fold/sheet; closed when idle |
| `AllocationRing` | `apps/web/components/shared/AllocationRing.tsx` | plan ring, exposure dial |
| `AnimatedNumber` | `apps/web/components/shared/AnimatedNumber.tsx` | count-up data punches |
| `MaskedReveal` | `apps/web/components/shared/MaskedReveal.tsx` | masked hero-line reveal (greeting headlines) |
| `FlickScrollRow` | `apps/web/components/shared/FlickScrollRow.tsx` | the horizontal scroll row: drag + momentum + chevrons + edge fades |
| `UnconnectedStatusTier` | `apps/web/components/shared/UnconnectedStatusTier.tsx` | shared unconnected status tier: trust line + demo link |
| `ShimmerText` | `apps/web/components/shared/ShimmerText.tsx` | CTA text (use sparingly) |
| `TokenIcon` | `apps/web/components/shared/TokenIcon.tsx` | real token logos w/ coin fallback |
| `phaseVariants`, `staggerChild` | onboarding screens | blur-swap transitions |
| segmented control | risk card + money purpose | period/purpose selector |
| `.scrollbar-hide` | `globals.css` | horizontal chip strips |
| currency-risk data | `apps/web/constants/currency-risk.ts` | depreciation, counterfactuals, events |

Grammar of the app: **coins decide, numbers convince, one button acts.**
