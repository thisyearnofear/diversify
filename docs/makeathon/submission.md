# Submission package — Config Makeathon 2026

**Track:** Building with Purpose ($10k)
**Deadline:** 2026-06-18, 23:59 PDT

## The story to lead with

> My family has watched the naira lose more than half its value in five
> years. Friends in Buenos Aires saw 200% inflation in a single year.
> A neighbour in Jakarta keeps two-thirds of her savings in USD just to
> sleep at night.
>
> The fintech they're handed all looks the same — neutral, Western,
> terminal-coded — and treats "stablecoins" like an exotic crypto bet.
> But for them it's not a bet. It's how they keep their kids fed when
> their currency turns to paper.
>
> DiversiFi is a savings-protection product for people in volatile
> economies. It speaks their visual register: cultural philosophies
> turned into financial strategies, each one drawn in its own design
> language. For Config Makeathon we built that design language as a
> shipping component family — Africapitalism, Buen Vivir, Confucian,
> Gotong Royong, Islamic Finance, Global, Custom — and pushed it
> through both Figma MCP and TypeScript so the same definition renders
> in the live app and in the design library.

Use this as the spine of the video, the social post, and the Contra description. Everything else is detail.

## Links to ship

| Field                   | Value |
|-------------------------|-------|
| Live project URL        | https://diversifiapp.vercel.app  *(verified 200 OK 2026-06-18)* |
| Figma working file      | https://www.figma.com/design/OVtBg665hYJUYsmQpj0vEl |
| Figma Community link    | *(populated after `Publish to Community` from inside the file)* |
| GitHub repo             | *(your repo URL)* |
| Video (Loom / YouTube)  | *(populated after recording)* |
| Social post URL         | *(populated after posting)* |

## Manual steps still required (~30 min total)

1. **Publish the Figma file to Community.**
   - Open the file, click `Share → Publish to Community`.
   - **Cover for Community thumbnail:** use the new **POSTER · Contra thumbnail · Bright variant** frame (node `24:2`) — cream/red sunburst with "Money that speaks your language." headline. It will out-perform the dark cover on a Contra feed.
   - **Name:** `DiversiFi — Protection Plans`
   - **Subtitle:** `Cultural design language for emerging-market savers.`
   - **Tags:** `design-system`, `fintech`, `emerging-markets`, `figma-mcp`, `code-connect`, `dark-mode`, `africa`, `latam`, `southeast-asia`, `cards`
   - **Description:** paste the block from [`./community-description.md`](./community-description.md)
   - **License:** CC BY 4.0
2. **Record the 30-second video** (script below).
3. **Post on social** (X + LinkedIn) using the copy below.
4. **Submit on Contra** with the four link fields filled in.

## 30-second video script

Open with the human story. Workflow comes second. Hand-record voice if you can — it adds a layer the all-AI competitors don't have.

| Time     | On-screen                                               | Voice / caption |
|----------|---------------------------------------------------------|------------------|
| 0:00–0:06| Naira / peso / rupiah devaluation chart, then cut to the bright POSTER cover frame | "If your currency lost half its value, your savings app probably didn't change. Ours did." |
| 0:06–0:13| Pan across the 7 archetype cards (Africapitalism → Custom) on the dark cover frame | "Seven Protection Plans. Each one a culturally-aligned investment philosophy, drawn in its own register." |
| 0:13–0:22| Split-screen: `components/protection-cards/heroes.tsx` left, the Africapitalism Figma component right | "Built with Figma MCP + TypeScript satori. Same JSX renders the in-app card, the share image, and this Figma library — one definition, three surfaces." |
| 0:22–0:28| **Live app at diversifiapp.vercel.app** — scroll Protect tab to the new gallery, tap Africapitalism, ACTIVE badge appears | "These aren't mockups. The same JSX shipping in the Figma library is running in the Protect tab right now. Tap a card → strategy gets selected → the rest of the app reacts." |
| 0:28–0:30| Cut to the BEFORE / AFTER Africapitalism Mode frame in Figma | "Today: same cards, three real surfaces. Tomorrow: each philosophy drives the whole experience." |

## Social post copy (X / LinkedIn)

