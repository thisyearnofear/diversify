# Integrations & Security

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/vault/create` | POST/GET | Create or check vault |
| `/api/vault/deposit` | POST | Record deposit |
| `/api/vault/withdraw` | POST | Withdraw with fee settlement |
| `/api/vault/balance` | GET | Vault summary (holdings, P&L, fees) |
| `/api/vault/permission` | POST/GET/DELETE | ERC-7715 permission CRUD |
| `/api/vault/rebalance` | POST | Agent-triggered rebalance |
| `/api/vault/transactions` | GET | Transaction history |
| `/api/vault/fees` | GET | Fee summary |
| `/api/status` | GET | System health check |
| `/api/agent/execute-swap` | POST | Execute swap via agent |
| `/api/agent/x402-gateway` | GET | Payment challenge + paid evidence retrieval |
| `/api/agent/x402-metrics` | GET | Transaction-frequency + pricing proof payload |
| `/api/agent/sosovalue` | GET | SoSoValue market intelligence (news, sentiment, SSI index); `?tier=premium` for SSI |
| `/api/agent/zero-g-ledger` | GET/POST | 0G `RecommendationLedger` on-chain recommendations + stats; `?user=0x...` to filter. POST returns `{ status: 'anchored' \| 'pending' \| 'failed', txHash, explorerUrl, id? }`. |
| `/api/agent/guardian-loop` | POST | Autonomous execution cron (server-to-server, secret-protected). Also runs the payment-cycle monitor tick inline (`cycleMonitor` in response). Pending actions live in a bounded `recommendationQueue` (head mirrored as `latestRecommendation`). |
| `/api/agent/business/cycles` | GET/POST | Purchase-cycle CRUD. Requires wallet-signed headers (`x-wallet-auth-message` / `x-wallet-auth-signature`); address is derived server-side. Date pass → `payment_due`; `completed` requires `paymentOutcome`. |
| `/api/agent/business/cycle-monitor` | POST | Standalone cycle-aware proposal tick (same logic as guardian-loop inline step); enqueues without overwriting unrelated pending recommendations |
| `/api/agent/fx-cycle-report` | POST | Free in-app FX drag scenario: current mid-market rate + historical stress context (USD targets only). Not a forecast or locked quote. |
| `/api/agent/firecrawl-webhook` | POST | Receives Firecrawl Monitor macro signal webhooks |

## AI Providers

| Provider | Role | Fallback |
|----------|------|----------|
| **Gemini (Google)** | Primary agent intelligence (Flash for speed, Pro for reasoning) | Venice AI |
| **Venice AI** | Secondary / fallback | AI/ML API |
| **AI/ML API** | 400+ models, OpenAI-compatible endpoint (`deepseek/deepseek-chat`) | NVIDIA |
| **NVIDIA** | OpenAI-compatible, 100+ models, ~40 req/min free tier (`deepseek/deepseek-v4-flash`) | Featherless |
| **Featherless** | OpenAI-compatible fallback | 0G Serving |
| **0G Serving** | Decentralized inference via 0G Router (`deepseek-v4-pro`, `GLM-5.1`, `qwen3.6-plus`) | Modal (GLM) |
| **Modal (GLM)** | Tertiary fallback | Error response |

> **User-supplied keys**: Users can paste their own Gemini API key in the ⚙️ chat settings modal. The key is stored in `localStorage` and forwarded via the `x-gemini-key` request header — it is never persisted server-side. This removes shared rate-limit pressure and qualifies for the Google prize track.

### AI Endpoints & Caching

- All AI responses cached for 5 minutes to reduce API calls
- Rate limit: 60 req/min per provider
- Error taxonomy: timeout → retry once, rate limit → queue, auth error → alert

## Data Providers

| Provider | Data | Rate Limit |
|----------|------|------------|
| **World Bank** | Inflation rates | 10k req/month |
| **FRED** | Economic indicators | 120 req/min |
| **CoinGecko** | Exchange rates | 50k req/month |
| **DeFiLlama** | TVL, yields | 100 req/day |
| **GoodDollar** | UBI distribution | — |
| **SoSoValue** | Flash news + market sentiment → feeds Guardian AI macro awareness (one source among 12+) | Free tier + API key for live data |
| **Firecrawl** | Event-driven macro page monitoring (ECB, Fed, yield trackers) | 500 credits/month free |
| **Cognee** | Agent memory — cross-session persistent context | Tenant API (REST) |

## Autonomous Guardian Loop

The Guardian is a server-side cron (`*/5 * * * *`) that auto-executes portfolio rebalancing within user-approved permission bounds.

```
Firecrawl detects macro change → webhook → AI extracts signal → guardian-state updated
→ cron ticks → guardian-loop checks permissions → confidence > threshold? → auto-execute
→ chain-aware RecommendationLedger records on the chain where the action settled
  (Celo for savings, Arbitrum for yield) → 0G Storage anchors evidence CID → Cognee persists memory
