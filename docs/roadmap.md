# Roadmap

Three tracks run in parallel, each serving a different grant program but
sharing one architecture: the **0G Bridge buildathon** (0G as evidence
layer), the **Celo Prezenti grant** (Celo as savings + identity layer),
and the **Arbitrum Open House** (Arbitrum as yield + execution layer).
The **product quality plan** brings DiversiFi from 7.0 → 9.0 across
Product Design, UI/UX, Cogency, Performance, and System Architecture.

---

## Track 1 — 0G Bridge by AKINDO Buildathon (Active, 2026-06)

The 0G Bridge by AKINDO buildathon (10 weeks, 5 waves, up to $50K in
0G credits, Demo Day at Token2049 Singapore Oct 7-8 2026) is the
current submission target. 0G is the evidence/anchoring layer — Storage
(reasoning CIDs), Compute (TEE proofs), DA (state snapshots). The
chain-aware `RecommendationLedger` settles on the chain where the money
moves (Celo for savings, Arbitrum for yield); 0G mainnet hosts an
evidence anchor deployment for cross-chain verification.

The authoritative file-by-file, wave-by-wave implementation plan
lives in the [0G Bridge Plan section](#0g-bridge-plan-buildathon-implementation)
below. The headline principle: **enhance the existing 0G-aware modules**
(already-present in `recommendation-ledger.service.ts`,
`settlement-service.ts`, `storage-service.ts`, `persistence-service.ts`,
`zero-g-provider.ts`, `ZeroGAnchoringDecorator`) rather than create
parallel `0g-bridge/*` surfaces. The full plan, the principle-alignment
table, the pre-Wave-1 audit, and the Wave 1-5 file deltas are in that
section.

**Wave 1 deadline:** June 26, 2026 23:59 UTC. Submission is this week;
the file deltas in the 0G Bridge Plan §4 (Wave 1) plus the §3 audit
fixes are the entire Wave 1 scope.

**Why 0G is the evidence layer, not the ledger of record:** The
chain-aware thesis means the ledger follows the money. A Mento
rebalance on Celo gets recorded on Celo. A PAXG yield deposit on
Arbitrum gets recorded on Arbitrum. Both ledger entries reference a
0G Storage evidence CID. This serves three grant tracks simultaneously:
Celo reviewers check Celoscan, Arbitrum reviewers check Arbiscan, 0G
reviewers check 0G Explorer. 0G's unique value (Storage, Compute, DA)
is preserved without forcing it to be a settlement layer it isn't
designed for.

---

## Track 1b — Celo Prezenti Grant (Next round, 2026)

The Celo Prezenti Frontier Round rejected the initial application with
actionable feedback. The gaps and the fixes:

| Gap from reviewer feedback | Fix | Status |
|---|---|---|
| "Consumer app with infrastructure framing" | Reframe as intelligence protocol; ship external-agent SDK + integration guide | **Docs reframed** (product.md, README.md, architecture.md). Integration guide in `docs/integrations.md` § External Agent Integration Guide |
| "No evidence of external agents consuming the gateway" | One working external-agent example that pays x402 and consumes Mento intelligence | **Done.** External agent example verified against live gateway — receives HTTP 402 payment challenge with amount, recipient, nonce, chain ID (`examples/external-agent/consume-intelligence.js`) |
| "Verifiable stack sits off Celo / on testnet" | Deploy `RecommendationLedger` on Celo mainnet; move Self Agent ID to mainnet | **Done.** Ledger deployed (0x3BCf…369C on Celo mainnet, first rec seeded). Self Protocol mainnet verified with real passport |
| "Celo mainnet footprint is essentially a fresh ERC-8004 registration" | Add verified ledger + real Guardian tx history on Celo mainnet | **Done.** Ledger deployed + source verified on Celoscan. Guardian heartbeat cron records advisory recommendations every 2 hours (tx `0x536daf48…` and counting) |
| "No milestones, grant amount, or team section" | Write `docs/grant-proposal.md` with named team, milestones, amount, sustainability | Planned |

The Celo grant and the 0G buildathon share the same codebase and
architecture. Celo mainnet gets the savings ledger of record; 0G
mainnet gets the evidence anchor. No code fork needed.

---

## Track 1c — Arbitrum Open House London (July 10-12, 2026)

Accepted to the Arbitrum Open House — a 3-day in-person builder event
with $300K in prizes, including a separately-evaluated **AI & Agentic
Track**. The Guardian's autonomous yield execution on Arbitrum is the
exact thesis this track funds.

**Arbitrum-specific value prop:** DiversiFi's Guardian is an autonomous
AI agent that executes verifiable yield strategies on Arbitrum — routing
stablecoin savings into RWA-backed yield (PAXG, USDY, SYRUPUSDC) with
on-chain proof of every decision. The `RecommendationLedger` on
Arbitrum makes every agent action auditable, and 0G anchoring makes the
reasoning tamper-proof. Arbitrum's EIP-7702 capability is the path to
true on-chain ERC-7710 permission enforcement for yield actions.

**What to ship during the 3 days:**
1. ~~Promote the Arbitrum ledger from Sepolia to mainnet~~ **Done** — `0x3BCf…369C` on Arbitrum mainnet, first rec seeded (tx `0x2a034aad…`)
2. ~~Wire chain-aware routing in `recommendation-ledger.service.ts`~~ **Done** — `getLedgerChainForAction()` routes yield tokens to Arbitrum mainnet automatically
3. ~~External agent example executing a yield action on Arbitrum mainnet~~ **Done** — `examples/external-agent/consume-intelligence.js` verified against live gateway (HTTP 402 payment challenge received)

**Prep priority (before July 10):** ~~Deploy + verify RecommendationLedger on Arbitrum mainnet~~ **Deployed + source verified on Arbiscan.** ~~Run the external agent example end-to-end against the live gateway~~ **Done.** Guardian heartbeat cron now records on all 3 chains every 30 min.

---

## Track 1d — Enterprise Tier (B2B licensing, 2026)

The verifiable-intelligence gateway is licensable as a B2B product, not just
a retail feature. Two additive capabilities were added (the public x402 flow
is unchanged):

- **API-key auth** (`pages/api/agent/x402-gateway.ts` +
  `packages/shared/src/services/enterprise-auth.service.ts`): licensed
  consumers authenticate with an `x-api-key` header instead of per-request
  x402 USDC settlement. Keys are configured via `ENTERPRISE_API_KEYS` (JSON
  array of `{ key, tenantId, tier, rateLimit, quotaUsd, audit }`). Enterprise
  requests skip the 402 challenge and Arc on-chain settlement but are still
  attributed to the tenant for audit.
- **Audit export** (`pages/api/agent/enterprise/audit.ts` +
  `lib/audit-index.ts`): `GET /api/agent/enterprise/audit` returns a tenant's
  verifiable recommendation history (chain-aware `RecommendationLedger`
  entries + 0G evidence bundles) as JSON or CSV. A wallet-scoped variant reads
  the ledger directly for any address. Off-chain tenant attribution lives in
  `models/TenantRecommendation.ts` (Mongo) — the on-chain ledger records
  `user` as a wallet, never a tenant.

**Status:** implemented; `pnpm build` + `pnpm test` green. **Remaining
hardening (pre-mainnet):** ~~Redis/Mongo-backed rate-limit/credit store~~
**Done** — pluggable `ClientStateStore` (in-memory default, MongoDB via
`CLIENT_STATE_STORE=mongo`, fire-and-forget persistence). ~~0G-anchoring the
gateway's premium responses~~ **Done** — paid gateway intelligence is now
anchored to 0G with CIDs surfaced in `_billing.evidenceCids` and the enterprise
audit record. ~~mainnet ledger/env flip~~ **Staged / Arbitrum-ready** — the x402
settlement code is fully env-gated via `SETTLEMENT_NETWORK` (rail) +
`SETTLEMENT_ENV` (testnet/mainnet), and the 402 challenge, payment verification,
and metrics explorer all follow the active rail dynamically. The moment a
verified mainnet USDC contract is available, the flip is a config-only change.
**Blocker resolved for Arbitrum:** The settlement code now supports an
`ARBITRUM` rail (`SETTLEMENT_NETWORK=ARBITRUM`) with a verified, live,
Circle-issued USDC contract on chainId 42161. For the Arbitrum Open House demo,
set `SETTLEMENT_ENV=mainnet`, fund the agent wallet with Arbitrum USDC, and x402
payments settle on Arbitrum mainnet. Arc mainnet remains unavailable, and 0G
mainnet still lacks a verified USDC contract, so those rails stay on testnet.
The chain-aware `RecommendationLedger` (Celo/Arbitrum/0G mainnet at
`0x3BCf…369C`) and 0G evidence anchoring are already live and provide the
mainnet proof surface for demos.

---

## Track 1e — Qwen Cloud Hackathon (Track 1: MemoryAgent, July 2026)

The Qwen Cloud Global AI Hackathon Track 1 (MemoryAgent) requires building an
agent with persistent memory that autonomously accumulates experience, remembers
user preferences, and makes increasingly accurate decisions across multi-turn,
cross-session interactions. Projects must use Qwen Cloud API and be deployed on
Alibaba Cloud infrastructure.

**Implementation (shipped 2026-07-19):**

- **DashScope (Alibaba Cloud Bailian) provider** (`packages/shared/src/services/ai/providers/dashscope-provider.ts`):
  Direct Qwen Cloud integration via the OpenAI-compatible DashScope endpoint.
  Registered as a first-class provider but excluded from the default chat
  fallback chain — only reachable via `preferredProvider: 'dashscope'` for
  memory consolidation. Inert when `DASHSCOPE_API_KEY` is unset.

- **Automatic forgetting** (decay + sweep in `cognee-memory-service.ts`):
  Memories older than TTL (30 days) have their recall score penalized
  proportional to age (soft forgetting). At 2×TTL, `sweepStaleMemories`
  evicts them (hard forgetting). This keeps the recall set focused on what's
  current.

- **Memory consolidation service** (`memory-consolidation-service.ts`):
  Compresses raw interaction memories into 3-7 distilled profile statements
  using Qwen's long-context models. The profile is stored as a high-priority
  memory and the absorbed raw memories are evicted. Three-tier backend
  selection: (1) Alibaba Cloud FC delegation, (2) Tablestore local, (3) Cognee.

- **Tablestore Agent Memory adapter** (`tablestore-memory-service.ts`):
  Alibaba Cloud Tablestore-native memory store using the Memory Storage HTTP
  API (`searchMemories`, `addMemories`, `deleteMemory`). Provides vector
  search, automatic long-term memory extraction, and short-term/long-term
  separation. Inert when `TABLESTORE_ENDPOINT` is unset.

- **Function Compute deployment** (`alibaba-cloud/fc-memory-consolidation/`):
  Alibaba Cloud deployment proof — a Node.js 18 FC handler that uses
  Function Compute + Tablestore + DashScope. Deployable via Serverless Devs
  (`s deploy`). The Guardian cron delegates consolidation to this endpoint
  when `ALIBABA_CLOUD_FC_ENDPOINT` is set.

- **Measurement harness** (`scripts/memory-eval.ts`):
  Memory-on vs memory-off evaluation showing +38% improvement with Qwen
  memory consolidation.

- **Demo video**: 90-second promotional video showcasing the MemoryAgent.

**Architecture diagram**: `docs/architecture-diagram.png`
**Deployment proof**: `docs/alibaba-cloud-deployment.md`
**880 tests passing.**

---

## Track 2 — Product Quality Plan

Bring DiversiFi from 7.0 → 9.0 across Product Design, UI/UX,
Cogency, Performance, and System Architecture. Based on a
comprehensive review that identified structural gaps (prop drilling,
monolithic shared package, no accessibility, unconditional heavy
component hydration, suppressed type errors).

All tasks are ordered by risk-adjusted impact. Things that require
architectural upheaval with uncertain ROI (package split, Turbopack
migration, API versioning, CSS design tokens) are explicitly deferred.

### Task 1 — Remove `ignoreBuildErrors` + Fix Types (Days 1-2)

**Why:** Masks real bugs. `typescript: { ignoreBuildErrors: true }` in `next.config.js` means every PR could ship type errors. A 9/10 system cannot suppress type checking.

**File:** `next.config.js`

```diff
- typescript: { ignoreBuildErrors: true },
```

**Then:** `npx tsc --noEmit` and fix every error. Unknown cascades from `any`-typed escape hatches in the shared package may surface. Budget a full day for cleanup.

**Add to build script:**
```json
"build": "npx tsc --noEmit && next build"
```

**Verification:** `pnpm build` fails on type errors. CI gates on this.

### Task 2 — Create `useAppShell()` Hook (Day 3)

**Why:** `pages/index.tsx` passes 27 props through `<AppShell>`. This couples every tab component to the page orchestrator and makes independent testing impossible. Single largest code smell in the app.

**Create:** `hooks/use-app-shell.ts` — aggregates navigation, wallet, advisor, region, inflation, currency performance, protection profile, streak rewards, multichain balances, and tutorial state from their respective contexts/hooks.

**Modify:** `components/app/AppShell.tsx` — remove all props from the interface, call `useAppShell()` internally.

**Modify:** `pages/index.tsx` — replace 27-line prop spread with `<AppShell />`. Keep the onboarding gate logic and confetti effects at the page level (they belong there).

**Verification:** Every tab renders identically. Wallet connect, region switch, advisor FAB, voice intent — all unchanged.

### Task 3 — Split AppShell Into 3 Files (Days 3-4)

**Why:** `AppShell.tsx` is 326 lines doing tab routing, animation orchestration, pull-to-refresh, floating controls, tour triggers, wallet tutorial, voice, and tab content. Each concern should be its own file.

| New file | ~Lines | Responsibility |
|---|---|---|
| `components/app/TabContentRouter.tsx` | 60 | Maps `activeTab` → component. Owns `AnimatePresence` + `TabPane` transitions. |
| `components/app/FloatingControls.tsx` | 50 | Advisor FAB (with unread badge), GuardianStreakWidget (dynamic), GuidedTour (dynamic), TourTrigger (dynamic). |
| `components/app/AppShell.tsx` | 100 | Layout: AppHeader + TabNavigation + `<TabContentRouter>` + PullToRefresh + `<FloatingControls>` + WalletTutorial. |

**Verification:** Tab switching, pull-to-refresh, advisor FAB, streak widget, tour — all identical behavior.

### Task 4 — Lazy-Load AIChat + Heavy Agent Components (Day 5)

**Why:** `AIChat` mounts unconditionally in `_app.tsx`. Users who never open the chat still download its JS. Same for `VerifiableAIDashboard`, `BacktestPanel`, `IntelligenceHistory`, `ResearchReceipt` in the Agent tab.

**Files:**

| File | Change |
|---|---|
| `pages/_app.tsx` | Wrap `<AIChat>` in `dynamic(() => import('@/components/agent/AIChat'), { ssr: false })` |
| `components/tabs/AgentTab.tsx` | Wrap heavy sub-components in `dynamic()` imports with skeleton loaders |
| `components/app/FloatingControls.tsx` | GuardianStreakWidget, GuidedTour, TourTrigger already dynamic — verify |

**Verification:** Lighthouse TTI before/after. Expected: 15-20% improvement on 3G throttling.

### Task 5 — Bundle Analysis → Fix Top Offenders (Days 5-6)

**Why:** Wagmi + Viem + Privy + Framer Motion + LiFi SDK + Google AI + OpenAI all ship in the main bundle. No visibility into what costs the user load time.

**Add bundle analyzer:**
```bash
pnpm add -D @next/bundle-analyzer
```

**Modify** `next.config.js`:
```js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer(nextConfig);
```

**Expected offenders and fixes:**

| Offender | Fix |
|---|---|
| `@lifi/sdk` (~200KB+) | Verify it's only imported in `ExchangeTab` (already `dynamic()`) — confirm it's not leaking via shared package barrel export |
| `wagmi` + `viem` chain configs | Enable `lazy: true` in Wagmi client config. Load chain configs only for connected chains. |
| `framer-motion` | Verify named imports tree-shake correctly. Switch from default to named if needed. |

**Hard budget:** First Load JS < 300KB gzipped. Enforce in CI.

**Verification:** `ANALYZE=true pnpm build` — treemap confirms no single chunk > 100KB after gzip.

### Task 6 — Accessibility Pass (Day 7)

**Why:** One `aria-label` in 33K+ lines. This is a legal risk and a usability blocker. A 9/10 app must be screen-reader navigable.

| Component | Changes |
|---|---|
| `components/ui/TabNavigation.tsx` | `role="tablist"`, `role="tab"`, `aria-selected`, keyboard navigation (ArrowLeft/Right), focus management |
| `components/onboarding/StrategyModal.tsx` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape to close |
| `components/agent/AIChat.tsx` | `aria-label` on input, `role="log"` on message list for live-region announcements |
| All interactive elements | `<div onClick>` → `<button>` with `type`. Icon-only buttons get `aria-label`. |

**Verification:** Lighthouse Accessibility score ≥ 90. `axe-core` in CI.

### Task 7 — Guardian Progressive Disclosure Wizard (Days 8-9)

**Why:** The Guardian requires understanding 4 nested concepts simultaneously (what it is, ERC-7715 permissions, autonomous vs. manual actions, x402 funding). Currently these are dumped on the user all at once. This is the single highest-leverage UX change in the plan.

**Create:** `components/agent/GuardianOnboardingWizard.tsx`

4-step card sequence, one at a time:

| Step | Content | Max words |
|---|---|---|
| 1 | "Meet your Guardian" — illustration + "Your Guardian monitors markets 24/7 and suggests moves to protect your savings from inflation." | 40 |
| 2 | "What it can do automatically" — "It can rebalance your stablecoins across stronger economies when inflation shifts. You approve once, it handles the rest." | 40 |
| 3 | "What you control" — "You set a daily limit and choose which tokens it can use. You can pause or stop it anytime." | 40 |
| 4 | "Ready?" — "Enable Protection" button. Shows daily limit, token list, 7-day expiry. One tap. | 30 |

**Modify:** `components/tabs/AgentTab.tsx` — if user has no active Guardian permission, show wizard as primary card instead of full dashboard.

**Modify:** `hooks/use-agent-config.ts` — add `needsGuardianOnboarding: boolean` to return value.

**Verification:** User test with 3 non-crypto people. Pass = they can explain what the Guardian does after the wizard.

### Task 8 — Error + Empty States for All Tabs (Days 10-11)

**Why:** Blank screens on error or first visit destroy user confidence. Every data-dependent surface needs a graceful degraded state.

**Create:**
- `components/ui/ErrorState.tsx` — illustration, message, retry button
- `components/ui/EmptyState.tsx` — illustration, description, one clear action button

**Wire into every tab:**

| Tab | Empty state | Error state |
|---|---|---|
| Overview | "Connect your wallet to see your portfolio" (verify existing `NotConnectedState` works) | "Couldn't load portfolio. [Retry]" |
| Protection | "You haven't set up a protection plan yet. [Create one]" | "Couldn't load protection data. [Retry]" |
| Exchange | N/A (swap form always visible) | Wrap in ErrorBoundary |
| Agent | "Your Guardian hasn't analyzed your portfolio yet. [Run first analysis]" — superseded by wizard if applicable | "Analysis failed. [Retry]" |
| Info | "No data available for your region yet." | "Couldn't load data. [Retry]" |

**Verification:** Disconnect wallet → each tab shows empty state. Break an API endpoint → each tab shows error state with working retry.

### Task 9 — Dead Code Sweep (Day 12)

**Files to delete:**
- `packages/shared/src/services/wallet-service.ts.bak` — backup file in source tree

**Run dead code detection:**
```bash
npx knip   # Detect unused exports, files, dependencies
```

Remove everything flagged. Verify `pnpm build && pnpm test && pnpm lint` after removal.

### Days 13-14 — Spillover Buffer + Final Audit

Reserve 2 days for:
- Task overruns from any of the 9 tasks above
- Final integration testing across all tabs and wallet flows
- Verification checklist:
  ```bash
  pnpm build          # Clean build
  pnpm test           # All tests pass
  pnpm lint           # Zero warnings
  npx tsc --noEmit    # Zero errors
  ```
- Lighthouse scores: Performance ≥ 80, Accessibility ≥ 90
- Manual walkthrough: onboarding → wallet connect → tab navigation → swap → Guardian activation

---

## Post-9/10 — Full-stack fintech infrastructure

DiversiFi's current product is savings protection (hold → protect → monitor). A natural
expansion is completing the financial lifecycle: onramp → protect + grow → offramp.
The following providers map to DiversiFi's chains (Celo, Arbitrum) and target markets
(Africa, LatAm, SE Asia).

| Layer | Target | Priority providers | Why |
|---|---|---|---|
| **Onramp** (fiat → stablecoins) | Kenya, Nigeria, Ghana | **Fonbnk** (Celo-native, M-Pesa), **Kotani Pay** (Celo-native), **Yellow Card** (Africa) | Without onramp, users need existing crypto — biggest UX gap. Fonbnk + Kotani are Celo-native. |
| **Onramp** (LatAm) | Mexico, Brazil, Colombia | **Bitso**, **TransFi**, **dLocal** | Maps to Buen Vivir / Global Diversification plans. Bitso is the largest LatAm exchange. |
| **Onramp** (SE Asia) | Philippines, Singapore | **StraitsX**, **Coins.ph** | Maps to Gotong Royong plan. |
| **Earn / Yield** (protocol) | Global | **Ethena** (sUSDe), **Ondo Finance** (USDY — already a swap target), **Aave** (Arbitrum), **Fluid** (Arbitrum), **Morpho** (Base) | Turns idle protection into active growth. The Guardian already has permission infrastructure — it needs a yield strategy. |
| **Earn / Yield** (managed) | Global | **Yield.xyz**, **Veda Labs** | Alternative to self-directed DeFi yield if a managed vault suits the UX better. |
| **Offramp** (stablecoins → fiat) | Africa, LatAm, SE Asia | **Kotani Pay** (Celo-native), **MoneyGram** (via Stellar), **Yellow Card** (via Polygon USDC) | Users need to exit to local currency. Kotani does mobile-money cash-out on Celo. |
| **Card** | Global | **Rain**, **Wirex**, **Bridge** | Post-revenue milestone. Requires card-issuing partner + compliance infrastructure. |

No commitment to integrate any specific provider. Listed here so the integration surface
area is visible and decisions are intentional rather than reactive.

### APAC rail — Asia execution home

The onramp table above names SE Asia providers (**StraitsX**, **Coins.ph**) but does not
define where those stablecoins **settle and get protected** after on-ramp. The **APAC rail**
(HashKey Chain, chain 177 — code shipped 2026-07-10, deploy pending HSK gas) is that landing
zone: regulated-market savings and structured settlement for **Confucian** and
**Gotong Royong** plans, while Arbitrum remains the yield optimizer.

| Concern | Owner |
|---------|--------|
| Fiat on-ramp (PH, SG) | StraitsX, Coins.ph → stablecoin on APAC rail |
| Savings / hold actions | APAC rail + `RecommendationLedger` |
| Yield rotation (USDY, etc.) | Arbitrum (unchanged) |
| Intelligence API tolls | Arc / x402 (unchanged) |
| Reasoning evidence | 0G (unchanged) |

Full rationale, routing diagram, build/skip criteria, go-live runbook, and hackathon submission:
[`apac-rail.md`](./apac-rail.md) · [`hackathon-hashkey-buidl.md`](./hackathon-hashkey-buidl.md).

---

## Track 3 — Product Reframe: Risk-Aware, Values-Driven Treasury (2026-07-09)

The product was reframed from "AI intelligence marketplace" to "risk-aware,
values-driven treasury management." The insight: nobody wakes up wanting
premium macro research; they wake up wanting to know their savings won't
evaporate because of an election, a rate decision, or a currency crisis.
The Kenyan business example crystallized this: a business saving in KES vs
USD around an election would have maintained significantly more purchasing
power, but the headaches of doing it meant they just kept everything in KES.

**Core principle:** The risk data is neutral. The response is philosophy-driven.
DiversiFi shows users their currency risk, then lets them choose a
culturally-aligned protection philosophy — never prescribing "move to USD."

### What shipped

| Change | Files | Principle |
|---|---|---|
| Curated multi-benchmark depreciation dataset (20 currencies vs USD/EUR/gold, 1yr/3yr/5yr, risk events) | `constants/currency-risk.ts` (new) | DRY, MODULAR |
| Consolidated non-prescriptive currency risk hook | `hooks/use-currency-risk.ts` (new) | DRY, CLEAN |
| Surface ISO2 country code from IP geolocation | `hooks/use-user-region.ts` (enhanced) | ENHANCEMENT FIRST |
| 3-phase onboarding: detect country → show risk → choose philosophy | `components/onboarding/screens/WelcomeScreen.tsx` (enhanced) | ENHANCEMENT FIRST |
| Philosophy-aware counterfactual calculator with archetype gallery | `components/tabs/overview/NotConnectedState.tsx` (enhanced) | ENHANCEMENT FIRST |
| Philosophy-aware protection scorecard (adapts to chosen archetype) | `components/tabs/overview/ProtectionScorecard.tsx` (new) | ENHANCEMENT FIRST |
| Add scorecard section to home page decision logic | `hooks/use-home-sections.ts` (enhanced) | ENHANCEMENT FIRST |
| Reorder tabs to lead with Shield, relabel Protect → Shield | `constants/tabs.ts`, `TabNavigation.tsx`, `TabContentRouter.tsx`, `NavigationContext.tsx` | CONSOLIDATION |
| Neutral "understand, choose, act" copy across key screens | `pages/index.tsx`, `use-cold-start.ts`, `ConnectedOverview.tsx` | CLEAN |

### Why the cultural archetype system is the differentiator

The app has 8 cultural protection philosophies (Africapitalism, Buen Vivir,
Pan-Caribbean, Confucian, Gotong Royong, Islamic Finance, Global
Diversification, Custom) with deep strategy configs, AI prompts, visual
ambient effects, and scoring weights. The reframe connects the currency risk
data to this existing archetype system: the user's specific currency risk
becomes the *reason* to engage with the archetype system, and the archetype
system becomes the *values-driven response* to that risk. This makes DiversiFi
impossible to replicate with a generic stablecoin app.

### What was deliberately NOT done
- No new live FX API (curated dataset for the "aha"; existing Frankfurter for live monitoring)
- No prescriptive USD framing anywhere
- No filtering of archetypes (show all, let user self-select)
- No new tabs (reordered existing 5)

### Post-launch fix: counterfactual math + benchmark currency risk (2026-07-09)

Two fixes shipped after initial deploy:

1. **Counterfactual math bug**: `calculatePreservedValue` was returning `unhedgedAmount * depreciationRate` (what the 80% still lost), but the UI said "you would have preserved $X." Fixed to `shieldAmount * depreciationRate` (what the shielded 20% avoided losing). The counterfactual now uses gold (XAU) as the universal hedge benchmark instead of summing across all three.

2. **Benchmark currency risk**: The initial implementation treated USD/EUR/GBP as "safe" benchmarks with no risk, skipping the risk phase entirely for US/EU visitors. This was a Western-centric normative judgment that contradicts the app's ethos. Added benchmark currency entries (USD, EUR, GBP) to the dataset with their vsXAU depreciation (gold gained against all of them), inflation, and political risk events (US debt ceiling, UK mini-budget crisis, EU energy crisis). Every visitor now gets the "aha" risk moment, including US/EU judges and diaspora communities. Risk is contextual: for a Kenyan business it's KES depreciation; for a US investor it's gold outperformance and political instability; for an African diaspora member in New York it's both.

### Why "risk is universal" is the right framing

The assumption that "USD = safe, everything else = risky" is itself a normative judgment. A US investor worried about political instability, a Muslim in London seeking Sharia-compliant holdings, or a Kenyan-American whose family's savings are in KES — all of them have risk, and all of them can find a philosophy that matches their values. Gold (XAU) works as the universal benchmark because it has outperformed every currency, including USD. The philosophy system then provides the values-driven response: HALO for hard-asset hedgers, Africapitalism for diaspora wealth retention, Islamic Finance for Sharia compliance, TACO for political neutrality.

### UX consolidation waves (2026-07-10)

Critical UI/UX audit against the emerging/APAC saver persona. **Waves 0–9 shipped**.

| Wave | Focus | Status |
|------|-------|--------|
| **0 — Stop bleeding** | Skip tour when philosophy set; beginner tab IA (Shield/Home/Learn); plain wallet CTAs; remove confetti | **Done** |
| **1 — Guardian surfaces** | Delete `GuardianOnboardingWizard`; `GuardianStatusChip`; compact scrollytelling (2 states) | **Done** |
| **2 — DRY + plain copy** | `strategyToArchetype()` single source; beginner tips without chain jargon; compact `LiveProofCard` | **Done** |
| **3 — Calm + honest** | Hide header chrome in Simple mode; 3-step tour; APAC honesty banner; fold `philosophy` into protection profile | **Done** |
| **4 — Calm polish** | Testnet banner gated; ClaimCelebration coin motif; ProtectionTab confetti removed; AgentTab beginner compact view | **Done** |
| **5 — Provider + proof polish** | `ProtectionProfileProvider` replaces `StrategyProvider`; LiveProof mainnet-aware copy; voice hidden in Simple mode | **Done** |
| **6 — DRY + pacing** | `PhilosophyHeroCard` shared hero; WelcomeScreen manual detect→risk advance | **Done** |
| **7 — Plan preview** | `getPlanPreview()` + `PlanPreviewCard` on onboarding phase 3; `PhilosophyPromptCard` DRY; shared `STRATEGY_ALLOCATIONS` | **Done** |
| **8 — Honest price feeds** | Shared `fetchWithTimeout`; EM price failover hardened (per-provider timeouts, expired-cache-before-fabrication, no fake `+0.0%`); staleness from data timestamps + "Includes estimates" marker; EM prices API on `unifiedCache` (`realtime`); dead freshness/price hooks deleted | **Done** |
| **9 — Chat UX overhaul** | Real SSE streaming end-to-end (Gemini `generateContentStream` + Venice `stream: true` + `chatStream()` fallback); fake thinking/source labels deleted; intent fast-path restricted to commands only (no canned marketing copy); pricing de-emphasized + failed receipts removed; mobile sheet (`dvh` + `visualViewport` + scroll lock + drag-to-dismiss + smart auto-scroll); chat analytics (`chat_send`/`chat_done`/`chat_error`); history capped (20 sent / 100 stored); dead `AIAssistant.tsx` deleted; 7 pre-existing ledger test failures fixed (env isolation) | **Done** |

**650 tests passing** after Wave 9. Key files: `hooks/use-agent-chat.ts`, `components/agent/AIChat.tsx`, `components/agent/TrustFlow.tsx`, `components/agent/ResearchCheck.tsx`, `pages/api/agent/advisor.ts`, `pages/api/agent/_advisor-core.ts`, `packages/shared/src/services/ai/ai-service.ts`, `packages/shared/src/services/ai/providers/gemini-provider.ts`, `packages/shared/src/services/ai/providers/venice-provider.ts`, `context/AIConversationContext.tsx`, `models/FunnelEvent.ts`.

---

## Track 4 — North Star: SME FX Working Capital & the Retail→Business Funnel (2026-07-11)

A real user conversation — a Ghanaian importer buying in USD (China, US,
UK) and selling in cedis — surfaced the persona the Track 3 reframe was
always pointing at, one step further: **the trader whose "savings" are
cyclical working capital**, exposed to cedi slippage in the 2–8 week
window between local sales and the next supplier payment. Their three
pains (volatility, cognitive burden, inability to quantify) map directly
onto shipped surfaces (currency-risk dataset, autonomous Guardian,
verifiable ledger). **The problem is universal** — any business with a
currency mismatch between revenue and costs faces the same risk (UK
exporters, US retailers sourcing from EUR, Brazilian traders, Philippine
BPOs). Ghana is the wedge; the market is global. See
[`sme-fx-strategy.md`](./sme-fx-strategy.md) for the full universal framing.

**Current state (2026-07-13):** Guardian product consolidation (single identity, non-modal proactive updates, shared recommendation contract) shipped alongside the first SME FX vertical slice and a trust pass:

- **Money purpose** in onboarding (`everyday_buffer` / `long_term_savings` / `upcoming_payment`) — separate from philosophy
- **In-app payment-cycle report** on Shield/Home (`PaymentCycleReport`, `POST /api/agent/fx-cycle-report`) — current-rate + historical stress, USD-only, not a fabricated future quote
- **Mongo `PurchaseCycle` model** + wallet-signed `GET/POST /api/agent/business/cycles` (`lib/wallet-auth.ts`); `payment_due` until user confirms outcome with achieved amount/rate/fees
- **Cycle-aware proposals** via client proactive agent + inline `runCycleMonitor()` in guardian-loop cron
- **Bounded `recommendationQueue`** on GuardianState so cycle/yield/macro writers cannot overwrite each other
- **Review ≠ execute** — Review opens the swap quote path; Open review renders the structured Guardian contract
- **Markdown/CSV export** via shared `fx-drag-report-renderer.ts`
- **Fail-closed `CYCLE_PROTECTION` auto-execution** (2026-07-14) — Celo-only, verified Mento funding rail (KES/COP/PHP/BRL → cUSD), per-cycle atomic idempotency, second-stage opt-in consent (`Permission.autoExecuteCycleProtection`); unsupported currencies stay advisory-only

Still planned: Importer `FinancialStrategy` archetype, graduation funnel (Phase 4).

The concierge FX drag report (`scripts/fx-drag-report.ts`) still validates math with real trader data; it now delegates rendering to shared. Full phased plan:
in [`docs/sme-fx-implementation-plan.md`](./sme-fx-implementation-plan.md).

**Market:** China–Africa trade $348B (2025, +20% YoY); SSA stablecoin
volume $50B in Q1 2026 (+340% YoY, large B2B share); ~$5B/yr lost to
currency conversion (AfCFTA). The rails war (Waza, Juicyway, Cedar Money,
Verto, Yellow Card, Visa pilots) is crowded — **nobody offers the FX risk
quantification / automated protection layer.** That layer is DiversiFi's
lane: not another rail, the driver on top of the rails.

**Funnel model (retail and enterprise serve one vision):**

| Stage | Role | Surface |
|---|---|---|
| Retail | Trust — entrepreneur tries Guardian with personal savings, sees risk quantified | Existing Guardian app |
| Business | Revenue — same person graduates working capital | Importer/Trader archetype (cycle-aware) + per-cycle FX drag report |
| Protocol | Scale — rails players embed the intelligence | Track 1d enterprise gateway ("treasury autopilot") |

**Sequencing (gated):** See `docs/sme-fx-implementation-plan.md` for the full phased plan. Summary: 1) concierge validation *(shipped)*; 2) Importer archetype as `FinancialStrategy` *(planned)*; 3) self-serve per-cycle FX drag report in the app *(shipped 2026-07-13)*; 4) cycle-aware Guardian proposals + fail-closed auto-execution as payment dates approach *(shipped 2026-07-14 — monitoring opt-in + cron tick + Celo-only verified-rail execution with consent + idempotency)*; 5) GHS ramp via partner; 6) rails design partner; 7) split only when demand forces it.

