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
  method). Must be *subordinate and readable*.
- **Transition** — what happens next. Must be *one line*.

Anything that's neither the job, trust, nor transition gets cut or
moved. Example: the SME business waitlist used to sit mid-scroll in the
risk moment — an email form interrupting the emotional beat. It left the
moment entirely — the SME wedge now surfaces only at the risk screen.

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
tab and every connection morph — Shield, Home, Exchange, Guardian,
connected or not. Objects render bare inside it: the moment card, the
swap ticket, and the ring carry no card chrome of their own. A tab that
wraps its object in its own card (or a shell that skips the card) is out
of contract — that drift is exactly what users read as "the tabs feel
like different apps". **The shell also owns the identity tint:** the
archetype pattern renders through the shell's `pattern` slot — INSIDE the
card, above its solid background, below the content. Painting it as a
sibling under the opaque card makes it invisible; painting it over the
content fights the text.

## 2. Expressive clarity — one dominant story

DiversiFi should feel alive, culturally recognizable, and empowering, not muted by default. The emotional goal is curiosity, recognition, and agency: the user understands their money and sees their values change the instrument.

**One dominant story per screen.** Color, typography, material, and motion may extend across the object, its meaningful reading, selected controls, and primary action. They must reinforce the same decision. Unrelated content remains subordinate, never illegible. Expressiveness belongs in the instrument, not extra cards or competing decoration.

**Quiet means lower priority, not low readability.** Financial meaning, selectable labels, and next actions must remain readable at a glance. De-emphasize through placement, spacing, and weight before reducing contrast or type size. Never truncate philosophy names or shrink important language to accommodate decoration. Make the main reading stronger before making the background busier.

**Every tab has an emotional job.** Home makes the stakes land; Shield makes the plan feel like yours; Exchange makes the choice tangible; Guardian makes the agent present and accountable. Each retains its owned motif and a recognizable silhouette. Shared structure must not produce identical expression.

**Every interactive object advertises its verb.** Inspection, selection, preview, and commitment have distinct visible treatments. Motion reinforces an affordance; it never substitutes for one. First-use teaching stays local to the relevant object, disappears after use, and never covers a different control.

**Celebrate understanding and ownership, not moving more money.** Honest historical/live/projected/sample labels, explicit consent, one primary action per state, readable evidence, and reduced-motion support are unchanged. No fabricated activity, artificial urgency, transaction rewards, or celebrations encouraging real-money trading.

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
and `FloatingCoins`. Rule: **the coins do work**. Readable labels and visible selection are part of the control, not optional decoration.

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

Discovery invites, exploration responds, commitment settles. Motion reveals, selects, or confirms; while browsing, one focal choreography may express material, attention, or verified state. Reduced motion preserves the same meaning and visual character without movement. No competing loops or pulsing transaction CTAs.

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

- One focal choreography per object, long dwell (≥5s), no competing loops or pulsing CTAs. Coordinated material motion and the existing dated live line may support the same story; unrelated motion stops on user action.
- Ambient motion may only re-surface existing facts (a shine, a beat
  rotation) — never introduce a new text block or a decorative loop.
- Reduced motion gets identical content, static: the shine is CSS-gated
  under `prefers-reduced-motion`, beat rotation is JS-gated.

**Data motion is not decoration (2026-09-28 amendment).** Feedback said
the surfaces read as static; calm had tipped into lifeless. Two
additions, neither counted against the ambient budget:

- **Numbers and shapes that change because the data changed always
  animate from the old value to the new one** — balances, the Guardian
  budget sentence, ring slices, hero values (`useCountUp`, the ring's
  spring). Motion that carries a real change is information. Numbers that
  never change after mount stay still.