```

| Component | File | Purpose |
|-----------|------|---------|
| Guardian Loop | `pages/api/agent/guardian-loop.ts` | Cron-driven autonomous execution |
| Firecrawl Webhook | `pages/api/agent/firecrawl-webhook.ts` | Macro signal ingestion |
| Firecrawl Setup | `scripts/setup-firecrawl-monitors.ts` | Register page watchers |
| Guardian State | `pages/api/vault/_guardian-state.ts` | Pending recommendation store |
| Cognee Memory | `packages/shared/src/services/cognee-memory-service.ts` | Cross-session learning |

### Security
- `GUARDIAN_LOOP_SECRET` protects the cron endpoint (server-to-server only)
- `FIRECRAWL_WEBHOOK_SECRET` authenticates incoming Firecrawl webhooks
- User's permission bounds are always enforced (daily limit, allowed tokens, expiry). **Enforcement is app-layer**, not on-chain, on the production Celo/Mento path — see `docs/guardian-enforcement-model.md`.
- `GUARDIAN_CONFIDENCE_THRESHOLD` (default 0.6) prevents low-confidence auto-execution
- **ERC-7715 permission integrity:** `/api/vault/permission` POST verifies the EIP-712 typed-data signature against the user's wallet on the server (`ERC7715Service.verifySignedPermission`). Requests with a missing, malformed, or non-recovering signature are rejected with `400` before any permission is persisted. The `signature: 'unsigned'` fallback has been removed.

## x402 Research Payments (Env-Gated Settlement Rail)

DiversiFi’s x402 gateway is the single billing surface for premium intelligence.
The underlying settlement rail is configurable: `ZERO_G` (interim default),
`ARC`, `ARBITRUM`, or `HASHKEY`, in `testnet` or `mainnet` mode. This lets the
same gateway serve hackathon judges on testnet and production consumers on
mainnet without code changes.

`HASHKEY` is a distinct rail: settlement happens zero-custody via **HSP
(HashKey Settlement Protocol)** — the buyer's wallet signs an EIP-712 mandate
and broadcasts the USDC transfer itself, rather than the gateway's usual
agent-side `settleOnChain` fire-and-forget tx. See
[`hsp-fx-protection.md`](./hsp-fx-protection.md) for the full flow and the
`fx_protection` source it powers.

| Component | Responsibility |
|-----------|-----------------|
| `pages/api/agent/_advisor-core.ts` | Decide what evidence is needed before recommending an action |
| `pages/api/agent/x402-gateway.ts` | Issue payment challenge, verify payment, enforce credit drawdown, and return paid evidence |
|| `packages/shared/src/services/settlement-service.ts` | Configurable USDC micro-payment rail (`SETTLEMENT_NETWORK` + `SETTLEMENT_ENV`) |
| Shared source registry | Canonical source IDs, alias mapping, pricing, reputation, and freshness rules |

### Payment Boundary

- The live judge-facing path is: `402` challenge → buyer sends a real USDC transfer on the active settlement rail → gateway verifies the tx hash and nonce.
- Per-action source prices are at or below `$0.01` in the registry — enforced at build time.
- Nonce expiry and replay checks protect against double-spend on payment proofs.
- Every paid request triggers a real `USDC.transfer` on the active rail via `settlement-service.ts`.
- Opaque `circle-gateway-*` proof ids are intentionally not accepted in the judge-facing flow unless server-side verification is explicitly configured.

### Configuring the Rail

Set in `.env.local` or on the server (see `.env.example` → "MAINNET FLIP"):

| Variable | Default | Purpose |
|---|---|---|
| `SETTLEMENT_NETWORK` | `ZERO_G` | Rail: `ZERO_G`, `ARC`, `ARBITRUM`, or `HASHKEY` |
| `SETTLEMENT_ENV` | `testnet` | Environment: `testnet` or `mainnet` |
| `ZERO_G_MAINNET_USDC` | — | Required when `SETTLEMENT_NETWORK=ZERO_G SETTLEMENT_ENV=mainnet` |
| `ARC_MAINNET_USDC` | — | Required when `SETTLEMENT_NETWORK=ARC SETTLEMENT_ENV=mainnet` |
| `ARBITRUM_MAINNET_USDC` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Circle-native USDC on Arbitrum One (override optional) |
| `ARBITRUM_TESTNET_USDC` | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Arbitrum Sepolia USDC (override optional) |
| `HSP_COORDINATOR_URL`, `HSP_API_KEY` | — | Required when `SETTLEMENT_NETWORK=HASHKEY` — from the HSP Coordinator's self-service `/register` |
| `HASHKEY_TESTNET_USDC`, `HASHKEY_MAINNET_USDC` | — | Fallbacks only — the authoritative token address is read from the Coordinator's `GET /chains` at verify time |
| `HASHKEY_PAY_RECIPIENT` | `DATA_HUB_RECIPIENT_ADDRESS` | Merchant payout wallet on HashKey |

To flip to mainnet: fund `VAULT_PRIVATE_KEY`, set the rail's verified mainnet USDC address, and set `SETTLEMENT_ENV=mainnet`.

> **Buildathon recommendation:** For the Arbitrum Open House, use `SETTLEMENT_NETWORK=ARBITRUM` and `SETTLEMENT_ENV=mainnet`. Arbitrum already has a verified, live, Circle-issued USDC contract on chainId 42161, making it the only rail ready for real mainnet payments today. 0G mainnet and Arc mainnet lack a verified USDC contract for settlement.

### Evidence Bundles

- A single recommendation may request multiple sources.
- Each bundle returns source payload, timestamp, cost, confidence, and settlement tx hashes.
- The advisor prefers fresh, high-agreement data and reduces action size when evidence conflicts.
- Premium sources (`macro_analysis`, `portfolio_optimization`, `risk_assessment`) use Gemini to
  synthesise live World Bank / DeFiLlama / CoinGecko / FRED / Yearn data into structured JSON.

### On-Chain Settlement Flow

```text
Client → GET /api/agent/x402-gateway?source=macro_analysis
       ← 402 { nonce, amount: "0.004", currency: "USDC", recipient, chainId,
             settlement_network: "ARBITRUM", settlement_env: "mainnet", expires }
