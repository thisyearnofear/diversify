# Product

> **What ships today (2026-08-24):** A retail savings app that detects a visitor's local currency and shows its depreciation against USD, EUR, and gold using live FX rates. A landing-page FX drag calculator (Phase 0) — no signup, no wallet, no onboarding. Signal detection + adaptive tab labels (Phase 1) wired into the app shell. Users choose a values-based philosophy, then protect savings via stablecoin allocation, gold-backed tokens, and yield vaults on Celo/Arbitrum — with every Guardian decision recorded on-chain. The SME business FX layer (importer archetype, per-cycle drag reports, cycle-aware autonomous execution) is the north star described below — a concierge CLI tool validates the math, but the in-app experience is not yet shipped.

> **Adaptive experience (2026-08-24):** DiversiFi is shifting from one-size-fits-all to signal-based adaptive experience. The same backend serves all personas; the frontend is a configuration. See [`docs/product.md`](./product.md) for the full architecture — signals, routing, and landing page calculator.

## Core Story

DiversiFi is an **FX-risk intelligence and autonomous protection layer**
for businesses that earn in one currency and must purchase in another.

Two things make DiversiFi unique. Everything else is commodity:

1. **FX-risk intelligence layer** — the ability to quantify and
   autonomously flatten currency risk for a business that earns in one
   currency and must purchase in another. A Ghanaian importer buying from
   China in USD. A US retailer sourcing from the Eurozone. A UK business
   paying suppliers in USD. The currencies change; the problem is identical.
   The SME bleeds margin in the window between local sales and the next
   supplier payment. **No player in the market offers FX risk
   quantification + autonomous protection.**

2. **The philosophy/values system** — no other product in DeFi or fintech
   has this. It's not a feature; it's a structural moat that creates
   identity-based retention and cultural community. When a user chooses
   Africapitalism, Buen Vivir, or Islamic Finance, they are declaring a
   cultural identity, not just a risk tolerance. **This is the reason
   someone stays when the yield is identical elsewhere.**

The **retail savings app is top-of-funnel.** It proves the technology,
builds trust, and surfaces the risk moment to individual entrepreneurs and
diaspora professionals whose personal savings are also working capital. The
**business intelligence layer is the real product.** The **philosophy
system is the retention moat.**

The **DiversiFi Guardian** is the autonomous agent that executes this
protection. It monitors markets, detects inflation and FX shifts, and
protects capital by routing between **Celo/Mento** (local stablecoins,
low-cost savings), **Arbitrum** (deep liquidity, RWA yield), and **HashKey
Chain** (APAC regulated-market savings) — with on-chain proof of every
decision.

**What it is:** An FX-risk intelligence layer with a reference consumer
(the Guardian savings app) that demonstrates the full loop: risk
quantification → autonomous decision → on-chain settlement → verifiable
evidence.
**What it is not:** A payment rail, a trading terminal, a DeFi control panel,
or a yield farming dashboard.

## Current State vs. Vision (2026-07-12)

**Delivered today:**
- **Philosophy/values system** — live and deeply integrated. Strategy configs, AI prompts, asset filtering, compliance, and the Protection Scorecard all adapt to the user's chosen philosophy.
- **Retail FX-risk awareness** — the country/currency risk moment, the curated depreciation dataset, the Protection Scorecard, and the counterfactual calculator are live in the app.
- **Autonomous execution** — the Guardian loop auto-rebalances within user-signed permission bounds and records every decision on the chain-aware ledger + 0G evidence.
- **Best-yield engine** — vaults.fyi and GMX GM-pool deposits are integrated on Arbitrum.
- **Enterprise audit** — the `x-api-key` enterprise gateway and audit export are implemented for B2B licensing.

**North star / in progress:**
- **SME FX-risk intelligence layer** — the importer/trader archetype, purchase-cycle model, per-cycle FX drag report, and cycle-aware Guardian execution are designed and sequenced in `docs/strategy.md` but not yet shipped in the consumer app. The concierge FX drag report (`scripts/fx-drag-report.ts`) is already validating the math with real traders.
- **Retail → business graduation** — signal detection and a self-serve graduation CTA are planned; today the app only surfaces a small "How this can affect a business" hint in onboarding.

