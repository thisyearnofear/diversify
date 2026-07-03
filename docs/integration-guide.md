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

- 60 requests per minute per source
- Nonce expiry: 10 minutes
- Replay protection: each nonce can only be used once

## Support

- GitHub: [thisyearnofear/diversify](https://github.com/thisyearnofear/diversify)
- Live gateway: https://api.diversifi.famile.xyz
- Settlement metrics: https://api.diversifi.famile.xyz/api/agent/x402-metrics
