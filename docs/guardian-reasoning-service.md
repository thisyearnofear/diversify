# Unified Guardian Reasoning Service — Design Draft

> **Status:** draft (2026-09-05). Not yet implemented. This is the architecture
> plan for closing the "three Guardians, one name" gap documented in
> `docs/guardian.md` § Guardian architecture notes → *Boundary note*.
>
> **Guiding constraint:** money movement is frozen until Phase 2. Phases 0–1
> are pure refactors with golden tests proving byte-identical behaviour; the
> executor and its single choke point (`VaultService.rebalance`) are never
> touched by this workstream.

---

## 1. The problem (verified in code)

Three surfaces make Guardian-shaped decisions under one name, each with its own
reasoning implementation and its own on-chain wording:

| Surface | Where the decision is made today | Reasoning style |
|---|---|---|
| **Savings Guardian loop** (auto-executes) | `apps/web/pages/api/agent/guardian-loop.ts` | Eligibility *gates* (tier, consent, caps, staleness, cycle rules) inline in the cron; candidates arrive pre-formed from queue writers (advisor, cycle-monitor, firecrawl) |
| **Heartbeat** (advisory, on-chain) | `apps/web/pages/api/agent/guardian-heartbeat.ts` → `pickRecommendation` | Deterministic thresholds over a 3-source snapshot (inflation / yield / prices) |
| **Arc marketplace agent** (pays for its data) | `packages/shared/src/services/guardian/*`, orchestrated by `agent-service.ts` | Data-rich context (`GuardianAnalysisDataService.gatherContext` — paid pulse/inflation/yields) → LLM recommendation (`GuardianRecommendationService`) → execution/post-analysis services |

**Consequences of the split:**

- An honesty or provenance fix in one surface (the heartbeat fallback work, the
  actual-debit budget work) must be re-implemented in the others by hand.
- The heartbeat and the loop cannot consume the Arc agent's richer analysis,
  and the Arc agent ignores the loop's hard-won gate logic — so the same market
  state can produce contradictory advice on different surfaces.
- On-chain `reasoning` text is composed at each call site, so wording,
  source-labelling, and the "no fallback figures" disclosure drift between
  surfaces even when the underlying decision agrees.
- The two *UI* contracts already share a type (`GuardianRecommendationContract`
  six-question contract + `recommendation-contract.ts` builders) — the *decision*
  layer underneath never got the same treatment.

## 2. Goal

One shared reasoning domain in `packages/shared` that every surface consumes:

```
gather signals (provenance-tracked)
        → draft (deterministic synthesizer = the floor)
        → optional AI rank/explain WITHIN the gates (never instead of them)
        → eligibility verdict (pure gates)
        → ONE artifact: shape + six-question contract + on-chain reasoning text
```

The executor stays exactly as it is: `VaultService.rebalance` as the single
choke point that re-validates a fresh permission before `circleExecutor`
signs. **Reasoning produces what-and-why; the gates authorize; the executor
moves.** That separation is the whole point.

## 3. Non-goals (kept honest)

- **AI never authorizes.** The deterministic gates are the binding floor for
  drafts AND for AI-ranked candidates (an AI suggestion that fails a gate is
  declined the same way a rule draft is).
- **No custody change.** This does not move the ERC-7715 app-layer enforcement
  status or the hybrid chain-enforcement plan in `docs/guardian.md`. It makes
  the *reasoning* single-sourced; enforcement stays a separate workstream.
- **No paid data on the free cron surfaces.** The heartbeat and loop keep free
  sources; the paid Arc context stays behind the existing free-first gates.
- **No new Mongo collections in Phases 0–1.**
- **No UI rebuild.** The drawer already renders the six-question contract; the
  artifact unification feeds it.

## 4. Two-layer model

### Layer A — deterministic gates (the floor)

Pure functions extracted from today's inline checks, each:

```ts
type Gate = (ctx: { permission?: VaultPermission; draft: GuardianDraft;
                     signals: GuardianSignalBundle; now?: number }) =>
            { allowed: boolean; reason?: string };
```

**Reasoning gates** (what may be proposed / auto-executed), inventoried from
current code — extraction must preserve each rule exactly:

