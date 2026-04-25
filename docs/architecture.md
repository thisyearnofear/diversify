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

## Payment Design Notes

- Payment challenge includes `nonce` and `expires`.
- Proofs are replay-checked in-memory for demo safety.
- Per-action source prices are capped at `<= 0.01 USDC` in registry.
- Free-tier sources can be fetched without payment until free limit is exhausted.
- Analytics counter (`x402Analytics`) is in-memory — pump with `pnpm test-x402-comprehensive` after each server start before recording demo.

## Demo Evidence Surface

Use `/api/agent/x402-metrics` as the canonical demo evidence endpoint for:

- settled payment count
- success rate
- top paid sources
- maximum configured per-action price

This endpoint should be shown in the demo recording alongside Circle Console + Arc Explorer transaction proof.
