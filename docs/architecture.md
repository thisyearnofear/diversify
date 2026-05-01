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
| `packages/shared/src/utils/arc-research-sources.ts` | Canonical source pricing/reputation/freshness registry |
| `packages/shared/src/utils/x402-analytics.ts` | Payment/frequency analytics aggregation |
| `pages/api/agent/x402-metrics.ts` | Exposes transaction-frequency and pricing guardrail metrics |
| `packages/shared/src/services/ai/ai-service.ts` | Multi-provider AI with Gemini-first routing and automatic failover |
| `components/agent/AIChat.tsx` | Chat UI — shows provider badge per message, ⚙️ settings for user Gemini key |

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

## Premium Data — Gemini Synthesis

The three premium sources (`macro_analysis`, `portfolio_optimization`, `risk_assessment`)
are **not hardcoded**. Each one:

1. Fetches live data in parallel from World Bank, DeFiLlama, CoinGecko, FRED, Yearn
2. Passes the combined payload to Gemini with a structured JSON prompt
3. Returns a real AI-generated analysis specific to current market conditions
4. Falls back to a structured estimate if Gemini is unavailable

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