The retail app is the proof surface and top-of-funnel. The business intelligence layer is the real product we are building toward.

## Two layers, one product

| Layer | What it is | Who consumes it |
|---|---|---|
| **FX-risk intelligence layer (the real product)** | Quantifies per-purchase-cycle currency drag for SMEs and autonomously flattens it. Chain-aware settlement ledger, 0G evidence anchoring, open SDK, and enterprise gateway for rails players. | SME importers/traders; external agents and rails players that license the intelligence |
| **Reference consumer (Guardian app — top-of-funnel)** | The DiversiFi Guardian — a savings protection agent for volatile economies. Proves the intelligence layer end-to-end and funnels retail trust into the business tier. | End users in emerging markets who want protection without complexity; individual entrepreneurs who graduate to the importer archetype |

The FX-risk intelligence layer is the product. The Guardian app is the
proof surface and top-of-funnel. External agents and rails players are
consumers #2+. This is what makes DiversiFi infrastructure other teams
depend on, not a consumer app with infrastructure framing.

## Primary Persona (Guardian app)

A stablecoin saver who wants to protect purchasing power but does not want
to manually monitor macro data, risk signals, and yield opportunities.
They want one practical answer — hold, rebalance, or de-risk — with
attached proof, not a verbose AI explanation.

## North Star — The Importer & the Retail→Business Funnel (2026-07-11)

The long-term market opportunity is the **import/export SME in a
volatile-currency market** — crystallized by a real Ghanaian importer who
buys in USD abroad (China, US, UK), sells locally in cedis, and bleeds
margin invisibly in the window between local sales and the next supplier
payment. The rails for moving that money (Waza, Juicyway, Cedar Money,
Yellow Card…) are crowded and well-capitalized; **the FX risk
quantification + autonomous protection layer on top of them is unserved
— and it is exactly what DiversiFi has built.**

Retail and enterprise are not competing priorities; they are one funnel:

1. **Retail (trust)** — the individual entrepreneur tries the Guardian
   with personal savings, sees their currency risk quantified, builds
   trust in the autonomy and the on-chain proof.
2. **Business (revenue)** — the same person graduates their working
   capital: a cycle-aware Importer/Trader archetype with a per-cycle FX
   drag report. For this persona, personal savings *is* working capital —
   the funnel is one person at two levels of trust.
3. **Protocol (scale)** — rails players license the intelligence +
   Guardian via the enterprise gateway (Track 1d) as embedded "treasury
   autopilot."

Market evidence, competitive gap, archetype design, regulatory posture
(Ghana VASP Act 1154), and sequencing: [`strategy.md`](./strategy.md).

## How It Works (Guardian app)

1. **Connect** — Privy creates a Safe smart account (email, social login, or existing wallet)
2. **Pick a Protection Plan** — Sign an ERC-7715 spending permission (e.g., $50/day, 7 days)
3. **Deposit stablecoins** — The Guardian diversifies per plan across regions and asset types, choosing Celo/Mento for stable-savings and Arbitrum for liquidity/RWA yield
4. **Monitor** — Real-time receipts, allocations, P&L in a single dashboard
5. **Withdraw anytime** — Fees settled at withdrawal

## Protection Plans

| Plan | Philosophy | Focus |
|------|-----------|-------|
| **Africapitalism** | African prosperity | Keep wealth in African economies (cUSD, KESm, COPm) |
| **Buen Vivir** | Latin American balance | Balance material wealth with community |
| **Confucian** | East Asian prudence | Long-term stability, low volatility |
| **Gotong Royong** | Southeast Asian mutual aid | Community-first, shared risk |
| **Islamic Finance** | Sharia-compliant | No interest-bearing assets, ethical screening (excludes perp strategies) |
| **Global Diversification** | Maximum spread | Geographic diversification across all regions |
| **Custom** | User-defined | Set your own allocation targets |

## What Makes It Different

1. **FX-risk intelligence layer — the real product.** We quantify the currency drag on a business's working capital and autonomously protect it per purchase cycle. The retail savings app is the proof surface and top-of-funnel; the business intelligence layer is what scales.

2. **The philosophy/values system — a structural moat.** No other DeFi or fintech product builds cultural identity into the product. Africapitalism, Buen Vivir, Islamic Finance, Confucian, Gotong Royong — these are not risk-tolerance sliders; they are identity markers that drive retention and community. This is the reason someone stays when the yield is identical elsewhere.