Client → GET /api/agent/x402-gateway?source=macro_analysis
         x-payment-proof: 0x<real_usdc_transfer_tx_hash>
         x-payment-nonce: <challenge_nonce>
       ← 200 { data, _billing: { onChainSettled: true, settlementNetwork: "ARBITRUM",
             settlementEnv: "mainnet", txHashes: ["0x..."],
             explorer: ["https://arbiscan.io/tx/0x..."] } }
```

The example above shows the Arbitrum buildathon default; swap
`settlement_network`/`settlement_env` for `ZERO_G`/`ARC` as needed. Live
settlement metrics and the active explorer are exposed at
`GET /api/agent/x402-metrics` under the `settlement` object (and the legacy
`arcSettlement` alias for backwards compatibility).

## 0G Chain — Evidence Anchor + RecommendationLedger

Every advisor recommendation is recorded on a chain-aware
`RecommendationLedger` — the ledger of record follows the money. 0G is
the **evidence layer**: Storage holds the reasoning CIDs, Compute
provides TEE-verified inference, DA holds state snapshots. The 0G
mainnet hosts the evidence anchor deployment; the chain-aware ledgers of
record live on Celo (savings) and Arbitrum (yield). Galileo Testnet remains
available as a fallback mirror for development.

| Field | Value |
|-------|-------|
|| **0G Mainnet evidence anchor** | chainId `16661`, [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://chainscan.0g.ai/address/0x3BCf7dFd68ce98880618c89A351168960724369C) (overridable via `ZERO_G_MAINNET_LEDGER_CONTRACT`) |
| **Arbitrum Sepolia yield ledger** | chainId `421614`, [`0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996`](https://sepolia.arbiscan.io/address/0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996) |
|| **0G Galileo evidence mirror** | chainId `16602`, [`0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED`](https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED) (overridable via `ZERO_G_LEDGER_CONTRACT`) |
| **Celo mainnet savings ledger** | chainId `42220`, [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://celoscan.io/address/0x3BCf7dFd68ce98880618c89A351168960724369C) |
|| **0G Mainnet RPC** | `https://evmrpc.0g.ai` |
|| **0G Mainnet Explorer** | `https://chainscan.0g.ai` |
|| **0G Galileo RPC / Explorer** | `https://evmrpc-testnet.0g.ai` / `https://chainscan-galileo.0g.ai` |
|| **Write authority** | EOA configured via `LEDGER_PRIVATE_KEY` or `VAULT_PRIVATE_KEY` (automatically authorised on deploy; admin can grant via `setAgentAuthorization`) |

