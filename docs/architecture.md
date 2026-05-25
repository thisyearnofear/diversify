# Architecture

## System Goal

DiversiFi's hackathon path is a paid-evidence recommendation loop:

1. User asks advisor whether to hold, rebalance, or hedge.
2. Advisor requests evidence from paid/free sources.
3. `x402-gateway` enforces payment before returning premium evidence.
4. Evidence bundle is scored for freshness, reputation, and agreement.
5. Advisor returns an action card (`HOLD`, `REBALANCE`, `HEDGE`, `SWAP`).

## Request Flow

```text
User -> /api/agent/advisor
     -> /api/agent/x402-gateway?source=...
        -> 402 challenge (nonce + expires + amount)
        -> payment proof/mandate validation
        -> source fetch + billing metadata
     -> evidence scoring
     -> action recommendation
```

## Key Components

| Component | Responsibility |
|-----------|----------------|
| `pages/api/agent/_advisor-core.ts` | Decides required evidence and produces recommendations |
| `pages/api/agent/x402-gateway.ts` | Payment challenge, nonce validation, premium data access, billing |
| `pages/api/agent/sosovalue.ts` | SoSoValue market intelligence endpoint (news, sentiment, SSI index) |
| `lib/sosovalue.ts` | Shared SoSoValue API client — single source of truth used by gateway and sosovalue route |
| `packages/shared/src/utils/arc-research-sources.ts` | Canonical source pricing/reputation/freshness registry |
| `packages/shared/src/utils/x402-analytics.ts` | Payment/frequency analytics aggregation |
| `pages/api/agent/x402-metrics.ts` | Exposes transaction-frequency and pricing guardrail metrics |
| `packages/shared/src/services/ai/ai-service.ts` | Multi-provider AI with Gemini-first routing and automatic failover |
| `components/agent/AIChat.tsx` | Chat UI — shows provider badge per message, ⚙️ settings for user Gemini key |
| `components/agent/SoSoIntelligenceCard.tsx` | Inline card rendering SoSoValue news, sentiment, and SSI index in chat |
| `components/agent/SoSoActionModal.tsx` | Trade proposal confirmation modal triggered from SoSoValue news items |

## AI Provider Routing

```text
Request → Gemini (primary, Flash/Pro)
              ↓ fail / rate-limit
          Venice AI (secondary)
              ↓ fail
          Modal GLM (tertiary)
              ↓ fail
          Error
```

User-supplied Gemini key flow:
```text
localStorage["diversifi_user_gemini_key"]
  → x-gemini-key header on /api/agent/advisor
  → server temporarily overrides GEMINI_API_KEY for that request
  → Gemini client uses user's quota (no shared rate-limit pressure)
```

## Real Arc On-Chain Settlement

Every paid research request fires a real USDC micro-transaction on Arc testnet:

```text
Premium request (paid tier)
  → x402 payment verified (credit deducted)
  → getActualPremiumData() → Gemini synthesises live data
  → settleOnArc(cost, sourceId)
      → USDC.transfer(HUB_ADDR, amount) via EOA on Arc
      → returns { txHash, explorer } in _billing
  → response includes _billing.txHashes[] + _billing.explorer[]
```

Settlement is **fire-and-forget** (non-blocking): the gateway waits up to 1.5s
for the tx hash, then returns regardless. Mining confirmation happens in background.

| Component | File |
|---|---|
| Settlement module | `packages/shared/src/services/arc-settlement.ts` |
| Agent EOA | `VAULT_PRIVATE_KEY` env var |
| USDC contract | `ARC_TOKENS.USDC` (0x3600...0000) |
| Hub recipient | `DATA_HUB_RECIPIENT_ADDRESS` env var |
| Explorer | `https://testnet.arcscan.app/address/<agent>` |

## 0G Integration (Verifiable Intelligence — Full Stack)

DiversiFi uses the full 0G stack as its "Truth Layer". Every advisor recommendation is verifiably traceable from inference → evidence → on-chain record:

- **0G Serving (Decentralized Inference):** Recommendations can be generated through the 0G Router API (OpenAI-compatible) as part of the AI failover chain. Default model `deepseek-v4-pro`, with `zai-org/GLM-5.1-FP8` and `qwen3.6-plus` available.
- **0G Storage (Evidence Commit):** Every premium research payload is hashed and uploaded to 0G Storage, with the resulting CID persisted in the analysis result. This provides an immutable audit trail for all advisor recommendations.
- **0G DA (State Persistence):** The agent serializes its internal context (preferences, risk profile) to 0G Data Availability after every analysis, ensuring resilience across serverless executions.
- **0G Chain — `RecommendationLedger`:** Every recommendation is recorded on 0G Galileo Testnet (chainId `16602`), linking user → action → evidence CID → serving model → settlement tx → confidence. The contract is the queryable, immutable ledger of all advisor output.