3. **Chain-aware verifiability.** Every decision is recorded on a verified `RecommendationLedger` on the chain where the money moves — Celo for savings actions, Arbitrum for yield actions. The user sees the decision on the explorer where their money actually moved. Reasoning is anchored to 0G Storage as tamper-proof evidence.

4. **Autonomous Guardian.** A server-side cron loop monitors markets 24/7 via Firecrawl, synthesizes signals with multi-provider AI (Gemini → Venice → 0G Serving → Modal), and auto-executes rebalancing within user-signed permission bounds — no manual intervention needed.

5. **Chain-aware optimization.** Celo/Mento provide local stablecoin access with near-zero fees; Arbitrum provides deep liquidity and RWA yield; the **APAC rail** (HashKey Chain) provides regulated-market savings settlement for East/SE Asia (Confucian / Gotong Royong plans). The Guardian routes each action to the chain that best serves the user's goal. Each chain has a genuine, irreplaceable role — neither is a vanity deployment. See [`rails.md`](./rails.md).

6. **Regional inflation awareness.** Protection plans are culturally aligned (Africapitalism, Buen Vivir, etc.) and target specific emerging-market inflation profiles, not generic "crypto yields."

7. **Calm UX.** Designed as a savings protection app, not a trading terminal. The Guardian proposes one clear action at a time. **Simple mode** (default for new users) shows three tabs — Shield, Home, Learn — and hides the experience toggle, chain pill, Exchange tab, and Advisor FAB until the user opts into Standard mode.

8. **Guided first run.** Philosophy onboarding (`StrategyModal` → detect country → show risk → choose plan) is the primary first-run flow. A lightweight **3-step** `GuidedTour` (risk moment → Shield tab → connect wallet) only runs when philosophy onboarding was skipped. Region, goal, and philosophy persist in `ProtectionProfileProvider` / `use-protection-profile` (`diversifi-protection-profile-v2`); `useStrategy()` reads `config.philosophy` from the same provider.

9. **Tab discoverability.** First-visit users get an action-oriented hint above the tab bar. Tab visits are tracked via `useTabDiscovery` — the hint auto-dismisses after **2** tabs visited or the first swipe.

10. **Verifiable trust surface.** LiveProofCard shows recent Guardian receipts merged across mainnet ledgers (Celo, Arbitrum, HashKey when configured) on Protect and Overview before wallet connect — proof-first, not splash-first.

## Terminology Guide

| Internal Term | User-Facing Term |
|--------------|-----------------|
| Agent | Advisor / Guardian |
| Strategy | Protection Plan |
| Exchange | Protect |
| Agent Fuel | Protection Balance |
| Rebalance | Re-protect |
| Vault | Savings |

## Core Capabilities (What's Shipped)

