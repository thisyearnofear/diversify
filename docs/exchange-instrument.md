# Exchange instrument — the pair, the ticket, the receipt

The Exchange-specific application of `design-language.md` §5 (tabs are instruments): how the pair stage, the swap ticket, the receipt, the journey rail, sharing, and the time machine compose into one object.

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
emerald line. When the swap arrived as a Shield hand-off (the prefilled
pair is the pair that settled), the receipt adds one quiet "Back to
your {plan} plan →" that returns to the plan slice it came from — the
loop closes where it opened. The casino modal is retired — "Swap Successful!", a
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

The pair is public knowledge, so it's shareable — receipts and
journeys never are (they're personal). The pair inspector carries one
quiet "Share this pair ↗" that links `/pair/{from}/{to}`: a page whose
meta and OG card are computed server-side from the two symbols alone —
headline, what-if, beam tilt all come from the curated corridor
dataset, and an unknown symbol or an unmeasurable corridor 404s or
renders the neutral brand card. The card takes no numeric params, so a
link can't carry a fabricated score. The old `/share/[id]` page did the
opposite — percentiles and ratings straight from query strings — and is
retired to a redirect; its OG endpoint now ignores params entirely.

The same inspector answers questions about the pair. "Ask Guardian
about this pair →" sits next to the share line (only where a corridor
or provenance exists) and sends exactly two things: the question and
the two symbols. No fact text travels from the client — the server
rebuilds the grounding itself in `formatPairFacts`, from the same
curated registry the screen renders (token provenance, corridor,
what-if), capped at 2,000 chars on line boundaries. The appended rules
forbid claims outside the record ("say it isn't in DiversiFi's curated
record rather than guessing"), forbid treating the figures as live FX,
and forbid predictions — watch items are mechanisms and cadences, and
the reverse direction is part of the same story. Walletless visitors
get the same affordance: asking is free of wallet state.

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

The corridor line also has a lens state — the **decision window** —
offered only while a fresh dated macro beat exists on the live pair (the
same ≤14-day, readable-echo rows `corridorSignalsFor` returns; never a
forward calendar). The status tier's prompt ("New on this pair ·
{dateLabel} — open the decision window →") takes the transition slot and
netting drops to the rail; opening it turns the line still — no
rotation, no what-if pin — and shows each fresh side's dated beat plus
the standing mechanism that produced it ("Decided at {watch.event} ·
{watch.cadence}"). Past event plus mechanism only, no forecast copy;
"← Story" collapses back to the line, and the state closes itself when
the pair changes or the signal expires.
