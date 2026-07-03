# 0G Bridge by AKINDO — Implementation Plan

**Program:** [0G Bridge Buildathon](https://0g.ai/) (10 weeks, 5 waves, up to $50K in 0G credits)
**Window:** Wave 1 deadline June 26, 2026 → Demo Day at Token2049 Singapore, Oct 7-8, 2026
**Status:** Wave 1 (scoping) — drafted 2026-06-15
**Authoritative reference for:** 0G component selection, Wave-by-Wave file deltas, principle alignment

This plan lives next to [`roadmap.md`](./roadmap.md), [`architecture.md`](./architecture.md), and [`integrations.md`](./integrations.md). The 0G Bridge track runs alongside the Celo grant and Arbitrum Open House tracks — each chain has a genuine, irreplaceable role. 0G is the evidence/anchoring layer; Celo and Arbitrum are the settlement layers where the ledgers of record live.

---

## 0. Long-term chain architecture (the end state)

The 0G Bridge buildathon frames 0G as replacing Arc for payments. That is a **buildathon-timeline pragmatism**, not the long-term architecture. Arc and 0G serve fundamentally different layers. Conflating them is the architectural mistake this section prevents.

DiversiFi's long-term mainnet stack has four layers, each owned by exactly one chain. The ledger of record follows the money — decisions settle on the chain where the action executes, not on a single canonical chain. 0G is the evidence layer that all ledgers reference.

| Layer | Chain | Why this chain | What it does NOT do |
|---|---|---|---|
| **Savings + Identity** | **Celo** | Regional Mento stablecoins (cUSD, cREAL, KESm, GHSm, etc.), SocialConnect ODIS identity, GoodDollar UBI. No other chain has local-currency stablecoin liquidity. | Agent execution (no EIP-7702), nanopayments, verifiable AI proofs |
| **Execution + Yield** | **Arbitrum** | Deepest USDC + RWA liquidity (Uniswap V3, 1inch, Camelot, PAXG, USDY, SYRUPUSDC). EIP-7702-capable for true on-chain ERC-7710 permission enforcement. | Trust root (ledger demoted to mirror), nanopayments, regional stablecoins |
| **Trust + Verifiability** | **0G** | Content-addressed Storage (evidence CIDs), TEE-verified Compute, DA (state snapshots). No other chain offers storage or verifiable inference. | Nanopayment settlement (gas-token friction — 0G tokens for gas, not USDC), ledger of record (0G is the evidence layer, not the settlement layer) |
| **Money Movement** | **Arc** | USDC-native gas (no volatile token inventory), sub-second deterministic finality, nanopayment economics ($0.000001), built-in FX engine for stablecoin pairs, native Circle Gateway/CCTP/CPN integration. | Verifiable AI proofs, regional stablecoins, deep DEX liquidity |

### The chain-aware ledger resolution

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

### The Arc vs 0G Pay resolution

0G Pay (settling USDC on 0G chain) is a **stopgap** that makes sense while Arc is testnet-only. The moment Arc mainnet lands, Arc should reclaim the payment rail because:

1. **USDC as native gas** — on 0G, settling a $0.001 nanopayment requires holding 0G tokens for gas. On Arc, the gas *is* USDC. The settlement currency and gas currency should match for a payment rail.
2. **Circle Gateway is the x402 standard** — nanopayments powered by Circle Gateway are live on mainnet across 80+ chains. Arc is Circle's native chain for this.
3. **Built-in FX engine** — Arc's institutional-grade RFQ system for stablecoin-to-stablecoin conversion is directly on-mission for DiversiFi's stablecoin savings product.
4. **0G's value is verifiability, not payments** — using 0G as a payment rail underutilizes its unique strengths (Storage, Compute, DA) and introduces gas-token friction that Arc eliminates by design.

### Migration phases

| Phase | Timeline | Payment rail | Trust layer | Notes |
|---|---|---|---|---|
| **1 — Buildathon** | Now – Aug 2026 | 0G Pay (interim default) | 0G mainnet canonical (Wave 3) | `SETTLEMENT_NETWORK=ZERO_G`. Arc stays configured but testnet-only. |
| **2 — Arc mainnet beta** | When Arc mainnet lands (est. 2026) | Arc (flip default) | 0G mainnet canonical | `SETTLEMENT_NETWORK=ARC`. 0G Pay becomes fallback. One-line config change. |
| **3 — Arc mainnet stable** | Post-beta | Arc canonical | 0G canonical | Arc = payments, 0G = verifiability. These never overlap again. Explore Arc FX engine for major pairs (USDC/EURC), complementing Mento regional pairs on Celo. CCTP bridge Arc → Arbitrum for yield execution. |

### What this means for the codebase

- **Do not delete Arc-specific infrastructure.** `ArcAgent`, `arc-research-sources.ts`, Curve/AeonDEX strategies, and `use-arc-balance` all have long-term value once Arc mainnet lands.
- **`DEFAULT_SETTLEMENT_NETWORK` is the single switch.** The `SETTLEMENT_NETWORK` env var controls the rail without code changes. The x402 gateway and Guardian loop both read from this default.
- **0G's canonical role is unchanged regardless of payment rail.** Storage, Compute, DA, and the trust ledger are 0G's permanent domain. The payment rail question is orthogonal to the verifiability question.

---

## 1. Principle alignment (the filter for every file we touch)

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

## 2. 0G components — owned by existing files

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

## 3. Pre-Wave-1 audit (prevent-bloat gate)

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

## 4. Wave-by-Wave file deltas

For each wave: principle alignment, file changes, verification gate, and the buildathon submission artifact that the change supports.

### Wave 1 — Scoping & 0G integration plan (June 13-26, $5K)

**Goal:** submit the buildathon's required Project Information + Code Repository + Documentation + public X post. No net-new code. All work is documentation, config, and the Phase 0 audit.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `docs/0g-bridge-plan.md` | (this file) | new, ~400 | ORGANIZED |
| `docs/roadmap.md` | Add 0G Bridge section that supersedes the "Arbitrum Submission Roadmap (Active)" block once Wave 1 is submitted. Reference `0g-bridge-plan.md` as authoritative. | +20 | ORGANIZED |
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
- `docs/0g-bridge-plan.md` is merged to main.
- Public X post with `#0GBridge #BuildOn0G` tagging `@0G_labs @0G_Builders @AKINDO_io` is live.

**Submission artifact (Wave 1):** this file (or its top section) becomes the "Project Information" + "Architecture diagram" sections of the AKINDO submission form.

---

### Wave 2 — Testnet integration & demo (June 27 - July 10, $7.5K)

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

### Wave 3 — Mainnet deployment (July 11-24, $15K, the highest-allocated wave)

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

### Wave 4 — Traction & user acquisition (July 25 - August 7, $10K)

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

### Wave 5 — Growth & Demo Day (August 8-21, $12.5K)

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

## 5. Risk register (per Wave)

| Risk | Likelihood | Impact | Mitigation | Principle |
|---|---|---|---|---|
| 0G mainnet RPC is unreliable at submission time | Medium | High (blocks Wave 3) | Use `x402-proxy.mjs` (existing) to pay-per-request, or fall back to a public RPC + 3 retries with exponential backoff. | PERFORMANT |
| ERC-7857 spec evolves between Wave 3 and Wave 5 | Medium | Medium | Keep `AgenticID.sol` minimal; wrap, don't extend OpenZeppelin. Easy to redeploy. | MODULAR |
| 0G Compute Direct TEE proofs add >15s latency | Low | Medium | Direct path is gated on `confidence > 0.8`; low-confidence decisions use the Router path. | PERFORMANT |
| Arbitrum ledger is required by the Arbitrum Open House reviewers | Medium | Medium | `recommendationLedgerService` is chain-aware — Arbitrum mainnet hosts the yield ledger of record. The chain-aware routing serves both tracks. | DRY |
| 0G Pay USDC contract differs on mainnet | Medium | Low | `ZERO_G_DATA_HUB_CONFIG.USDC_TESTNET` is already env-overridable. Add `USDC_MAINNET` and switch the default in Wave 3. | DRY |
| Wave 1 submission is late (deadline June 26) | High if not done this week | High (lose $5K) | This document IS the Wave 1 submission. Submission deadline: June 26, 2026 23:59 UTC. | (action item, see below) |

---

## 6. Action items for this week (Wave 1 close-out)

These are the only tasks that should run between now and the June 26 Wave 1 deadline. They are the Phase 0 audit + the Wave 1 file deltas above.

1. **Fix A1, A2, A3, A4, A5** in a single PR (one commit per finding, one principle per commit message).
2. **Open a docs PR** that adds this file + the `docs/roadmap.md` and `docs/architecture.md` updates.
3. **Update `.env.example`** with the new 0G mainnet keys.
4. **Run `pnpm test && pnpm lint && pnpm validate-agent`** and screenshot the green output for the submission.
5. **Draft the AKINDO submission form fields** (project name, one-liner, summary, integration list) from the top of this doc.
6. **Schedule the X post** for June 25, 2026 (24h before deadline) with a demo GIF and the `#0GBridge #BuildOn0G` tags.

The Wave 1 submission is otherwise a packaging exercise. The hard work (the 0G integration) is already in the repo.

---

## 7. Cross-references

- Project context: [`README.md`](../README.md)
- Architecture: [`docs/architecture.md`](./architecture.md)
- All integrations: [`docs/integrations.md`](./integrations.md)
- Quality roadmap: [`docs/roadmap.md`](./roadmap.md)
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
um template): [`scripts/DeployArbitrum.s.sol`](../scripts/DeployArbitrum.s.sol)
- Deploy-all script: [`scripts/deploy-all.sh`](../scripts/deploy-all.sh)