**Regulatory note:** Ghana's VASP Act 1154 (signed 2025-12-29, BoG
licensing from Q1 2026) + BoG anti-dollarization posture make the
non-prescriptive philosophy framing regulatory protection, not just brand
ethos. Position as intelligence/software; licensed partners hold custody
and conversion.

Full strategy, market data with sources, competitive table, archetype
design, honesty guardrails, and risks: [`sme-fx-strategy.md`](./sme-fx-strategy.md).

---

## Deferred (Correct but Wrong Timing)

| Task | Why deferred |
|---|---|
| **Package split** (`@diversifi/shared` → `shared-ai`, `shared-swap`, `shared-guardian`, `shared-data`, `shared-core`) | 33K-line monolith will surface circular dependency nightmares. Revisit when the package hits 50K+ lines or a second team starts contributing. |
| **API versioning** (`/api/v1/` prefix) | Zero external consumers. All API routes are internal Next.js routes consumed by the same app. Add versioning when the first SDK or mobile app is built. |
| **Turbopack migration** (remove `--webpack` flag) | Mixing bundler changes with component refactors makes debugging untraceable. Do this as a standalone task after this plan is complete and the codebase is stable. |
| **Design tokens** (CSS custom properties) | Refactoring Tailwind classes across 50+ components into custom properties is low ROI for a solo dev. Revisit when a second designer joins or a white-label deployment is needed. |
| **Test coverage expansion** | Existing tests cover swap strategies, rewards, and core services. Add integration tests for the Guardian loop and onboarding in the next cycle. |