### Recorded fields (per recommendation)

| Field | Type | Purpose |
|-------|------|---------|
| `user` | address | Recipient of the recommendation |
| `action` | string | `SWAP` / `HOLD` / `REBALANCE` / `BRIDGE` |
| `targetToken` | string | e.g. `USDY`, `PAXG` (empty for HOLD) |
| `reasoning` | string | Full AI-generated reasoning text |
| `evidenceCid` | string | 0G Storage CID for the evidence bundle |
| `servingModel` | string | 0G Serving model ID (e.g. `deepseek-v4-pro`) |
| `settlementTxHash` | string | x402 settlement tx hash on the active rail (if a payment was made) |
| `timestamp` | uint256 | Block timestamp |
| `confidence` | uint256 | AI confidence in basis points (0–10000) |

### Verifying the contract

```bash
# Confirm the contract is deployed (use the address printed by
# docs/architecture.md — the live value is 0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED)
curl -s -X POST https://evmrpc-testnet.0g.ai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED","latest"],"id":1}'

# Read live stats + recent recommendations through the API
curl -s https://api.diversifi.famile.xyz/api/agent/zero-g-ledger | python3 -m json.tool
```

### Anchor observability

`recommendationLedgerService.recordRecommendation` returns a discriminated `AnchorResult`. Callers must inspect `result.status` and surface it to the user — never ignore `failed` results.

| Status | Meaning | Surface |
|---|---|---|
| `anchored` | Tx mined, `RecommendationRecorded` event parsed, `id` known | `AIMessage.x402Receipt.anchor` patched in place; `GuardianState.latestAnchor`; `GET /api/vault/permission?userAddress=…` returns it. |
| `pending`  | Tx broadcast but receipt not confirmed within 60 s (network congestion) | Same surfaces; the `txHash` is included so a later re-query by hash can resolve. |
| `failed`   | Broadcast failed, write contract unavailable, or tx reverted | Same surfaces; the `error` text is included. |

The 60-second `tx.wait(1, 60_000)` timeout is the right boundary: a network stall should never block the user-visible chat reply, so the function returns `pending` rather than failing the call. The recommendation may still land on-chain; callers can re-query by `txHash` later.

## DEX & Routing