- **Every tab owns one live line** (`components/shared/LiveLine.tsx`): a
  single L1 sentence that rotates dated, cited facts on the 7s dwell —
  Exchange's corridor line (provenance, beats, cadences), Home (your
  currency's fresh macro signal or watch cadence, then its newest dated
  event), Guardian (what it is watching: your next saved payment, fresh
  signals for your plan's currencies, the cadence to watch), Shield (fresh
  signals and the cadence for your plan's legs). Beats come only from real
  data — `corridorSignalsFor` (14-day freshness, echo check, rehearsal
  filter), curated `riskEvents`, saved cycles — and a beat with no data is
  omitted, never invented or forecast. The line freezes the moment the user
  acts, stays on its first beat under reduced motion, never repeats a block
  already on screen, and renders nothing when no beat resolves. It is one
  line, never a feed.

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
costume. Guardian's object is the mark (96px) + its state headline + two
quiet lines: the budget line — `$X left of $Y today`, a sentence, never
a ring — and the latest decision line. Journal and limits are inspector
sheets behind those lines. **Limits & controls holds limits only** —
daily limit, used/left, expiry, pause, the plan Guardian follows, and the
one autonomy opt-in; notifications, voice and integrations sit behind a
single "Notifications & integrations →" link. **One grant path:** the
object's "Set daily limit" signs a proposal-only (COPILOT) permission and
its copy never says Guardian moves money on its own; "Let Guardian act
for you" (ERC-7715 cap + GUARDIAN re-sign at the same, read-only limit)
is the only place autonomy is granted and the only copy allowed to say
Guardian acts without asking. Shield never signs — it hands off here.
Walletless Guardian can morph into an explicitly labeled, three-step
example decision performed by the mark: stand down on missing data,
propose for user approval, then show what evidence a real decision carries.
The visitor advances by tapping the mark; the example never auto-advances.
"Why this decision?" opens one inspector with the current explanation.
It has no receipt or live monitoring state and never enables sample
balances or execution. Reduced motion preserves the selected step and
mood with static transitions.

Tripwire: `corridor-context.test.tsx` asserts the resting corridor line
stays under a word budget — sediment fails CI, not review.

Each tab is an **instrument**, not a feed of cards:

1. **Object** — the thing you manipulate (risk moment, exposure dial,
   plan ring, pair stage, Guardian mark).
   First viewport. Its reading, selected controls, and primary action reinforce one dominant story (§2).
2. **Inspector** — opens from a selection (`InspectorSheet`). Empty
   selection means the sheet is closed, not a stack of closed rows.
3. **One CTA** — attached to the inspector or the object's current
   shape. A second button with the same destination is a bug.
4. **Morph** — the same screen changes shape with user state and
   persona (no plan → picker; empty → fund; gap → rebalance; aligned →
   assured). Persona retargets the object; it does not reorder a module
   list. Leftover jobs go to Ask Guardian, not a basement of features.

**Desktop composes the workbench; it does not calibrate page height.**
`InstrumentShell` owns the shared spatial grammar: a deliberate resting
stage, the object, the selected inspector, and the status line. At `lg`
the resting shell uses one viewport-aware stage budget across all four
tabs; when the shell itself reaches 720px, an open inspector becomes the
right-hand workbench column instead of pushing the object farther down.
Below that width — and on mobile — the same inspector folds beneath the
object. Objects that need a wider reading compose their existing
`.instrument-artifact`, `.instrument-reading`, and `.instrument-controls`
when their own 560px container allows it; `.instrument-inspect-hidden`
marks secondary object content that yields while a selection is open.
Status spans the whole workbench. Never reintroduce a per-tab height
flag, shrink type, or add filler to make the tabs look the same length —
equalise the orientation and depth of interaction, not the pixel count.

**Ask Guardian is a session thread, not a durable journal.** The visible
chat lives only while the drawer is open: closing it or choosing "New
conversation" clears the transcript so the next open is empty — matching
the triad's reset-to-instrument feel. Long-term memory is **opt-in and
off by default**: a footer line ("Memory: Off · Change") swaps the drawer
to a memory view with three modes — Off (nothing stored), This device
(facts in this browser only), or Across devices (facts server-side under
the signature-verified wallet, at the provider the user picks — named
with its location, e.g. "Alibaba Cloud — stored in mainland China" or
"Cognee — stored in the USA (AWS)"). Memory holds **facts, not
transcripts** — at most 12 short user-stated lines, expiring after 30
days, listed under "What Guardian remembers" with per-fact delete and
"Forget everything". After a reply that stores a fact, one quiet line
appears beneath it: "Remembered: {fact} · Undo". Turning memory off with
facts asks inline ("Also delete what Guardian remembers? Delete · Keep")
— never a modal. Do not reintroduce transcript persistence or implicit
memory writes without a product decision to revert this stance. Empty
state stays quiet (one line + starters) — trust footnotes belong behind
recommendations, not in the first paint.

On desktop (≥lg) Ask Guardian docks as a right-side panel — 420px,
`min(720px, 100dvh−2rem)`, no scrim, no blur, no scroll lock; the page
stays live behind it. The FAB morphs into the panel via a shared
`layoutId` (fade only under reduced motion), and hides while it's open.
⌘K / Ctrl+K or "/" opens it, Esc closes it; the header carries one
context line (`Looking at: {tab} · {from} → {to}` on Exchange) and the
Protection Balance lives once in the footer. Mobile keeps the bottom
sheet unchanged.

`DisclosureSection` is not IA. Accordion rows are a density tactic.
Disclosure is allowed only for **trust footnotes** (data source, method).

Review test: *does this block change the object, the inspector, or the
one CTA?* If not, it leaves the tab.

### Instrument utility rails (fail = revert)

A tab change that fails any of these is the old stack. Do not ship it.

1. **One job per tab.** Home sees. Shield decides. Exchange acts. Guardian
   guards. Learn is retired — the calculator lives in Shield's
   empty-wallet inspector.
2. **Selection rewrites the artefact.** If a tap only opens a paragraph,
   it does not ship. **Modes transform, never append:** entering a mode
   (compare, picker, a lens) moves and morphs the elements already on
   screen — shared-element `layout`/`layoutId` motion — and must not grow
   the page with a new block below the object. Shield's compare is the
   reference: the ring goes compact, the coin rail slides in, nothing
   stacks underneath.
3. **One CTA, on a tab that is in the dock.** `navigateToSwap` into a
   hidden Exchange tab is a bug. A hand-off to Guardian from Simple mode
   is a real request, not a bug — it switches the mode Simple → Full so
   Guardian appears instead of bouncing to the first tab.
4. **Persona morphs the object, it does not add a module.** Caribbean
   netting stays an Exchange shape. Yield annotates the quote. RWA is a
   ring token. Payment cycle is a Shield inspector body — for business
   personas (`shieldMorph: 'cycle'` or a payment money-purpose) it is
   also Shield's status rail, replacing the RWA entry connected and
   walletless. The morph is the
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
   **Connecting never replaces Home's object:** while a wallet prompt is
   open, Home stays explorable and its connect CTA alone shows
   "Connecting…"; do not strand the user on a full-screen wait or add a
   second connecting banner. **One connect affordance per tab on mobile:**
   below `sm` the header `WalletButton` yields to the in-object CTA on tabs
   that carry one (Home, Shield, Guardian); it survives where the resting
   object has none (Exchange's pair stage, Info), when connected, on desktop,
   and in Farcaster/MiniPay contexts. **Shield transforms ring ↔ rail in
   place:** compare and the picker transform the ring — it goes compact
   with a faint outline of the current plan behind it — and the
   philosophy coin rail (the onboarding `LensCoinSelector`, scrollable)
   slides in beneath; a coin previews (re-slicing the ring in place), a
   second tap opens the details sheet, "Use this plan" commits, the hole
   tap exits — nothing appends below. Walletless Shield copy separates
   the jobs: the badge names the plan, the hole states its
   dollar-reserve target and compare affordance, and the CTA says
   "Connect wallet" — no duplicate plan name or connect ask in the hole.
   Leg rows render canonical tickers (USDm/EURm/BRLm) though leg ids
   stay wallet-facing internally.
6. **Nothing sits above the object** except a real error. Banners,
   scorecards, honesty strips, and “next step” journeys are object /
   status / footnote — or they leave.
7. **No restored cards.** The retired card stack — `ProtectionScorecard`,
   `ProtectionJourney`, `OptimizationInsight`, `ProtectionPlanCard`,
   `ProfileWizard`, `RobinhoodRwaCard`, `ShieldGuardianRecommendation`,
   `AssetModal`, `RwaAssetCards`, `DisclosureSection` (and before them
   `BestYieldCard`, `SavingsLoopCard`) — is deleted. The Guardian card
   stack joined it: the `AgentTierStatus` component, `GuardianWDKStatus`,
   the four-step `GuardianMobileWizard` (a second grant path — now the
   change-only `GuardianPlanSwitcher`), `GuardianMarquee`,
   `GuardianProofTab`, `ActivityFeed`, `AdvisorMetrics`. "Total Savings"
   was retired with them — it summed projected `expectedSavings` as if
   they were realized money. Tokenized-asset (RWA) identity lives in
   `components/tabs/protect/rwa-assets.ts` — claim-free: issuer facts come
   from `token-provenance.ts`, rates/prices live from
   `/api/agent/rwa-market` (absent when a provider is down). The RWA lens
   (`?sleeve=rwa`, or the status rail) keeps RWA wedges in color and
   quiets the rest; holdable assets lead the inspector, IXS vaults follow
   as an off-app section — they never re-slice the user's ring. Do not
   recreate them.
8. **Status tier budget.** Trust + one transition + one rail, via
   `StatusTier` (`components/shared/StatusTier.tsx`). A new prompt
   competes for the transition slot by priority — it never stacks. All
   four tabs route their connected status through it (walletless keeps
   `UnconnectedStatusTier`); tests assert ≤3 slots on every tab.

**Lenses.** A lens is a state of the tab's existing object — same
primitives, no new card — entered only through the transition slot and
left via an in-object "←", always preview-only. Two are shipped:
**Stronger floor** (Shield) opens only when the wallet's dollar share
sits ≥10 points above the plan floor — a stronger floor raises the
dollar reserve, so it is never offered when the wallet is under-reserved
(that's the gap CTA's job); **Decision window** (Exchange) opens only on
a fresh dated macro beat — the ones `corridorSignalsFor` already returns
(≤14 days, readable off-chain echo) — never a predicted direction.
Sourced scheduled dates are allowed as facts elsewhere
(`constants/scheduled-events.ts` feeds Stamps, re-verified every 90
days); what stays forbidden is a forward calendar of our own making —
predicted outcomes or directions. Its state is the corridor line itself: still, no
rotation, no what-if pin — each fresh side's dated beat plus the
standing mechanism that produced it ("Decided at {event} · {cadence}"),
then ← Story returns. Shield's floor lens IS the existing balance
preview — ring re-slice, "Dollar reserve A% → B%", Use/Keep — nothing
auto-commits. Home's transition order: banner > payment-cycle >
graduation prompt > Guardian activity > tip > compare — and every prompt
hides while an inline inspection is open. Payment-cycle
and graduation both open Shield's payment-cycle inspector (`lens:
'cycle'`, plan-independent and walletless; also `?tab=protect&cycle=1`)
— the per-cycle FX drag report is the business morph's doorway, netting
stays an Exchange shape. The inspector itself has two modes — **Next
payment** (forward scenario) and **Last cycle** (the historical engine
over a trailing 73-day window, `?cycle=last`) — and
`/fx-drag-calculator` is a doorway into Last cycle, the same contract
as `/rwa-vaults`. The report is one object with in-sheet view swaps —
a main view (form → result + one CTA), an options view for Guardian
details and export ("Details & export →" / "← Report"), and a saved-cycles
view ("Your cycles…" / "← Back") — never accordions. The graduation line comes only from the
wallet's own behaviour (`useGraduationSignal`), is phrased as a
question, never renders in demo, dismisses for good, and logs
`graduation_prompt_viewed/clicked/dismissed`. Shield's: sleeve back > compare
row > floor prompt > status row. Exchange's: while a fresh beat offers
the decision window the prompt owns the transition slot and netting
drops to the rail; otherwise netting is the transition, no rail. Every
lens logs `lens_offered` (once per session, only when the prompt is the
rendered transition, never in demo) and `lens_open`, so open rates are
honest.

The dock is a fixed order — Shield / Home / Exchange / Guardian — clipped by the
two experience modes: Simple shows the first three; Guardian joins when first
requested (a hand-off switches Simple → Full) and in Full. Learn is retired — the calculator lives in Shield's
empty-wallet inspector (and optionally Home amount-inspect), never a peer tab.
Home is always the Risk Theater — the coin stage (`CurrencyMomentCard`/`InflationMomentCard`) is
the one expressive object, centred on one stage rather than an artefact/reading split (coin — delta — benchmark
across the row, context beneath); holdings are a quiet coin row beneath it — one `Coin` per region, sized by share,
centred when it fits and scrolling from the start when it overflows (`flex-none` items, auto `margin-inline` on the
ends — never `justify-center` on an overflowing track) — never
a second `AllocationRing`. Home selection replaces the stage inline (`InspectorSheet` `presentation="stage"`:
borderless, opacity-only, `← Back`, same focus/dismiss lifecycle) — the comparison stays mounted but `hidden`,
holdings stay, and the status transition slot is suppressed until close. Tapping a coin dims the others and stages
that region: the headline `N%`, `Region · value of total`, one exposure meaning, `Review in Shield` primary plus a
quiet Ask Guardian — optional Zakat sits behind an explicit Exposure/Zakat selection, never stacked. Tapping the stage's
local coin flips it to its back (flag + newest dated event) and opens the currency story — a centred coin, a labelled
`12-month path vs USD` chart (feed series, timestamp-spaced, validated before draw — malformed/missing series render
`Historical path unavailable`), then a bounded `FlickScrollRow` of dated events whose selected caption carries
year/event/impact (`Latest` only when a live anchored signal exists); "Share this currency's story ↗" stays secondary
to the Ask Guardian primary. Home carries its own provenance (moment source/date, wallet freshness) — the status
tier's generic trust line stays empty on Home, and the GoodDollar claim rides a named `GoodDollar daily income`
entry that opens to the one-time identity explanation rather than a bare verify prompt; a `?currency=` shared card lands view-only —
no country override, no visit memory — with an in-object "← Your currency" to leave. Shield's focused-token
coin flips the same way when a curated provenance entry exists (`ProvenanceCoinBack`, reset on selection change). Shield alone owns the
`AllocationRing` (hole = gap when a slice is selected, ghost/hatch for
RWA). Home never renders a ring. Shield's since-last-visit alignment
lives in the status tier (`ShieldStatusTier`), not the ring hole. When a swap
settles, the destination's region coin wears a seal on the next Home
visit — derived from refreshed balances (never the receipt's word), one
emerald pulse plus a persistent ✓; reduced motion shows the ✓ alone.
The resting card is one comparison, one consequence, one live fact: when a
country override exists the selector IS the heading (`Savings currency`, or
`Example currency` + a `{country} ({code}) · example` placeholder when
detection produced nothing — never a falsely selected country); the scenario
input reads `Example amount` (it stays an example after editing); the single
`home-consequence` line is sign-aware and, only for a negative comparison
with a sourced, nonzero staple equivalent, alternates money ↔ goods via the `Consequence unit`
segmented control (same element, resets to money on currency/benchmark/
horizon change). Guardian activity left the resting surface — the transition
slot carries only a "Review Guardian activity →" link, and the cadence line
lives inside the selected journal/context inspector.

Exchange's resting object is the PAIR (`PairStage`) — two coins on a
balance beam tilted by the corridor's drift. The ticket is its acting
mode behind the one CTA ("Move savings"); settlement returns to the
stage as a `PairReceipt`. Provenance, the journey rail, the time
machine, pair sharing, and Ask Guardian live in the pair inspector.
Full spec: [`exchange-instrument.md`](./exchange-instrument.md).

Counterparty matching is a state of the pair inspector, not a dashboard: Your need shows the currency pair, amount, dated mid-market reading, and Find a match. Details replaces that composition with presets, matched/unmatched figures, estimated avoided costs, rate provenance, and the settlement-native credit file. Loading and failed checks never display a retained result as current; walletless checks are labeled live previews with nothing posted. Pending settlement actions and receipts remain visible in the result; settlement still requires the user's wallet.

Header: chain visibility ("see the chain without hunting", 2026-09-03
tester feedback) is now the wallet button's job, not a second header
control. The closed button face shows the current chain's icon + short
name (`sm+`) beside the address/email; opening it reaches the full
`ChainSelector`. The standalone header `ChainPill` was removed
2026-09-28 — it duplicated that same switcher with a narrower chain
list, and testers found the header itself crowded (streak badge, mode
toggle, voice, chain pill, wallet button all competing at once). The
Simple/Full toggle moved to Home's region/settings disclosure; the
voice button lives only where voice input is contextual (Ask Guardian).

Connection feedback belongs only to the wallet button the user attempted. Missing-wallet guidance is subordinate, readable, dismissible with Escape/back, and offers only configured connection paths. A missing browser wallet is not a financial emergency; never print the raw provider error below every wallet button. Email/social availability depends on Privy being configured, not on the presence of a Connect label.

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

### Stamps — facts users press onto a move

A stamp is a circular seal for one curated, dated, cited fact: a round
SVG carrying a glyph and a short value in the centre with `SOURCE · DATE`
riding the rim on a `textPath`. Users press 1–3 onto a small postcard of
their move (from coin → to coin + mode caption + empty dashed slots) and
share it. The grammar is strict because there is **no free text
anywhere** — zero moderation surface:

- Only curated facts (`lib/stamps.ts`): scheduled sourced dates
  (`constants/scheduled-events.ts`, hand-sourced with a url, re-verified
  every 90 days), the corridor dataset's drift and risk-event trail, the
  goods anchor, and token provenance. Every stamp carries a named source
  and a date; a fact that can't cite both is omitted, not padded. Never
  a prediction or a direction — what already happened, plus sourced
  scheduled events.
- One fact primitive, two states: a fact flows on a tab's LiveLine as
  a beat (L1) and can be pressed as a stamp (L2) — a stamp is a beat
  you keep. `lib/stamps.ts` builders feed `lib/live-lines.ts`; a beat
  carrying a `stampId` is keepable, a fresh signal beat never is (it
  expires in 14 days; postcards must be durable). Coming (scheduled,
  sourced) beats now appear on the Home and corridor live lines within
  120 days. On a return visit (per-pair `corridor:` snapshot,
  `since-last-visit`), the corridor line may lead once with `Since
  {elapsed} ·` on what's new — an event newly within 14 days, else a
  new signal — before the normal rotation resumes; demo views never
  read or write visit memory.
- L2 only — three doors, one sheet (`StampSheet`, mode
  `moved`/`watching`, entry `receipt`/`beat`/`inspector`): the
  receipt's ✓ seal (a button taught once per device — three dashed
  rings bloom once and a "stamp your why ✦" caption shows ~4s), a
  trailing ✦ on a stampable corridor-line beat (pressing it counts as
  acting: the line stills, and the sheet opens with that stamp
  pre-pressed), and "Stamp what you're watching ✦" in the pair
  inspector. Nothing reaches L0/L1, and every affordance is absent
  when `stampsForPair` has nothing honest to offer.
- Stamps are pressed, never earned: no unlock, no reward, no streak —
  sharing is not gamified.
- Motion: the seal flies tray → slot by `layoutId` inside a
  `LayoutGroup`, lands with a press (scale 1.15 → 1, a deterministic
  −8°..8° tilt hashed from its id, and an ink-bloom ring that fades
  once). `haptics.tap()` on press. A 4th press on a full postcard
  gently shakes the slots and does nothing else. Reduced motion: no
  fly, no bloom, instant placement, no shake — identical content. No
  ambient loops.
- Shared postcards (`/postcard/[from]/[to]` + `/api/og/postcard`)
  derive everything from symbols + stamp ids — like pair cards, they
  never read a number from the URL, and a seal links to its source or
  back to the pair page. "Facts cited by DiversiFi · dated · not
  advice."

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

### One number, one face — and a way to hide it

The user's total is the most important number in an FX-risk app, and it
must read the same way everywhere and be one tap from gone.

- **One slot, one formatter.** Every dollar figure on Home and Shield
  goes through `formatMoney` (`lib/money-format.ts` → whole dollars,
  `$x.xxM` past a million). No per-surface `$${n.toFixed(0)}` variants:
  a total that changes size, format, and location per tab reads as
  "nowhere", which is the tester complaint that produced this rule.
- **The hole states one fact.** Shield's ring centre is L0 + one word —
  `$12,480` / "your savings" at `text-3xl` (`text-2xl` for six-figure
  totals like `$123,456`, which would overflow the 152px hole). No label duplication (the plan badge above
  already names the plan), no hint sentence ("of your money follows
  the plan" restates the score), no `3xs` kicker. More type size, not
  more words: cutting a layer *raises* the remaining type.
- **Flip, never carousel.** The idle hole carries a second face — plan
  alignment (`72%` / "aligned", `text-4xl`) — reached by the flip verb
  (a closed gesture verb in this grammar, same as `ProvenanceCoinBack`),
  with a rotateX+blur swap keyed on the face and two tiny face dots
  under the label marking which face is showing. The total itself
  tweens old → new when balances change (data motion, not decoration).
  A one-shot dwell preview (swap to alignment after 8s idle, hold ~3s,
  return to the total, never repeats) shows the second face once —
  skipped under reduced motion, cancelled by any action: hole tap,
  slice select, legend row, or the plan badge. Auto-rotating facts are
  a feed — banned.
- **Idle memory is not a hole layer.** The since-last-visit drift moved
  out of the ring into `ShieldStatusTier`'s transition tier, under the
  object where it reads as context rather than as part of the number.
- **Privacy is dots.** `BalanceVisibilityProvider` (persisted,
  default visible) + the header eye toggle mask every dollar figure
  app-wide. The mask is `••••` with an honest `aria-label` — never a
  fabricated `0.0000` (the honesty contract bans invented balances) and
  never a blur, because `TrustFootnote` already claims blur as "a
  stillness affordance, not a hide". Percentages, plans, and the
  Guardian's decisions stay readable: privacy covers *how much you
  have*, not what the product thinks. Guardian's account-specific daily
  limit, used amount, and remaining amount are hidden through `formatMoney`
  in both the object and Limits & controls. Explicit move amounts, prices,
  fixed protocol thresholds, and the limit shown for review in a grant
  confirmation remain visible because they explain an action or consent.
  Someone who has hidden before gets re-hidden on return after ≥60s away
  (`everHidden` + `lastActiveAt`), applied before first paint — a stale
  visible balance never renders; a user who never hid is never touched.
  New account-balance surfaces must call `formatMoney`; that is the only
  sanctioned way to render a balance.

## 7. Honesty is styled as restraint

Visibility of disclaimers is inversely proportional to how much they
work. One plain line — "● Live 1Y · Data as of 2026-08-24 · history, not
advice." — beats a badge strip with a chip for every sub-claim. Plain
words are the trust signal; chrome undermines it. Never fabricate
numbers to fill a gap (per AGENTS.md Wave 8 — expired cache before a
fake `+0.0%`); apply the same rule to copy: no claim you're not making
truthfully somewhere verifiable.

**Chain-agnostic trust:** DiversiFi settles on 5 networks (0G, Arbitrum, Celo, HashKey, Robinhood — all at `0x3BCf…369C`) and the Guardian carries `AgenticID #1` on 0G (`0x6815…33D60`, 0G Storage root). The UI stays chain-agnostic by default: one quiet line — `Verified · Evidence mirrored` with a `✓` — in the trust tier (`TrustFootnote` / `InstrumentShell status`), not the object. No chain names, no hex in the first viewport. Detail is progressive disclosure: tapping `Verified` rewrites the artefact in place to the 5 dots + shared address + `Guardian #1` + explorer `0G/Celoscan/Arbiscan` links and the `/api/agent/zero-g-ledger?verify=<hash>` check (`LiveProofCard` lazy `✓`). Beginners never see a hex until they care; reviewers get the exact vision sentence in one tap. Header `GuardianMascot` tooltip reads `Portable Guardian · portable across wallets`, not `ERC-721`. Home is the exception — the moment and story already carry their own source/date provenance, so Home's status tier leaves the generic trust slot empty rather than mirroring a second Verified line.

**Colour carries meaning, so there is one action hue.** Every primary CTA and every product hand-off link wears `--action` (`bg-action` in Tailwind; numerically blue-600 so legacy call sites still match, but `action` is the sanctioned spelling). Green and teal are reserved for verified / ready / settled state (`StatusBadge` `ready`) — spending them on an upsell makes a pitch read as a confirmation, which is exactly the confusion this section exists to prevent. Status-tier text links follow one grammar: `.link-handoff` is a real next step (carries a verb, wears the action hue, the heaviest thing in the row); `.link-quiet` is supporting or exploratory (gray, never the action hue). The demo entry is quiet by contract — it is illustrative, not the way forward, so it never wears blue. Arrows suffix interactive hand-offs only; a static sentence never ends in `→`.

## 8. PR checklist for any new surface

- [ ] One sentence states the screen's job; if it needs "and", split it.
- [ ] CTA in or near first viewport on mobile (~600px content above it).
- [ ] Each text block names a job that no other block names.
- [ ] One dominant story across object, reading, selection, and action; supporting information stays readable.
- [ ] Each tab earns its emotional job and every interactive object advertises its verb.
- [ ] Controls reuse an existing motif (coin, segmented control, ring).
- [ ] Name the object, what selection opens, the one CTA, and which
      persona morphs the object. A new `*Card` or `DisclosureSection`
      as a tab sibling is out of contract.
- [ ] Discovery invites, exploration responds, commitment settles; one focal choreography, no competing loops, and unrelated motion stops on user action.
- [ ] New facts name their depth layer (L0 object / L1 line / L2
      inspector / L3 Guardian); an L1 addition evicts, never stacks.
- [ ] Reduced-motion path verified.
- [ ] Disclaimers/honesty copy appear exactly once, in plain words.
- [ ] New CTAs use `bg-action`; new status-tier links use `.link-handoff` (next step) or `.link-quiet` (supporting) — never a new hue, never green/teal for a pitch, no arrow on static text.
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
| thinking | squashed (scaleY 0.8), fixed slight offset | two still signal dots above-right | active AI processing |
| protective | narrow slit (scaleY 0.35), gaze drops | — | shield active / standing down |
| alert | enlarged (1.25×), gaze lifts | — | notifications / a proposal waiting for the user's decision |

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
  (`WelcomeScreen`, AIChat empty state) and the connected Guardian object
  only while resting; stop during analysis, inspection, or a pending move.
  In the connected Guardian object, the first pointer press or keyboard
  focus also turns gaze off until the object remounts. Keep gaze off on
  utility surfaces. A fixed `{x, y}` target (each axis [-1, 1]) is available
  for directed attention. Moods settle on springs (`MOOD_SPRING`), never
  linear snaps.
- Thinking is a fixed eye pose with still dots, not wandering eyes or a
  repeating signal. It appears only during active analysis or chat. An
  authorized but idle Guardian stays neutral; a real proposal waiting for
  the user's signature uses alert. A real analysis takes precedence over
  the proposal pose.
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
| `UnconnectedStatusTier` | `apps/web/components/shared/UnconnectedStatusTier.tsx` | shared unconnected status tier: trust line + demo link (demo is `.link-quiet` — gray, never blue) |
| `StatusTier` | `apps/web/components/shared/StatusTier.tsx` | connected status tier budget: trust + one transition + one rail (§5 rail 8) |
| `--action` / `bg-action`, `.link-handoff` / `.link-quiet` | `apps/web/styles/tokens.css`, `globals.css`, `tailwind.config.js` | the ONE action hue for CTAs + hand-off links; green/teal reserved for verified/ready (§7); quiet register for supporting links |
| `useBalanceVisibility`, `BalanceVisibilityProvider` | `apps/web/context/app/BalanceVisibilityContext.tsx` | app-wide privacy switch: `hidden` + `formatMoney` (dots while hidden). Every dollar figure goes through it |
| `BalanceVisibilityToggle` | `apps/web/components/shared/BalanceVisibilityToggle.tsx` | the header eye control that flips the switch (`aria-pressed`) |
| `formatUsd` / `MONEY_MASK` | `apps/web/lib/money-format.ts` | the one USD formatter + the dot mask |
| `StampSeal`, `StampSealFace` | `apps/web/components/shared/StampSeal.tsx` | circular fact seal: rim `textPath` source·date, `aria-pressed` toggle |
| `StampSheet`, `StampPostcard` | `apps/web/components/swap/StampSheet.tsx` | the L2 stamp inspector + postcard face (press/lift/share) |
| `ShimmerText` | `apps/web/components/shared/ShimmerText.tsx` | CTA text (use sparingly) |
| `TokenIcon` | `apps/web/components/shared/TokenIcon.tsx` + `apps/web/constants/token-logos.ts` | curated token logos w/ branded coin fallback on missing or failed logos; add verified assets to the registry, never leave broken images |
| `phaseVariants`, `staggerChild` | onboarding screens | blur-swap transitions |
| segmented control | risk card + money purpose | period/purpose selector |
| `.scrollbar-hide` | `globals.css` | horizontal chip strips |
| currency-risk data | `apps/web/constants/currency-risk.ts` | depreciation, counterfactuals, events |

Grammar of the app: **coins decide, numbers convince, one button acts.**
