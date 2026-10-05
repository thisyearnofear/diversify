# Storytelling brief — one coin, one world

*Draft for review (2026-10-05). Exploratory: it proposes directions; anything
adopted must still clear `docs/design-language.md` and land there.*

## The diagnosis

The parts are strong: an honest one-number risk moment, a coin grammar
("coins decide, numbers convince, one button acts"), owned motifs per tab, and
a strict honesty contract. The gaps are a **protagonist** and a **world**.

- **No protagonist.** The user's own money shows up as a different object on
  every tab: a currency coin on Home, an empty ring on Shield, a token pair on
  Exchange, a mascot on Guardian. Each tab follows the contract, but together
  they read as four separate apps that share a dock.
- **No world.** Onboarding is a night scene (navy ground, gold coins,
  philosophy-tinted light). The app then opens on a white card that's mostly
  empty on desktop. Choosing a philosophy changes only the ring colours. The
  identity the user just declared mostly disappears.
- **The best story is hidden.** The currency story (the 12-month path plus
  dated events) is the most narrative asset in the product. It sits behind a
  coin flip with no visible cue.
- **The loss is abstract.** "≈ NGN 10,800,000 less buying power" is a big
  number that doesn't land. The Goods toggle exists but isn't the default
  reading.

The 2026-09-28 amendment ("calm had tipped into lifeless") names the symptom.
This brief proposes the cause: the contract prevents clutter, but nothing in it
*requires* continuity.

## The arc

One sentence per tab, read in story order:

| Beat | Tab | The user feels | The coin… |
|---|---|---|---|
| 1. Recognition | Home | "That's my money, and it's been shrinking." | is introduced: your currency, your number |
| 2. Agency | Shield | "I decide what it's protected by." | enters the plan ring as a slice |
| 3. Action | Exchange | "This is the move, and I'm making it." | crosses the beam |
| 4. Trust | Guardian | "Something is watching it for me, within my limits." | rests as the Guardian's belly coin |

The dock stays Shield / Home / Exchange / Guardian (a fixed contract). The arc
is about continuity between tabs, not their order.

## Directions

### 1. The coin is the protagonist *(prototyped)*

The user's currency coin is the one object that moves *between* tabs. On a tab
change it leaves the outgoing tab's anchor and lands on the incoming tab's
anchor:

- Home: the local currency coin on the stage.
- Shield: the ring's hole. The coin is absorbed into the plan.
- Exchange: the "from" coin on the beam.
- Guardian: the belly coin.

Contract fit:
- Motion confirms a transition and stays one-shot (~0.5s); nothing loops.
- It adds no motif: it is the `Coin` primitive, and the anchors are coins each
  tab already owns.
- Reduced motion skips the flight entirely. Content stays the same.
- It's also skipped on first mount, while the user is acting, and when either
  anchor is missing.

### 2. The world carries across *(prototyped)*

Once a philosophy is chosen, its identity belongs to the app, not only to
Shield:

- Every instrument shell wears the archetype pattern through the shell's own
  `pattern` slot (§1: the shell owns the identity tint) and gets an accent top
  edge (§1: accent arrives via borders and top edges).
- The backdrop ground carries the same pattern, more visibly, in the margins.
  No text sits on it, so glass rule §1 isn't at risk.

Later, and as a separate decision: run the instruments on a dark ground, so the
app keeps the onboarding's night scene instead of switching to a white
dashboard.

### 3. Make the loss human

- Lead Home's reading with the **Goods** frame where a curated basket exists:
  "Your 15M NGN bought N months of rent in 2021; today it buys M." Sourced and
  dated like every other number, and omitted when there's no basket data
  (honesty contract).
- Promote the currency story. Onboarding's "Context: 2023, 2024…" line could
  become a timeline you can scrub, with each year a dated event from
  `riskEvents`, and Home's flip could carry a visible cue on first visit.

### 4. Philosophies need an identity, not emoji

Philosophies are the retention layer, yet the picker is eight near-identical
coins labelled with emoji (and emoji glyphs render as empty boxes on systems
without an emoji font). Each philosophy needs:

- a commissioned glyph stamped on its coin (replacing the emoji);
- its existing CSS pattern, raised from "felt, never seen" to visible on the
  ground;
- a single sentence in its own voice ("Build the motherland" already does
  this, so the work is to extend it to the rest);
- a ring texture, so a sliced ring is recognisable at a glance.

This should be designed with people from each tradition, not from stock motifs.

### 5. Guardian with no wallet should demonstrate, not ask

The three-step example decision is the strongest walletless story in the app,
but it sits behind a link. It should be the default walletless object. It would
still advance only on tap, per the contract.

### 6. The share loop is the growth story

The postcard, stamp, moment and pair-card pages already exist. A "my currency's
story" card (coin, delta, one dated event, plan seal) fits how this audience
shares, mostly over WhatsApp. It needs an OG-image pass and a single, visible
share entry point after the risk moment lands.

## What not to do

- No fabricated activity, streaks, or celebrations on real-money moves (§2).
- No new card stacks. Every direction above transforms an existing object.
- No ambient loops. The protagonist moves only on a tab change.
