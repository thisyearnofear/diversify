# SME FX Layer Implementation Plan

**Status:** Drafted 2026-07-12 (sequenced plan). Phase 0's shared-service move is now done via an adjacent track — see the note below.  
**Purpose:** Close the gap between the aligned docs vision (FX-risk intelligence + philosophy moat) and the actual app. The importer wedge stays inside the existing app as an archetype until forced by demand, per `docs/sme-fx-strategy.md` §8.

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
| Move report renderer into shared | New: `packages/shared/src/services/fx-drag/fx-drag-report-renderer.ts` (from `scripts/fx-drag-report.ts` render functions) — **not yet done**, only the calc engine moved | DRY |
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

| Action | File(s) | Principle |
|---|---|---|
| Add shared types | `packages/shared/src/types/fx-drag.ts` or `types/purchase-cycle.ts` | CLEAN |
| Add `PurchaseCycle` Mongoose model | `models/PurchaseCycle.ts` | MODULAR |
| Add CRUD API | `pages/api/agent/business/cycles.ts` | CLEAN |
| Reuse existing wallet/session auth | existing auth middleware | DRY |
| Tests: model + API | new tests | MODULAR |

**Model sketch:**

```ts
interface PurchaseCycle {
  userAddress: string;
  label: string;
  currency: string; // e.g. 'GHS'
  revenues: Array<{ date: Date; amountLocal: number }>;
  payment: { date: Date; amountUsd: number; achievedRate?: number; feesLocal?: number };
  rampCostBps: number;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}
```

**Why:** A purchase cycle is the only genuinely new concept from `docs/sme-fx-strategy.md` §5. Everything else reuses the existing pattern.

## Phase 3 — Self-Serve Per-Cycle FX Drag Report

Goal: turn the concierge script into an in-app, self-serve report.

| Action | File(s) | Principle |
|---|---|---|
| Add API to compute drag report from cycles | `pages/api/agent/business/drag-report.ts` | MODULAR |
| Reuse `analyzeCycles` (shared, done) + a report renderer (shared, not yet done) | `packages/shared/src/services/fx-drag/*` — `calc.ts` and `rates-serverless.ts` are ready to import; see `pages/api/agent/x402-gateway.ts`'s `getFxProtection()` for a working (paid, agent-facing) reference of the same pattern | DRY |
| Create `BusinessDragReport` component | `components/business/BusinessDragReport.tsx` (or `components/tabs/overview/BusinessDragReport.tsx`) | ENHANCEMENT FIRST |
| Mount it in the Overview/Protection tab for importer users | `components/tabs/overview/ConnectedOverview.tsx` or `components/tabs/ProtectionTab.tsx` | ENHANCEMENT FIRST |
| Add Markdown/CSV export | reuse `FxDragReportRenderer` | DRY |
| Tests: end-to-end drag report with sample cycles | `scripts/__tests__/fx-drag-calc.test.ts` (extend) | MODULAR |

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

| Action | File(s) | Principle |
|---|---|---|
| Extend `guardian-loop.ts` to read active cycles | `pages/api/agent/guardian-loop.ts` | ENHANCEMENT FIRST |
| Compute days-until-payment per cycle | reuse `FxDragCalculator` | DRY |
| If close to payment (e.g., ≤ 7 days) and exposed, generate a `CYCLE_PROTECTION` recommendation | existing recommendation flow | ENHANCEMENT FIRST |
| Use existing confidence threshold, permission bounds, and execution path | existing `guardian-loop.ts` | DRY |
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