| Area | Status |
|------|--------|
| **Intelligence gateway** | x402-gated Mento depeg + inflation + yield intelligence. HTTP 402 challenge → real USDC settlement → paid evidence with on-chain tx proof. Open to external agents. |
| **AI inference** | Multi-provider chain: Gemini Flash → Venice → Featherless → 0G Serving → Modal, with circuit breakers and 5-min caching |
| **Swap execution** | 12+ strategies: Mento (Celo), LiFi, 1inch, Uniswap V3, Hyperliquid perps, direct RWA, Arbitrum-native DEX, Curve Arc, Emerging Markets |
| **Guardian loop** | Cron-driven autonomous execution with user-signed permission enforcement (app-layer; ERC-7710 on-chain enforcement is deferred), confidence thresholds, and daily caps |
| **Chain-aware ledger** | `RecommendationLedger` records decisions on the chain where the action settles — Celo for savings, Arbitrum for yield. Each ledger entry references a 0G Storage evidence CID. |
| **0G verifiability** | Evidence layer: Storage (reasoning CIDs), Compute (TEE-verified inference), DA (state snapshots). 0G is not the ledger of record — it is the tamper-proof evidence layer that the ledgers reference. |
| **Live data** | 11+ sources feed the Guardian's macro awareness: World Bank, FRED, CoinGecko, DeFiLlama, SynthData, BrightData, TinyFish Search, Firecrawl |
| **Agent memory** | Cognee for cross-session persistent context |
| **Multi-chain** | Celo (EM savings ledger), Arbitrum (yield ledger), HashKey (APAC savings ledger, chain 177 — deploy pending HSK), 0G (evidence/anchoring), Arc (x402 nanopayment rail) |
| **Wallet** | Privy Safe smart accounts + social login + Farcaster/MiniPay compatibility |
| **Best-yield engine** | Arbitrum yield is a dynamic engine, not a fixed menu: vaults.fyi per-wallet best-deposit recommendations across 1,000+ risk-rated vaults (paid, engagement-gated), **GMX GM-pool deposits — LIVE** (`GmxGmDepositStrategy`, validated with a real deposit on Arbitrum One, blue-chip pools only, slippage-protected), free LI.FI Earn + DefiLlama base. Surfaced + depositable via `BestYieldCard`. See `docs/roadmap.md` § Yield Engine Strategy. |
| **Voice** | Advisor voice output (ElevenLabs TTS) + voice input (ElevenLabs Scribe STT) — runs on ElevenLabs alone, no OpenAI. Live in prod. |
| **Free web/news search** | TinyFish Search (web/news/research) feeds the Guardian region-specific context (FX news, central-bank moves) — free, replaces paid marketplace search. |
| **Cost discipline** | Paid insights (e.g. vaults.fyi) are engagement-gated (`insight-tier.ts`): Free → Saver (≥$100 or 7-day streak) → Committed. Default-deny; free data open to all. |

## Product Principles

1. **Enhancement first** — Improve existing flows before adding new ones
2. **Consolidation** — Merge duplicate surfaces, reduce cognitive load
3. **Prevent bloat** — Say no to features that don't serve the core story
4. **DRY, clean, modular** — Code quality enables product clarity
5. **Performant** — Fast loads, smooth interactions
6. **Delete, don't deprecate** — Remove unused code paths once the replacement is live

## What We Cut / Deferred

- Trading-terminal identity (no charts, no order books)
- Protocol-first messaging (user outcomes first)
- Voice/automation features (until core flow is polished)
- Separate research dashboards that duplicate advisor output

## Ideal Navigation

| Tab | Purpose |
|-----|---------|
| **Overview** | Portfolio summary, inflation impact, quick actions |
| **Protect** | Choose plan, view allocation, deposit — with compact Guardian status before connect |
| **Exchange** | Swap stablecoins across regions and chains |
| **Pilot** | AI Guardian recommendations, verifiable proof, backtesting, Guardian tier state |
| **Learn** | Inflation education, strategy guides, glossary |

**Simple mode** (beginner): Shield → Home → Learn only. Exchange and Advisor remain reachable via **More options** on Home. **Standard/Advanced** modes restore the full tab bar.

New users see Shield-first order. Swipe/tap discovery hint animates in above the tab bar on first visit — dismissed after 2 tabs visited or first swipe gesture.

## Fees

| Fee | Amount | When |
|-----|--------|------|
| Management | 1% annual | Pro-rated, settled at withdrawal |
| Performance | 10% above high-water mark | Only on gains above previous peak |
| Swap spread | 0.10% | Per swap |

## Target Users

People in emerging and APAC markets who:
- Experience high local inflation (>10% annually) or currency/regulatory uncertainty
- Want to protect savings, not speculate
- Need guidance without DeFi complexity
- Value cultural alignment with their financial philosophy (Africapitalism, Buen Vivir, Confucian, Gotong Royong, etc.)

**North-star persona (funnel target):** the individual entrepreneur /
importer / exporter whose "savings" are actually cyclical working capital
— local-currency proceeds exposed between purchase cycles. They enter as
retail savers and graduate their business. See [`strategy.md`](./strategy.md).

**Regional execution:** EM savers route through Celo (local Mento stables). Global yield legs route through Arbitrum. APAC savers on Confucian or Gotong Royong plans route savings decisions to **HashKey Chain** (when deployed); until mainnet go-live, an honest banner explains that protection still runs on global chains today. See [`rails.md`](./rails.md).

## APAC Rail (HashKey Chain — shipped, deploy pending)

DiversiFi detects Asia-region users and offers East/SE Asian protection philosophies. The **APAC rail** on **HashKey Chain mainnet (chain 177)** is the execution + trust home for those plans:

