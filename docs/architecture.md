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

## 0G Integration (Verifiable Intelligence)

DiversiFi leverages the 0G ecosystem as its "Truth Layer":
- **Evidence Commit (0G Storage):** Every premium research payload is hashed and uploaded to 0G Storage, with the resulting CID persisted in the analysis result. This provides an immutable audit trail for all advisor recommendations.
- **State Persistence (0G DA):** The agent serializes its internal context (preferences, risk profile) to 0G Data Availability (DA) after every analysis, ensuring resilience and persistence across serverless executions.

| Component | Responsibility |
|-----------|----------------|
| `packages/shared/src/services/storage-service.ts` | 0G Storage interface for evidence commitment |
| `packages/shared/src/services/persistence-service.ts` | 0G DA interface for agent state persistence |
| `packages/shared/src/services/settlement-service.ts` | Cross-chain settlement (supports 0G and Arc) |

```text
macro_analysis      → WorldBank + CoinGecko + FRED  → Gemini Flash → JSON
portfolio_optimization → DeFiLlama + Yearn + CoinGecko → Gemini Flash → JSON
risk_assessment     → WorldBank + CoinGecko + FRED  → Gemini Flash → JSON
```

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
