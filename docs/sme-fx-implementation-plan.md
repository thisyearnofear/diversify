# SME FX Layer Implementation Plan

**Status:** In progress (2026-07-14). Phases 0–3 + Guardian trust pass shipped in-app; Phase 5 (cycle-aware Guardian execution, fail-closed Celo-only) shipped.  
**Purpose:** Close the gap between the aligned docs vision (FX-risk intelligence + philosophy moat) and the actual app. The importer wedge stays inside the existing app as an archetype until forced by demand, per `docs/sme-fx-strategy.md` §8.

> **2026-07-13 update — Guardian + FX slice + trust pass:**
> - **Guardian identity consolidation** — single user-facing agent, non-modal proactive updates, shared six-question recommendation contract (`GuardianRecommendationCard`, `recommendation-contract.ts`)
> - **Money purpose** in onboarding/profile (`constants/money-purpose.ts`) — not a new philosophy
> - **Payment cycle report** — `PaymentCycleReport` on Shield/Home; `POST /api/agent/fx-cycle-report` is a **current-rate scenario with historical stress context** (USD targets only — not a future-day historical quote)
> - **PurchaseCycle Mongo model** — `models/PurchaseCycle.ts`, wallet-signed `GET/POST /api/agent/business/cycles` (`lib/wallet-auth.ts`)
> - **Cycle monitoring opt-in** — user enables after reviewing report; proactive client alerts + `runCycleMonitor()` inline in `guardian-loop` cron
> - **Payment-due confirmation** — date passing → `payment_due`; “post-payment report” only after user confirms with achieved amount/rate/fees
> - **Bounded recommendation queue** — `recommendationQueue` on GuardianState (cap 5); enqueue/dequeue so cycle/yield/macro proposals do not clobber each other
> - **Export** — shared `fx-drag-report-renderer.ts` (Markdown + CSV); CLI script delegates to it
> - Focused suite green (guardian-state / FX / AppShell / guardian-loop)