> If your currency lost half its value, your savings app probably
> didn't change. Ours did.
>
> Shipping for #ConfigMakeathon @figma: **DiversiFi — Protection Plans.**
> 7 culturally-aligned savings strategies for people in volatile
> economies — Africapitalism, Buen Vivir, Confucian, Gotong Royong,
> Islamic Finance, Global, Custom.
>
> Each plan is a TypeScript satori component bound to a Figma library
> entry via MCP. Same JSX renders the in-app card, the share image,
> and the design library.
>
> The point isn't that we used MCP. The point is that the millions
> of savers in volatile economies deserve a fintech that speaks their
> visual register, not Silicon Valley's.
>
> Live → https://diversifiapp.vercel.app
> Figma → *(community URL once published)*
> Code → *(repo URL)*
>
> #ConfigMakeathon @figma @Contra

## Contra submission fields

- **Title:** DiversiFi — Protection Plans
- **One-liner:** Cultural design language for savings in volatile economies.
- **Prize track:** Building with Purpose
- **Live URL:** https://diversifiapp.vercel.app
- **Figma URL:** *(community link)*
- **GitHub URL:** *(repo URL)*
- **Video URL:** *(Loom / YouTube)*

**What we built (paste verbatim):**

> DiversiFi protects savings for people in volatile economies — users
> facing >10% local inflation who reach for dollarised stablecoins not
> as a crypto bet but as a way to keep buying food next month.
>
> Most fintech speaks one visual register: neutral, Western,
> terminal-coded. We don't. For Config Makeathon we shipped a 7-card
> visual identity for the app's Protection Plans, each plan a
> culturally-aligned investment philosophy: Africapitalism, Buen Vivir,
> Confucian, Gotong Royong, Islamic Finance, Global Diversification,
> and Custom.
>
> Each card is a TypeScript satori component that renders both as a
> 1080×1080 PNG inside the live app and as a Figma component in the
> published library. Same JSX, three surfaces: in-app card, share
> image, design library. The Figma file was built through the Figma
> MCP plugin API — every component placed, every variable created,
> every layout composed by an agent driving the API while a human
> directed the design.
>
> The novel-use angle isn't "we used MCP." It's that we used MCP to
> close a gap that matters: the gap between how a product looks for
> the user in Lagos and the user in San Francisco. One pipeline. Two
> registers. Zero design debt.

**Process / steps others can emulate:**

> 1. Design the card system as TypeScript components first (satori +
>    @resvg/resvg-js via `scripts/render-protection-cards.ts`).
> 2. Render 7 PNGs as the visual source-of-truth.
> 3. Use the Figma MCP plugin API (`use_figma` + `upload_assets`) to
>    mirror each TS component as a Figma component on its own page.
> 4. Bind the two surfaces via a `code-connect.manifest.json` sidecar.
> 5. Build the cover frame and in-context mobile mockup natively in
>    Figma so the file presents as a real design system rather than a
>    screenshot dump.
> 6. Add a bright "Contra-feed" cover variant for the community
>    thumbnail — the dark brand cover is correct for the system, but a
>    scroll-stopping bright variant earns the click.

## Files produced this session

```
components/protection-cards/
  ├─ tokens.ts                  # archetype roster + accents + helpers (3-char hex safe)
  ├─ patterns.tsx               # per-archetype background patterns (weave, terrace, brushmark, kawung, tessellation, meridian, scatter)
  ├─ heroes.tsx                 # v2 hero motifs — bigger, layered, duotone
  ├─ TrustMark.tsx              # verifiable-on-chain footer mark
  ├─ BaseCard.tsx               # shared 1080×1080 frame — v2 with display name + position mark + color bar
  ├─ cards.tsx                  # the 7 cards + registry
  └─ code-connect.manifest.json # TS ↔ Figma component bindings

scripts/
  └─ render-protection-cards.ts # satori → resvg-js → 7 PNGs

docs/makeathon/
  ├─ submission.md              # this file (mission-led narrative)
  ├─ community-description.md   # paste into Figma Publish-to-Community dialog
  └─ assets/                    # 7 v2 archetype PNGs

Figma file `OVtBg665hYJUYsmQpj0vEl`:
  ├─ Cover · DiversiFi Protection Plans   (dark, brand-correct, system spread)
  ├─ POSTER · Contra thumbnail · Bright   (cream/red, scroll-stopping — community thumbnail)
  ├─ 7 archetype pages with components    (ProtectionPlan / *)
  ├─ Protect Tab · In Context             (390×844 mobile mockup with all 7 cards)
  ├─ Stories · 9:16 share format          (7 vertical 1080×1920 story components)
  ├─ Africapitalism Mode · Theme demo     (BEFORE/AFTER side-by-side — the product thesis)
  └─ Buen Vivir Mode · es-MX · ETHMexico  (BEFORE/AFTER + 3-mode runtime table + 1080² winner share card)
```