---

## Dependency Order

```
Task 1 (types) ─────────────────────────────────────────────────────┐
                                                                     │
Task 2 (useAppShell) ──→ Task 3 (split AppShell) ───────────────────┤
                                                                     │
Task 4 (lazy AIChat) ──→ Task 5 (bundle analysis) ──────────────────┤
                                                                     │
Task 6 (accessibility) ─────────────────────────────────────────────┤
                                                                     │
Task 7 (Guardian wizard) ──→ Task 8 (error/empty states) ───────────┤
                                                                     │
Task 9 (dead code) ─────────────────────────────────────────────────┤
                                                                     │
Days 13-14 (buffer + audit) ← depends on all above ─────────────────┘
```

Tasks 6 and 7 can run in parallel with 2-5. Tasks 1-3 form the critical path (architecture cleanup enables everything else).

---

## Yield Engine Strategy (Arbitrum)

*Date: 2026-07-11 · Status: strategy (decide before building)*

### Where the Arbitrum leg is today

Arbitrum is DiversiFi's "yield + execution" home, but the yield menu is **thin
and hardcoded**: USDY, PAXG, SYRUPUSDC, plus Hyperliquid perps. The Guardian
"rotates into our few RWA tokens" rather than finding the best risk-adjusted
yield across the Arbitrum DeFi universe. That's the gap.

