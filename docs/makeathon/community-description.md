# DiversiFi — Protection Plans

**Cultural design language for savings in volatile economies.**

If your currency lost half its value, your savings app probably didn't change.

DiversiFi is a savings-protection product for people in volatile economies
— users facing >10% local inflation who reach for dollarised stablecoins
not as a crypto bet but as a way to keep buying food next month.

Most fintech speaks one visual register: neutral, Western, terminal-coded.
For Config Makeathon 2026, we shipped a 7-card visual identity for the
app's Protection Plans, each plan a culturally-aligned investment
philosophy drawn in its own design language.

## The 7 archetypes

1. **Africapitalism** — keep wealth in African economies *(amber + ochre)*
2. **Buen Vivir** — balance material wealth with community and nature *(jade)*
3. **Confucian** — long-term stability; patience as a strategy *(vermilion)*
4. **Gotong Royong** — community-first; shared risk *(sunset orange)*
5. **Islamic Finance** — Sharia-compliant; ethical by design *(emerald)*
6. **Global Diversification** — geographic spread across all regions *(sky)*
7. **Custom** — set your own allocation; your plan, your proof *(violet)*

## How it's built

Each card is a TypeScript satori component that renders to a 1080×1080
PNG. The same JSX produces:

1. The card surface inside the live app at `diversifiapp.vercel.app`.
2. A share-ready PNG (also 1080×1080).
3. This Figma component library — built via the Figma MCP plugin API,
   each TS component mirrored as a Figma component on its own page.

Code Connect: a `code-connect.manifest.json` sidecar binds every TS
component to its Figma node ID, giving us round-trip parity between
code and design.

## What's in the file

- **POSTER · Contra thumbnail · Bright variant** — the feed-stopper
- **Cover · DiversiFi Protection Plans** — dark system spread
- **7 component pages** (one per archetype) — `ProtectionPlan / *`
- **Protect Tab · In Context** — 390×844 mobile mockup showing all 7
  cards inside the live app's Protect tab
- **DiversiFi · Tokens** — variable collection with archetype accent
  colors

## Design principles

- **Abstract geometry, never literal imagery.** Adinkra-adjacent
  concentric squares, chakana-adjacent stepped crosses, hexagram-
  adjacent bars, kawung-adjacent diamonds, Islamic-art-adjacent
  tessellated stars. Inspired by the tradition, never copying its
  symbols. The "what to avoid" list was as load-bearing as the
  per-archetype palette.
- **Calm UX register.** No charts, no candlesticks, no "to the moon"
  energy. This is a savings product, not a gambling product.
- **Verifiable-on-chain footer.** Every plan recommendation is anchored
  to 0G Storage and on-chain. The trust surface is the brand surface.
- **Distinct per-archetype background patterns.** Woven stripes,
  stepped terraces, brushmark columns, kawung diamonds, Alhambra-
  adjacent tessellations, longitude meridians, scattered dots. Each
  card carries cultural depth even before you read the hero motif.

## Why it matters

The novel-use angle isn't "we used Figma MCP." It's what we used MCP
*for*: closing the gap between how a product looks for the user in
Lagos and the user in San Francisco. One pipeline, two registers,
zero design debt.

## License

CC BY 4.0. Remix the system, build your own cultural design language,
keep the attribution.

Built for **Config Makeathon 2026** — Building with Purpose track.