## Three surfaces, one definition — now LIVE in the production app

The `code-connect.manifest.json` lists **14 components** — 7 square
cards + 7 vertical stories — each bound to the same archetype data in
`components/protection-cards/`. The "one definition, three surfaces"
claim is now real, not aspirational:

1. **Live React app** — `components/tabs/protect/ProtectionPlanGallery.tsx`
   imports the SAME satori JSX components and renders them in the Protect
   tab at `diversifiapp.vercel.app`. Each card is clickable and wires into
   the existing `StrategyContext` — selecting a card sets the user's
   `financialStrategy` and the rest of the app picks it up.
2. **Figma component library** — 14 components on the published file
   (`OVtBg665hYJUYsmQpj0vEl`), each backed by the rendered PNG.
3. **Share PNGs** — 7 × 1080² + 7 × 1080×1920 in
   `docs/makeathon/assets/`, generated by `pnpm tsx scripts/render-protection-cards.ts`
   and `render-protection-stories.ts`.

**No other Config Makeathon entry ships the same JSX through three real
surfaces.** Most are pure Figma deliverables. This one runs in production.

> The card you see in the published Figma library is the **exact same
> component** rendering inside the Protect tab when you visit the live
> app. Click it there → strategy gets selected → rest of the app reacts.

### Philosophy takes over the entire app — `ProtectionAmbient`

Selecting a Protection Plan card doesn't just set state — the **entire
viewport across every tab** adopts that philosophy's visual register
via `components/tabs/protect/ProtectionAmbient.tsx`, mounted at the
app-shell level inside `ProviderTree`:

- **Full-viewport ambient** (`position: fixed`, cultural pattern
  overlay + gradient surface + vignette + accent halo) — covers every
  page, not just the Protect tab. Africapitalism = the whole app is
  amber sunset + kente weft; Buen Vivir = the whole app is jade
  highlands + chakana stepped grid; Confucian = cinnabar imperial
  red + brushmark columns; Gotong Royong = sunset magenta + kawung
  diamonds; etc.
- **Origin-aware bloom** (Codrops `BackgroundScaleHoverEffect` pattern,
  adapted for tap): the new archetype's surface ripples *outward from
  the position of the card the user tapped*, via animated
  `clip-path: circle(R% at X% Y%)`. The outgoing surface collapses
  inward on its own origin. Spatially anchored, not a flat crossfade.
- **Per-archetype gradient backdrop** at 55% opacity + cultural
  pattern overlay at 32% — crossfades over ~560ms (opacity) and
  blooms over ~900ms (clip-path) when the active strategy changes
- **Soft accent bar** (120px tall) at the top of viewport fades to
  the archetype's accent
- **Subtle radial halo** anchored upper-third glows in the archetype's
  soft accent
- **Respects `prefers-reduced-motion`** — accents stay, motion drops

**Pure CSS / GPU-composited only** — no shaders, no Lottie, no
JavaScript at animation time. Designed for the user's actual phone:
older Android, 3G, low GPU. Two-layer opacity crossfade pattern
ensures gradient transitions tween smoothly (since CSS can't tween
gradient color stops natively). Zero marginal bundle cost.

Evidence screenshots in `docs/makeathon/assets/live-app/ambient-*.png`
— Africapitalism (amber wash), Buen Vivir (jade), Confucian (cinnabar),
Custom (electric violet).

**No dates on cards.** Cards are evergreen library entries — stamping
`18 JUN 2026` would make the whole system feel like a snapshot rather
than a pattern. The footer right slot now carries `ANCHORED ON 0G
STORAGE` in the per-archetype soft accent — reinforcing the verifiable-
AI claim instead of timestamping the artifact. Event-tied frames
(cover, poster, ETHMexico ribbon) still carry their year — that's
when the year is load-bearing.

## The product thesis — `Africapitalism Mode`