### The reframe: from a fixed menu to a best-yield engine

Turn the Arbitrum leg into a **dynamic best-yield engine** — the Guardian finds
the best risk-adjusted yield for each user's holdings across the whole Arbitrum
DeFi universe, executes across venues, and offers premium insured options. The
providers map cleanly onto that:

| Provider | Role in the story | Free? | Priority |
|---|---|---|---|
| **vaults.fyi** ★ | **Yield intelligence** — 1,000+ curated, risk-rated vaults + per-wallet best-deposit recommendations + idle-asset detection | Paid ($0.002–$0.30/call); raw APY partly free via DefiLlama | **High** |
| **GMX** | New yield **venue** (GM/GLV pools, LPs earn 63% of fees) on Arbitrum + free API/SDK | Free data | Medium |
| **Robinhood Chain / Earn** | Premium **yield source**: 7% APY on USDG via Morpho, Lloyd's-insured, non-custodial (Arbitrum Orbit L2) | Product, not API | Medium-High (evaluate) |
| **Alchemy** | Infra reliability — better RPC + token-balance API (could replace the ethers multicall in first-load) | Free tier | Medium |
| **ZeroDev** | Account-abstraction alternative (smart accounts/paymaster) — relates to the Circle/Privy/Safe layer, not yield | Free tier | Low (wallet track) |
| **Dune** | Onchain analytics/dashboards — differentiated metrics, tangential to yield | Paid/free tier | Low |
| **Fhenix** | FHE confidential compute — private balances, long-term/tangential | — | Low |

### ★ vaults.fyi — the linchpin (and first real resale candidate)

It's the first marketplace service that is **differentiated, on-thesis, AND
reselleable**:

- **Differentiated:** we have raw APY/TVL free (DefiLlama), but NOT curated risk
  ratings, per-wallet best-deposit recommendations, or idle-asset detection.
  Passes the free-first gate for the *recommendation* layer.
- **On-thesis:** transforms the Guardian from "our 3 RWA tokens" to "the best
  risk-adjusted yield across 1,000+ vaults (Aave, Morpho, Pendle, Euler, Yearn…)
  on Arbitrum."
- **Reselleable:** per-wallet "best-deposit-options" is $0.2020 wholesale — a
  natural **"find my best yield" premium** to charge users (marked up), while
  cheap list endpoints ($0.002) and free DefiLlama cover the commodity data.
  Added to the catalog as `vaultsfyi-best-deposit`.

**Free-first discipline still applies:** use DefiLlama (free) for raw APY/TVL;
pay vaults.fyi only for the differentiated per-wallet recommendation + risk
ratings, and resell *that*.

### Robinhood Earn — worth a serious look for a savings app

7% insured stablecoin yield (USDG via Morpho, Lloyd's of London cover,
non-custodial) is directly on DiversiFi's savings thesis — a premium, insured
yield destination for EM savers, on an Arbitrum Orbit L2. Diligence needed:
regulatory posture (high-yield lending scrutiny), USDG availability in target
markets, and bridging. But it's the strongest "premium safe yield" option seen.

### Recommended sequence

1. **vaults.fyi integration** (the linchpin): wire the yield-recommendation layer
   into the Guardian — DefiLlama for raw data (free), vaults.fyi for per-wallet
   recommendations (paid, resold as a premium). Biggest yield-story upgrade.
2. **GMX** as an added execution venue (free data + GM pools) in the swap
   orchestrator — extends the existing strategy pattern.
3. **Robinhood Earn** diligence — evaluate as a premium insured yield
   destination; product/compliance decision before integration.
4. **Alchemy** infra swap — reliability + a token-balance API that could retire
   the ethers multicall (also a bundle win). Separate infra track.
5. **ZeroDev / Dune / Fhenix** — park; revisit ZeroDev with the wallet/AA track,
   Dune/Fhenix when a specific need appears.

### GMX venue — status (2026-07-11)

Confirmed vaults.fyi does NOT cover GMX (it has Aave/Morpho/Euler/Sky… not GMX),
so GMX is a genuinely non-duplicative venue. Split into read (safe) and execution
(risky):

- **✅ Read side shipped** — `gmx-gm.service.ts` surfaces GM markets + APY from the
  FREE public GMX API (`arbitrum-api.gmxinfra.io/markets/info` + `/apy`; no key,
  no SDK, no RPC). Wired into the yield advisor as a free venue (top stable-side
  GM pools). Verified endpoints return live per-market APY (~10%). 3 tests.
