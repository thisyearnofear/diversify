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
lives in [`docs/0g-bridge-plan.md`](./0g-bridge-plan.md). The headline
principle: **enhance the existing 0G-aware modules** (already-present
in `recommendation-ledger.service.ts`, `settlement-service.ts`,
`storage-service.ts`, `persistence-service.ts`, `zero-g-provider.ts`,
`ZeroGAnchoringDecorator`) rather than create parallel `0g-bridge/*`
surfaces. The full plan, the principle-alignment table, the pre-Wave-1
audit, and the Wave 1-5 file deltas are in the linked doc.

**Wave 1 deadline:** June 26, 2026 23:59 UTC. Submission is this week;
the file deltas in `0g-bridge-plan.md` §4 (Wave 1) plus the §3 audit
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
| "Consumer app with infrastructure framing" | Reframe as intelligence protocol; ship external-agent SDK + integration guide | **Docs reframed** (product.md, README.md, architecture.md). Integration guide written (`docs/integration-guide.md`) |
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
(planned) is that landing zone: regulated-market savings and structured settlement for
**Confucian** and **Gotong Royong** plans, while Arbitrum remains the yield optimizer.

| Concern | Owner |
|---------|--------|
| Fiat on-ramp (PH, SG) | StraitsX, Coins.ph → stablecoin on APAC rail |
| Savings / hold actions | APAC rail + `RecommendationLedger` |
| Yield rotation (USDY, etc.) | Arbitrum (unchanged) |
| Intelligence API tolls | Arc / x402 (unchanged) |
| Reasoning evidence | 0G (unchanged) |

Full rationale, routing diagram, build/skip criteria, and minimal v1 scope:
[`apac-rail.md`](./apac-rail.md).

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

Critical UI/UX audit against the emerging/APAC saver persona. Five waves; **0–3 shipped**, 4+ deferred.

| Wave | Focus | Status |
|------|-------|--------|
| **0 — Stop bleeding** | Skip tour when philosophy set; beginner tab IA (Shield/Home/Learn); plain wallet CTAs; remove confetti | **Done** |
| **1 — Guardian surfaces** | Delete `GuardianOnboardingWizard`; `GuardianStatusChip`; compact scrollytelling (2 states) | **Done** |
| **2 — DRY + plain copy** | `strategyToArchetype()` single source; beginner tips without chain jargon; compact `LiveProofCard` | **Done** |
| **3 — Calm + honest** | Hide header chrome in Simple mode; 3-step tour; APAC honesty banner; fold `philosophy` into protection profile | **Done** |
| **4+** | Testnet banner gating, further AgentTier demotion, claim confetti removal | Planned |

**540 tests passing** after Wave 3. Key files: `constants/tabs.ts`, `constants/onboarding.ts`, `constants/apac-rail.ts`, `hooks/use-protection-profile.ts`, `hooks/use-home-sections.ts`, `components/app/AppHeader.tsx`, `components/tour/GuidedTour.tsx`.

---

## Deferred (Correct but Wrong Timing)

| Task | Why deferred |
|---|---|
| **Agent identity on-chain registration** (ERC-8004 mint + Self Protocol passport scan) | **ERC-8004 done** (agentId 9654 on Celo mainnet). **Self Protocol on testnet** (agentId 82 on Celo Sepolia, proof-of-human verified with mock documents). Mainnet Self Protocol registration with real passport is a Wave 3 / Celo grant priority — testnet + mock docs scored zero on the Celo rubric. See `docs/agent-identity.md`. |
| **Package split** (`@diversifi/shared` → `shared-ai`, `shared-swap`, `shared-guardian`, `shared-data`, `shared-core`) | 33K-line monolith will surface circular dependency nightmares. Revisit when the package hits 50K+ lines or a second team starts contributing. |
| **API versioning** (`/api/v1/` prefix) | Zero external consumers. All API routes are internal Next.js routes consumed by the same app. Add versioning when the first SDK or mobile app is built. |
| **Turbopack migration** (remove `--webpack` flag) | Mixing bundler changes with component refactors makes debugging untraceable. Do this as a standalone task after this plan is complete and the codebase is stable. |
| **Design tokens** (CSS custom properties) | Refactoring Tailwind classes across 50+ components into custom properties is low ROI for a solo dev. Revisit when a second designer joins or a white-label deployment is needed. |
| **Test coverage expansion** | Existing tests cover swap strategies, rewards, and core services. Add integration tests for the Guardian loop and onboarding in the next cycle. |
| **AI streaming UX** | Requires changes to the `AIService` provider chain. Do after the package split when the AI layer is in its own isolated package. |

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