- **Job:** Regulated-market savings ledger for Japan, HK, Singapore, Philippines, and adjacent markets
- **Not:** A yield chain (Arbitrum), EM stablecoin chain (Celo), intelligence toll (Arc), or evidence layer (0G)
- **Enables:** Region → philosophy → chain alignment; SE Asia on-ramp → protect → optional Arbitrum yield → off-ramp lifecycle

Full rationale, routing rules, go-live runbook, and hackathon submission: [`rails.md`](./rails.md) § APAC Rail (go-live runbook and hackathon submission).

## Current Priorities

See `roadmap.md` for the 14-day improvement plan targeting 9/10 across Product Design, UI/UX, Cogency, Performance, and Architecture.


---

## Adaptive Experience Architecture

> **Status:** Phase 1 shipped (2026-08-24). Signal detection layer and adaptive tab labels are live. Landing page calculator is live at `/fx-drag-calculator`.
> **Purpose:** Define how DiversiFi surfaces different experiences to different visitors using the same backend — the landing page is a signal, not a product; the app is a configuration, not a destination.

## The Problem We're Solving

The product has too many personas in one shell: retail saver, diaspora professional, Ghanaian importer, APAC BPO, enterprise API consumer. The result is a 5-tab app that tries to be everything and speaks to nobody with enough specificity to feel alive.

The problem isn't too many features. It's too many faces.

## Adaptive Software — Two Schools, One Truth

There are two schools of thought called "adaptive software," and both apply here:

### Adaptive Software Development (ASD) — Jim Highsmith, 2000

A methodology for building in conditions of radical uncertainty. The cycle is: **speculate → collaborate → learn**. You cannot plan what you cannot predict, so you speculate in parallel, collaborate in real-time, and learn from what the system discovers.

DiversiFi's five grant tracks (0G Bridge, Celo Prezenti, Arbitrum Open House, HashKey Horizon, Future Caribbean) are the parallel speculation step. Each track is a hypothesis about which corridor wins. The winner gets the collaboration. The codebase learns from all of them.

### Adaptive Experience (AX) — UX evolution beyond UI/UX

Interfaces that don't present a static screen to everyone, but reshape themselves in real-time based on signals: location, past behavior, wallet state, purchase history, device, time of day. The progression:

- **UI** → responsive surface (what it looks like)
- **UX** → fluid journey (how it behaves)
- **CX** → cross-channel alignment (web, app, social, in-person)
- **AX** → the interface perceives, interprets, and anticipates

**Not Netflix recommendations.** The deeper version: the interface itself reshapes — different screens, different information architecture, different language — based on who's using it *right now*.

## The Core Thesis

> **The same backend serves all personas. The frontend is a configuration.**
>
> Signals determine which configuration loads. No forks. No new products. Just different surfaces surfacing based on who's visiting.

### What's Shipped

The signal layer is wired into the app. Every adaptive surface we designed reuses existing, production code:

| Signal | Backend Service | Status |
|---|---|---|
| Geo + currency risk | `useCurrencyRisk` + `currency-risk.ts` dataset | ✅ Live |
| FX drag calculation | `analyzeCycles()` in `@diversifi/shared` | ✅ Live |
| Mid-market rates | `buildServerlessRateProvider()` | ✅ Live |
| Purchase cycles | `PurchaseCycle` model + CRUD API | ✅ Live |
| Guardian execution | Guardian loop + cycle monitor | ✅ Live |
| Ledger anchoring | `RecommendationLedgerService` chain-aware | ✅ Live |
| Report rendering | `renderFxDragReportMarkdown()` | ✅ Live |
| Export (Markdown/CSV) | `fx-drag-report-renderer.ts` | ✅ Live |
| Signal detector | `use-signal-detector.ts` | ✅ Live (Phase 1) |
| Adaptive context | `AdaptiveContext` provider | ✅ Live (Phase 1) |
| Adaptive tab labels | `TabNavigation` reads `useAdaptiveContext()` | ✅ Live (Phase 1) |
| Landing page calculator | `/fx-drag-calculator` | ✅ Live (Phase 0) |

The backend is production-ready. The signal layer is wired into the app shell. Phase 2 (behavioral signal detection) builds on this foundation.

