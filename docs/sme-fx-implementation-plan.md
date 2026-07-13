# SME FX Layer Implementation Plan

**Status:** In progress (2026-07-13). Phases 0–3 + Guardian trust pass shipped in-app; Phase 5 monitoring/proposals live.  
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

**Status: partial (2026-07-13)** — monitoring opt-in, proposals, and cron tick shipped; `CYCLE_PROTECTION` auto-execution still uses the existing rebalance recommendation path when confidence/permissions allow.

| Action | File(s) | Principle |
|---|---|---|
| ✅ `PurchaseCycle` model + cycles API | `models/PurchaseCycle.ts`, `pages/api/agent/business/cycles.ts` | MODULAR |
| ✅ Compute days-until-payment + proposal contract | `recommendation-contract.ts`, `lib/guardian/cycle-monitor-run.ts` | DRY |
| ✅ Inline cycle monitor in guardian-loop cron | `pages/api/agent/guardian-loop.ts` | ENHANCEMENT FIRST |
| ✅ Client proactive alerts for monitored cycles | `hooks/use-proactive-agent.ts` | ENHANCEMENT FIRST |
| ✅ Bounded recommendation queue (no single-pointer clobber) | `pages/api/vault/_guardian-state.ts` (`enqueueRecommendation` / `dequeueRecommendation`) | CLEAN |
| Extend `guardian-loop.ts` to execute `CYCLE_PROTECTION` with cycle context | `pages/api/agent/guardian-loop.ts` | ENHANCEMENT FIRST |
| Use existing chain-aware routing (Celo for local stables, Arbitrum for USD yield) | `recommendation-ledger.service.ts` | DRY |
| Record on chain-aware ledger + 0G evidence | existing decorators | DRY |
| Tests: cycle-aware recommendation generation | new tests | MODULAR |

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
- `docs/hsp-fx-protection.md` — the paid, HSP-settled proof of this layer (adjacent surface, see the 2026-07-12 note above)
