# Reusable patterns from the SportWarren makeathon

The same Claude Code session shipped 10 archetype cards for
SportWarren (~/Dev/sportwarren) over the past 2 days using the
exact workflow this submission needs. These are the reusable bits.

## Files worth reading or cribbing

### Token + shared helper patterns

- `~/Dev/sportwarren/src/components/moments/cards/tokens.ts` —
  color tokens, `alpha()` helper, `formatCardDate()`,
  `SURFACE_GRADIENT` constant. **Copy the structure, swap the
  values for DiversiFi's per-archetype accents from
  `protection-plans.md`.**
- `~/Dev/sportwarren/src/components/moments/cards/PitchTexture.tsx`
  — shared background motif rendered with explicit
  `cardWidth`/`cardHeight` props (satori 0.26 doesn't honor
  percentage positioning evenly). **Mirror this pattern for the
  DiversiFi-native motif.**
- `~/Dev/sportwarren/src/components/moments/cards/FootballMark.tsx`
  — small CSS-drawn footer mark with per-archetype accent.
  **Mirror this for TrustMark.**

### Per-card composition reference

- `~/Dev/sportwarren/src/components/moments/cards/RecordBrokenCard.tsx`
  — type-as-imagery, oversized accent-colored hero text. Good
  reference for Confucian (calligraphic-feel, restrained type).
- `~/Dev/sportwarren/src/components/moments/cards/AchievementCard.tsx`
  — centered crest, civic register, geometric motif. Good
  reference for Islamic Finance (geometric pattern + centered
  composition).
- `~/Dev/sportwarren/src/components/moments/cards/TwinCreatedCard.tsx`
  — name-as-hero, identity-forward, dotted constellation. Good
  reference for Global Diversification (world-map dot grid).
- `~/Dev/sportwarren/src/components/moments/cards/SeasonEndCard.tsx`
  — poster format with metallic divider, stats stack. Good
  reference for Africapitalism (poster-like cultural identity).

### Renderer

- `~/Dev/sportwarren/src/server/services/personalization/moment-render-v2.ts`
  — satori + @resvg/resvg-js pipeline. Font loaded from Google
  Fonts CSS API with IE User-Agent forcing WOFF (avoids the
  v18 hardcoded URL trap).
- `~/Dev/sportwarren/scripts/render-before-after.tsx` — script that
  renders all archetype PNGs for the makeathon. **Mirror this for
  `scripts/render-protection-cards.ts`.**

### Figma build via MCP

- `~/Dev/sportwarren/docs/makeathon/build-log.md` — chronological
  record of the 15 build sessions. Search for "use_figma" to find
  the working patterns for component creation, ComponentSet
  variants, auto-layout pitfalls.
- Specific gotchas already paid for:
  - `figma.currentPage = ...` does NOT work in plugin API. Use
    `await figma.setCurrentPageAsync(page)`.
  - When inserting overlay nodes into a VERTICAL auto-layout
    variant, set `layoutPositioning = 'ABSOLUTE'` or the new node
    gets absorbed into the flow and pushes other children down.
  - `Space Grotesk` has no `SemiBold` style — only Bold, Light,
    Medium, Regular. Loading SemiBold throws.
  - Passing `alpha(token, 0.55)` into a helper component that
    re-applies `alpha()` produces invalid 10-char hex like
    `#ffffff8cd9`. Pass raw tokens + opacity props.
  - `<polygon>` and `<line>` inline SVG works in satori 0.26.
    Border-trick triangles (`borderTop` + `borderLeft: transparent`)
    do not.

### Code Connect manifest (Pro-tier substitute)

- `~/Dev/sportwarren/src/components/moments/cards/code-connect.manifest.json`
  — the file that records `<TS component, Figma node ID>` mappings
  when first-party Code Connect isn't available. **Mirror this for
  DiversiFi if time permits in Phase 4.**

## Cover frames worth referencing

Both ship in SportWarren:
- Moment Cards cover: `~/Dev/sportwarren` Figma file
  `xTaynEAGCjhhmcmQdPG0JZ`, cover node `9:2` (after the rebuild).
- Marketing Toolkit cover: file `XgOGYay09gxABzEUPtJFdN`, cover at
  node `18:2`.

Both follow the same anatomy that should reproduce well for
DiversiFi:
- Identity dot + SPORTWARREN wordmark top-left
- Kicker line ("DESIGN SYSTEM · CONFIG MAKEATHON 2026")
- Oversized 2-line title (200px)
- 3 system-property pills (colored per archetype)
- Tagline
- Component-name list footer
- Right-side editorial spread of real component instances tilted
  into a stack

The TS scripts that built them are documented in
`~/Dev/sportwarren/docs/makeathon/build-log.md` sessions 13–15.

## What NOT to copy

- **Football grammar elements** (pitch texture, ball mark, corner
  flag). Those are SportWarren's brand. DiversiFi needs its own
  primitives — see `protection-plans.md` for the proposed visual
  vocabulary.
- **The 5-tier variant system** (Standard / Premium / Streak /
  Partner / Internal). Not relevant to Protection Plans.
- **The detailed code-connect.manifest.json schema.** Only the
  pattern of "JSON sidecar for component bindings" is reusable.