## The Signal Architecture

### Signals Detected Per Session

```
signals for visitor/session:
├── geo: { country: "GH", currency: "GHS", language: "en" }
├── behavioral: { pages: [...], dwell: {...}, scroll: {...} }
├── wallet: { connected: boolean, chains: [...], balance: {...} }
├── history: { previous_visits: N, has_cycles: boolean, goal: "..." }
├── device: { mobile: boolean, browser: {...} }
└── context: { referrer: "...", campaign: "...", timestamp: "..." }
```

### Where Signals Are Collected

| Layer | Signal | Source | Status |
|---|---|---|---|
| Geo | Country code, region, currency, flag | IP geolocation (`ipapi.co`), user-agent | ✅ Live |
| Wallet | Connected? chain? holdings? | `useAppShellContext()` + `useWalletContext()` | ✅ Live |
| History | Has cycles? Guardian auth? | `PurchaseCycle` API | 🧪 Phase 2 (stub in `useSignalDetector`) |
| Device | Mobile? detection method? | `navigator.userAgent` | ✅ Live |
| Currency risk | Depreciation rates, flag | `useCurrencyRisk` + `constants/currency-risk.ts` | ✅ Live |
| App (pre-auth) | Country override, experience mode | `useUserRegion` + `useCurrencyRisk` |
| App (post-auth) | Wallet connected, chains, balances | `useSharedMultichainBalances` |
| App (ongoing) | Behavior, cycles, Guardian state | `PurchaseCycle` model, `GuardianState` |

### Adaptive Routing (What Each Visitor Sees)

#### Visitor 1: Ghana, no wallet (first touch)

```
Landing: /fx-drag-calculator
Surface: 3-field FX drag calculator
Language: Plain Ghanaian business English ("your supplier needs $X,
          you sell GH₵Y, here's what it costs")
Default: Pre-filled with representative sample (GH₵720k cycle,
         $50k payment, rate 15.90)
Result:  Real drag calculation from live mid-market rates
CTA:    "Enter your actual cycle numbers" → or "Connect wallet to save"
```

#### Visitor 2: Ghana, connected wallet, no cycles

```
Home:   Currency risk screen ("Your GHS saved $X vs XAU over 3 years")
Shield: Protection scorecard (adapted for GHS holder)
Guardian: "Protecting your cedi savings" with standard yield engine
```

#### Visitor 3: Ghana, connected wallet, cyclical pattern detected

```
Home:   "Your next cycle" — active PurchaseCycle dashboard
Shield: "Cycle #3: protecting GH₵XXX as payment approaches"
Guardian: Cycle-aware with monitoring enabled, CYCLE_PROTECTION proposals
Drag report: "You saved GH₵XX,XXX this cycle vs last cycle"
```

#### Visitor 4: US, Ghanaian diaspora

```
Home:   "Your cedi savings aren't safe in GHS" → risk screen
Shield: Protection scorecard + Africapitalism prompt
Guardian: "Protecting your family's savings in Ghana"
Optional: "This is for your family's savings, not your USD account"
```

#### Visitor 5: US, generic saver

```
Same as existing retail experience — no business surfaces.
Protection scorecard, yield engine, Guardian for savings.
```

#### Visitor 6: Philippines (APAC)

```
Home:   "Your PHP savings are eroding" → risk screen
Shield: Confucian/Gotong Royong prompt
FX drag: PHP-specific drag report (already proven on HashKey mainnet)
Guardian: APAC routing → HashKey ledger
```

#### Visitor 7: APAC, BPO/trader pattern

```
Same as Visitor 3 (cycle-aware), but with APAC routing.
FX drag report computed from PHP rates.
Guardian monitors PHP→USD exposure.
```

### The Adaptive Surface Configuration Schema

