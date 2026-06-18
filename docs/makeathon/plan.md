# Path B — work breakdown

Six to eight focused hours, structured as four phases. Each phase
has a hard exit criterion. If a phase blows its budget, cut scope
within the phase, don't push it into the next phase's time.

## Phase 1 — TS satori card components (~2h)

Mirror the proven SportWarren pattern:
`~/Dev/sportwarren/src/components/moments/cards/`

Create `components/protection-cards/` (or wherever the existing
project conventions land — read `AGENTS.md` first):

- `tokens.ts` — color tokens (slate gradient surface +
  per-archetype accent colors per `protection-plans.md`),
  `alpha()` helper, `formatCardDate()` helper.
- `PitchTexture.tsx` equivalent — pick a *DiversiFi-native*
  background motif. Suggestion: faint world-map dot grid (regional
  identity) OR a vertical band gradient (chain-routing visual).
  Pick one and commit.
- `TrustMark.tsx` — the 12px "this is verifiable" footer mark.
  Equivalent of `FootballMark.tsx`. A small encircled checkmark or
  shield glyph, tinted per-archetype.
- `BaseCard.tsx` — shared 1080×1080 frame: gradient bg, kicker,
  hero, philosophy line, allocation row, footer with TrustMark.
- 7 cards: `AfricapitalismCard.tsx`, `BuenVivirCard.tsx`,
  `ConfucianCard.tsx`, `GotongRoyongCard.tsx`,
  `IslamicFinanceCard.tsx`, `GlobalDiversificationCard.tsx`,
  `CustomCard.tsx`.

**Exit criterion:** `scripts/render-protection-cards.ts` produces 7
PNGs in `docs/makeathon/assets/`. They look distinct from each
other. They look on-brand with the live app's slate palette.

## Phase 2 — Figma library build (~2h)

Workflow that worked on SportWarren:

1. Open the `figma-use` skill (Skill tool, name `figma-use`).
2. Create a new Figma file via `mcp__figma__create_new_file`.
   Name it `DiversiFi — Protection Plans`.
3. Build the cover frame (1920×1080) — same energy as SportWarren's
   cover. Title: "PROTECTION / PLANS". Sub-pills: "7 PHILOSOPHIES"
   / "EMERGING-MARKET FINANCE" / "VERIFIABLE AI".
4. Build the 7 Tier=Standard components on dedicated pages, one
   per archetype. Mirror the TS composition.
5. Take screenshots after each archetype to verify.

**Exit criterion:** Figma file with cover + 7 components, all
visually consistent, ready to publish to Community.

## Phase 3 — In-context screen mockup (~1h)

ONE mobile screen mockup (390×844) showing the Protect tab with the
7 cards in a horizontal scroll. This is the "design decisions
shown in product context" frame for the judges.

Use the existing live-app screenshots as ground truth — the goal is
to show what the cards look like *in the product*, not redesign the
product itself.

**Exit criterion:** One additional Figma page named "Protect Tab —
In Context" with the screen mockup + cards as instances.

## Phase 4 — Submission package (~1.5h)

1. **Publish Figma to Community.** File → Publish to community.
   Name: `DiversiFi — Protection Plans · Cultural design language
   for emerging-market finance`.
2. **Record screencast video (30s).**
   - Hook (5s): "Most fintech speaks one visual register. Emerging-
     market users deserve their own."
   - Workflow (15s): TS satori → Figma MCP → Code Connect bridge
   - Result (10s): the 7 cards + in-context screen
   Use Loom or QuickTime + screen recording.
3. **Social post.** X or LinkedIn. Tag `#ConfigMakeathon @figma`.
4. **Contra submission.** Fill the form with the GitHub link, live
   app link, Figma file link, video link.

**Exit criterion:** Submission posted on Contra before 23:00 PDT
(buffer the deadline by an hour).

## Cuts in priority order if time slips

1. **Cut to 5 cards** instead of 7. Drop Custom + Global
   Diversification (the least culturally-specific). Submit
   `Africapitalism · Buen Vivir · Confucian · Gotong Royong ·
   Islamic Finance` — the cultural angle is what's novel.
2. **Cut the in-context screen mockup.** The card family alone is
   enough if the cover frames it as a system.
3. **Cut Code Connect / app integration.** The Figma file + PNGs +
   video tells the story without code binding.

Do NOT cut: the cover, the 5 cultural cards, the video.
