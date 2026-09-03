# Roadmap Log — historical waves & file deltas

> Extracted from roadmap.md during the doc consolidation. Advisory log of what shipped per wave; **not** the forward plan — see [roadmap.md](./roadmap.md).

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
| `packages/shared/src/services/ai/providers/zero-g-provider.ts` | Add a `useDirectCompute: boolean` option that, when true, calls the 0G Compute Direct API for TEE-verified inference. The `withTimeout` window tightens to 15s for the direct path (TEE proofs add latency). **Done** — Direct is the Router `verify_tee: true` path (same API key, fail-closed on `tee_verified !== true`). Wallet-SDK Direct is deferred: it pulled nested `@noble/hashes` copies that crash vitest collect. | +35 | MODULAR, PERFORMANT |
| `packages/shared/src/services/ai/fallback/fallback-orchestrator.ts` | Route high-confidence decisions (`confidence > 0.8`) through the 0G Compute Direct provider; low-confidence decisions stay on the Router API path. **Done.** Guardian recs pass `confidence: 0.85`. Direct miss falls through to the Router-order chain. | +20 | PERFORMANT |
| `packages/shared-0g/src/services/persistence-service.ts` | Add a `snapshotGuardianState` method that writes the full Guardian state to 0G mainnet DA once per Guardian loop cycle (not on every decision). Reads are unchanged. | +25 | PERFORMANT, MODULAR |
| `pages/api/agent/guardian-loop.ts` | After the recommendation record, fire a `snapshotGuardianState` to 0G DA. Awaited, not fire-and-forget — DA is a state checkpoint, not a receipt. | +8 | PERFORMANT |
| `contracts/AgenticID.sol` | (new) Minimal ERC-721 Guardian identity with 7857-inspired pointer semantics (not a complete ERC-7857 implementation): `mint(to, agentURI, encryptedURI)` with the URIs pointing at the agent doc + encrypted evidence bundle in 0G Storage. Ownable2Step, single contract, no on-chain AI. The actual Guardian is an off-chain service; the on-chain ID is a transferable pointer (721 transfers emit 7857-style `AgentTransferred`; `updateAgent` re-points as the bundle grows). **Done** — 16 Foundry tests pass. Deployment to 0G mainnet pending gas. | +190 | MODULAR, CLEAN |
| `scripts/DeployAgenticID.s.sol` | (new) Deploy script for `AgenticID.sol` to 0G mainnet (`--rpc-url zero_g_mainnet`). **Done.** | +30 | ORGANIZED |
| `scripts/DeployCelo.s.sol` | (new) Deploy script for `RecommendationLedger` on Celo mainnet. Mirrors `DeployArbitrum.s.sol`. | +90 | ORGANIZED |
| `scripts/deploy-all.sh` | Add `celo_mainnet` and `zero_g_mainnet` targets. | +30 | ORGANIZED |
| `packages/shared/src/services/recommendation-ledger.service.ts` (+ `pages/api/agent/zero-g-ledger.ts`) | Explorer **source verification**: `verifyLedgerTx(txHash, chainId)` answers "is this evidence link real?" from the chain's RPC (authoritative receipt) instead of the 0G explorer, which exposes no reliable public API. Exposed at `GET /api/agent/zero-g-ledger?verify=<txHash>`; 0G mainnet (16661) added to `PROOF_FEED_CHAIN_IDS` so evidence-mirror rows surface in the live proof feed with chainscan links. **Done** — 7 vitest cases. | +110 | DRY, CLEAN |
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
- Agentic ID is minted for at least 1 test user; the on-chain ID points to a 0G Storage CID. *(Contract + deploy script shipped and tested; mint pending 0G mainnet deployment.)*
- ~~Explorer source verification so proof links are backed by chain data.~~ **Done** — `verifyLedgerTx` + `?verify=` + 0G rows in the proof feed.
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