| # | Gate | Today's home |
|---|---|---|
| G1 | Autonomy tier: only `GUARDIAN` auto-executes | `guardian-loop.ts` consent gate |
| G2 | First-execution consent (`totalSpentUSD>0` or `firstAutoExecutionConfirmed`) | `guardian-loop.ts` |
| G3 | Permission expiry / status | `guardian-loop.ts` + `VaultService.rebalance` |
| G4 | Confidence ≥ threshold (0.6) | `guardian-loop.ts` `CONFIDENCE_THRESHOLD` |
| G5 | Trade size: ≥ $1 and ≤ remaining daily headroom | `guardian-loop.ts` |
| G6 | Destination-token allowlist (symbols or `*`) | `guardian-loop.ts` + `VaultService.validateSwap` |
| G7 | Daily cap keyed to **actual debit** (`usdDebitOfAmountIn`) | `packages/shared/src/services/vault/vault.service.ts` (new) |
| G8 | Total cap keyed to actual debit | same |
| G9 | Staleness ≤ 60 min for queued candidates | `guardian-loop.ts` |
| G10 | Cycle gates (monitoring on, in window, permission bounds fit) | `guardian-loop.ts` cycle branch |
| G11 | **Data liveness**: a draft may assert a condition only if its driving signal is live — the heartbeat honesty rule, generalized to all surfaces | `guardian-heartbeat.ts` (recent fix) |

**Deliberately NOT gates** (execution concurrency, not reasoning): the per-user
execution lock, dequeue-before-execute idempotency, cycle claim. These stay in
the loop — they protect *execution*, and moving them into shared reasoning
would blur the two concerns.

A `GatesEvaluator` aggregates gates into one `EligibilityVerdict`
(`eligible | declined(reasons[])`). Because they are pure, every gate gets
exhaustive unit tests, and the same evaluator runs in all three surfaces.

### Layer B — reasoning (what and why)

**`GuardianSignalBundle`** — typed observations, replacing ad-hoc snapshot
shapes:

```ts
interface GuardianSignal {
  key: string;          // 'inflation.us.cpi' | 'yield.stable.topApy' | 'price.btc' | 'pulse.sentiment' ...
  value: number | string;
  unit?: string;
  source: string;       // 'world-bank' | 'defillama' | 'coingecko' | 'market-pulse' | ...
  live: boolean;        // false ⇒ must never be quoted as observed
  capturedAt: string;
}
```

Invariant (mirrors the heartbeat fix + Wave 8 honesty rule): **a signal with
`live:false` cannot enter reasoning text or gate math.** Producers map provider
failures to `live:false`, never to a plausible-looking value.

**Deterministic synthesizer** — the heartbeat's `pickRecommendation`
generalized to a `SignalBundle` → `GuardianDraft`. Free, deterministic, and the
default for the loop + heartbeat. In Phase 0 it must reproduce today's
reasoning **byte-for-byte** (golden tests) so extraction is provably safe.

**Optional AI ranker** — the Arc path today (`GuardianAnalysisDataService` +
`GuardianRecommendationService`) becomes an optional Layer-B strategy behind
the free-first gate. It may enrich *context* and *explain*, but its output
passes through the same `GatesEvaluator`; a candidate that fails G1–G11 is
declined identically to a rule draft. The existing `getFallbackRecommendation`
in `agent-service.ts` already proves the "deterministic floor under an AI
path" pattern — it becomes the shared synthesizer instead of a private method.

## 5. The unified artifact

Every surface emits the same `GuardianDecision`, so the proof feed, the
drawer, and the ledger agree:

```ts
interface GuardianDecision {
  id: string;
  createdAt: string;
  surface: 'guardian-loop' | 'heartbeat' | 'arc-marketplace';
  draft: GuardianDraft;                     // action, targetToken, amountUsd, confidence
  signals: GuardianSignal[];                // which sources, which were live
  verdict: EligibilityVerdict;              // gate outcome + reasons
  contract: GuardianRecommendationContract; // six-question, via shared builders
  onChainReasoning: string;                 // ONE shared text builder
}
```

