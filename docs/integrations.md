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
| `/api/agent/guardian-loop` | POST | Autonomous execution cron (server-to-server, secret-protected) |
| `/api/agent/firecrawl-webhook` | POST | Receives Firecrawl Monitor macro signal webhooks |

## AI Providers

| Provider | Role | Fallback |
|----------|------|----------|
| **Gemini (Google)** | Primary agent intelligence (Flash for speed, Pro for reasoning) | Venice AI |
| **Venice AI** | Secondary / fallback | AI/ML API |
| **AI/ML API** | 400+ models, OpenAI-compatible endpoint (`deepseek/deepseek-chat`) | 0G Serving |
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
→ 0G RecommendationLedger records on-chain → Cognee persists memory
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
- User's ERC-7715 permission bounds are always enforced (daily limit, allowed tokens, expiry)
- `GUARDIAN_CONFIDENCE_THRESHOLD` (default 0.6) prevents low-confidence auto-execution
- **ERC-7715 permission integrity:** `/api/vault/permission` POST verifies the EIP-712 typed-data signature against the user's wallet on the server (`ERC7715Service.verifySignedPermission`). Requests with a missing, malformed, or non-recovering signature are rejected with `400` before any permission is persisted. The `signature: 'unsigned'` fallback has been removed.

## Arc Research Payments

DiversiFi’s hackathon path should reuse the current Arc/x402 gateway as the single billing surface.

| Component | Responsibility |
|-----------|-----------------|
| `pages/api/agent/_advisor-core.ts` | Decide what evidence is needed before recommending an action |
| `pages/api/agent/x402-gateway.ts` | Verify payment, enforce credit drawdown, and return paid evidence |
| Shared source registry | Canonical source IDs, alias mapping, pricing, reputation, and freshness rules |

### Payment Boundary

- The live judge-facing path is: `402` challenge → buyer sends a real Arc USDC transfer → gateway verifies the tx hash and nonce.
- Per-action source prices are at or below `$0.01` in the registry — enforced at build time.
- Nonce expiry and replay checks protect against double-spend on payment proofs.
- Every paid request triggers a real `USDC.transfer` on Arc via `arc-settlement.ts`.
- Opaque `circle-gateway-*` proof ids are intentionally not accepted in the judge-facing flow unless server-side verification is explicitly configured.

### Evidence Bundles

- A single recommendation may request multiple sources.
- Each bundle returns source payload, timestamp, cost, confidence, and Arc tx hashes.
- The advisor prefers fresh, high-agreement data and reduces action size when evidence conflicts.
- Premium sources (`macro_analysis`, `portfolio_optimization`, `risk_assessment`) use Gemini to
  synthesise live World Bank / DeFiLlama / CoinGecko / FRED / Yearn data into structured JSON.

### On-Chain Settlement Flow

```text
Client → GET /api/agent/x402-gateway?source=macro_analysis
       ← 402 { nonce, amount: "0.004", currency: "USDC", recipient, expires }
Client → GET /api/agent/x402-gateway?source=macro_analysis
         x-payment-proof: 0x<real_arc_usdc_transfer_tx_hash>
         x-payment-nonce: <challenge_nonce>
       ← 200 { data, _billing: { arcSettled: true, txHashes: ["0x..."], explorer: ["https://testnet.arcscan.app/tx/0x..."] } }
```

Real tx verifiable at `https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8`

## 0G Chain — RecommendationLedger

Every advisor recommendation is recorded on the 0G Galileo Testnet via the `RecommendationLedger` contract. This is the immutable, queryable ledger of agent output and links the full 0G Serving → 0G Storage → 0G Chain trace.

| Field | Value |
|-------|-------|
| **Network** | 0G Galileo Testnet (chainId `16602`) |
| **Contract** | [`0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED`](https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED) (overridable via `ZERO_G_LEDGER_CONTRACT`) |
| **RPC** | `https://evmrpc-testnet.0g.ai` |
| **Explorer** | `https://chainscan-galileo.0g.ai` |
| **Write authority** | EOA configured via `VAULT_PRIVATE_KEY` (automatically authorised on deploy; admin can grant via `setAgentAuthorization`) |
| **Public API** | `GET /api/agent/zero-g-ledger` |

### Recorded fields (per recommendation)

| Field | Type | Purpose |
|-------|------|---------|
| `user` | address | Recipient of the recommendation |
| `action` | string | `SWAP` / `HOLD` / `REBALANCE` / `BRIDGE` |
| `targetToken` | string | e.g. `USDY`, `PAXG` (empty for HOLD) |
| `reasoning` | string | Full AI-generated reasoning text |
| `evidenceCid` | string | 0G Storage CID for the evidence bundle |
| `servingModel` | string | 0G Serving model ID (e.g. `deepseek-v4-pro`) |
| `settlementTxHash` | string | Arc x402 settlement tx hash (if a payment was made) |
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

The 60-second `tx.wait(1, 60_000)` timeout is the right boundary: a 0G Galileo network stall should never block the user-visible chat reply, so the function returns `pending` rather than failing the call. The recommendation may still land on-chain; callers can re-query by `txHash` later.

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
- `deploy-hetzner.sh` — Server deployment script
- `start-runtime.sh` — Agent runtime startup
- `pm2.ecosystem.config.cjs` — PM2 process config with env vars
- `deploy-env-to-server.sh` — Environment sync
- `nginx.conf` — Reverse proxy config

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
| AI | Gemini (primary), Venice AI, AI/ML API (fallback), Modal GLM (tertiary) |
| Agent Memory | Cognee (cross-session learning) |
| Macro Monitoring | Firecrawl (event-driven page watching) |
| Swaps | Mento Protocol (Celo), 1inch/Uniswap (Arbitrum) |
| Bridging | Circle CCTP, LiFi |
| Hedging | Hyperliquid perps |
| Data | World Bank, FRED, CoinGecko, DeFiLlama |
| Database | MongoDB |
| Hosting | Vercel/Netlify (frontend), Hetzner (agent runtime) |