| Chain | DEX | Router |
|-------|-----|--------|
| **Celo** | Mento Protocol | Built-in stablecoin swaps |
| **Arbitrum** | Uniswap V3, 1inch | LiFi for cross-chain |
| **Hyperliquid** | Perps DEX | Direct API |
| **Robinhood Chain** | AMM | Built-in |

## Circle (CCTP & MPC)

- **CCTP Domains**: Arc → Arbitrum, Arbitrum → Celo (via bridge)
- **MPC Wallets**: Circle MPC for agent fuel tank + Hyperliquid API keys
- **EIP-3009**: USDC transfer with authorization for nanopayments
- **Hackathon Default**: prefer the simplest externally verifiable proof path for judges; keep experimental payment variants out of the core demo unless they are fully verified end to end

## Wallet Integration

Provider priority: Farcaster > MiniPay > Injected > AppKit

```typescript
// Network config example
{
  id: 'celo',
  name: 'Celo',
  nativeCurrency: { symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: 'https://forno.celo.org' },
  blockExplorers: { default: { url: 'https://celoscan.io' } }
}
```

## Security Hardening

### Scripts & Credentials
- Deploy scripts excluded from git (`.gitignore`)
- `.example` files provided with placeholder env vars
- Never commit real credentials or API keys

### MongoDB
- Removed `0.0.0.0/0` access rule
- Use IP whitelisting for production
- Enable encryption at rest

### SSH & Server
- Use SSH keys (no password auth)
- Restrict MongoDB Atlas to server IP only
- Enable firewall on Hetzner server
- Rotate API keys regularly

### Deployment Scripts Security
The following files are git-ignored and must be configured from `.example` templates:
- `start-runtime.sh` — Agent runtime startup
- `pm2.ecosystem.config.cjs` — PM2 process config with env vars
- `deploy-env-to-server.sh` — Environment sync
- `nginx.conf` — Reverse proxy config

The canonical backend deploy is `./scripts/deploy-to-hetzner.sh` (tracked, not gitignored) — see [`scripts/README.md`](../../scripts/README.md) for details.

## Rate Limits & Caching Strategy

| Provider | Limit | Cache Duration |
|----------|-------|----------------|
| Gemini (shared key) | 60 req/min | 5 min |
| Gemini (user key) | User's own quota | 5 min |
| Venice AI | 60 req/min | 5 min |
| World Bank | 10k/month | 24 hrs |
| FRED | 120/min | 1 hr |
| CoinGecko | 50k/month | 1 min |
| DeFiLlama | 100/day | 6 hrs |

## Planned / Explored

The following providers have been evaluated but not yet integrated. See `docs/roadmap.md` →
"Post-9/0 — Full-stack fintech infrastructure" for the strategic rationale.

| Provider | Layer | Chain compatibility | Celo-native? | Relevant regions |
|---|---|---|---|---|
| **Fonbnk** | Onramp | Celo + EVM | ✅ Yes | KE, NG, GH, ZA |
| **Kotani Pay** | Onramp + Offramp | Celo + EVM | ✅ Yes | KE, GH, ZM, NG |
| **Yellow Card** | Onramp + Offramp | Polygon + EVM | ❌ (bridges via USDC) | NG, KE, GH, ZA |
| **Bitso** | Onramp + Offramp | Polygon + EVM | ❌ (bridges via USDC) | MX, BR, AR, CO |
| **Ethena** | Earn (sUSDe) | Ethereum | ❌ | Global |
| **Ondo Finance** | Earn (USDY) | Ethereum + Polygon | ❌ | Global |
| **Aave** | Earn (lending) | Arbitrum + EVM | ❌ | Global |
| **Fluid** | Earn (lending) | Arbitrum + EVM | ❌ | Global |
| **Morpho** | Earn (lending) | Ethereum + Base | ❌ | Global |
| **Yield.xyz** | Earn (managed) | EVM | ❌ | Global |
| **Veda Labs** | Earn (managed) | EVM | ❌ | Global |
| **TransFi** | Onramp + Offramp | Polygon + EVM | ❌ | Global, AE, IN, BR |
| **StraitsX** | Onramp | EVM | ❌ | SG, ID |
| **Coins.ph** | Onramp | EVM | ❌ | PH |
| **MoneyGram** | Offramp | Stellar | ❌ (via Stablecoin bridge) | Global |
| **dLocal** | Onramp + Offramp | EVM | ❌ | BR, MX, AR, CO |
| **Rain** | Card | EVM | ❌ | Global |
| **Wirex** | Card | EVM | ❌ | GB, EU, Global |
| **Bridge** | Card + Virtual ACH + Stablecoin | EVM | ❌ | Global |