### Deployed Contracts (0G Galileo Testnet, chainId 16602)

| Contract | Address | Purpose |
|----------|---------|---------|
| `RecommendationLedger` | [`0x8b8528dE95178b77d46CF5A9612C1C9FCc53740f`](https://chainscan-galileo.0g.ai/address/0x8b8528dE95178b77d46CF5A9612C1C9FCc53740f) | Immutable record of every AI recommendation |

### Components

| Component | Responsibility |
|-----------|----------------|
| `contracts/RecommendationLedger.sol` | On-chain ledger contract (struct: user, action, targetToken, reasoning, evidenceCid, servingModel, settlementTxHash, confidence) |
| `packages/shared/src/services/recommendation-ledger.service.ts` | ethers.js write/read client for the ledger contract |
| `packages/shared-0g/src/services/storage-service.ts` | 0G Storage interface for evidence commitment |
| `packages/shared-0g/src/services/persistence-service.ts` | 0G DA interface for agent state persistence |
| `packages/shared/src/services/settlement-service.ts` | Cross-chain settlement (supports 0G and Arc) |
| `pages/api/agent/zero-g-ledger.ts` | Public API surfacing on-chain ledger reads + stats |
| `components/agent/VerifiableAIDashboard.tsx` | In-app dashboard rendering full Serving → Storage → Chain trace |

### End-to-End 0G Trace (per recommendation)

```text
Advisor request
  → 0G Serving (inference, e.g. deepseek-v4-pro)   ─┐
  → premium data + reasoning                        │  Serving model ID
  → 0G Storage.upload(evidenceBundle)               │  → evidenceCid
  → Arc x402 settlement (optional)                  │  → settlementTxHash
  → RecommendationLedger.recordRecommendation(...)  │  → on-chain id, txHash
                                                     ▼
                          chainscan-galileo.0g.ai/tx/<txHash>
```

```text
macro_analysis      → WorldBank + CoinGecko + FRED  → AI (Gemini / 0G Serving) → JSON
portfolio_optimization → DeFiLlama + Yearn + CoinGecko → AI (Gemini / 0G Serving) → JSON
risk_assessment     → WorldBank + CoinGecko + FRED  → AI (Gemini / 0G Serving) → JSON
```

### Required Environment

| Var | Purpose |
|-----|---------|
| `ZERO_G_RPC_URL` | 0G Galileo Testnet RPC (default `https://evmrpc-testnet.0g.ai`) |
| `ZERO_G_LEDGER_CONTRACT` | Deployed `RecommendationLedger` address (defaults to `0x75C0…1495`) |
| `ZERO_G_STORAGE_URL` | 0G Storage endpoint |
| `ZERO_G_INDEXER_URL` | 0G Storage indexer |
| `ZERO_G_SERVING_API_KEY` | API key for 0G Serving inference (optional — enables 0G in AI failover) |
| `VAULT_PRIVATE_KEY` | EOA authorised to write to `RecommendationLedger` |

## Payment Design Notes

- Payment challenge includes `nonce` and `expires`.
- Buyer proofs accepted in the judge-facing flow are real Arc tx hashes plus the issued nonce.
- Payment proofs are replay-checked in-memory for prototype safety; move this to Redis/DB for multi-instance production.
- Per-action source prices are capped at `<= 0.01 USDC` in registry.
- Free-tier sources can be fetched without payment until free limit is exhausted.
- `/api/agent/x402-metrics` derives `totalSettledPayments` from Arc USDC `Transfer` logs for the agent wallet; app analytics remain supplementary.
- If runtime analytics reset after a deploy, `/api/agent/x402-metrics` now derives `successRate`, `topSources`, and `recentSpending` from the same chain evidence and exposes `observabilityMode: chain_derived_fallback`.
- Real on-chain settlement requires `VAULT_PRIVATE_KEY` and a funded Arc testnet wallet.

## Demo Evidence Surface

Use `/api/agent/x402-metrics` as the canonical demo evidence endpoint for:

- chain-derived settled payment count
- recent Arc settlement tx hashes
- total settled USDC from the live agent wallet
- success rate
- top paid sources
- recent spending cadence
- explicit observability mode
- maximum configured per-action price

This endpoint should be shown in the demo recording alongside Arc Explorer transaction proof.