```ts
interface AdaptiveSurfaceConfig {
  // What the visitor sees first
  landingPage: 'calculator' | 'risk-screen' | 'dashboard' | 'empty';

  // Tab configuration for the app shell
  tabs: {
    home:      { label: string; content: 'risk' | 'cycle' | 'savings' | 'empty' };
    shield:    { label: string; content: 'scorecard' | 'cycle-monitor' | 'yield' };
    exchange:  { label: string; disabled?: boolean };
    agent:     { label: string; content: 'basic' | 'guardian' | 'business' };
    info:      { label: string; disabled?: boolean };
  };

  // Whether to show business surfaces at all
  showBusiness: boolean;

  // Whether to show yield engine
  showYield: boolean;

  // Guardian mode
  guardianMode: 'savings' | 'cycle' | 'disabled';

  // Primary CTA after initial engagement
  primaryCTA: 'enter-cycles' | 'connect-wallet' | 'enable-guardian' | null;

  // Language and cultural framing
  language: 'en' | 'fr' | 'ar' | 'zh';
  culturalFrame: 'acapitalism' | 'buen-vivir' | 'confucian' | 'islamic' | 'generic';
}
```

## Implementation Phases

### Phase 0: Landing Page Calculator ✅ Shipped

The first adaptive surface. A public, shareable page that requires nothing: no signup, no wallet, no onboarding.

**File:** `apps/web/pages/fx-drag-calculator.tsx` (503 lines)

**What it does:**
- 3 inputs: earnings/cycle, USD payment, bank rate
- Pre-filled defaults from `GHANA_IMPORTER_SAMPLE`
- Calls `analyzeCycles()` with live mid-market rates
- Renders plain-language diagnosis: "Here's what your cedi is costing you"
- Shows decomposition: bank spread, timing, fees
- Honest warnings: "timing can be negative, protection isn't free money"
- CTA: "Save this cycle" → links to app (wallet connect) or "Share this report"

**What it doesn't do:**
- Doesn't require login or wallet
- Doesn't prescript ("move to USD")
- Doesn't show yield, Guardian, or philosophy screens
- Isn't a dashboard

**What it uses:**
- `analyzeCycles()` from `@diversifi/shared`
- `buildServerlessRateProvider()` from `@diversifi/shared`
- `renderFxDragReportMarkdown()` from `@diversifi/shared`
- Currency risk data from `apps/web/constants/currency-risk.ts`

**Design:**
- Clean, fast, < 500ms first paint
- No wallet SDK, no wagmi, no Framer Motion
- Mobile-first (most Ghanaian visitors will be on mobile)
- Shareable link with results encoded in URL params

**Validation:** 900 tests pass, 0 lint errors, 0 TS errors

### Phase 1: Signal-Based Routing ✅ Shipped

Signal detection layer wired into the app shell.

**Files:**
- `apps/web/hooks/use-signal-detector.ts` (347 lines) — collects signals, resolves AdaptivePersona → AdaptiveConfig
- `apps/web/context/app/AdaptiveContext.tsx` (48 lines) — context provider exposing config to the app tree
- `apps/web/components/app/ProviderTree.tsx` — added AdaptiveProvider into the provider chain
- `apps/web/components/ui/TabNavigation.tsx` — reads adaptive tab labels via `useAdaptiveContext()`
- `apps/web/components/app/TabContentRouter.tsx` — reads guardianMode from adaptive config (cycle-aware for importers, savings for savers)

**What it detects:**
- Geo: country code, region, currency, flag
- Wallet: connected? chain? holdings?
- History: has cycles? Guardian auth? (Phase 2 stubs)
- Device: mobile? detection method?

**What it adapts:**
- Tab labels (persona-specific overrides)
- Guardian mode (savings vs cycle-aware)
- Whether to show business surfaces (pending Phase 2 behavioral detection)

**Principle:** Enhancement first. If a user hasn't triggered a business signal, they see the retail surface. If they have, they see the business surface. No user is forced into a configuration they didn't earn.

**Validation:** 900 tests pass, 0 lint errors, 0 TS errors. `useAdaptiveContext` has a graceful fallback when context isn't mounted (fixes AppShell.test.tsx without test changes).

### Phase 2: Behavioral Signal Detection (Planned)

Automated detection of trader patterns.

**Signals:**
- Cyclical deposit/withdrawal patterns in vault history
- Larger balances that suggest working capital (not savings)
- Corridor-shaped swaps (GHS → USD, PHP → USD, not USD → USDC)
- Multiple cycles in a short period

**Where:** `apps/web/pages/api/agent/business/graduation-signals.ts`

**Storage:** `GuardianState.adaptiveSignals` or `FunnelEvent` model

**Surface:** `BusinessPromptCard` → "See what FX drag is costing your business"