---

## Tech Stack Summary

| Category | Technology |
|----------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Smart Accounts | Privy + Safe (ERC-4337) |
| AI | Gemini (primary), Venice AI, AI/ML API, NVIDIA, Featherless, 0G Serving, Modal GLM (fallback chain) |
| Agent Memory | Cognee (cross-session learning) |
| Macro Monitoring | Firecrawl (event-driven page watching) |
| Swaps | Mento Protocol (Celo), 1inch/Uniswap (Arbitrum) |
| Bridging | Circle CCTP, LiFi |
| Hedging | Hyperliquid perps |
| Data | World Bank, FRED, CoinGecko, DeFiLlama |
| Database | MongoDB |
| Agent Identity | ERC-8004 Identity Registry (8004scan, Celo mainnet, agentId 9654), Self Protocol Agent ID (Celo mainnet, agent `0xE8cDb7CA…f170`, real passport verified) |
| Hosting | Vercel (frontend), Hetzner (agent runtime) |

## External Agent Integration Guide

This guide shows how external autonomous agents can consume DiversiFi's
Mento stablecoin intelligence via the x402 payment protocol.

### Overview

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

### Architecture

```
External Agent
    │
    ├── GET /api/agent/x402-gateway?source=macro_analysis
    │       ← 402 { nonce, amount, currency: "USDC", recipient, chainId,
    │             settlement_network, settlement_env, expires }
    │
    ├── USDC.transfer(recipient, amount) on the active settlement rail
    │       → real on-chain tx (Arc or 0G, testnet or mainnet)
    │
    ├── GET /api/agent/x402-gateway?source=macro_analysis
    │       + x-payment-proof: 0x{tx_hash}
    │       + x-payment-nonce: {challenge_nonce}
    │       ← 200 { data, _billing: { onChainSettled, txHashes, explorer,
    │             settlementNetwork, settlementEnv, anchor } }
    │
    └── Intelligence consumed + on-chain proof recorded
```

### Available Intelligence Sources

| Source ID | Description | Price (USDC) |
|---|---|---|
| `macro_analysis` | Mento depeg + inflation macro analysis | ~$0.004 |
| `portfolio_optimization` | Portfolio rebalancing recommendations | ~$0.004 |
| `risk_assessment` | Risk assessment for stablecoin holdings | ~$0.004 |

### Authentication

No API key required. The x402 protocol handles authentication via
on-chain USDC payment. Each request:

1. Receives a unique nonce + payment challenge (including `chainId`,
   `settlement_network`, and `settlement_env`)
2. Requires a real USDC transfer on the configured settlement rail
   (`ZERO_G` or `ARC`, testnet or mainnet) to the specified recipient
3. Is verified by the gateway before intelligence is released

