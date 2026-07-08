# Integration Guide — DiversiFi Intelligence Gateway

This guide shows how external autonomous agents can consume DiversiFi's
Mento stablecoin intelligence via the x402 payment protocol.

## Overview

DiversiFi exposes an x402-gated intelligence gateway that any agent can
consume. The gateway provides:

- **Mento depeg intelligence** — real-time stablecoin depeg risk analysis
  for cUSD, cEUR, cREAL, KESm, COPm, PHPm, and other Mento regional stables
- **Inflation intelligence** — regional inflation data synthesized from
  World Bank, FRED, CoinGecko, and DeFiLlama sources
- **Yield intelligence** — RWA yield opportunity analysis (PAXG, USDY,
  SYRUPUSDC) on Arbitrum
- **Verifiable evidence** — every response includes a 0G Storage CID and
  a chain-aware RecommendationLedger entry

## Architecture

```
External Agent
    │
    ├── GET /api/agent/x402-gateway?source=macro_analysis
    │       ← 402 { nonce, amount, currency: "USDC", recipient, expires }
    │
    ├── USDC.transfer(recipient, amount) on Arc
    │       → real on-chain tx
    │
    ├── GET /api/agent/x402-gateway?source=macro_analysis
    │       + x-payment-proof: 0x{tx_hash}
    │       + x-payment-nonce: {challenge_nonce}
    │       ← 200 { data, _billing: { arcSettled, txHashes, anchor } }
    │
    └── Intelligence consumed + on-chain proof recorded
```

## Available Intelligence Sources

| Source ID | Description | Price (USDC) |
|---|---|---|
| `macro_analysis` | Mento depeg + inflation macro analysis | ~$0.004 |
| `portfolio_optimization` | Portfolio rebalancing recommendations | ~$0.004 |
| `risk_assessment` | Risk assessment for stablecoin holdings | ~$0.004 |

## Authentication

No API key required. The x402 protocol handles authentication via
on-chain USDC payment. Each request:

1. Receives a unique nonce + payment challenge
2. Requires a real USDC transfer on Arc to the specified recipient
3. Is verified by the gateway before intelligence is released