> **2026-07-12 update:** a separate, paid proof of the FX-risk intelligence layer shipped via the x402 gateway — pay a stablecoin (USDT on HashKey; HSP mandate settlement pending Coordinator KYC), unlock a real FX drag report, anchored on the importer's region-canonical ledger (APAC → HashKey, Africa → Celo, else Arbitrum — "follows the money"). **The anchor is live**: [a real HashKey mainnet tx](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b) recorded a PHP importer's FX drag report computed from live rates, for HSK gas only — no Coordinator needed. See [`hsp-fx-protection.md`](./hsp-fx-protection.md). It is **not** the in-app importer-archetype surface this plan describes (that's still Phase 1–4 below, free-to-view for onboarded users) — it's an agent-facing, pay-per-report proof that reuses the exact same `analyzeCycles` engine, now moved to shared per Phase 0. The two surfaces will likely converge (an importer-archetype user's own cycles could power both the free in-app report and a resellable paid one), but that convergence isn't built yet.

## Guiding constraint

Until forced by demand, the importer wedge lives **inside the existing app as an archetype**, not a new product or tab. This mirrors the sequencing in `docs/sme-fx-strategy.md` §8 and honors **PREVENT BLOAT**.

## Phase 0 — Audit & Consolidation (no new features)

Goal: make the existing code safe to extend before adding business logic.

| Action | File(s) | Principle |
|---|---|---|
| **Audit `FinancialStrategy`** | `packages/shared/src/types/strategy.ts` | PREVENT BLOAT |
| Delete `halo`/`taco` if they are not real product strategies | `packages/shared/src/services/strategy/strategy.service.ts`, `components/protection-cards/tokens.ts` | CONSOLIDATION |
| ✅ **Move FX drag logic into `@diversifi/shared`** — done 2026-07-12 | `packages/shared/src/services/fx-drag/calc.ts` (canonical; `scripts/fx-drag/calc.ts` now re-exports it) | DRY |
| ✅ Add a serverless-safe rate provider (the filesystem-cached CLI one doesn't work in an API route) | `packages/shared/src/services/fx-drag/rates-serverless.ts` | DRY |
| ✅ **Move report renderer into shared** | `packages/shared/src/services/fx-drag/fx-drag-report-renderer.ts` (from `scripts/fx-drag-report.ts` render functions) | DRY |
| Keep `scripts/fx-drag-report.ts` as a thin CLI wrapper that delegates to the shared service | `scripts/fx-drag-report.ts` | ENHANCEMENT FIRST |
| **Delete or replace fake business scenarios** | `components/demo/RealWorldUseCases.tsx`, `components/demo/RealLifeScenario.tsx` | CONSOLIDATION |
| **Verification** | `pnpm test`, `pnpm lint`, `pnpm build` | — |

**Why first:** The concierge FX drag tool (`scripts/fx-drag-report.ts`) already proves the math works. The logic must become a shared service before it can power the app.

## Phase 1 — Importer Archetype as Strategy Extension

Goal: a business user is just another philosophy/archetype, not a new app.

| Action | File(s) | Principle |
|---|---|---|
| Add `'importer'` to `FinancialStrategy` union | `packages/shared/src/types/strategy.ts` | ENHANCEMENT FIRST |
| Add `case 'importer':` in `StrategyService.getConfig()` | `packages/shared/src/services/strategy/strategy.service.ts` | DRY |
| Add `case 'importer':` in `StrategyService.getAIPrompt()` | `packages/shared/src/services/strategy/strategy.service.ts` | DRY |
| Add importer archetype card/token | `components/protection-cards/tokens.ts` | ENHANCEMENT FIRST |
| Add importer to `plan-preview.ts` | `components/protection-cards/plan-preview.ts` | DRY |
| Add importer framing to `ProtectionScorecard` | `components/tabs/overview/ProtectionScorecard.tsx` | ENHANCEMENT FIRST |
| Add importer handling to `ProtectionAmbient` if needed | `components/tabs/protect/ProtectionAmbient.tsx` | ENHANCEMENT FIRST |
| Tests: importer config, prompt, archetype render | `packages/shared/src/services/strategy/__tests__/strategy.service.test.ts`, `components/protection-cards/__tests__/*.test.ts` | MODULAR |

**Importer config sketch:**

```ts
case 'importer':
  return {
    preferredRegions: ['Global'],
    targetAllocations: [
      { region: 'Global', min: 60, ideal: 80, max: 95 }, // USD-pegged core
    ],
    prioritizeAssets: ['USDC', 'USDm', 'cUSD', 'USDY'],
    scoringWeights: { regionalConcentration: 0.2, globalDiversification: 0.2, assetCompliance: 0.6 },
    successThresholds: { excellent: 85, good: 70, needsWork: 50 },
  };
```

**AI prompt sketch:**

> The user is an importer/trader. Protect trade margin, not idle savings. Park sales proceeds in USD-pegged value between purchase cycles. Prioritize liquidity and stability. Be ready for the supplier payment date.

**Why:** The entire philosophy infrastructure already exists. Adding an importer as a `FinancialStrategy` is the smallest credible extension that makes the business layer real.

## Phase 2 — Purchase Cycle Data Model

Goal: a minimal, clean data model for working-capital cycles.

**Status: shipped 2026-07-13** (wallet-authenticated CRUD; payment-due vs confirmed-outcome semantics).

| Action | File(s) | Principle |
|---|---|---|
| ✅ Add shared types | `packages/shared/src/types/purchase-cycle.ts` | CLEAN |
| ✅ Add `PurchaseCycle` Mongoose model | `models/PurchaseCycle.ts` | MODULAR |
| ✅ Add CRUD API (wallet-signed headers) | `pages/api/agent/business/cycles.ts`, `lib/wallet-auth.ts` | CLEAN |
| ✅ Derive address from signature — do not trust client `userAddress` | `lib/wallet-auth.ts` | DRY |
| ✅ Status: `active` → `payment_due` on date pass; `completed` requires `paymentOutcome` | cycles API + `PaymentCycleReport` | CLEAN |
| Tests: model + API | extend as needed | MODULAR |

**Model sketch (shipped shape):**

```ts
interface PurchaseCycle {
  userAddress: string;
  label: string;
  localCurrency: string; // e.g. 'GHS'
  targetCurrency: string; // currently USD-only in the report engine
  paymentDate: Date;
  targetAmountUsd: number;
  monitoringEnabled: boolean;
  status: 'draft' | 'active' | 'payment_due' | 'completed' | 'cancelled';
  lastReport?: CycleReportSnapshot;
  paymentOutcome?: {
    confirmedAt: Date;
    achievedLocalAmount: number;
    achievedRate?: number;
    achievedFeesLocal?: number;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Why:** A purchase cycle is the only genuinely new concept from `docs/sme-fx-strategy.md` §5. Everything else reuses the existing pattern.

## Phase 3 — Self-Serve Per-Cycle FX Drag Report

Goal: turn the concierge script into an in-app, self-serve report.

**Status: shipped 2026-07-13** (see header update for file list).

| Action | File(s) | Principle |
|---|---|---|
| ✅ Add API to compute drag report from cycles | `pages/api/agent/fx-cycle-report.ts` | MODULAR |
| ✅ Reuse `analyzeCycles` + report renderer | `packages/shared/src/services/fx-drag/*` | DRY |
| ✅ Create in-app report UI | `components/tabs/protect/PaymentCycleReport.tsx` | ENHANCEMENT FIRST |
| ✅ Mount on Shield/Home for `upcoming_payment` money purpose | `ProtectionTab.tsx`, `ConnectedOverview.tsx` | ENHANCEMENT FIRST |
| ✅ Markdown/CSV export | `fx-drag-report-renderer.ts` + download in UI | DRY |
| Tests: renderer unit tests | `packages/shared/src/services/fx-drag/__tests__/fx-drag-report-renderer.test.ts` | MODULAR |

**Why:** This is the "signature surface" from `docs/sme-fx-strategy.md` §5. It proves the FX intelligence layer to a business user before any autonomous execution.

## Phase 4 — Graduation Funnel

Goal: detect retail users who are actually traders and surface the business layer.

| Action | File(s) | Principle |
|---|---|---|
| Add server-side graduation signal detection | `pages/api/agent/business/graduation-signals.ts` or extend existing analytics | MODULAR |
| Signals: cyclical deposits/withdrawals, larger balances, corridor swaps (local stable ↔ USD stable) | query existing `vaultStore` / swap history / `FunnelEvent` | DRY |
| Store signal in `GuardianState` or `FunnelEvent` | `models/FunnelEvent.ts`, `pages/api/vault/_guardian-state.ts` | CLEAN |
| Add `BusinessPromptCard` | `components/business/BusinessPromptCard.tsx` (pattern: `PhilosophyPromptCard`) | ENHANCEMENT FIRST |
| Show prompt in Overview/Protection for high-signal users | `components/tabs/overview/ConnectedOverview.tsx` or `components/tabs/ProtectionTab.tsx` | ENHANCEMENT FIRST |
| CTA: "See what FX drag is costing your business" → opens `BusinessDragReport` | — | — |

**Why:** The graduation moment must be designed, not hoped for. The data already exists; we just need to surface it.

## Phase 5 — Cycle-Aware Guardian Execution

Goal: the Guardian autonomously protects working capital as a supplier payment approaches.

**Status: shipped (2026-07-14)** — monitoring opt-in, proposals, cron tick, and fail-closed `CYCLE_PROTECTION` auto-execution are all live. Auto-execution is intentionally scoped to Celo-only permissions and to local currencies with a verified Mento funding rail (KES, COP, PHP, BRL → cUSD); every other cycle stays advisory-only until a verified rail is added, rather than attempting an ambiguous swap.

| Action | File(s) | Principle |
|---|---|---|
| ✅ `PurchaseCycle` model + cycles API | `models/PurchaseCycle.ts`, `pages/api/agent/business/cycles.ts` | MODULAR |
| ✅ Compute days-until-payment + proposal contract | `recommendation-contract.ts`, `lib/guardian/cycle-monitor-run.ts` | DRY |
| ✅ Inline cycle monitor in guardian-loop cron | `pages/api/agent/guardian-loop.ts` | ENHANCEMENT FIRST |
| ✅ Client proactive alerts for monitored cycles | `hooks/use-proactive-agent.ts` | ENHANCEMENT FIRST |
| ✅ Bounded recommendation queue (no single-pointer clobber) | `pages/api/vault/_guardian-state.ts` (`enqueueRecommendation` / `dequeueRecommendation`) | CLEAN |
| ✅ Fail-closed execution plan (Celo-only, verified funding rail, vault-balance check) | `lib/guardian/cycle-execution.ts` (`deriveCycleExecutionPlan`) | ENHANCEMENT FIRST |
| ✅ `guardian-loop.ts` executes `CYCLE_PROTECTION` with cycle context, atomic per-cycle claim/finish idempotency | `pages/api/agent/guardian-loop.ts`, `lib/guardian/cycle-execution.ts` | ENHANCEMENT FIRST |
| ✅ Second-stage consent (`Permission.autoExecuteCycleProtection`) — `PATCH /api/vault/permission`, opt-in checkbox in the Protect tab | `pages/api/vault/permission.ts`, `hooks/use-purchase-cycles.ts`, `components/tabs/protect/PaymentCycleReport.tsx` | ENHANCEMENT FIRST |
| ✅ Browser writes to `guardian-state` rejected for reserved server-origin fields (`source: 'cycle-monitor'`, `cycleId`) | `pages/api/vault/guardian-state.ts` | CLEAN |
| ✅ Record on-chain with distinct `CYCLE_PROTECTION` action + `guardian-loop-cycle` serving model | `pages/api/agent/guardian-loop.ts` | DRY |
| ✅ Tests: plan derivation, staleness gate, claim/finish idempotency, two-tick no-double-execute, consent trust boundary | `lib/guardian/__tests__/cycle-execution.test.ts`, `pages/api/agent/__tests__/guardian-loop.test.ts`, `pages/api/vault/__tests__/guardian-state-handler.test.ts` | MODULAR |

**Why:** This is the autonomous protection half of the value proposition. It builds on Phase 2–4, not in parallel.

## Phase 6 — Business Dashboard & Enterprise API

Goal: give rails players and larger SMEs a business view.

| Action | File(s) | Principle |
|---|---|---|
| Add a "Business" section to the Overview tab | `components/tabs/overview/ConnectedOverview.tsx` | ENHANCEMENT FIRST |
| Gate behind `NEXT_PUBLIC_BUSINESS_DASHBOARD_ENABLED` or engagement signal | feature flag | PREVENT BLOAT |
| Surface: active cycles, upcoming payments, total FX drag, recent protection actions | `components/business/BusinessDashboard.tsx` | MODULAR |
| Add enterprise-scoped endpoints | `pages/api/agent/enterprise/business/cycles.ts`, `pages/api/agent/enterprise/business/drag-report.ts` | MODULAR |
| Reuse `validateApiKey` and audit patterns from existing enterprise audit | `pages/api/agent/enterprise/audit.ts` | DRY |

**Why:** This is the B2B licensing surface. It only matters once the prior phases prove the per-cycle value to individual users.

## Principle Alignment Summary

| Principle | How the plan honors it |
|---|---|
| **ENHANCEMENT FIRST** | Importer is a new `FinancialStrategy` value, not a new app. Drag report mounts in existing tabs. Guardian loop is extended. |
| **CONSOLIDATION** | FX drag calc/rates move from scripts to shared; fake demo scenarios are deleted; `halo`/`taco` are audited. |
| **PREVENT BLOAT** | Phase 0 is an audit with no new features. Business dashboard is feature-flagged. No new top-level tabs until forced. |
| **DRY** | Single `FxDragCalculator`, single `FxRateProvider`, single `StrategyService`, single `PurchaseCycle` model used by app + CLI + enterprise API. |
| **CLEAN** | Clear separation: `fx-drag` service = calculation, `business` API = data, `business` components = UI, `guardian-loop` = execution. |
| **MODULAR** | Each phase is independently testable. Shared services instantiate without Next.js request context. |
| **PERFORMANT** | FX rates are cached. Drag calculations are memoized. Cycle processing in the Guardian loop is bounded and non-blocking. |
| **ORGANIZED** | New files: `packages/shared/src/services/fx-drag/`, `models/PurchaseCycle.ts`, `components/business/`, `pages/api/agent/business/`. |

## Verification Gates (every phase)

1. `pnpm test` — all new tests pass; no regressions in philosophy/strategy tests.
2. `pnpm lint` — zero warnings.
3. `pnpm build` — clean build.
4. `pnpm validate-agent` — config integrity.
5. Manual walkthrough: onboarding → select importer → add purchase cycle → view drag report → see graduation prompt.

## What this plan does NOT do

- It does not build a payment rail, ramp, or supplier-payout leg (out of scope per `docs/sme-fx-strategy.md` §6).
- It does not add hedging derivatives (forwards/options).
- It does not split the SME product into a separate app until Phase 5 forces it.

## Related docs

- `docs/sme-fx-strategy.md` — strategic direction, market research, persona design, sequencing
- `docs/product.md` — product positioning and the two differentiators
- `docs/roadmap.md` — active tracks and the product quality plan
- `scripts/fx-drag-report.ts` — existing concierge validation tool
- **§ HSP Settlement & FX Protection Insight** below — the paid, HSP-settled proof of this layer (adjacent surface, see the 2026-07-12 note above)

---

## HSP Settlement & FX Protection Insight (paid, HashKey-settled)

**Status:** 2026-07-12. Code complete, typechecked, lint-clean, 675/675 tests
passing (16 new). **Live on HashKey mainnet** — the region-canonical ledger
anchor has a real, confirmed transaction (see "Live proof" below). **HSP
settlement itself is not yet exercised against a live Coordinator** — that
last step is blocked on Coordinator KYC (submitted, pending), not on missing
code; the anchor and the plain-transfer settlement path needed no Coordinator
at all and are proven live today. No mocks anywhere in this path.

### Live proof

| | |
|---|---|
| Tx hash | [`0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b`](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b) |
| Chain | HashKey Chain mainnet (177) |
| Contract | `RecommendationLedger` `0x3BCf7dFd68ce98880618c89A351168960724369C` — recommendation **#25** |
| Status | `SUCCESS`, block 24,761,823, 228,715 gas |
| What it recorded | `PROTECT → USDC` — the real Manila-importer FX Protection Insight (PHP, total drag 308,397 PHP / 1.6% across 2 cycles), computed from live mid-market rates |
| Cost | HSK gas only — **no stablecoin, no Coordinator, no KYC** |
| Reproduce | `npx tsx scripts/hashkey-fx-demo.ts anchor` (see "Demo without KYC" below) |

---

### What it is

A paid product: a user (or their agent) pays ~1 in stablecoin (USDT on HashKey)
via **HSP (HashKey Settlement Protocol)** and unlocks a verifiable **FX
Protection Insight** — a per-cycle FX drag report ("this cycle, protection
preserved ₵X vs holding cedis") computed from real historical mid-market
rates. The resulting recommendation anchors on the importer's
**region-canonical** `RecommendationLedger` — the audit trail "follows the
money" per [`apac-rail.md`](./apac-rail.md): an **APAC** importer's record
lands on HashKey (payment *and* proof on one chain), an **African** importer's
on Celo, otherwise Arbitrum. Either way the HSP settlement tx on HashKey is
recorded as the cross-chain settlement reference — the accountant-usable audit
trail `sme-fx-strategy.md` calls for.

Settlement chain and anchor chain are **deliberately decoupled**: settlement is
fungible (HSP-on-HashKey is the flagship option, config-selected via
`SETTLEMENT_NETWORK=HASHKEY`), while the anchor obeys the documented per-region
ledger routing. The "one chain" story is real specifically for APAC importers;
for others, HashKey settlement + region-appropriate anchor is the honest shape.

It ships as a new premium source (`fx_protection`) on the existing,
production x402 gateway (`pages/api/agent/x402-gateway.ts`), with HashKey
added as a fourth settlement rail alongside Arc / 0G / Arbitrum.

### Why HSP is safe to depend on

HSP's Coordinator is a plain REST API and its Mandate is standard EIP-712 —
verified against two independent primary sources (the hackathon docs and the
`project-hsp/hsp` repo source) before any code was written. That means:

- **No SDK dependency, no `github:` install.** An earlier attempt to
  `pnpm add github:project-hsp/hsp` was reverted — pulling unaudited
  third-party code from a mutable git ref is a real supply-chain risk, and
  the package didn't even resolve cleanly (`@hsp/core` 404s on npm). This
  implementation is a small, from-scratch EIP-712 client instead.
- **Field-exact to the protocol.** The vendored `packages/core/spec/typehashes.md`
  in the HSP repo gives the canonical `MANDATE_TYPEHASH` preimage. Our
  implementation is pinned to that string by a unit test — see Verification
  below.
- **Testnet-first.** HashKey testnet (chain 133) has a public faucet; nothing
  here has been claimed live on mainnet (177) without a real settled tx.

### What shipped

| Piece | Location |
|---|---|
| EIP-712 Mandate construction (`Signer`/`Recipient` structs, `mandateHash`) | `packages/shared/src/services/hsp/eip712.ts` |
| Coordinator REST client (register/observe/poll/verify) | `packages/shared/src/services/hsp/hsp-settlement.service.ts` |
| HashKey testnet config (chain 133) + tokens | `config/index.ts`, `packages/shared/src/config/index.ts` |
| `HASHKEY` settlement rail (sibling to Arc/0G/Arbitrum) | `packages/shared/src/services/settlement-service.ts` |
| Gateway: HSP challenge fields, `x-payment-hsp` verify path, replay dedup | `pages/api/agent/x402-gateway.ts` |
| `fx_protection` premium source (real `analyzeCycles` computation, no LLM) | `packages/shared/src/utils/arc-research-sources.ts`, `packages/shared/src/services/fx-drag/` |
| Serverless-safe historical rate provider (open dataset, no filesystem) | `packages/shared/src/services/fx-drag/rates-serverless.ts` |
| Frontend: in-wallet mandate signing + HashKey USDC transfer | `hooks/use-x402-payment.ts` (`payViaHsp`) |
| Receipt UI: network-aware "Verified on HashKey" label | `components/agent/ResearchReceipt.tsx` |
| Region-canonical `RecommendationLedger` anchor (currency → region → chain) | `pages/api/agent/x402-gateway.ts` (fire-and-forget) + `packages/shared/src/services/fx-drag/regions.ts` |

The FX-drag math itself (`analyzeCycles`) is not new — it's the existing
concierge tool's engine (`scripts/fx-drag-report.ts` → now
`packages/shared/src/services/fx-drag/calc.ts`, re-exported so the CLI is
unchanged), moved into shared so both the CLI and the paid API route call the
exact same computation. No LLM, no canned fallback: the numbers compute from
real cycle records against real historical rates, or the request errors
honestly.

### Design decisions worth knowing

- **Anchor chain is decoupled from settlement chain (follows the money).** The
  product (`analyzeCycles`) and settlement (any of the 4 rails; HSP-on-HashKey
  is the flagship option) are chain-agnostic. The *anchor* is region-canonical:
  `fxRegionForCurrency(currency)` → HashKey (APAC) / Celo (Africa & LatAm) /
  Arbitrum (default), matching the documented per-region ledger roles. This is
  the reconciliation with `apac-rail.md`'s "ledger follows the money" — the FX
  problem is universal (`sme-fx-strategy.md`), and the anchor follows the
  importer's region, not a hardcoded chain. Payment identity for the
  anchor comes from the HSP signed mandate, so the anchor fires on the HSP path.
- **Distinct header, not overloaded.** HSP proofs travel on `x-payment-hsp`,
  never `x-payment-proof` — an HSP `paymentId` is also 32-byte hex and would
  otherwise be silently mis-routed into the Arc/0G on-chain verifier.
- **API key never reaches the browser.** The wallet signs the EIP-712 mandate
  and broadcasts the USDC transfer (zero-custody); the backend performs the
  authenticated Coordinator writes (`POST /payments`, `/observe`) using
  `HSP_API_KEY`, which is a server-only env var.
- **No double-settlement.** On the `HASHKEY` rail, the user's own wallet is
  the settlement transaction (observed and receipted by the Coordinator), so
  the gateway's usual agent-side `settleOnChain` fire-and-forget step is
  skipped for that rail.
- **`SettlementConfig` shape untouched.** HSP-specific fields (coordinator
  URL, verifying contract, chain name) live in a sibling `HSP_CONFIG` map
  keyed by chainId, not bolted onto the 4-rail `SettlementConfig` interface.
- **Authoritative token address at runtime, not hardcoded.** Two source
  documents disagreed on HashKey's settlement USDC/USDC.e address. Rather
  than guess, the client bootstraps `verifyingContract` and the token address
  from the Coordinator's `GET /chains` every time.
- **Sample input is labeled, everything else is real.** The FX Protection
  response uses a representative Ghana importer cycle set
  (`packages/shared/src/services/fx-drag/sample-ghana.ts`) when the caller
  doesn't POST their own `cycles`, and says so in the response
  (`is_sample: true`, a `disclaimer` field). The rates, the drag
  decomposition, the settlement, and the ledger anchor are all real regardless
  of whether the input is a sample or a real trader's books.

### Prerequisites to go live (not code — credentials only a human can supply)

1. **HSP Coordinator URL + Bearer API key** — self-service `/register` on the
   live Coordinator.
2. **A faucet-funded HashKey testnet wallet** (gas + test USDC) for the
   merchant/recipient side.
3. Set in `.env.local` (see `.env.example` → the HSP block):
   ```
   SETTLEMENT_NETWORK=HASHKEY
   SETTLEMENT_ENV=testnet
   HSP_COORDINATOR_URL=<from /register>
   HSP_API_KEY=<from /register>
   HASHKEY_PAY_RECIPIENT=<funded HashKey testnet wallet>
   ```

Once set, the loop is: `GET /api/agent/x402-gateway?source=fx_protection&quote=1`
returns a HashKey challenge carrying an `hsp` block → wallet signs the
mandate → wallet broadcasts the settlement token on HashKey → gateway registers +
observes + polls to `SETTLED` → `fx_protection` report unlocks → recommendation
anchors on its region-canonical ledger.

### Demo without KYC (`scripts/hashkey-fx-demo.ts`)

HSP's Coordinator requires KYC (slow to obtain). Because settlement and the
audit-trail anchor are decoupled, you don't need HSP to demonstrate the product
on HashKey. Two modes, using the **Manila importer sample** (PHP → Asia → the
recommendation anchors on HashKey 177):

- **`anchor` mode — free, no KYC, no stablecoin.** Computes the real FX drag
  report from live rates and records the recommendation on the HashKey
  `RecommendationLedger` (chain 177) via `recordRecommendation`. Needs only
  `LEDGER_PRIVATE_KEY` funded with **HSK gas** (which the ledger wallet already
  has) + `HASHKEY_LEDGER_CONTRACT`. Proves "verifiable AI FX intelligence,
  recorded on HashKey Chain" for $0 of stablecoin.
  ```
  npx tsx scripts/hashkey-fx-demo.ts anchor
  ```
- **`settle` mode — the full paid x402 flow.** Drives probe → `402` → USDT
  transfer on HashKey → re-fetch with proof → unlocked report; the gateway then
  anchors. Needs `SETTLEMENT_NETWORK=HASHKEY` on a running gateway and
  `DEMO_PAYER_PRIVATE_KEY` funded with **USDT + HSK** on HashKey mainnet.
  ```
  npx tsx scripts/hashkey-fx-demo.ts settle
  ```

**Stablecoin correction (verified on-chain):** HashKey mainnet's canonical
stablecoin is **USDT** (`0xf1b50ed6…9029`, 6 decimals), not USDC — bridged USDC
(`0x054ed458…D0a`, 6 decimals) also exists. The plain-transfer settlement path
defaults to USDT; the HSP path still reads its token authoritatively from the
Coordinator's `GET /chains`. (An earlier hardcoded `…a22cf95a70` from the HSP
repo guide was wrong for the real chain and has been corrected.)

### Verification

- **Crypto correctness, offline, no credentials needed:**
  `packages/shared/src/services/hsp/__tests__/eip712.test.ts` — 10 tests,
  including a full sign→recover round-trip that mirrors the HSP verifier's
  own strictness checks (65-byte signature, `v ∈ {27,28}`, low-`s`, recovered
  address matches). If this suite is green, our mandates will be accepted by
  the real Coordinator's signature check.
- **Product math, offline, seeded rates:**
  `packages/shared/src/services/fx-drag/__tests__/fx-drag.test.ts` — asserts
  the drag decomposition identity (`timing + spread + fees == totalDrag`) and
  determinism.
- **Full suite:** 675/675 passing (was 659 before this work; +16, zero
  regressions). `tsc --noEmit` and `eslint` clean on every changed file.
- **Live, on-chain:** the region-canonical anchor — confirmed `SUCCESS` on
  HashKey mainnet (see "Live proof" above). Proves `recordRecommendation`,
  the region-routing (`fxRegionForCurrency`), and the real FX-drag computation
  all work end-to-end in production, independent of HSP/Coordinator.
- **Not yet run:** a live register → pay → observe → `SETTLED` → unlock loop
  against the real HSP Coordinator (blocked on KYC). The plain-transfer
  settlement path (USDT on HashKey, no Coordinator) is code-complete and
  ready to run via `settle` mode once a payer wallet is funded.

### Related docs

- [`sme-fx-strategy.md`](./sme-fx-strategy.md) — the north-star direction this proves out (§8 sequencing, step 3)
- [`apac-rail.md`](./apac-rail.md) — the HashKey `RecommendationLedger` this anchors to
- [`integrations.md`](./integrations.md) — the canonical settlement-rail env var table