The settlement rail and environment are controlled by `SETTLEMENT_NETWORK`
and `SETTLEMENT_ENV` — see [Configuring the Rail](#configuring-the-rail)
above for the full variable table and mainnet flip instructions.

An optional **enterprise tier** authenticates with an `x-api-key` header
instead of per-request x402 settlement — see
[Enterprise Tier (API-key auth)](#enterprise-tier-api-key-auth).

### Payment Flow

#### Step 1: Request intelligence (receive 402 challenge)

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
  "chainId": 16602,
  "settlement_network": "ZERO_G",
  "settlement_env": "testnet",
  "expires": "2026-07-03T12:00:00Z"
}
```

The `chainId`, `settlement_network`, and `settlement_env` tell the buyer
exactly which rail and environment to pay on. These values follow the
deployment's `SETTLEMENT_NETWORK` and `SETTLEMENT_ENV` configuration.

#### Step 2: Settle payment on the active rail

Send a real USDC transfer on the rail specified by the challenge to the
recipient address. Use the returned `chainId` to select the correct network
in your wallet or provider:

```javascript
const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
const amount = ethers.parseUnits("0.004", 6);
const tx = await usdc.transfer(recipient, amount);
await tx.wait();
```

#### Step 3: Re-request with payment proof

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
    "onChainSettled": true,
    "settlementNetwork": "ZERO_G",
    "settlementEnv": "testnet",
    "txHashes": ["0x..."],
    "explorer": ["https://chainscan-galileo.0g.ai/tx/0x..."],
    "evidenceCids": ["bafy..."],
    "anchor": {
      "status": "anchored",
      "id": 42,
      "chainId": 42161,
      "explorerUrl": "https://arbiscan.io/tx/0x..."
    }
  }
}
```

### Verifying the Intelligence

Every response includes verifiable proof:

1. **0G Storage CID** — the `anchor` field contains a reference to the
   0G Storage evidence bundle. Fetch it from 0G to inspect the full AI
   reasoning, data sources, and prompt.

2. **Chain-aware RecommendationLedger** — the `anchor.chainId` tells you
   which chain the decision was recorded on:
   - Celo mainnet (42220) for savings/Mento stablecoin decisions
   - Arbitrum mainnet (42161) for yield/RWA decisions
   - 0G Galileo (16602) for evidence anchor/mirror

3. **Settlement tx** — the `_billing.txHashes` array contains the
   USDC transfer tx hashes on the active settlement rail. Verify on the
   rail's explorer (returned in `_billing.explorer` and indicated by
   `_billing.settlementNetwork` / `_billing.settlementEnv`).

**Gateway intelligence CIDs.** Every paid Data Hub response also includes
`evidenceCids` in its `_billing` block — one 0G Storage CID per paid
source. Each CID references the exact intelligence payload (analysis, data
sources, model, prompt) returned for that request, so a consumer can
fetch it from 0G and verify the precise output they paid for. This closes
the verifiability gap for the gateway's direct (non-recommendation)
intelligence responses.

### Code Example

See [`examples/external-agent/consume-intelligence.js`](../examples/external-agent/consume-intelligence.js)
for a complete working example in JavaScript.

### Agent Identity (Optional)

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

### Rate Limits

- **Public (x402):** 20 requests per minute per client (IP), with replay
  protection on each payment nonce.
- **Enterprise (API-key):** per-key `rateLimit` defined in `ENTERPRISE_API_KEYS`
  (tier-based, typically higher than the public limit).
- Nonce expiry: 10 minutes
- Replay protection: each nonce can only be used once

### Enterprise Tier (API-key auth)

For licensed B2B consumers who want stable programmatic access without
wiring per-request x402 USDC settlement, DiversiFi offers an additive
API-key path. The public x402 flow is unchanged — the API-key branch is a
parallel authenticator.

#### Configuration

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

#### Request (API-key instead of x402)

```bash
curl https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis \
  -H "x-api-key: <enterprise-key>"
```

Enterprise requests:

- Skip the HTTP 402 payment challenge and the on-chain USDC settlement.
- Are still attributed to the tenant (`tenantId`) for audit purposes.
- Return the same verifiable intelligence payload (0G Storage CID +
  chain-aware `RecommendationLedger` anchor) as a paid x402 request.

#### Enterprise Audit Export

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

### Support

- GitHub: [thisyearnofear/diversify](https://github.com/thisyearnofear/diversify)
- Live gateway: https://api.diversifi.famile.xyz
- Settlement metrics: https://api.diversifi.famile.xyz/api/agent/x402-metrics