An optional **enterprise tier** authenticates with an `x-api-key` header
instead of per-request x402 settlement — see
[Enterprise Tier (API-key auth)](#enterprise-tier-api-key-auth).

## Payment Flow

### Step 1: Request intelligence (receive 402 challenge)

```bash
curl https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis
```

Response (HTTP 402):
```json
{
  "nonce": "abc123...",
  "amount": "0.004",
  "currency": "USDC",
  "recipient": "0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8",
  "expires": "2026-07-03T12:00:00Z"
}
```

### Step 2: Settle payment on Arc

Send a real USDC transfer on Arc to the recipient address:

```javascript
const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
const amount = ethers.parseUnits("0.004", 6);
const tx = await usdc.transfer(recipient, amount);
await tx.wait();
```

### Step 3: Re-request with payment proof

```bash
curl https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis \
  -H "x-payment-proof: 0x{tx_hash}" \
  -H "x-payment-nonce: {challenge_nonce}"
```

Response (HTTP 200):
```json
{
  "data": {
    "analysis": "...",
    "recommendations": [...],
    "confidence": 0.85
  },
  "_billing": {
    "arcSettled": true,
    "txHashes": ["0x..."],
    "explorer": ["https://testnet.arcscan.app/tx/0x..."],
    "anchor": {
      "status": "anchored",
      "id": 42,
      "chainId": 42161,
      "explorerUrl": "https://arbiscan.io/tx/0x..."
    }
  }
}
```

## Verifying the Intelligence

Every response includes verifiable proof:

1. **0G Storage CID** — the `anchor` field contains a reference to the
   0G Storage evidence bundle. Fetch it from 0G to inspect the full AI
   reasoning, data sources, and prompt.

2. **Chain-aware RecommendationLedger** — the `anchor.chainId` tells you
   which chain the decision was recorded on:
   - Celo mainnet (42220) for savings/Mento stablecoin decisions
   - Arbitrum mainnet (42161) for yield/RWA decisions
   - 0G Galileo (16602) for evidence anchor/mirror

3. **Settlement tx** — the `_billing.txHashes` array contains the Arc
   USDC transfer tx hashes. Verify on Arcscan.

**Gateway intelligence CIDs.** Every paid Data Hub response also includes
`evidenceCids` in its `_billing` block — one 0G Storage CID per paid
source. Each CID references the exact intelligence payload (analysis, data
sources, model, prompt) returned for that request, so a consumer can
fetch it from 0G and verify the precise output they paid for. This closes
the verifiability gap for the gateway's direct (non-recommendation)
intelligence responses.

## Code Example

See [`examples/external-agent/consume-intelligence.js`](../examples/external-agent/consume-intelligence.js)
for a complete working example in JavaScript.

## Agent Identity (Optional)

If your agent has a Self Protocol Agent ID (ERC-8004 compliant), you can
include the Self Protocol signing headers for sybil-resistant authentication:

```javascript
import { getSelfSigningAgent } from '@diversifi/shared';

const agent = getSelfSigningAgent();
const res = await agent.fetch(`${GATEWAY_URL}/api/agent/x402-gateway?source=macro_analysis`);
```

This attaches three headers:
- `x-self-agent-address` — the agent's Ethereum address
- `x-self-agent-signature` — ECDSA signature
- `x-self-agent-timestamp` — Unix timestamp

## Rate Limits

- **Public (x402):** 20 requests per minute per client (IP), with replay
  protection on each payment nonce.
- **Enterprise (API-key):** per-key `rateLimit` defined in `ENTERPRISE_API_KEYS`
  (tier-based, typically higher than the public limit).
- Nonce expiry: 10 minutes
- Replay protection: each nonce can only be used once

## Enterprise Tier (API-key auth)

For licensed B2B consumers who want stable programmatic access without
wiring per-request x402 USDC settlement, DiversiFi offers an additive
API-key path. The public x402 flow is unchanged — the API-key branch is a
parallel authenticator.

### Configuration

Enterprise keys are configured server-side via the `ENTERPRISE_API_KEYS`
environment variable — a JSON array of key objects:

```json
[
  {
    "key": "<long-random-string>",
    "tenantId": "acme",
    "tier": "enterprise",
    "rateLimit": 200,
    "quotaUsd": 5000,
    "audit": true
  }
]
```

### Request (API-key instead of x402)

```bash
curl https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis \
  -H "x-api-key: <enterprise-key>"
```

Enterprise requests:

- Skip the HTTP 402 payment challenge and the Arc on-chain USDC settlement.
- Are still attributed to the tenant (`tenantId`) for audit purposes.
- Return the same verifiable intelligence payload (0G Storage CID +
  chain-aware `RecommendationLedger` anchor) as a paid x402 request.

### Enterprise Audit Export

`GET /api/agent/enterprise/audit` — requires a valid `x-api-key` header.
Returns the tenant's verifiable recommendation history: the on-chain
`RecommendationLedger` entry (Celo / Arbitrum / 0G) enriched with the full
0G Storage evidence bundle (prompt, model, reasoning).

Query parameters:

| Param | Description |
|---|---|
| `user` | Optional wallet address. If set, reads the chain-aware ledger **directly for that wallet** (any address, no tenant needed). |
| `from` / `to` | Optional Unix-ms bounds (tenant scope only). |
| `chainId` | Restrict to a single ledger chain (e.g. `42220`, `42161`, `16602`). |
| `format` | `json` (default) or `csv`. |

```bash
# Tenant-scoped JSON export
curl https://api.diversifi.famile.xyz/api/agent/enterprise/audit \
  -H "x-api-key: <enterprise-key>"

# Wallet-scoped CSV export with chain + time filters
curl "https://api.diversifi.famile.xyz/api/agent/enterprise/audit?user=0xabc...&chainId=42161&from=1750000000000&format=csv" \
  -H "x-api-key: <enterprise-key>"
```

JSON response shape (one row per recommendation):

```json
{
  "tenantId": "acme",
  "scope": "tenant",
  "count": 42,
  "rows": [
    {
      "recommendationId": 42,
      "chainId": 42161,
      "explorerUrl": "https://arbiscan.io/tx/0x...",
      "action": "SWAP",
      "targetToken": "cUSD",
      "confidence": 9200,
      "timestamp": 1750000000000,
      "settlementTxHash": "0x...",
      "evidenceCid": "bafy...",
      "evidence": { "prompt": "...", "model": "...", "reasoning": "..." }
    }
  ]
}
```

Off-chain tenant attribution lives in `models/TenantRecommendation.ts`
(Mongo) — the on-chain ledger records `user` as a wallet address, so the
tenant mapping is maintained separately and surfaced by this endpoint.

## Support

- GitHub: [thisyearnofear/diversify](https://github.com/thisyearnofear/diversify)
- Live gateway: https://api.diversifi.famile.xyz
- Settlement metrics: https://api.diversifi.famile.xyz/api/agent/x402-metrics
