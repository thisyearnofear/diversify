# Adaptive Experience Architecture

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

- **`sme-fx-strategy.md`** — the north star this implements. This doc is *how* we surface the SME FX intelligence; the strategy doc is *why*.
- **`sme-fx-implementation-plan.md`** — phased build plan. Phase 0–5 build the backend; this doc shapes how the backend surfaces.
- **`product.md`** — current product definition. This doc updates the product definition to be adaptive, not monolithic.
- **`architecture.md`** — system architecture. This doc defines the adaptive routing layer on top of it.
- **`roadmap.md`** — grant tracks are the speculation phase; this doc defines the collaboration phase.