**One `buildAdvisoryReasoning(decision, cohort?)`** produces the on-chain
`reasoning` string everywhere (data points with live sources, unavailable-
source disclosure, cohort framing). `servingModel` keeps its role as the
*origin* label (`guardian-loop` / `guardian-heartbeat` /
`guardian-heartbeat-mirror` / `guardian-loop-cycle` / the agent's own). Same
facts, same wording, different origin stamps — that is the unification.

## 6. Consumer mapping

| Surface | Today | After Phase 0 | After Phase 2 |
|---|---|---|---|
| Heartbeat | snapshot → `pickRecommendation` | snapshot → shared `synthesizeSignals` → shared synthesizer (byte-identical) | synthesizer + optional AI rank over free signals; gates G1–G11 unchanged |
| Loop | queue writers → inline gates → execute | queue writers → shared draft → `GatesEvaluator` (identical rules) → execute | same, plus memory (Cognee) feeds context, never authority |
| Arc agent | private gather/LLM/fallback pipeline | LLM output parsed into the shared draft + gates (fallback = shared synthesizer) | full: paid context behind free-first gate, AI explains within gates |

## 7. Migration phases

**Phase 0 — extraction, zero behaviour change (safe to run pre-deadline).**
Move into `packages/shared/src/services/guardian-reasoning/`:
- types (`GuardianSignal`, `GuardianDraft`, `EligibilityVerdict`, `Gate`)
- `pickRecommendation` from the heartbeat → `deterministicSynthesizer`
  (consumed by the heartbeat, which re-imports it)
- the heartbeat's honesty provenance (`live` flags) as `synthesizeSignals`
- the `usdDebitOfAmountIn`-based cap helpers (already shared) surfaced through
  the gate API

Gate: golden tests asserting the synthesizer output (action / token /
confidence / reasoning) is **identical** to today's heartbeat output across
live, partial-down, and all-down fixtures (the heartbeat tests already pin
this). No behaviour delta.

**Phase 1 — artifact unification.**
Loop + heartbeat `recordRecommendation` call sites emit `buildAdvisoryReasoning`
from a shared `GuardianDecision`; the Arc path stamps the same shape. Cross-
surface golden tests: identical (draft, cohort) ⇒ identical on-chain text.

**Phase 2 — intelligence behind flags.**
Wire the analysis services into the savings surfaces as an *optional* Layer-B
ranker (env-gated, free sources only). Feed Cognee memory in as context (cohort
preferences, past decisions) so the same user does not get contradicting
advice week to week.

**Phase 3 — cross-surface evaluation harness.**
A decision replay harness (mocked providers + frozen clock, the pattern the
loop tests already use) that drives all three surfaces from the same signal
fixture and asserts identical verdicts and artifacts.

## 8. Invariants & tests (regardless of phase)

1. Fallback data is never labelled live (heartbeat test suite, generalized to
   `synthesizeSignals`).
2. A decision only asserts a condition whose driving signal was live.
3. Daily/total caps bind the actual debit, not the estimate.
4. One on-chain wording per (draft, cohort) across all three surfaces.
5. AI-ranked candidates pass the exact same `GatesEvaluator` as rule drafts.
6. Deterministic synthesizer output is stable (same signals → same draft).
7. Executor call sites and the rebalance choke point are untouched by Phases
   0–1 (enforced by not importing executor modules into the reasoning domain).

## 9. Open questions (implementation-time, not blockers)

- **Confidence source on the AI path.** Rule drafts carry fixed confidence
  (0.72 / 0.68 / 0.65 / 0.6). An AI ranker could propose its own confidence —
  bounded by the same threshold gate — or keep surface-fixed confidences and
  use the LLM only for ordering + explanation. Prefer the latter (fewer moving
  parts in the trust story).
- **On-chain reasoning length budget.** Ledger anchoring costs scale with text;
  richer signal bundles must not bloat `reasoning`. `buildAdvisoryReasoning`
  should compress to a fixed budget with full detail in the decision record /
  0G mirror.
- **Decision record ownership.** The proof feed already renders anchors +
  journaled declines; Phase 1 artifacts should attach to that surface without
  a second UI concept.

## 10. Related code

- Extraction source: `apps/web/pages/api/agent/guardian-heartbeat.ts`
  (`pickRecommendation`, `fetchMarketSnapshot` honesty work)
- Gate source: `apps/web/pages/api/agent/guardian-loop.ts` +
  `packages/shared/src/services/vault/vault.service.ts` (`validateSwap`,
  `usdDebitOfAmountIn`)
- AI-path source: `packages/shared/src/services/guardian/*` +
  `agent-service.ts` (`GuardianAnalysisDataService.gatherContext`,
  `GuardianRecommendationService.generateRecommendation`,
  `getFallbackRecommendation`)
- Shared contract types: `packages/shared/src/types/guardian-protection.ts`
  (six-question contract), `services/guardian/recommendation-contract.ts`
  (builders)
- Trust model + enforcement deferral: `docs/guardian.md`