- **🧪 Execution side — builder + testnet harness shipped; NOT mainnet-enabled.**
  - `swap/gmx/gmx-deposit-builder.ts` — pure builder for the atomic
    `ExchangeRouter.multicall([sendWnt, sendTokens…, createDeposit])`. Verified by
    encode→decode round-trip (5 tests). Addresses are inputs, never hardcoded
    (GMX redeploys the router).
  - `scripts/gmx-testnet-deposit.ts` — runnable **Arbitrum Sepolia** harness:
    approve USDC → submit the deposit multicall → poll the GM balance until the
    keeper mints. Proves the full round-trip.
  - **Testnet validation run (2026-07-11) — 3 real bugs caught, 1 open.** Ran the
    harness against a funded Arbitrum Sepolia wallet. Verified on-chain: the
    canonical Sepolia addresses (search results had the MAINNET ExchangeRouter —
    pulled the real ones from the gmx-synthetics deploy repo:
    ExchangeRouter `0xEd50B2A1…`, Router `0x72F13a44…`, DepositVault `0x809Ea82C…`,
    Reader `0x4750376b…`, DataStore `0xCF4c2C4c…`), and read the live markets via
    the Reader (market `0xb6fC4C9e…` = WETH/USDC, short = USDC.SG `0x3253a335…`).
    Fixes found by running it:
    1. **Approval must target the base `Router`, not the ExchangeRouter** —
       otherwise "transfer amount exceeds allowance".
    2. **Set an explicit `gasLimit`** — GMX's payable multicall reverts under
       `eth_estimateGas` even when a raw `eth_call` succeeds.
    3. Execution fee raised (0.001 → 0.01 ETH); still not the blocker.
    4. **ROOT CAUSE of the empty revert: stale `CreateDepositParams` struct.**
       GMX now nests the addresses in a `CreateDepositParamsAddresses` sub-struct
       and adds a reserved `dataList` (bytes32[]). The old flat struct mis-encodes
       → the contract reverts with EMPTY data. Fixed the builder to the current
       struct (from GMX's own `gmx-io/gmx-ai` liquidity reference).
  - **✅ Testnet gate passed (2026-07-11):** Arbitrum Sepolia round-trip —
    5 USDC → +6.327 GM (tx `0xf5d8f3fd…`).
  - **✅ MAINNET validated (2026-07-12):** real deposit on Arbitrum One via the
    exact production helpers — blue-chip ETH/USD [ETH-USDC] pool (17.55%),
    dynamic exec fee, GM-price slippage floor (min 3.02, minted 3.19), 5 USDC →
    +3.193 GM (tx `0x9004d233ed7091717d169238eef7fd8d382ed68390a79d471dc12f5d0a446f07`).
  - **Pre-flight fixes before go-live:** (1) blue-chip-only market filter — the
    strategy had been picking the highest-APY pool (a 92% memecoin); (2) wired a
    deposit trigger (BestYieldCard → useSwap → orchestrator); (3) flag moved to
    `NEXT_PUBLIC_GMX_GM_DEPOSIT_ENABLED` (orchestrator is client-side); (4) explicit
    legacy gasPrice ×1.5 (ethers pads Arbitrum maxFeePerGas ~75× → over-reserves).
  - **✅ LIVE (2026-07-12):** `NEXT_PUBLIC_GMX_GM_DEPOSIT_ENABLED=true` set in
    Vercel; the client rebuild bakes the flag in. Users can now deposit USDC into
    the blue-chip GM pool via the Deposit control on the GMX card in the
    Protection tab — routed through the mainnet-validated `GmxGmDepositStrategy`.
  - **After validation:** wrap the builder in a `GmxGmDepositStrategy`
    (swap orchestrator) behind a mainnet config flag. Do NOT enable mainnet until
    the testnet round-trip passes. Full `@gmx-io/sdk` (15MB, server-only) can
    replace the hand-rolled path later if we want its pricing helpers.

### Cost discipline — engagement-gated paid insights (2026-07-11)

Paid insights (vaults.fyi ~$0.20/call) are gated by `insight-tier.ts` so we
only spend on committed users, and it doubles as a value ladder:

| Tier | Unlocks (savings OR streak) | Paid insights/day |
|---|---|---|
| **Free** (everyone) | — | 0 — free data only (DefiLlama, GMX read, LI.FI, TinyFish) |
| **Saver** | ≥ $100 saved OR ≥ 7-day streak | 3 |
| **Committed** | ≥ $1,000 saved OR ≥ 30-day streak | 10 |

- **Default-DENY:** with no engagement context the tier resolves to `free`, so
  the paid vaults.fyi call is skipped unless the caller proves eligibility. We
  never pay for the unengaged.
- **Caching:** vaults.fyi results cache `stable` (long TTL) — best-yield doesn't
  move minute-to-minute and each miss costs ~$0.20, so we cache hard.
- **Accessibility preserved:** everyone gets the free data + yields; only the
  *personalized* paid layer is gated — and it's earnable by saving OR by using
  the app, which is on-mission for a savings product.

Wiring note: `getYieldRecommendations` takes an `engagement` arg
({ savedUsd, streakDays, paidInsightsUsedToday }); the caller supplies these
from the portfolio balance + streak store + the daily paid-call counter.

### Open questions

- Payment auth for vaults.fyi x402 calls (operator wallet vs existing rail).
- Do we resell the recommendation per-call, or bundle into a tier?
- Robinhood Earn: regulatory + USDG-in-EM diligence before any wiring.

---

## 0G Bridge Plan (Buildathon Implementation)

*Status: Wave 1 (scoping) — drafted 2026-06-15*
*Authoritative reference for: 0G component selection, Wave-by-Wave file deltas, principle alignment*

The 0G Bridge track runs alongside the Celo grant and Arbitrum Open House
tracks — each chain has a genuine, irreplaceable role. 0G is the
evidence/anchoring layer; Celo and Arbitrum are the settlement layers
where the ledgers of record live.

---

### 0. Long-term chain architecture (the end state)

The 0G Bridge buildathon frames 0G as replacing Arc for payments. That is a **buildathon-timeline pragmatism**, not the long-term architecture. Arc and 0G serve fundamentally different layers. Conflating them is the architectural mistake this section prevents.

DiversiFi's long-term mainnet stack has four layers, each owned by exactly one chain. The ledger of record follows the money — decisions settle on the chain where the action executes, not on a single canonical chain. 0G is the evidence layer that all ledgers reference.

| Layer | Chain | Why this chain | What it does NOT do |
|---|---|---|---|
| **Savings + Identity** | **Celo** | Regional Mento stablecoins (cUSD, cREAL, KESm, GHSm, etc.), SocialConnect ODIS identity, GoodDollar UBI. No other chain has local-currency stablecoin liquidity. | Agent execution (no EIP-7702), nanopayments, verifiable AI proofs |
| **Execution + Yield** | **Arbitrum** | Deepest USDC + RWA liquidity (Uniswap V3, 1inch, Camelot, PAXG, USDY, SYRUPUSDC). EIP-7702-capable for true on-chain ERC-7710 permission enforcement. | Trust root (ledger demoted to mirror), nanopayments, regional stablecoins |
| **Trust + Verifiability** | **0G** | Content-addressed Storage (evidence CIDs), TEE-verified Compute, DA (state snapshots). No other chain offers storage or verifiable inference. | Nanopayment settlement (gas-token friction — 0G tokens for gas, not USDC), ledger of record (0G is the evidence layer, not the settlement layer) |
| **Money Movement** | **Arc** | USDC-native gas (no volatile token inventory), sub-second deterministic finality, nanopayment economics ($0.000001), built-in FX engine for stablecoin pairs, native Circle Gateway/CCTP/CPN integration. | Verifiable AI proofs, regional stablecoins, deep DEX liquidity |

#### The chain-aware ledger resolution

The ledger of record follows the money. A Mento rebalance on Celo gets
recorded on Celo. A PAXG yield deposit on Arbitrum gets recorded on
Arbitrum. Both ledger entries reference a 0G Storage evidence CID. This
serves three grant tracks simultaneously:

- **Celo grant reviewers** check Celoscan → see verified savings ledger + tx history ✓
- **Arbitrum Open House reviewers** check Arbiscan → see verified yield ledger + tx history ✓
- **0G buildathon reviewers** check 0G Explorer → see deep Storage/Compute/DA integration ✓

0G is not the ledger of record — it is the tamper-proof evidence layer.
The chain-aware `RecommendationLedger` (already implemented in
`recommendation-ledger.service.ts` with its `LEDGER_REGISTRY`) settles
on the chain where the action executed; 0G Storage holds the reasoning
blob; the ledger entry's `evidenceCid` field references it.

This is a cleaner separation than "ledger on 0G": it co-locates
verifiability with value (the user sees their money AND their agent's
decisions on one explorer) while preserving 0G's unique role as the
evidence/anchoring layer.

#### The Arc vs 0G Pay resolution

0G Pay (settling USDC on 0G chain) is a **stopgap** that makes sense while Arc is testnet-only. The moment Arc mainnet lands, Arc should reclaim the payment rail because:

1. **USDC as native gas** — on 0G, settling a $0.001 nanopayment requires holding 0G tokens for gas. On Arc, the gas *is* USDC. The settlement currency and gas currency should match for a payment rail.
2. **Circle Gateway is the x402 standard** — nanopayments powered by Circle Gateway are live on mainnet across 80+ chains. Arc is Circle's native chain for this.
3. **Built-in FX engine** — Arc's institutional-grade RFQ system for stablecoin-to-stablecoin conversion is directly on-mission for DiversiFi's stablecoin savings product.
4. **0G's value is verifiability, not payments** — using 0G as a payment rail underutilizes its unique strengths (Storage, Compute, DA) and introduces gas-token friction that Arc eliminates by design.

#### Migration phases

| Phase | Timeline | Payment rail | Trust layer | Notes |
|---|---|---|---|---|
| **1 — Buildathon** | Now – Aug 2026 | 0G Pay (interim default) | 0G mainnet canonical (Wave 3) | `SETTLEMENT_NETWORK=ZERO_G`. Arc stays configured but testnet-only. |
| **2 — Arc mainnet beta** | When Arc mainnet lands (est. 2026) | Arc (flip default) | 0G mainnet canonical | `SETTLEMENT_NETWORK=ARC`. 0G Pay becomes fallback. One-line config change. |
| **3 — Arc mainnet stable** | Post-beta | Arc canonical | 0G canonical | Arc = payments, 0G = verifiability. These never overlap again. Explore Arc FX engine for major pairs (USDC/EURC), complementing Mento regional pairs on Celo. CCTP bridge Arc → Arbitrum for yield execution. |

#### What this means for the codebase

- **Do not delete Arc-specific infrastructure.** `ArcAgent`, `arc-research-sources.ts`, Curve/AeonDEX strategies, and `use-arc-balance` all have long-term value once Arc mainnet lands.
- **`DEFAULT_SETTLEMENT_NETWORK` is the single switch.** The `SETTLEMENT_NETWORK` env var controls the rail without code changes. The x402 gateway and Guardian loop both read from this default.
- **0G's canonical role is unchanged regardless of payment rail.** Storage, Compute, DA, and the trust ledger are 0G's permanent domain. The payment rail question is orthogonal to the verifiability question.

---

### 1. Principle alignment (the filter for every file we touch)

The Core Principles are not aspirational here; they are the buildathon's grading rubric in disguise. Wave 3 explicitly weights "Technical Quality" at 30% and judges "0G Mainnet Integration Depth" at 50% — both are won or lost on how disciplined we are about the principles. This section is the contract for every change below.

| Principle | What it means in the 0G Bridge context | What we will NOT do |
|---|---|---|
| **ENHANCEMENT FIRST** | Every 0G capability extends a service that already exists. New 0G surfaces live in the same module as the existing surface they mirror. | Create a new `@diversifi/shared-0g-bridge` package, a parallel `ZeroGBridgeProvider`, a new decorator alongside `ZeroGAnchoringDecorator`. |
| **CONSOLIDATION** | When 0G promotion makes something redundant (e.g. an Arbitrum-canonical ledger becomes 0G-canonical), the loser is **deleted**, not deprecated with `// TODO`. | Leave `mirrorRecommendationToZeroG` as a fallback if 0G is canonical. Keep Arbitrum-only env vars alive with a warning. |
| **PREVENT BLOAT** | The pre-Wave-1 audit (section 3) is mandatory. Net diff for Wave 1 should be a docs PR + a config PR. Wave 2-3 net diffs are 1 contract + 1 service method + N tests, no more. | Add a 0G Pay "shim" service before 0G Pay is actually used. Add an Agentic ID contract before the user-facing feature exists. |
| **DRY** | The `LEDGER_REGISTRY` in `recommendation-ledger.service.ts` and the `NETWORK_CONFIGS` map in `settlement-service.ts` are already the single sources of truth for chain-specific config. 0G mainnet entries go there. | Hard-code chain IDs / RPC URLs / USDC addresses anywhere outside the registry. Re-implement `recordRecommendation` per chain. |
| **CLEAN** | Each 0G component has exactly one owner module: Storage → `packages/shared-0g/src/services/storage-service.ts`; Serving → `packages/shared/src/services/ai/providers/zero-g-provider.ts`; Chain → `recommendation-ledger.service.ts`; DA → `packages/shared-0g/src/services/persistence-service.ts`; Pay → `settlement-service.ts`; Agentic ID → new `contracts/AgenticID.sol` (only if Wave 3/4 feature work requires it). | Cross-call between `ZeroGStorageService` and `ZeroGPersistenceService` (already coupled via `registerContent` and that coupling is fine). |
| **MODULAR** | All 0G services are testable in isolation (no Next.js, no DB). The AI provider, the storage service, the persistence service, the settlement service, and the ledger service all instantiate without a Next.js request context. | Add 0G Pay as a class with implicit `req`/`res` state. Make `recordRecommendation` need a session. |
| **PERFORMANT** | High-impact decisions (confidence > 0.8) take the 0G Compute Direct TEE-verified path. Low-impact decisions skip TEE attestation. 0G Storage uploads are fire-and-forget (already pattern in `ZeroGAnchoringDecorator`). 0G Pay is a non-blocking settlement (already pattern in `settleOnChain`). | Block the Guardian loop on a 0G Storage upload. Block the chat response on a 0G Compute proof. |
| **ORGANIZED** | The 0G-Chain-specific contract lives in `contracts/` next to the existing 3 contracts. The 0G-Chain-specific Foundry config goes in `foundry.toml` next to the existing `zero_g_testnet` entry. The 0G-Chain-specific deploy script lives in `scripts/` next to `DeployArbitrum.s.sol`. | Spawn a new top-level `0g/` directory or move chain-specific code into per-chain subfolders before we have >2 chains. |

If a proposed change cannot point to the row above that justifies it, the change is rejected. The pre-Wave-1 PR template asks the author to fill in the principle column.

---

### 2. 0G components — owned by existing files

The buildathon submission requires that "at least one 0G component must be integrated in every valid submission from Wave 3 onwards." We integrate all six. Below is the mapping from 0G component to existing module, with the Wave when it goes from "present" to "Wave-ready."

| 0G Component | Owner module (existing) | Status today | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 |
|---|---|---|---|---|---|---|---|
| **0G Storage** (encrypted evidence CIDs) | `packages/shared-0g/src/services/storage-service.ts` + `ZeroGAnchoringDecorator` | Live (Galileo testnet) | Document | Testnet demo with real CIDs | Mainnet upload path | Traction counter | Polish |
| **0G Compute (Serving)** (TEE-verified inference) | `packages/shared/src/services/ai/providers/zero-g-provider.ts` | Live (Router API) | Document | High-impact path gated on confidence | Mainnet Compute Direct | Compare A/B on quality | Pitch |
| **0G DA** (verifiable state snapshots) | `packages/shared-0g/src/services/persistence-service.ts` | Live (Storage-as-DA today) | Document | Promote to explicit DA namespace | Mainnet DA writes | Auto-snapshot every Guardian cycle | Compress + index |
| **0G Chain** (evidence anchoring) | `recommendation-ledger.service.ts` + `contracts/RecommendationLedger.sol` | Live (Arbitrum Sepolia yield ledger, 0G Galileo evidence mirror) | Document | Add 0G mainnet to `LEDGER_REGISTRY` as evidence anchor | **Deploy 0G mainnet evidence anchor + promote Storage/Compute/DA to mainnet** | Multi-tenant tx volume | Audit + gas optimization |
| **0G Pay** (agent nanopayments) | `packages/shared/src/services/settlement-service.ts` (`SettlementNetwork = 'ARC' \| 'ZERO_G'`) | Live (ZERO_G is interim default; ARC is testnet-only) | Document | Switch default to 0G (interim — Arc reclaims payment rail at mainnet) | 0G Pay mainnet settlement (interim until Arc mainnet beta) | Volume dashboard | Arc mainnet reclaims payment rail; 0G Pay becomes fallback |
| **Agentic ID (ERC-7857)** | New `contracts/AgenticID.sol` + new `services/agentic-id.service.ts` | Not present | Defer | Spec out ERC-7857 wrapper around existing Guardian identity | Deploy mintable ID per user | Transfer + INFT-style listing | Demo Day video |

**Net new files across all 5 waves: 2.** `contracts/AgenticID.sol` and `services/agentic-id.service.ts`. Everything else is configuration promotion, a Foundry script, or a method on an existing class.

---

### 3. Pre-Wave-1 audit (prevent-bloat gate)

Before any new work, the following must be true. All three are 1-line checks:

1. `LEDGER_REGISTRY` already contains an entry for `ZERO_G_GALILEO_CHAIN_ID = 16602`. Confirmed in `recommendation-ledger.service.ts`. **No duplication needed for 0G Galileo.**
2. `NETWORK_CONFIGS.ZERO_G` is already wired with `rpcUrl`, `usdcAddress`, `recipientAddress`, `explorerBase`, `chainId`, `name`. Confirmed in `settlement-service.ts`. **0G Pay config reuses this entry.**
3. `ZERO_G_DATA_HUB_CONFIG` already mirrors `ARC_DATA_HUB_CONFIG` (same categories, pricing, free limits). Confirmed in `config/index.ts`. **0G Pay pricing is single-source-of-truth across both rails.**

**Audit findings to act on (Phase 0, before Wave 1):**

| # | Finding | File | Action | Principle |
|---|---|---|---|---|
| A1 | `deepseek-v4-pro` is not a real 0G Serving model. The Router model catalog lists `deepseek-chat-v3-0324`, `qwen-2.5-72b-instruct`, `llama-3.3-70b-instruct`. We are currently sending an unknown model name to the Router, which returns whatever the router default is. | `packages/shared/src/services/ai/providers/zero-g-provider.ts` line 79-83 | Replace default with `deepseek-chat-v3-0324`. Add a `ZERO_G_SERVING_MODEL` env var so the failover orchestrator can override per deployment. | DRY, CLEAN |
| A2 | `shouldAnchorToZeroG` keyword heuristic includes `'analyze'` and `'summary'`, which fires for nearly every chat reply. The intent was "high-impact only"; the implementation is "anything that sounds like prose." | `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts` lines 32-46 | Tighten to action keywords only (`recommend`, `strategy`, `allocate`, `rebalance`, `swap`, `deposit`, `withdraw`, `hedge`). Add a confidence-threshold gate (anchor only when `confidence > 0.6`). | PERFORMANT, PREVENT BLOAT |
| A3 | The `registerContent` in-memory map is the only way to list 0G Storage CIDs across sessions; after a server restart it is empty. The `restoreState` already has a fallback to the on-chain `RecommendationLedger` for CID discovery — but `listContent` for arbitrary prefixes does not. | `packages/shared-0g/src/services/storage-service.ts` `listContent` method | The chain-aware `RecommendationLedger` is already the persistent index. Add a `listContentByAgent` method that queries `getUserRecommendations` from the on-chain ledger and returns the `evidenceCid` array. Delete the dead-path "in-memory registry" code path. | DRY, CONSOLIDATION |
| A4 | `RecommendationLedger` is described as canonical on Arbitrum, with 0G Galileo as a mirror. The chain-aware thesis says the ledger follows the money (Celo for savings, Arbitrum for yield) and 0G is the evidence layer. We will **update doc comments** in Wave 1 to reflect chain-aware routing and **implement** `getLedgerChainForAction` in Wave 3. | `docs/architecture.md`, `docs/integrations.md`, `contracts/RecommendationLedger.sol` comments, `recommendation-ledger.service.ts` doc comments | **Done.** Doc comments updated, `getLedgerChainForAction` implemented, Celo + Arbitrum mainnet ledgers deployed and seeded. | CLEAN, CONSOLIDATION |
| A5 | No tests cover the 0G branch of the AI provider or the 0G branch of the settlement service. | `packages/shared/src/services/__tests__/` | Add 3 unit tests in Wave 2: provider model override, ZERO_G default vs ARC override, 0G explorer URL builder. | MODULAR, PERFORMANT |

Phase 0 is the gate. We do not start Wave 1 work until the 5 audit findings are either fixed or explicitly deferred to a later wave (with the deferral written into this doc).

---

### 4. Wave-by-Wave file deltas

For each wave: principle alignment, file changes, verification gate, and the buildathon submission artifact that the change supports.

#### Wave 1 — Scoping & 0G integration plan (June 13-26, $5K)

**Goal:** submit the buildathon's required Project Information + Code Repository + Documentation + public X post. No net-new code. All work is documentation, config, and the Phase 0 audit.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `docs/roadmap.md` | 0G Bridge Plan section (this section) merged from the former standalone `0g-bridge-plan.md`. | merged | ORGANIZED |
| `docs/architecture.md` | Update the 0G row in the architecture diagram to reflect mainnet readiness; update the "Recent Hardening" callout to mention 0G Bridge as the next phase. | +15 | CLEAN |
| `docs/integrations.md` | Add 0G mainnet to the `ZERO_G_LEDGER_CONTRACT` row; mark 0G Pay as a settlement rail; add Agentic ID placeholder. | +10 | CLEAN |
| `README.md` | Add a 0G Bridge callout badge block: "Submission track: 0G Bridge (Wave 1, 2, 3, 4, 5)." | +5 | CLEAN |
| `packages/shared-0g/src/services/storage-service.ts` | Fix A3 (delete in-memory registry dead path, add ledger-backed list). | -20, +30 | CONSOLIDATION, DRY |
| `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts` | Fix A2 (tighten keyword heuristic + confidence gate). | -8, +12 | PERFORMANT |
| `packages/shared/src/services/ai/providers/zero-g-provider.ts` | Fix A1 (real model name + env override). | -4, +8 | CLEAN |
| `packages/shared/src/services/recommendation-ledger.service.ts` | Update doc comment to drop "Arbitrum canonical" language. | -3, +3 | CLEAN |
| `.env.example` | Add `ZERO_G_MAINNET_RPC_URL`, `ZERO_G_MAINNET_LEDGER_CONTRACT`, `ZERO_G_SERVING_MODEL`, `ZERO_G_PAY_RECIPIENT`. | +8 | DRY |

**Net diff:** ~440 lines, ~10 files, 0 net new modules, 0 new contracts.

**Verification gate:**

- `pnpm test` passes (new tests for A1, A2, A3).
- `pnpm lint` passes.
- `pnpm validate-agent` passes.
- The 0G Bridge Plan section is merged to main.
- Public X post with `#0GBridge #BuildOn0G` tagging `@0G_labs @0G_Builders @AKINDO_io` is live.

**Submission artifact (Wave 1):** the 0G Bridge Plan section (or its top) becomes the "Project Information" + "Architecture diagram" sections of the AKINDO submission form.

---

#### Wave 2 — Testnet integration & demo (June 27 - July 10, $7.5K)

**Goal:** working Guardian flow on 0G Galileo testnet, with 3-minute demo video and verifiable 0G Explorer links. No new module structure; just the 0G mainnet testnet promotion + test coverage.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `foundry.toml` | Add `[rpc_endpoints] zero_g_mainnet = "${ZERO_G_MAINNET_RPC_URL}"` (or testnet equivalent if no mainnet RPC at submission time). | +2 | DRY |
| `packages/shared/src/services/recommendation-ledger.service.ts` | Add a `ZERO_G_MAINNET_CHAIN_ID` constant and a `LEDGER_REGISTRY` entry. The chain-aware routing (`getLedgerChainForAction`) is not implemented yet — Arbitrum Sepolia stays the default ledger, 0G is added as an option. Chain-aware routing lands in Wave 3. | +12 | DRY, CLEAN |
| `packages/shared-0g/src/services/storage-service.ts` | Add a `ZEROG_MAINNET_STORAGE_URL` and `ZEROG_MAINNET_INDEXER_URL` env var with Galileo as fallback. | +8 | DRY |
| `packages/shared/src/services/settlement-service.ts` | Promote `ZERO_G` to the default `network` parameter in `settleOnChain` via `DEFAULT_SETTLEMENT_NETWORK` (env-driven via `SETTLEMENT_NETWORK`). This is **interim** — 0G Pay is the stopgap while Arc is testnet-only. Arc reclaims the nanopayment rail at mainnet (USDC-native gas, Circle Gateway). Document this in the docstring. | +8 | CLEAN, DRY |
| `scripts/DeployZeroG.s.sol` | (new) Forge deploy script for `RecommendationLedger` on 0G mainnet. Mirrors the structure of `scripts/DeployArbitrum.s.sol`. | +90 | ORGANIZED, MODULAR |
| `scripts/deploy-all.sh` | Add a `zero_g_mainnet` target that runs `DeployZeroG.s.sol` and writes the address to `.env`. | +20 | ORGANIZED |
| `pages/api/agent/zero-g-ledger.ts` | Accept a `chainId` query param (already in the code) and verify it documents `zero_g_mainnet` in the response. | +2 | CLEAN |
| `pages/api/agent/guardian-loop.ts` | When recording a recommendation, also write to 0G mainnet if `ZERO_G_MAINNET_LEDGER_CONTRACT` is set (in addition to the canonical chain). This becomes the Wave 3 promotion path's "dry run." | +15 | MODULAR, PERFORMANT |
| `packages/shared/src/services/__tests__/recommendation-ledger.service.test.ts` | Add 4 tests: 0G mainnet entry exists, default ledger still Arbitrum Sepolia in Wave 2, write to 0G mainnet returns the right `explorerUrl`, evidence anchor result is independent of the settlement ledger result. | +60 | MODULAR |
| `packages/shared/src/services/__tests__/settlement-service.test.ts` | Add 2 tests: ZERO_G default network, ARC override. | +25 | MODULAR |
| `docs/internal/zero-g-mainnet-runbook.md` | (new) Step-by-step deploy + verify + revoke procedure for the 0G mainnet ledger. | +80 | ORGANIZED |

**Net diff:** ~330 lines, ~11 files, 1 new deploy script, 0 new core services.

**Verification gate:**

- `pnpm test` passes (~390 tests, +9 from Phase 0 + Wave 2).
- `pnpm test-x402` passes end-to-end with the 0G settlement rail as the default.
- Guardian loop records 1+ recommendation on 0G mainnet evidence anchor in a fresh deploy; 0G Explorer URL is generated and surfaces in the proof feed.
- 3-minute demo video is recorded and uploaded (YouTube unlisted is fine).
- Public X post with demo GIF + `#0GBridge #BuildOn0G`.

**Submission artifact (Wave 2):** working prototype + demo video + 0G Explorer link.

---

#### Wave 3 — Mainnet deployment (July 11-24, $15K, the highest-allocated wave)

**Goal:** 0G Storage, Compute, and DA are promoted to **0G mainnet** as
the evidence/anchoring layer. The chain-aware `RecommendationLedger`
settles on the chain where the money moves — Celo mainnet for savings
decisions, Arbitrum mainnet for yield decisions. 0G mainnet hosts an
evidence anchor deployment (a `RecommendationLedger` instance that
records evidence CIDs for cross-chain verification). Agentic ID
(ERC-7857) contract is deployed on 0G mainnet and one user is minted.

**The key architectural decision:** 0G is the evidence layer, not the
ledger of record. The ledgers of record live on Celo and Arbitrum
(where the money moves). 0G mainnet gets an evidence anchor deployment
that records CIDs for cross-chain verification — this satisfies the
buildathon's "0G mainnet integration depth" requirement while keeping
the settlement story coherent for the Celo and Arbitrum grant tracks.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `contracts/RecommendationLedger.sol` | ~~No logic change. Deploy to 0G mainnet as evidence anchor.~~ **Done** — deployed to 0G mainnet (`0x3BCf…369C`), Celo mainnet, and Arbitrum mainnet. First recs seeded on all three. | 0 | (deploy only) |
| `packages/shared/src/services/recommendation-ledger.service.ts` | ~~Add `CELO_MAINNET_CHAIN_ID` and `ZERO_G_MAINNET_CHAIN_ID` to `LEDGER_REGISTRY`. Implement chain-aware routing: savings actions → Celo ledger, yield actions → Arbitrum ledger, evidence anchor → 0G ledger.~~ **Done.** `getLedgerChainForAction(action, targetToken)` routes Celo savings tokens → Celo mainnet, yield/RWA tokens → Arbitrum mainnet. Lazy env reading so tests can override at runtime. 0G mainnet chain ID pending. | -8, +20 | CONSOLIDATION, DRY |
| `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts` | `anchorAndRecord` now records to the chain-aware ledger (Celo or Arbitrum based on action type) and anchors evidence to 0G mainnet Storage. The 0G mainnet evidence anchor write is fire-and-forget. | +15 | PERFORMANT, CLEAN |
| `packages/shared/src/services/ai/providers/zero-g-provider.ts` | Add a `useDirectCompute: boolean` option that, when true, calls the 0G Compute Direct API for TEE-verified inference. The `withTimeout` window tightens to 15s for the direct path (TEE proofs add latency). | +35 | MODULAR, PERFORMANT |
| `packages/shared/src/services/ai/fallback/fallback-orchestrator.ts` | Route high-confidence decisions (`confidence > 0.8`) through the 0G Compute Direct provider; low-confidence decisions stay on the Router API path. | +20 | PERFORMANT |
| `packages/shared-0g/src/services/persistence-service.ts` | Add a `snapshotGuardianState` method that writes the full Guardian state to 0G mainnet DA once per Guardian loop cycle (not on every decision). Reads are unchanged. | +25 | PERFORMANT, MODULAR |
| `pages/api/agent/guardian-loop.ts` | After the recommendation record, fire a `snapshotGuardianState` to 0G DA. Awaited, not fire-and-forget — DA is a state checkpoint, not a receipt. | +8 | PERFORMANT |
| `contracts/AgenticID.sol` | (new) Minimal ERC-7857 wrapper: `mint(user, agentURI)` with `agentURI` pointing to the encrypted evidence bundle in 0G Storage. Ownable, single contract, no on-chain AI. The actual Guardian is an off-chain service; the on-chain ID is a transferable pointer. | +120 | MODULAR, CLEAN |
| `scripts/DeployAgenticID.s.sol` | (new) Deploy script for `AgenticID.sol` to 0G mainnet. | +60 | ORGANIZED |
| `scripts/DeployCelo.s.sol` | (new) Deploy script for `RecommendationLedger` on Celo mainnet. Mirrors `DeployArbitrum.s.sol`. | +90 | ORGANIZED |
| `scripts/deploy-all.sh` | Add `celo_mainnet` and `zero_g_mainnet` targets. | +30 | ORGANIZED |
| `packages/shared/src/services/agentic-id.service.ts` | (new) Server-side service that mints/burns/transfers Agentic IDs. Mirrors the `recommendationLedgerService` shape (chain-aware registry, on-chain + 0G Storage). 1 file, ~200 lines, 4 methods. | +200 | MODULAR, DRY |
| `packages/shared/src/index.ts` | Re-export `agenticIdService`. | +1 | CLEAN |
| `pages/api/agent/agentic-id.ts` | (new) GET/POST endpoint for the Agentic ID. | +50 | ORGANIZED |
| `packages/shared/src/services/__tests__/agentic-id.service.test.ts` | (new) 6 tests: mint, transfer, ownership, agentURI resolution, pause, 0G Storage pointer. | +80 | MODULAR |
| `packages/shared/src/services/__tests__/recommendation-ledger.service.test.ts` | Update tests to expect chain-aware routing: savings → Celo, yield → Arbitrum, evidence → 0G. | +15 | DRY |
| `docs/architecture.md` | Update the architecture diagram to show chain-aware ledger (Celo + Arbitrum as ledgers of record, 0G as evidence layer). | +10 | CLEAN |

**Net diff:** ~620 lines, ~12 files, 1 new contract, 1 new service module, 1 new endpoint.

**Verification gate:**

- `pnpm test` passes (459 tests).
- ~~`RecommendationLedger` address on 0G mainnet (evidence anchor), Celo mainnet (savings ledger), and Arbitrum mainnet (yield ledger) are in `.env` and in the README.~~ **All three deployed** at `0x3BCf…369C`.
- ~~0G Explorer link to a real evidence anchor tx is in the README.~~ **Done** — tx `0x981086b4…` on chainscan.0g.ai
- ~~Celoscan link to a real savings ledger tx is in the README.~~ **Done** — tx `0xea1b169a…`
- ~~Arbiscan link to a real yield ledger tx is in the README.~~ **Done** — tx `0x2a034aad…`
- ~~Guardian loop records a recommendation on all three chains end-to-end.~~ **Done.** Guardian heartbeat cron runs every 2 hours, recording on Celo/Arbitrum primary + 0G evidence mirror. Guardian loop runs every 5 min for auto-execution within user permission bounds.
- Agentic ID is minted for at least 1 test user; the on-chain ID points to a 0G Storage CID.
- Demo video updated to show the chain-aware flow.
- X post with mainnet proof.

**Submission artifact (Wave 3):** mainnet contract address + 0G Explorer link + updated demo video.

---

#### Wave 4 — Traction & user acquisition (July 25 - August 7, $10K)

**Goal:** real users, real Guardian decisions, real 0G mainnet tx volume. The Verifiable AI dashboard becomes the user-facing growth surface.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `components/tabs/AgentTab.tsx` (or the dashboard component) | Add a "Chain-Aware Ledger Activity" widget: live tx count per chain (Celo savings, Arbitrum yield, 0G evidence anchor), gas spent, evidence CIDs created this week, # of users with a minted Agentic ID. Reads from `/api/agent/zero-g-ledger?chainId=<0G mainnet>` and the Celo/Arbitrum ledger endpoints. | +60 | PERFORMANT, CLEAN |
| `pages/api/agent/zero-g-stats.ts` | (new) Aggregated stats endpoint: `totalRecommendations`, `totalUsers`, `totalAgenticIds`, `last7DaysActivity`. Uses the existing `recommendationLedgerService` and `agenticIdService`. | +80 | DRY, MODULAR |
| `pages/api/agent/zero-g-ledger.ts` | Add a `?stats=true` flag that returns the aggregated shape from `zero-g-stats` (or merge the endpoints via query param to keep the surface small — DRY). | +15 | DRY |
| `packages/shared/src/services/agentic-id.service.ts` | Add a `transfer(to)` method that updates 0G Storage pointers on transfer. The Agentic ID is the user's Guardian, so a transfer is a real event. | +30 | MODULAR, CLEAN |
| `hooks/use-proactive-agent.ts` | On session start, check whether the user has an Agentic ID; if not, show a 1-tap "Mint your Guardian ID" call-to-action. | +25 | CLEAN, MODULAR |
| `pages/api/agent/_advisor-core.ts` | When recommending an action, surface "This recommendation will be recorded on [Celo/Arbitrum] as Guardian #N, with evidence anchored to 0G" — a small UX hint that drives home the chain-aware verifiability story. | +10 | CLEAN |
| `lib/marketing/0g-bridge-week-N.md` | (new) Weekly traction recap. Not a code file; lives next to `docs/` as `docs/internal/0g-bridge-week-N.md`. | +60 each | ORGANIZED |

**Net diff:** ~280 lines, ~6 files, 0 new contracts, 1 new endpoint.

**Verification gate:**

- `pnpm test` passes (~430 tests).
- 50+ wallets have connected and at least 1 Guardian decision each is recorded on the chain-aware ledger (Celo for savings, Arbitrum for yield, 0G evidence anchor).
- The Verifiable AI dashboard shows live 0G Explorer links + Celoscan + Arbiscan links.
- `pages/api/agent/zero-g-stats` returns non-zero counts.

**Submission artifact (Wave 4):** traction metrics + screenshots of the dashboard.

---

#### Wave 5 — Growth & Demo Day (August 8-21, $12.5K)

**Goal:** pitch deck, growth roadmap, polished demo for Token2049 Singapore (Oct 7-8). Audit pass + gas optimization on the contracts.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `contracts/RecommendationLedger.sol` | Gas audit: replace `string` parameters with `bytes32` hashes where the contract never reads the string (e.g. `servingModel` is only used as a string label). If not worth the migration, document the gas profile. | +30 or +5 (comment) | PERFORMANT |
| `contracts/AgenticID.sol` | Same audit pass. | +20 or +5 | PERFORMANT |
| `docs/internal/0g-bridge-demo-day-pitch.md` | (new) Demo Day pitch script. | +200 | ORGANIZED |
| `docs/roadmap.md` | Mark the 0G Bridge track as "submitted to Demo Day." Add a "post-buildathon" section referencing 0G's Investment Committee path. | +30 | ORGANIZED |
| `README.md` | Add a "Demo Day" section linking to the pitch video, the chain-aware mainnet contracts (Celo, Arbitrum, 0G), and the explorer proof links. | +15 | CLEAN |
| `scripts/check-0g-bridge-submission.sh` | (new) Verification script that runs before each Wave submission: checks contracts are deployed, env vars are set, tests pass, demo video is linked, X post is public. Mirrors `scripts/check-env-drift.sh`. | +80 | ORGANIZED, PERFORMANT |

**Net diff:** ~360 lines, ~5 files, 0 new core services, 1 new verification script.

**Verification gate:**

- `pnpm test` passes.
- `scripts/check-0g-bridge-submission.sh` exits 0.
- Demo Day video recorded.
- Pitch deck ready.

**Submission artifact (Wave 5):** demo video + pitch deck + investment-ready metrics.

---

### 5. Risk register (per Wave)

| Risk | Likelihood | Impact | Mitigation | Principle |
|---|---|---|---|---|
| 0G mainnet RPC is unreliable at submission time | Medium | High (blocks Wave 3) | Use `x402-proxy.mjs` (existing) to pay-per-request, or fall back to a public RPC + 3 retries with exponential backoff. | PERFORMANT |
| ERC-7857 spec evolves between Wave 3 and Wave 5 | Medium | Medium | Keep `AgenticID.sol` minimal; wrap, don't extend OpenZeppelin. Easy to redeploy. | MODULAR |
| 0G Compute Direct TEE proofs add >15s latency | Low | Medium | Direct path is gated on `confidence > 0.8`; low-confidence decisions use the Router path. | PERFORMANT |
| Arbitrum ledger is required by the Arbitrum Open House reviewers | Medium | Medium | `recommendationLedgerService` is chain-aware — Arbitrum mainnet hosts the yield ledger of record. The chain-aware routing serves both tracks. | DRY |
| 0G Pay USDC contract differs on mainnet | Medium | Low | `ZERO_G_DATA_HUB_CONFIG.USDC_TESTNET` is already env-overridable. Add `USDC_MAINNET` and switch the default in Wave 3. | DRY |
| Wave 1 submission is late (deadline June 26) | High if not done this week | High (lose $5K) | This document IS the Wave 1 submission. Submission deadline: June 26, 2026 23:59 UTC. | (action item, see below) |

---

### 6. Action items for this week (Wave 1 close-out)

These are the only tasks that should run between now and the June 26 Wave 1 deadline. They are the Phase 0 audit + the Wave 1 file deltas above.

1. **Fix A1, A2, A3, A4, A5** in a single PR (one commit per finding, one principle per commit message).
2. **Open a docs PR** that adds the 0G Bridge Plan section + the `docs/architecture.md` updates.
3. **Update `.env.example`** with the new 0G mainnet keys.
4. **Run `pnpm test && pnpm lint && pnpm validate-agent`** and screenshot the green output for the submission.
5. **Draft the AKINDO submission form fields** (project name, one-liner, summary, integration list) from the top of this section.
6. **Schedule the X post** for June 25, 2026 (24h before deadline) with a demo GIF and the `#0GBridge #BuildOn0G` tags.

The Wave 1 submission is otherwise a packaging exercise. The hard work (the 0G integration) is already in the repo.

---

### 7. Cross-references

- Project context: [`README.md`](../README.md)
- Architecture: [`docs/architecture.md`](./architecture.md)
- All integrations: [`docs/integrations.md`](./integrations.md)
- Internal runbook: `docs/internal/zero-g-mainnet-runbook.md` (to be created when 0G mainnet deploy happens)
- 0G contract: [`contracts/RecommendationLedger.sol`](../contracts/RecommendationLedger.sol)
- 0G Storage service: [`packages/shared-0g/src/services/storage-service.ts`](../packages/shared-0g/src/services/storage-service.ts)
- 0G DA service: [`packages/shared-0g/src/services/persistence-service.ts`](../packages/shared-0g/src/services/persistence-service.ts)
- 0G AI provider: [`packages/shared/src/services/ai/providers/zero-g-provider.ts`](../packages/shared/src/services/ai/providers/zero-g-provider.ts)
- 0G Anchoring decorator: [`packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts`](../packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts)
- 0G ledger service (chain-aware): [`packages/shared/src/services/recommendation-ledger.service.ts`](../packages/shared/src/services/recommendation-ledger.service.ts)
- 0G settlement (multi-chain): [`packages/shared/src/services/settlement-service.ts`](../packages/shared/src/services/settlement-service.ts)
- 0G endpoint: [`pages/api/agent/zero-g-ledger.ts`](../pages/api/agent/zero-g-ledger.ts)
- 0G config: [`packages/shared/src/config/index.ts`](../packages/shared/src/config/index.ts) (`NETWORKS.ZERO_G_TESTNET`, `ZERO_G_DATA_HUB_CONFIG`)
- Foundry config: [`foundry.toml`](../foundry.toml) (`zero_g_testnet` rpc endpoint)
- Deploy script (Arbitrum template): [`scripts/DeployArbitrum.s.sol`](../scripts/DeployArbitrum.s.sol)
- Deploy-all script: [`scripts/deploy-all.sh`](../scripts/deploy-all.sh)