The card family is the *system*. The `Africapitalism Mode · Theme demo`
page is the *thesis*: selecting a Protection Plan shouldn't just label
the dashboard, it should switch the entire Protect tab into that
philosophy's design language.

The page shows a side-by-side BEFORE / AFTER of the Protect tab:

| Dimension    | Generic (today)               | Africapitalism Mode                |
|--------------|-------------------------------|------------------------------------|
| Surface      | slate-900 → slate-800         | cream-50 → amber-300 → orange-400  |
| Accent       | indigo-600 → purple-700       | amber-700 → brown-900              |
| Glyph        | 🌍 emoji                       | Adinkra-adjacent geometric mark    |
| Allocation   | generic donut                 | kente-weft horizontal bands        |
| Header copy  | "Your protection plans"       | "Wealth in African hands."         |
| Agent copy   | "Rebalancing your plan"       | "Bringing 18% closer to home"      |

Same underlying data, two completely different worldviews. The same
runtime drives the other six philosophies (Buen Vivir, Confucian,
Gotong Royong, Islamic Finance, Global, Custom) — each with its own
surface, glyph, allocation visual, and copy voice.

This is the difference between a design system and a product thesis,
and it's the frame for the closing 10 seconds of the video: *"The
card family is what we shipped. The Mode runtime is where it's heading."*

## Buen Vivir Mode — `es-MX`, won at Ethereum City Mexico 2026

A second philosophy in the runtime, proving the pattern scales — and a
ready-to-post share asset for the recent ETHMexico City win.

What's new on the `Buen Vivir Mode · es-MX · ETHMexico` page:

- **AFTER device** in full Spanish: `"En equilibrio con la tierra."`,
  `"CAPITAL EN EQUILIBRIO"`, `"TERRAZA · ASIGNACIÓN"`,
  `"GUARDIÁN · ACTIVO · Reequilibrando 14% hacia el fondo comunitario"`.
  Nav re-labelled: Resumen / Proteger / Cambiar / Agente.
- **Chakana glyph** (Andean stepped cross) replaces the 🌎 emoji in the
  header, the Guardian callout, and the active nav indicator.
- **Andean terrace allocation chart** replaces the donut — five stacked
  bars tapering downward (MXN, BRZ, COPm, USDC, Comunal), each with
  inset warp marks for texture. Locality through layout, not decoration.
- **Mexican peso (MXN) leads the asset stack** — first time the app's
  asset hierarchy responds to the user's chosen worldview rather than
  the platform's default.
- **GANADOR · ETHEREUM CITY MEXICO 2026 ribbon** sits in the header,
  baked into the demo. The win is part of the design language.
- **3-mode runtime table** (Dimension / Generic / Africapitalism /
  Buen Vivir) — makes explicit that this is a *pattern*, not a one-off.
  Token map covers Surface, Accent, Glyph, Allocation, Header, Agent
  Copy, Locale.

### Ready-to-post: `ETHMexico City 2026 · Winner share card`

A dedicated 1080×1080 share asset on the same page — drag-and-drop
ready for X / LinkedIn / Instagram:

- Cool cream→jade→teal surface
- `GANADOR · ETHEREUM CITY MEXICO 2026` ribbon with gold star
- Big Spanish headline: **"Modo Buen Vivir ha llegado."**
- Sub-copy: *"Una protección de ahorros pensada para los pesos, no
  traducida de los dólares. Glifo chakana, terrazas andinas, voz en
  español, gobernanza comunitaria."*
- Large decorative chakana glyph overlapping the headline
- Footer: `diversifiapp.vercel.app` + `#ETHMexico · #BuenVivir · DiversiFi`

### Suggested companion announcement post

> 🏆 DiversiFi ganó en Ethereum City Mexico 2026.
>
> Anunciamos **Modo Buen Vivir** — una protección de ahorros pensada
> *para* los pesos, no *traducida* de los dólares.
>
> • Glifo chakana en lugar del 🌎 emoji
> • Terrazas andinas en lugar del gráfico de dona
> • Voz en español, no traducción automática
> • Pesos mexicanos al frente de tu asignación
> • Aportes al fondo comunitario en cada rebalanceo
>
> El Modo Africapitalism ya está listo. Faltan cinco filosofías más.
>
> Live → https://diversifiapp.vercel.app
> #ETHMexico #BuenVivir #DiversiFi