### Phase 3: Multi-Corridor Learning (Planned)

The system learns from real cycle data across corridors.

**Data:** Every FX drag report computed becomes training data for:
- Timing patterns per corridor (GHS depreciation speed, PHP stability, etc.)
- Bank spread baselines per jurisdiction
- Optimal protection timing by cycle length

**Guardian improvement:** The same cycle-aware execution that protects the Ghanaian importer also protects the Philippine BPO — just with different currency pairs and timing windows.

**The moat:** After 100 importers use it, the mid-rate timing data, spread baselines, and protection timing become hard to replicate. That's the moat. Not multi-chain — the data.

## The Landing Page Design

### Visual Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   WHAT YOUR CEDI IS COSTING YOU                         │
│   A free FX drag report — no sign-up, no wallet.        │
│                                                         │
│   ┌───────────────────────────────────────────────────┐ │
│   │                                                   │ │
│   │   How much do you earn in a cycle?                │ │
│   │   GH₵ 720,000                                     │ │
│   │                                                   │ │
│   │   How much USD do you pay suppliers?              │ │
│   │   $ 50,000                                        │ │
│   │                                                   │ │
│   │   What's your bank rate?                          │ │
│   │   15.90                                           │ │
│   │                                                   │ │
│   │   [ Calculate My Drag → ]                         │ │
│   │                                                   │ │
│   └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### The Result Screen

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Your FX Drag — Q1–Q2 2025                             │
│                                                         │
│   Across 2 cycles, paying $98,000 to suppliers:         │
│                                                         │
│   # GH₵121,043                                          │
│                                                         │
│   This vanished to FX costs you never saw coming.       │
│                                                         │
│   ───────────────────────────────────────────────────── │
│   Your bank charged more than the real rate   GH₵284k   │
│   The cedi weakened while your money sat exposed  GH₵-172k*
│   Wire fees                                      GH₵9k   │
│   ───────────────────────────────────────────────────── │
│                                                         │
│   *Timing can be negative — the cedi sometimes          │
│    strengthens. Protection doesn't guarantee a win;     │
│    it measures the risk. Honesty matters.               │
│                                                         │
│   You'd have paid GH₵1,431,457 instead of GH₵1,552,500  │
│   That GH₵121,043 stays in your business.               │
│                                                         │
│   ┌────────────────────────────┐ ┌──────────────────┐  │
│   │ Download full report       │ │ Track this       │  │
│   │ (CSV / Markdown)           │ │ automatically    │  │
│   └────────────────────────────┘ └──────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### The Annual Context

```
Same calculation, 4 cycles per year = ~GH₵242,000/year

That's 40 months of rent. Or 4 years of average salary.
Or enough to expand your inventory by 15%.
```

## Principles

1. **Diagnosis before prescription.** Show them money they've *already lost*. The pain isn't hypothetical — it's a receipt from their own books.

2. **The landing page is a signal, not a product.** It's the first interaction with a system that adapts. If they engage, the app changes to serve them.

3. **Honesty is the product.** Show the negative-drag warning. Show the decomposition. Most products hide the cost. Showing it makes the rest credible.

4. **No friction for diagnosis.** Calculator requires nothing. Wallet connect and signup only appear *after* they see their numbers.

5. **Same backend, different face.** The calculator, the retail app, and the business dashboard all use the same `analyzeCycles` + Guardian + ledger. The frontend is configuration.

6. **The system learns from every interaction.** Every drag report computed, every cycle recorded, every Guardian action anchored — the data is the adaptation mechanism.

7. **Don't fork. Configure.** Add a new corridor (Ghana → Philippines → Nigeria → Brazil) by adding data and routing rules, not by building new pages.

## Relationship to Other Docs

- **`strategy.md`** — the north star this implements. This doc is *how* we surface the SME FX intelligence; the strategy doc is *why*.
- **`strategy.md`** — phased build plan. Phase 0–5 build the backend; this doc shapes how the backend surfaces.
- **`product.md`** — current product definition. This doc updates the product definition to be adaptive, not monolithic.
- **`architecture.md`** — system architecture. This doc defines the adaptive routing layer on top of it.
- **`roadmap.md`** — grant tracks are the speculation phase; this doc defines the collaboration phase.
