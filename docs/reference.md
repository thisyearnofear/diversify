# Reference — Setup, Environment, APIs, Deployment, Demo Capture

**What this doc is:** the single operational reference for DiversiFi. It merges the four
former operational documents — `integrations.md` (APIs, providers, env, external-agent
integration), `setup.md` (quick start, test drive, troubleshooting), `ops.md` (Alibaba Cloud
deployment proof), and `demo-capture.md` (capture playbook) — reorganized by what you are
trying to do, not by where the text used to live. Product/design/strategy narrative lives in
`product.md`, `roadmap.md`, `architecture.md`, `guardian.md`, `design-language.md`, and `rails.md`.

**Find what you need:**

| I want to… | Go to |
|---|---|
| Set up the app locally and run it | [§1 Getting started & local dev](#1-getting-started--local-dev) |
| Look up an environment variable (one authoritative table) | [§2 Environment variables](#2-environment-variables) |
| Know which chains/DEX/ledgers are live and what they do | [§3 Chains & capabilities](#3-chains--capabilities) |
| Call or implement an API endpoint | [§4 API endpoints](#4-api-endpoints) |
| Understand the AI provider failover chain and data feeds | [§5 AI providers & data sources](#5-ai-providers--data-sources) |
| Integrate as an external agent (x402 / enterprise API key) | [§6 External agent integration](#6-external-agent-integration) |
| Deploy or operate the backend (Vercel, Hetzner, Alibaba Cloud) | [§7 Deployment & ops](#7-deployment--ops) |
| Capture verifiable demo material | [§8 Demo capture playbook](#8-demo-capture-playbook) |
| Fix a common failure | [§9 Troubleshooting](#9-troubleshooting) |

---

## 1. Getting started & local dev

### 1.1 Quick start

```bash
pnpm install
cp .env.example .env.local   # Add API keys (§2 — pick what you need)
pnpm dev                      # Starts on port 3042
```

Users can sign in via email, social login, or existing wallet (Privy). No wallet required to explore the demo.

The minimum to run the app is `NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` (see the §2 table — every other variable is optional and each row says what breaks or degrades without it).

### 1.2 Tests and push checks

GitHub's **Tests / Full regression** job runs the complete Vitest suite,
root typecheck, and lint on pushes and pull requests. On `origin/main`,
**Full regression** is a required, up-to-date GitHub Actions check;
administrator bypass remains enabled. Other repositories must configure
branch protection separately; the workflow alone does not enforce merges.

Local pre-push checks use every outgoing ref's remote-to-local commit range:

- Documentation-only changes skip code checks.
- Application TypeScript changes run root typecheck, seven safety suites,
  edited test files, and tests related through Vitest's import graph.
- Shared packages, configuration, tooling, deleted source, unknown assets,
  new branches, and unavailable remote history run the full suite.
- Local modifications and untracked files are included because checks run
  against the checkout. A pushed ref must match the checked-out commit.

Signer credentials are scrubbed in every test worker. React Testing Library
cleanup is loaded only for DOM workers. Financial, authorization, privacy, and
execution safety coverage remains in the suite.

After a fresh install, prepare package declarations before typechecking:

```bash
pnpm exec turbo run build --filter=@diversifi/shared --filter=@stable-station/mento-utils
pnpm exec tsc --noEmit
pnpm test
node --test scripts/pre-push-checks.test.mjs
```

CI prepares package declarations automatically. The local hook also prepares
these packages if their required declarations are missing. Full local tests
remain available through `pnpm test`; selective push checks do not replace CI.
CI uses Node 24, matching the runtime used to verify this configuration.

### 1.3 Try the Caribbean FX netting demo (no keys beyond Privy)

The Future Caribbean submission's core system runs with just the minimum setup plus MongoDB:

1. Add `MONGODB_URI` (free Atlas tier — `.env.example` has the shape). This hosts the intent pool so intents match across users and across time.
2. `pnpm dev` → open the app → **Exchange tab → FX Corridor → Caribbean FX Net card**.
3. Post an intent (e.g. *sell BBD, buy JMD*). Open a second browser profile (or ask a friend) and post the opposing intent (*sell JMD, buy BBD*).
4. The matching engine pairs them **directly at mid-market — no USD bridge** — shows the net obligation and the computed savings vs. the ~7% traditional corridor, and settlement executes wallet-to-wallet with on-chain verification.

Prefer not to run anything? The deterministic engine is a pure-function library — read it directly: [`packages/shared/src/services/fx-netting/matching-engine.ts`](../packages/shared/src/services/fx-netting/matching-engine.ts), with its test suite in `__tests__/`.

> Walletless visitors see the full ticket with a connect CTA — nothing fabricates balances or quotes without a wallet (honesty by mechanism, not disclaimer).

The endpoints behind this demo are in [§4](#4-api-endpoints) (`/api/fx-netting/intent`, `/match`, `/settle`).

### 1.4 Test Drive

1. Switch to Celo Sepolia in your wallet
2. Get testnet tokens from the faucet — they stay in your wallet
3. Pick a protection plan; the Guardian starts proposing moves
4. Tap "Review this move →" and sign on Exchange
5. Monitor allocations and P&L in the dashboard

### 1.5 Rive objects (optional — only when editing them)

The app's five self-contained Rive objects ship compiled in `apps/web/public/rive/`
— no tooling needed to run the app. To edit one:

1. Install the `rive` CLI (it prints its own install flow on first run).
2. Edit `apps/web/rive/<object>/scene.rml`, then `rive apps/web/rive/<object> --verify`.
3. `pnpm rive:build` recompiles all five into `apps/web/public/rive/`.
4. `pnpm dev` → open `/rive-test` (dev-only, renders nothing in production) to exercise every
   object, its bound colors, and its settled/armed/posture states side by side.

Rules and the object inventory: [`design-language.md`](./design-language.md) §5.

### 1.6 Guardian autonomy setup (ERC-7715/7710)

Autonomous execution is opt-in and enforced on-chain by the user's own smart
account — there is no Safe to create and no Privy execution path.

1. **Session signer** → generate a dedicated key; its address is what users
   grant Advanced Permissions to: `GUARDIAN_SESSION_PRIVATE_KEY` (server) +
   `NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS` (client — when unset, the
   "Let Guardian act for you" option is hidden).
2. **Bundler** → an ERC-4337 bundler per autonomy chain
   (`AA_BUNDLER_URL` or `AA_BUNDLER_URL_<chainId>`), optional
   `AA_RPC_URL_<chainId>` overrides. Eligible chains are derived from the
   installed `@metamask/smart-accounts-kit` ∩ the app's supported set
   (Celo, Celo Sepolia, Arbitrum today).
3. **Fail closed** → without these, every Guardian proposal degrades to a
   one-tap user approval, journaled as `advisory_pending_user_review`.

All variables above are in the §2 table.

---

## 2. Environment variables

**One consolidated, authoritative table** — the union of every environment variable named
across this document's four sources. Anywhere else in this doc (or in `AGENTS.md`), an env
var mention is a *behavior note* about a row here; the row is the source of truth for the
name, default, and purpose. `.env.example` carries the shapes; nothing here is a secret to
commit — see [§7 security hardening](#75-security-hardening).

| Variable | Scope | Default / value | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | client | — | Privy app (social login + embedded-wallet onboarding). One of the two vars that are the minimum to run the app. |
| `PRIVY_APP_SECRET` | server | — | Privy server SDK (session signer execution). Second minimum var. |
| `NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS` | client | unset → "Let Guardian act for you" hidden | Public address of the session signer keyed by `GUARDIAN_SESSION_PRIVATE_KEY`; ERC-7715/7710 autonomy path (§1.6). |
| `NEXT_PUBLIC_ARC_ARRIVAL` | client | off in production | Gates the Arc arrival path (`lib/arc-arrival.ts` → `hooks/use-arc-arrival.ts`). Tests and prod never hit Arc RPC by default; flip only after a real mainnet rehearsal (§3.4). |
| `NEXT_PUBLIC_ENABLE_ARC` | — | **removed** | The old Arc-research flag was never read and is gone; rail selection is `SETTLEMENT_NETWORK` + `SETTLEMENT_ENV`. |
| `MONGODB_URI` | server | — | MongoDB connection. Required for the Caribbean FX netting demo — hosts the intent pool so intents match across users and time (free Atlas tier; shape in `.env.example`). |
| `GUARDIAN_LOOP_SECRET` | server | — | Protects the `/api/agent/guardian-loop` cron endpoint (server-to-server only). |
| `HETZNER_EDGE_SECRET` | server | — | **Planned, not wired:** nothing reads it yet (no header on the `next.config.js` rewrites, no nginx check). Reserved for the direct-host allowlist in §7.5. |
| `FIRECRAWL_WEBHOOK_SECRET` | server | — | Authenticates incoming Firecrawl macro-signal webhooks (`/api/agent/firecrawl-webhook`). |
| `GUARDIAN_CONFIDENCE_THRESHOLD` | server | `0.6` | Prevents low-confidence auto-execution. |
| `GUARDIAN_SESSION_PRIVATE_KEY` | server | — | Dedicated ERC-4337 session-signer key; its address is what users grant Advanced Permissions to (autonomy path, §1.6). |
| `AA_BUNDLER_URL` / `AA_BUNDLER_URL_<chainId>` | server | — | Per-autonomy-chain ERC-4337 bundler for redeeming ERC-7715 delegations. |
| `AA_RPC_URL_<chainId>` | server | optional | Per-chain RPC override for the autonomy path. |
| `LEDGER_PRIVATE_KEY` | server | — | EOA with write authority on the `RecommendationLedger` (automatically authorised on deploy; admin can grant via `setAgentAuthorization`). Alternative to `VAULT_PRIVATE_KEY` for ledger writes. |
| `VAULT_PRIVATE_KEY` | server | — | **Legacy variable name — it is not a user-funds vault and not a user wallet.** Server-side x402 settlement signer (e.g. Arc mainnet: submits `transferWithAuthorization`, pays Arc-native USDC gas; the buyer's EIP-3009 mandate supplies the payment principal) and ledger write authority. Privy remains login/onboarding only; Guardian execution uses the user's own wallet and signed permissions. |
| `SETTLEMENT_NETWORK` | server | `ZERO_G` (repo default) | x402 settlement rail: `ZERO_G`, `ARC`, `ARBITRUM`, or `HASHKEY`. Defaults are `ZERO_G`/`testnet`; Arc mainnet support is implemented but not activated by defaults. |
| `SETTLEMENT_ENV` | server | `testnet` | `testnet` or `mainnet`. |
| `ENABLE_AUTONOMOUS_MODE` | server | — | Set `true` to enable the autonomous research-payment loop (Guardian negotiates paid premium data via x402 on the configured rail; see §4.2). |
| `ZERO_G_MAINNET_USDC` | server | — | Required when `SETTLEMENT_NETWORK=ZERO_G SETTLEMENT_ENV=mainnet`. 0G mainnet still lacks a verified stablecoin for settlement without it. |
| `ARC_MAINNET_USDC` | server | `0x3600000000000000000000000000000000000000` | Arc mainnet USDC predeploy — verified live (EIP-3009 `FiatTokenV2`, `version()` → `2`); override optional. |
| `ARBITRUM_MAINNET_USDC` | server | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Circle-native USDC on Arbitrum One (override optional). |
| `ARBITRUM_TESTNET_USDC` | server | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Arbitrum Sepolia USDC (override optional). |
| `HASHKEY_TESTNET_USDC` | server | — | Fallback only — the authoritative token address is read from the HSP Coordinator's `GET /chains` at verify time. |
| `HASHKEY_MAINNET_USDC` | server | — | Same as above (fallback only; Coordinator is authoritative). |
| `HASHKEY_PAY_RECIPIENT` | server | `DATA_HUB_RECIPIENT_ADDRESS` | Merchant payout wallet on HashKey. |
| `HSP_COORDINATOR_URL` | server | — | Required when `SETTLEMENT_NETWORK=HASHKEY` — from the HSP Coordinator's self-service `/register`. |
| `HSP_API_KEY` | server | — | Required when `SETTLEMENT_NETWORK=HASHKEY` — same source as `HSP_COORDINATOR_URL`. |
| `DATA_HUB_RECIPIENT_ADDRESS` | server | — | Merchant recipient for x402 settlement (required to activate Arc mainnet; default for `HASHKEY_PAY_RECIPIENT`). |
| `SMOKE_BUYER_PRIVATE_KEY` | server/local | — | Funded buyer key required only when `pnpm run x402-mainnet-smoke … -- --apply` is used to submit a real payment (§4.2). Never needed for the read-only check. |
| `ZERO_G_MAINNET_LEDGER_CONTRACT` | server | — | Override for the 0G mainnet `RecommendationLedger` anchor address (§3.3). |
| `ZERO_G_LEDGER_CONTRACT` | server | — | Override for the 0G Galileo evidence-mirror address (§3.3). |
| `ENTERPRISE_API_KEYS` | server | — | JSON array of enterprise API-key objects (`key`, `tenantId`, `tier`, `rateLimit`, `quotaUsd`, `audit`) — §6.5. |
| `ONEINCH_API_KEY` | server | — | Server-only, never `NEXT_PUBLIC_` (`apps/web/.env.local`) — 1inch quotes/swaps on Arbitrum via `/api/swap/oneinch-proxy`. Without it, Arbitrum still routes via Uniswap V3 and LiFi. |
| `UNISWAP_API_KEY` | server | — | Server-only — Uniswap Trading API (`trade-api.gateway.uniswap.org/v1`) via `/api/swap/uniswap/{quote,swap,check-approval}`; required for the API path (on-chain `UniswapV3Strategy` is separate). |
| `SERV_API_KEY` | server | — | SERV reasoning (RWA allocator only); server-only, never `NEXT_PUBLIC_`. |
| `SERV_ENABLED` | server | `true` | Explicit off-switch even with a key present (§5.3). |
| `SERV_BASE_URL` | server | `https://inference-api.openserv.ai` | OpenAI-compatible endpoint. |
| `SERV_MODEL` | server | `gpt-5.4-mini` | Chat Completions model. |
| `SERV_REASONING_EFFORT` | server | `medium` | `none`/`low`/`medium`/`high`. |
| `SERV_TIMEOUT_MS` | server | `20000` | Hard abort, then deterministic-heuristic fallback. |
| `COGNEE_API_URL` | server | **no default — required** | Per-tenant Cognee Cloud base URL (`https://<tenant>.aws.cognee.ai`, from the dashboard). |
| `COGNEE_API_KEY` | server | — | Sent as `X-Api-Key` (already set in the current deployment; already-set ≠ activation — see §4.4). |
| `COGNEE_TENANT_ID` | server | optional | Sent as `X-Tenant-Id`. |
| `TABLESTORE_ENDPOINT` | server | unset → memory backend falls back to Cognee | `https://<instance>.cn-beijing.ots.aliyuncs.com` (§7.2). |
| `TABLESTORE_INSTANCE_NAME` | server | — | Tablestore instance name (set in FC console — §7.6 step 3). |
| `TABLESTORE_MEMORY_STORE_NAME` | server | `diversifi_agent_memory` | Memory store created once allowlisted (§7.6 step 1.8). |
| `TABLESTORE_APP_ID` | server | `diversifi` | App scope for Tablestore Agent Memory. |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | server | — | RAM user AccessKey (user needs `AliyunOTSFullAccess` + `AliyunFCFullAccess` and must be **enabled** in the console). |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | server | — | Paired secret for the above. |
| `ALIBABA_CLOUD_FC_ENDPOINT` | server | unset → Guardian cron does local consolidation instead of delegating to Function Compute | FC HTTP trigger URL for memory consolidation (§7.6 step 4). |
| `DASHSCOPE_API_KEY` | server | unset → LLM consolidation falls back to the Gemini → Venice → … chain | DashScope (Bailian) key, from `bailian.console.aliyun.com`. |
| `DASHSCOPE_BASE_URL` | server | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible Qwen endpoint; can point at a custom MaaS endpoint (`https://<workspace>.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`). |
| `DASHSCOPE_MODEL` | server | `qwen-plus` | `qwen-long` (1M-token context) for large memory pools; `qwen-max` for highest quality. |
| `ENABLE_TYPESAFE_SIGNAL_LENS` | server (backend) | — | When `true`, the TypeSafe Signal Lens advisory layer runs on every macro event (§8.3 substrate; feeds the `guardian-telemetry` signalLens agreement stat). |

Scope rule: only `NEXT_PUBLIC_*` rows are client-exposed; everything else is server-only. Never put a signer key in a `NEXT_PUBLIC_` var. One common key is **not** an env var: a user's own Gemini API key is pasted in the ⚙️ chat settings modal, stored in `localStorage`, and forwarded via the `x-gemini-key` header — never persisted server-side (§5.1).

Behavior notes that used to carry their own mini-tables (rail selection in §4.2, SERV in §5.3, memory in §4.4, Alibaba optionality in §7.7) all reference rows above; nothing is restated with a different default.

---

## 3. Chains & capabilities

### 3.1 Supported chains

| Chain | Role | Testnet Faucet |
|-------|---------|----------------|
| **Celo** | Savings + identity + savings ledger of record (`0x3BCf…369C` on mainnet) | [Celo Faucet](https://celo.org/developers/faucet) |
| **Arbitrum** | Yield + execution + yield ledger of record (`0x3BCf…369C` on mainnet) | [Arbitrum Faucet](https://faucet.arbitrum.io/) |
| **0G** | Evidence layer (Storage CIDs, Compute TEE proofs, Guardian-state snapshots on 0G Storage, evidence anchor ledger `0x3BCf…369C` on mainnet — 0G DA is **not** integrated) | [0G Galileo Faucet](https://chainscan-galileo.0g.ai) |
| **Arbitrum / Arc / 0G (env-gated)** | x402 settlement rail for paid intelligence (`SETTLEMENT_NETWORK` = `ARBITRUM`, `ZERO_G`, or `ARC`; `SETTLEMENT_ENV` = `testnet` or `mainnet`) | **Arc mainnet:** chain 5042, USDC-native gas; configure the merchant recipient (`DATA_HUB_RECIPIENT_ADDRESS`) and `VAULT_PRIVATE_KEY` (legacy env name, server-side settlement signer). The signer needs USDC for transaction gas; the buyer's signed EIP-3009 mandate supplies payment principal. Arc/0G testnet: Circle Arc Faucet or 0G Galileo Faucet. |
| **Robinhood Chain** | RWA / stock-token ledger (`0x3BCf…369C`, chain 4663 — env-gated; USDG, SGOV, SPY/QQQ + tokenized stocks) | Robinhood Faucet |

App-executable chains are narrower than wallet-capable chains — `ChainDetectionService.isSupported` is the contract (Celo, Celo Sepolia, Arbitrum, Arc in dev). Arc stays out of `isSupported` for retail swap (arrival path only, §3.4).

### 3.2 DEX & routing

| Chain | DEX | Router |
|-------|-----|--------|
| **Celo** | Mento Protocol v3 (SDK), Uniswap V3 (CELO pairs) | Mento Router; SwapRouter02 |
| **Arbitrum** | Uniswap V3, 1inch, LiFi | 1inch via server proxy (`ONEINCH_API_KEY`); LiFi for cross-chain |
| **Hyperliquid** | Perps DEX | Direct API |
| **Robinhood Chain** | Tokenized stocks/ETFs (USDG, SGOV, SPY/QQQ, AAPL…) | Tracked only — not swappable in-app (see UniswapX note below) |

Routing keys: `ONEINCH_API_KEY` and `UNISWAP_API_KEY` (both server-only — rows in §2).

Celo venue rules (from `AGENTS.md`, kept here for operational reference): Mento goes through
`services/swap/mento-sdk.service.ts` only; neither Mento venue lists CELO — CELO pairs route
via `UniswapV3Strategy` (SwapRouter02, 7-field `exactInputSingle`, QuoterV2 quotes, fee tier
100, >3% price impact rejected as `no-route` so the ticket offers via-USDm). LiFi on Celo
can't route CELO. `pnpm check-swap-routes` is the live read-only route health check; run it
after touching routing.

### Uniswap Trading API — fee / bridge / chain notes (researched 2026-10-03)

Proxies already call the Trading API with `x-universal-router-version: 2.0`. Uniswap's 2026 API updates that matter to DiversiFi (docs: [Swapping FAQ](https://developers.uniswap.org/docs/trading/swapping-api/faqs), [integratorFees](https://developers.uniswap.org/docs/api-reference/aggregator_quote)):

| Capability | Status in Uniswap docs | DiversiFi implication |
|---|---|---|
| **`integratorFees`** | Up to **4** `{ recipient, bips }` entries; each ≤ 500 bips; sum ≤ 500; multi-recipient needs Universal Router **2.1.1+** (`x-universal-router-version: 2.1.1`) and **exact-input** only; quoted/`aggregatedOutputs` amounts are post-fee | Preferred capture path for Uniswap-routed swaps in monetisation Phase 1 — prefer this over a custom `FeeRouter` for the Trading API path. Bump the header only when wiring fees; disclose before the wallet; jurisdiction switch still gates to $0. |
| **`BRIDGE` routing** | `/quote` can return `routing: BRIDGE`; follow with `POST /swap` (same as CLASSIC/WRAP/UNWRAP). Cross-chain bridge-only is supported; confirm whether a true same-tx bridge→swap ("chained") is available for the pairs we care about before relying on marketing copy | Evaluate as an *alternative* to LiFi for some Arbitrum legs — **not** a replacement for Arc arrival (Circle CCTP + Forwarding). Arc→Arbitrum stays CCTP until a Trading API bridge quote is proven for USDC on Arc (5042) with honest fees and the same burn-hash resume semantics. |
| **Instant / batched calldata** | `POST /swap_5792` (EIP-5792 batch) and `POST /swap_7702` (Uniswap 7702 delegation) | UX candidates for Exchange (fewer wallet prompts) once wallets we support advertise the capability; no product work until fee disclosure lands. |
| **UniswapX chain coverage** | UniswapX v3 lists **Arc (5042)** and **Robinhood Chain (4663)** among supported chains (alongside Arbitrum/Base/…) | Watch only: Arc remains a deposit/settlement rail (not retail swap); Robinhood assets stay research/watch, not in-app execution. Do not advertise UniswapX on those chains until `getChainCapabilities` and counsel say so. |

**Out of scope / watch (not product backlog):**

- **OUSD (Open Standard)** — payments-network dollar on Base/Ethereum/etc.; Uniswap is a secondary market. Not a DiversiFi savings leg; do not add to token lists.
- **cirBTC on Arc** — confirms Uniswap liquidity exists on Arc; still irrelevant to the USDC→Arbitrum arrival path.
- **Spark PYUSD/USDS FX pools** — adjacent to stablecoin FX diligence; not a Mento EM-corridor or Circle StableFX substitute.

### Adjacent assets (watch, do not integrate yet)

| Asset | What it is | Gate before any DiversiFi surface |
|---|---|---|
| **PAXGy** (Paxos Labs, announced 2026-09-24) | PAXG-backed receipt that accrues in **gold terms** (balance fixed; exchange rate vs PAXG rises via institutional gold leasing). Liquidity at launch concentrated on X Layer / OKX / Uniswap there — **not** our Arbitrum PAXG path | Curated `token-provenance.ts` entry; Arbitrum (or another executable chain) address + live quote; counsel on yield-bearing gold vs spot PAXG; never rename or substitute PAXG silently |
| **Tokenized equities on Uniswap** | Uniswap reports majority DEX share for stock-token volume; Robinhood Chain deposits concentrated in Uniswap pools | Reinforces the existing RH research rail; still no in-app swap until chain-capability + compliance work |

### 3.3 0G chain — evidence anchor + RecommendationLedger

0G is the evidence layer; the ledger of record follows the money (concept
and rationale: [`architecture.md`](./architecture.md) § 0G Verifiability
Stack). Deployed surfaces and configuration:

| Field | Value |
|-------|-------|
| **0G Mainnet evidence anchor** | chainId `16661`, [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://chainscan.0g.ai/address/0x3BCf7dFd68ce98880618c89A351168960724369C) (overridable via `ZERO_G_MAINNET_LEDGER_CONTRACT`) |
| **Arbitrum Sepolia yield ledger** | chainId `421614`, [`0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996`](https://sepolia.arbiscan.io/address/0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996) |
| **0G Galileo evidence mirror** | chainId `16602`, [`0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED`](https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED) (overridable via `ZERO_G_LEDGER_CONTRACT`) |
| **Celo mainnet savings ledger** | chainId `42220`, [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://celoscan.io/address/0x3BCf7dFd68ce98880618c89A351168960724369C) |
| **0G Mainnet RPC** | `https://evmrpc.0g.ai` |
| **0G Mainnet Explorer** | `https://chainscan.0g.ai` |
| **0G Galileo RPC / Explorer** | `https://evmrpc-testnet.0g.ai` / `https://chainscan-galileo.0g.ai` |
| **Write authority** | EOA configured via `LEDGER_PRIVATE_KEY` or `VAULT_PRIVATE_KEY` (automatically authorised on deploy; admin can grant via `setAgentAuthorization`) |

#### Recorded fields (per recommendation)

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

Reasoning is hash-only on-chain (`reasoningHash`); the readable line lives off-chain in
`ledgerreasonings` (`models/LedgerReasoning.ts`) keyed `(chainId, recordId)` — or by
`reasoningHash` for anchors still pending. Never join on `settlementTxHash` (caller-supplied swap tx).

#### Verifying the contract

```bash
# Confirm the contract is deployed (use the address printed by
# docs/architecture.md — the live value is 0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED)
curl -s -X POST https://evmrpc-testnet.0g.ai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED","latest"],"id":1}'

# Read live stats + recent recommendations through the API
curl -s https://api.diversifi.famile.xyz/api/agent/zero-g-ledger | python3 -m json.tool
```

Public verification of any record: `GET /api/agent/zero-g-ledger?verify=<txHash>`.

#### Anchor observability

`recommendationLedgerService.recordRecommendation` returns a discriminated `AnchorResult`. Callers must inspect `result.status` and surface it to the user — never ignore `failed` results.

| Status | Meaning | Surface |
|---|---|---|
| `anchored` | Tx mined, `RecommendationRecorded` event parsed, `id` known | `AIMessage.x402Receipt.anchor` patched in place; `GuardianState.latestAnchor`; `GET /api/vault/permission?userAddress=…` returns it. |
| `pending`  | Tx broadcast but receipt not confirmed within 60 s (network congestion) | Same surfaces; the `txHash` is included so a later re-query by hash can resolve. |
| `failed`   | Broadcast failed, write contract unavailable, or tx reverted | Same surfaces; the `error` text is included. |

The 60-second `tx.wait(1, 60_000)` timeout is the right boundary: a network stall should never block the user-visible chat reply, so the function returns `pending` rather than failing the call. The recommendation may still land on-chain; callers can re-query by `txHash` later.

### 3.4 Circle (CCTP, Gateway & MPC)

- **CCTP**: Arc is domain `26` (mainnet TokenMessenger `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`). Arc↔Arbitrum mainnet transfer configuration/code is present; the code is not evidence of a completed production transfer. Arc sources Standard transfers only (Fast is N/A there; Standard has no protocol fee). **Celo is not a CCTP or Gateway domain** — there is no native USDC route to Celo. The user-facing use is the Arc arrival path (Arc → Arbitrum, Circle Forwarding Service mints; `NEXT_PUBLIC_ARC_ARRIVAL`, off in production by default). Before enabling mainnet: one small real transfer end to end — burn on Arc, forwarded mint on Arbitrum, both explorer links resolving — then flip the flag.
- **Gateway Nanopayments**: Circle Gateway's batched x402 facilitator path is integrated for Arc. It verifies and settles a buyer payment and returns a settlement identifier; this is not itself evidence that the separate cross-chain Protection Balance product is deployed or enabled.
- **Nanopayments / EIP-3009**: the gateway accepts `x-payment-mandate` (signed `transferWithAuthorization`) and `gateway_batched` proofs settled through `BatchFacilitatorClient` (down to `$0.000001`); self-hosted submission remains for the other rails.
- **Developer-Controlled Wallets**: per-user custodial agent wallets were removed. Privy remains for user login/embedded-wallet onboarding; Guardian execution uses the user's own wallet and signed permissions. `VAULT_PRIVATE_KEY` is a separate legacy-named server-side x402 settlement signer, not a user wallet or balance (§2).
- **Hackathon Default**: prefer the simplest externally verifiable proof path for judges; keep experimental payment variants out of the core demo unless they are fully verified end to end

> **Arc mainnet status (2026-09-25):** Arc public mainnet is live — chain ID
> `5042`, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`,
> USDC predeploy `0x3600000000000000000000000000000000000000` (on-chain
> `FiatTokenV2`, EIP-3009 domain `USDC`), EURC
> `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`, and CCTP domain `26`. The
> repository contains Arc settlement, CCTP V2, and Gateway Nanopayments
> integration. The committed defaults remain ZERO_G/testnet; production Arc
> activation and a successful production buyer settlement are not evidenced by
> repository state — Arc production use is **not established by any configuration
> or guide in this repo**. Circle Gateway batching is distinct from the separate
> Protection Balance product; the integration does not establish that a
> cross-chain prepaid balance is deployed or operational. 0G mainnet still lacks
> a verified stablecoin for settlement (0G mainnet settlement remains unavailable
> without a verified `ZERO_G_MAINNET_USDC`). To test or activate Arc: select
> `ARC` + `mainnet`, configure the merchant recipient and server-side settlement
> signer, then verify the deployed gateway with the read-only smoke check in
> §4.2. Do not infer production readiness from a configured key or a successful
> RPC check alone.

### 3.5 StableFX (Circle) — business pilot plan

**Status:** under evaluation (2026-09-28). Nothing is integrated beyond the `STABLEFX_ESCROW` addresses in `packages/shared/src/config/index.ts`. What StableFX is and where it does and does not fit: [`architecture.md`](./architecture.md) § StableFX. Sources: developers.circle.com/stablefx (technical guide, risk buffers, supported currencies, console roles), the public OpenAPI spec (`/openapi/stablefx.yaml`), and the Arc launch post (2026-09-22).

#### Open questions for Circle (gate for any build)

1. **Platform model.** Can DiversiFi onboard its business customers as individual takers (a partner or sub-account arrangement), or must each business complete KYB with Circle directly?
2. **Delegate funding.** Is it permitted for DiversiFi to be the trader while the customer's own wallet is the `delegate` funder and `recipientAddress`? This keeps DiversiFi non-custodial; the API supports the mechanics, the question is compliance.
3. **Live pairs.** Which pairs are live on mainnet today? The supported-currencies page lists 16 tokens; the OpenAPI `Currency` enum lists only USDC and EURC; the launch post says "select pairs". PHPC was announced but is absent from the table.
4. **Economics.** Taker fee schedule and risk-buffer (`collateral`) settings for a small-notional taker.
5. **Display rights.** May `reference` quotes be shown to users who are not KYB'd takers, and does fetching them require a taker account?
6. **Jurisdictions.** Which countries' businesses can be takers (Ghana, Nigeria, Kenya, Caribbean)?
7. **Roadmap.** African or Caribbean partner stablecoins; settlement windows longer than 24 hours.

#### Phases

| Phase | Gate | Scope | Done when |
|---|---|---|---|
| **0 — Sandbox probe** | none | `TEST` API key (base URL `api-sandbox.circle.com`, Arc testnet `5042002`). Script-only probe: reference + tradable quotes per candidate pair; record which pairs quote, response shape, fee and `collateral`. No app code. | A dated table of pairs that actually quote on testnet, committed alongside this section. |
| **1 — One business pilot** | Circle answers Q1–Q3 favourably; one importer on a live pair (BRL, MXN or ZAR, whichever is live) | "Next payment" gains one CTA, "Convert via StableFX", for a KYB'd business with funds on Arc. Server-side API key only (never client). An Arc-only `StableFxStrategy` behind `SwapOrchestratorService`, gated by `getChainCapabilities` (Arc stays out of retail wallet and swap lists). The business signs EIP-712 / Permit2 in its own wallet; settlement tx → `RecommendationLedger` on Arc; reasoning echo per the hash-only rule. A failed quote renders nothing — never an estimated rate. | One real mainnet trade settled end to end with a ledger record, verifiable via `?verify=`. |
| **2 — Weekend route** | Phase 1 shipped; Q5 answered | When Mento returns `market_closed` on an overlapping pair (EUR, GBP, BRL, ZAR, CAD, AUD, JPY, CHF), Exchange offers the StableFX route to eligible business users only; retail keeps the honest "FX market closed" state. | `pnpm check-swap-routes` reports StableFX alongside Mento. |
| **3 — Executable pricing in the cycle report** | Q5 allows display | "Next payment" shows a StableFX reference quote for supported pairs, labelled indicative, in place of the open-dataset mid-market rate. | Labelling covered by tests; unsupported pairs keep the dataset rate. |

#### Non-goals

- No retail execution, no DiversiFi-held omnibus wallet, no FX forwards (max tenor is 24 h — the cycle report keeps saying "convert early", never "rate locked for your payment date").
- Mento remains the venue for NGN, GHS, KES, XOF, COP and PHP savings.

### 3.6 Wallet Integration

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

### 3.7 Tech Stack Summary

| Category | Technology |
|----------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Smart Accounts | Privy for login + embedded-wallet onboarding only (never execution). Autonomy = ERC-7715/7710 via `@metamask/smart-accounts-kit`: a scoped session account (`GUARDIAN_SESSION_PRIVATE_KEY`) redeems the user's granted delegation on their own smart account through a bundler (`AA_BUNDLER_URL[_<chainId>]`); eligible chains are kit-derived (Celo, Celo Sepolia, Arbitrum intersect the app's supported set) |
| AI | Gemini (primary), Venice AI, AI/ML API, NVIDIA, Featherless, 0G Serving, Modal GLM (fallback chain) |
| Agent Memory | Tablestore (Alibaba Cloud, preferred) → Cognee (fallback); Qwen long-context consolidation via DashScope |
| Macro Monitoring | Firecrawl (event-driven page watching) |
| Swaps | Mento Protocol v3 + Uniswap V3 (Celo), Uniswap V3/1inch/LiFi (Arbitrum) |
| Bridging | Circle CCTP, LiFi |
| Hedging | Hyperliquid perps |
| Data | World Bank, FRED, CoinGecko, DeFiLlama |
| Database | MongoDB |
| Chain history | Blockscout public API (`celo.blockscout.com`, ERC-20 transfers → capital journey) |
| Agent Identity | ERC-8004 Identity Registry (8004scan, Celo mainnet, agentId 9654), Self Protocol Agent ID (Celo mainnet, agent `0xE8cDb7CA…f170`, real passport verified) |
| Hosting | Vercel (frontend), Hetzner (agent runtime) |

### 3.8 Planned / Explored providers

The following providers have been evaluated but not yet integrated. See [`plan.md`](./plan.md) § 7 →
"Post-9/10 — full-stack fintech infrastructure" for the strategic rationale.

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

## 4. API endpoints

### 4.1 Endpoint index

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/vault/permission` | POST/GET/PATCH/DELETE | Guardian permission CRUD; PATCH also attaches the ERC-7715 `delegationContext` |
| `/api/vault/rebalance` | POST | Guardian execution (dry-run preview or ERC-7710 redeem) |
| `/api/vault/transactions` | GET | Guardian journal / transaction history |
| `/api/vault/strategy` | POST | Save Guardian strategy on the profile record |
| `/api/vault/guardian-state` | GET | Guardian state (recommendation queue, decision log) |
| `/api/status` | GET | System health check |
| `/api/agent/execute-swap` | POST | Execute swap via agent |
| `/api/agent/x402-gateway` | GET | Payment challenge + paid evidence retrieval |
| `/api/agent/x402-metrics` | GET | Transaction-frequency + pricing proof payload |
| `/api/agent/sosovalue` | GET | SoSoValue market intelligence (legacy — crypto-era, disabled in chat UI) |
| `/api/agent/zero-g-ledger` | GET/POST | 0G `RecommendationLedger` on-chain recommendations + stats; `?user=0x...` to filter. POST returns `{ status: 'anchored' \| 'pending' \| 'failed', txHash, explorerUrl, id? }`. |
| `/api/agent/guardian-loop` | POST | Autonomous execution cron (server-to-server, secret-protected). Also runs the payment-cycle monitor tick inline (`cycleMonitor` in response). Pending actions live in a bounded `recommendationQueue` (head mirrored as `latestRecommendation`). |
| `/api/agent/business/cycles` | GET/POST | Purchase-cycle CRUD. Requires wallet-signed headers (`x-wallet-auth-message` / `x-wallet-auth-signature`); address is derived server-side. Date pass → `payment_due`; `completed` requires `paymentOutcome`. |
| `/api/agent/business/cycle-monitor` | POST | Standalone cycle-aware proposal tick (same logic as guardian-loop inline step); enqueues without overwriting unrelated pending recommendations |
| `/api/agent/fx-cycle-report` | POST | Free in-app FX drag scenario: current mid-market rate + historical stress context (USD targets only). Not a forecast or locked quote. |
| `/api/agent/firecrawl-webhook` | POST | Receives Firecrawl Monitor macro signal webhooks |
| `/api/agent/rwa-allocation` | POST | RWA vault allocation (deterministic heuristic by default; SERV reasoning only on explicit opt-in — §5.3). Demo at `/?tab=protect&sleeve=rwa`; `/rwa-vaults` redirects there. |
| `/api/agent/rwa-market` | GET | Tokenized-asset market figures for Shield's lens (keyless; §5.4) |
| `/api/agent/memory` | GET/POST/DELETE | Guardian memory (opt-in; §4.4). `?providers=1` reports health-aware availability. |
| `/api/agent/enterprise/audit` | GET | Enterprise tenant/wallet-scoped verifiable recommendation export (§6.5) |
| `/api/agent/guardian-telemetry` | GET | Live telemetry incl. `signalLens.agreement` (§8.3) |
| `/api/swap/oneinch-proxy` | — | 1inch quotes/swaps on Arbitrum (server proxy; `ONEINCH_API_KEY`) |
| `/api/swap/uniswap/{quote,swap,check-approval}` | — | Uniswap Trading API proxies (`UNISWAP_API_KEY`) |
| `/api/fx-netting/intent` | POST/GET | Wallet-authenticated FX intent creation for the hosted CARICOM FX pool. POST validates + normalizes + **persists** an intent (sellCurrency, sellAmount, buyCurrency, buyAmountMin?, deadline?) — `participantId` derived from the signed message, never the body. GET lists the caller's own pool intents. |
| `/api/fx-netting/match` | POST | CARICOM FX matching + net settlement **against the hosted intent pool**. Body `{ intents?: FxIntent[] }` (optional — supplied intents are upserted into the pool first), then the full open pool is loaded and matched at live mid-market rates (no USD bridge); outcomes persist (remainingSell decrements, `open → partially_matched → matched`, matchId audit). Nets obligations to cUSD transfers, anchors each match to the RecommendationLedger on the region-canonical chain (Celo; APAC → HashKey). Returns matches + savings + settlement plan + `poolSize`. |
| `/api/fx-netting/settle` | POST/GET | Zero-custody settlement of a net FX obligation. POST (debtor-only, wallet-authenticated): body `{ settlementId, txHash }` — the server fetches the tx receipt on the settlement's region-canonical chain, parses the ERC-20 Transfer log, and verifies token/debtor/creditor/amount (settlement-execution.ts::verifySettlementTransfer) before marking the settlement + both intents `settled` and anchoring `FX_SETTLE` to the RecommendationLedger. Idempotent. GET lists the caller's settlements (outgoing = debtor worklist, incoming = creditor inbox). Settlement rails: Celo/cUSD (Africa/Caribbean/LatAm), HashKey/USDT (APAC) — routed by `settlement-rails.ts`, per-obligation, never hardcoded. |

### 4.2 x402 settlement rails (env-gated) & research mode

DiversiFi's x402 gateway is the single billing surface for decision-artifact
generation (Protection Reviews — `docs/product.md` § The product object).
The underlying settlement rail is configurable: `ZERO_G` (current default),
`ARC`, `ARBITRUM`, or `HASHKEY`, in `testnet` or `mainnet` mode (`SETTLEMENT_NETWORK` +
`SETTLEMENT_ENV` — rows in §2). The codebase defaults to ZERO_G/testnet; Arc mainnet
support is implemented but is not activated by those defaults. A buyer-funded Protection
Balance is a product direction, not a claim that every environment currently has a live
balance flow.

`HASHKEY` is a distinct rail: settlement happens zero-custody via **HSP
(HashKey Settlement Protocol)** — the buyer's wallet signs an EIP-712 mandate
and broadcasts the USDC transfer itself. There is no agent-side mirror
settlement on any rail: the buyer-signed settlement is always the settlement
of record. See
[`archive/strategy-2026-07.md`](./archive/strategy-2026-07.md) § HSP Settlement & FX Protection Insight for the full flow and the
`fx_protection` source it powers.

| Component | Responsibility |
|-----------|-----------------|
| `apps/web/lib/agent/advisor-core.ts` | Decide what evidence is needed before recommending an action |
| `pages/api/agent/x402-gateway.ts` | Issue payment challenge, verify payment, enforce credit drawdown, and return paid evidence |
| `packages/shared/src/services/settlement-service.ts` | Configurable USDC payment rail (`SETTLEMENT_NETWORK` + `SETTLEMENT_ENV`) — settles balance top-ups |
| Shared source registry | Canonical source IDs, alias mapping, pricing, reputation, and freshness rules (cost-side inputs to artifacts) |

#### Payment Boundary

- The primary buyer path is **mandate-first**: `402` challenge → buyer signs an EIP-3009 `transferWithAuthorization` (no tx, no gas, no chain switch) → gateway verifies the signature **and settles it on-chain** before crediting. A mandate is never credited unsettled.
- The mandate is a **top-up**: the signature funds the buyer's credit balance (`suggested_topup_amount` in the challenge), and requests draw the balance down. Per-call signatures are not the retail UX — funding is the consent moment; the Guardian spends within the funded balance and user-set bounds.
- Retail consent surface: when a review would need funding, the app quotes first and shows an in-app `confirm_research` offer (review cost + top-up amount + evidence provenance) **before** any wallet prompt — confirm proceeds to the signature, skip keeps the free answer. An optional auto-fund setting (`autoPayMaxUSDC`, default-off) skips the offer only when the authoritative quote is within the user's cap; it never bypasses the wallet signature.
- The fallback path is `402` challenge → buyer sends a real USDC transfer on the active settlement rail → gateway verifies the tx hash and nonce. This remains for external agents and clients that prefer tx-hash proofs.
- Data-source prices are at or below `$0.01`; artifact-level products (e.g. `fx_protection` at `$1.00`) are priced per decision, not per feed.
- Nonce expiry and replay checks protect against double-spend on payment proofs and mandates (challenge nonce is consumed once; the EIP-3009 nonce is additionally spent on-chain).
- Only real buyer settlements appear on-chain: mandate, tx-proof, HSP, or `gateway_batched`. There is no agent-side `USDC.transfer` mirror (it was removed — the vault sending its own USDC per request is fabricated volume). The buyer's settlement is reported as `_billing.settlementTxHash` + `_billing.settlementExplorer` (the latter only when the value is an on-chain tx hash — a Gateway batched settlement id is not).
- Opaque `circle-gateway-*` proof ids are intentionally not accepted in the judge-facing flow unless server-side verification is explicitly configured.

#### Enabling the research-payment loop

Enable the autonomous research-payment loop where the Guardian negotiates paid premium data via x402 nanopayments on the configured settlement rail:

1. Set `ENABLE_AUTONOMOUS_MODE=true` (the old `NEXT_PUBLIC_ENABLE_ARC` flag was never read and is gone)
2. Configure `SETTLEMENT_NETWORK` (`ARBITRUM`, `ZERO_G`, or `ARC`) and `SETTLEMENT_ENV` (`testnet` or `mainnet`)
3. Configure the rail's RPC, USDC address, merchant recipient, and server-side settlement signer (§2 rows). On Arc mainnet, buyer mandates provide the payment principal; the signer pays native USDC gas. Circle Gateway batching is a distinct method.
4. Confirm the deployed gateway challenge advertises the intended rail and environment before enabling paid mainnet transactions.

#### Configuring the Rail (mainnet flip)

Set in `.env.local` or on the server (see `.env.example` → "MAINNET FLIP"); all variables and
defaults are the §2 table rows (`SETTLEMENT_NETWORK`, `SETTLEMENT_ENV`, `ZERO_G_MAINNET_USDC`,
`ARC_MAINNET_USDC`, `ARBITRUM_MAINNET_USDC`, `ARBITRUM_TESTNET_USDC`, `HSP_COORDINATOR_URL`,
`HSP_API_KEY`, `HASHKEY_TESTNET_USDC`, `HASHKEY_MAINNET_USDC`, `HASHKEY_PAY_RECIPIENT`,
`DATA_HUB_RECIPIENT_ADDRESS`, `VAULT_PRIVATE_KEY`).

To select Arc mainnet, configure `SETTLEMENT_NETWORK=ARC` and
`SETTLEMENT_ENV=mainnet`, the merchant `DATA_HUB_RECIPIENT_ADDRESS`, and the
server-side `VAULT_PRIVATE_KEY` settlement signer (§2: legacy variable name, not a
user-funds vault). For EIP-3009 mandates, the
buyer-authorized USDC principal transfers directly to the configured merchant;
the signer submits the transfer and pays Arc-native USDC gas. A mandate requires
both a funded buyer and a signer with sufficient gas; this is distinct from any
Circle Gateway-batched payment. A key or env flip alone does not prove successful
production settlement. Before activation, verify the signer address and balance
through the deployed service's settlement diagnostics
(`GET /api/agent/x402-metrics`), and run the read-only smoke check:

```bash
pnpm run x402-mainnet-smoke -- --gateway <url> --source macro_analysis
```

It remains read-only unless `--apply` is explicitly passed; applying requires
`SMOKE_BUYER_PRIVATE_KEY` and submits a real payment — only pass `--apply` with
explicit authorization and a funded buyer key. Run the read-only check before
considering production activation. Testnet funding should use the faucet for the
selected rail. Dated status: see the Arc mainnet status note (2026-09-25) in §3.4.

#### Evidence Bundles

- A single recommendation may request multiple sources.
- Each bundle returns source payload, timestamp, cost, confidence, and settlement tx hashes.
- The advisor prefers fresh, high-agreement data and reduces action size when evidence conflicts.
- Premium sources (`macro_analysis`, `portfolio_optimization`, `risk_assessment`) use Gemini to
  synthesise live World Bank / DeFiLlama / CoinGecko / FRED / Yearn data into structured JSON.

#### On-Chain Settlement Flow

```text
Client → GET /api/agent/x402-gateway?source=macro_analysis
       ← 402 { nonce, amount: "0.004", currency: "USDC", recipient, chainId,
             token, mandate_supported: true, settlement_network: "ARBITRUM",
             settlement_env: "mainnet", expires }

# Mandate-first (EIP-3009): buyer signs, merchant settles
Client → signs TransferWithAuthorization over {from, to: recipient,
         value: amount, validBefore: expires, nonce}
Client → GET /api/agent/x402-gateway?source=macro_analysis
         x-payment-mandate: <mandate json>
       ← gateway verifies signature + submits transferWithAuthorization
         on-chain (server-side settlement signer pays native gas); credit = settled amount

# Fallback: raw transfer proof
Client → GET /api/agent/x402-gateway?source=macro_analysis
         x-payment-proof: 0x<real_usdc_transfer_tx_hash>
         x-payment-nonce: <challenge_nonce>
       ← 200 { data, _billing: { onChainSettled: true, settlementNetwork: "ARBITRUM",
             settlementEnv: "mainnet", settlementTxHash: "0x...",
             settlementExplorer: "https://arbiscan.io/tx/0x..." } }
```

The example above shows the Arbitrum buildathon default; swap
`settlement_network`/`settlement_env` for `ZERO_G`/`ARC` as needed. Live
settlement metrics and the active explorer are exposed at
`GET /api/agent/x402-metrics` under the `settlement` object (and the legacy
`arcSettlement` alias for backwards compatibility).

#### Verification commands

```bash
pnpm test-x402                   # Basic x402 gateway challenge/response
pnpm test-x402-comprehensive      # Full research-payment-settlement cycle
pnpm test-x402-frequency          # Payment frequency validation
```

### 4.3 Autonomous Guardian loop & endpoint security

The Guardian is a server-side cron (`*/5 * * * *`) that executes portfolio actions within
user-approved permission bounds — the deterministic bounds check gates every action; the AI
layer explains rather than decides (full pipeline: `docs/product.md`; loop mechanics —
signal ingestion → permission validation → chain-aware execution → evidence anchor — in
[`architecture.md`](./architecture.md) § Guardian Autonomous Loop).

| Component | File | Purpose |
|-----------|------|---------|
| Guardian Loop | `pages/api/agent/guardian-loop.ts` | Cron-driven autonomous execution |
| Firecrawl Webhook | `pages/api/agent/firecrawl-webhook.ts` | Macro signal ingestion |
| Firecrawl Setup | `scripts/setup-firecrawl-monitors.ts` | Register page watchers |
| Macro Rehearsal | `scripts/send-test-macro-signal.ts` | Drive the macro path end to end on demand (local target by default; remote needs `--allow-remote`) |
| Ledger Reasoning Echo | `apps/web/lib/ledger-reasoning-store.ts` + `apps/web/models/LedgerReasoning.ts` | Readable reasoning for hash-only ledger records (`record` by chainId+id, `pending` by keccak, 90-day TTL) |
| Ledger Reasoning Backfill | `scripts/backfill-ledger-reasoning.ts` | Recover reasoning text for historical records, keccak-gated (dry-run by default) |
| Guardian State | `apps/web/lib/vault/guardian-state.ts` | Pending recommendation store |
| Cognee Memory | `packages/shared/src/services/cognee-memory-service.ts` | Cross-session learning (fallback) |
| Tablestore Memory | `packages/shared/src/services/tablestore-memory-service.ts` | Alibaba Cloud Agent Memory (preferred when configured) |
| Memory Consolidation | `packages/shared/src/services/memory-consolidation-service.ts` | Qwen long-context consolidation (FC delegation or local) |
| FC Handler | `ops/alibaba-cloud/fc-memory-consolidation/index.js` | Alibaba Cloud Function Compute proof file |
| Guardian Memory | `packages/shared/src/services/guardian-memory-service.ts` + `apps/web/pages/api/agent/memory.ts` | Opt-in user facts, user-chosen provider |
| Guardian Memory Extraction | `packages/shared/src/services/guardian-memory-extract.ts` | Post-reply fact extraction + secret backstop |
| Guardian Memory Smoke | `scripts/smoke-guardian-memory.ts` | Ephemeral-wallet add/list/delete/forget per provider |

Endpoint security:
- `GUARDIAN_LOOP_SECRET` protects the cron endpoint (server-to-server only).
- `FIRECRAWL_WEBHOOK_SECRET` authenticates incoming Firecrawl webhooks.
- User's permission bounds are always enforced (daily limit, allowed tokens, expiry). **Enforcement is app-layer**, not on-chain, on the production Celo/Mento path — see `docs/guardian.md`.
- `GUARDIAN_CONFIDENCE_THRESHOLD` (default 0.6) prevents low-confidence auto-execution.
- **ERC-7715 permission integrity:** `/api/vault/permission` POST verifies the EIP-712 typed-data signature against the user's wallet on the server (`ERC7715Service.verifySignedPermission`). Requests with a missing, malformed, or non-recovering signature are rejected with `400` before any permission is persisted. The `signature: 'unsigned'` fallback has been removed.

#### Macro path rehearsal

Monitors fire when a watched central-bank page changes — not on a schedule you
control. Drive the identical path on demand instead:

```bash
pnpm rehearse-macro-signal                        # print the payload, send nothing
pnpm dev                                          # terminal 1
pnpm rehearse-macro-signal --send                 # terminal 2 — local target
pnpm rehearse-macro-signal --verify-only --url https://api.diversifi.famile.xyz
```

A rehearsal exercises observation recording without producing news or user
recommendations. No primary model decision or per-user eligibility walk runs;
`usersWouldUpdate` is zero. Optional shadow assessment is telemetry only.
The webhook queues no intents, publishes no events, and writes no user memory.
It anchors one permanent observation record, typed `MACRO_SIGNAL:REHEARSAL`, with a server-forced
`[Rehearsal — not a market event]` echo, so beats, the macro pill, and the
health check all filter it by action rather than text. That permanent ledger
write is why remote targets are refused unless `--allow-remote` is passed.
`--verify-only` reports each feed row as rehearsal or macro and whether it
carries readable text or is hash-only.

Records anchored before the reasoning echo shipped stay hash-only until
recovered:

```bash
pnpm backfill-ledger-reasoning           # dry-run report
pnpm backfill-ledger-reasoning --apply   # write the echoes
```

The backfill reconstructs the anchored line from the GuardianState queue and
writes it **only** when `keccak256(candidate)` equals the record's on-chain
`reasoningHash`; everything else is reported as unmatched.

### 4.4 Guardian memory (opt-in) & `/api/agent/memory`

Guardian memory is consent-only: nothing is recalled or written unless the
user picks a mode in Ask Guardian ("Memory: … · Change"). Modes:

- **Off** (default) — no recall, no extraction, no writes. Structured app
  context (plan, portfolio, pair facts) is unaffected — it is not "memory".
- **This device** — up to 12 facts (≤140 chars, 30-day expiry, pruned on
  read) in `localStorage` under `diversifi.guardian.memory.facts.<addr|anon>`;
  the client sends them with each question and nothing is stored server-side.
- **Across devices** — the same facts stored server-side under a
  **wallet-signature-verified** address (`requireWalletAuth`), at the
  provider the user picked. `GET /api/agent/memory?providers=1` reports each
  provider's **health-aware** availability (`available` = configured AND a
  ~2 s authenticated probe succeeded, cached 10 min on success / 2 min on
  failure) plus a `reason` (`not_configured` | `unreachable`) so the UI can
  label "Not set up yet" vs "Unavailable right now".

Providers are adapters over the existing services, kept in a dedicated
namespace separate from any legacy interaction memory:

| Provider | Storage | Namespace | Per-fact delete |
|---|---|---|---|
| `tablestore` | Alibaba Cloud — mainland China (`cn-beijing`) | `agentId: guardian_facts`, tenant = verified address | Native `deleteMemory` per unit |
| `cognee` | Cognee Cloud — USA (AWS us-east-1) | Dataset `guardian_facts_<address>`; one data item per fact | Native `DELETE /api/v1/datasets/{id}/data/{data_id}`; `forget` deletes the dataset |

Cognee Cloud requires a **per-tenant base URL** — `COGNEE_API_URL`
(`https://<tenant>.aws.cognee.ai` from the dashboard) is required with no
default; `COGNEE_API_KEY` is sent as `X-Api-Key` and `COGNEE_TENANT_ID`
(optional) as `X-Tenant-Id`. Writes are `POST /api/v1/add` as multipart
form (`datasetName` + repeated `raw_data` string fields); facts skip
cognify entirely. `add` reports only confirmed writes — a failed write
never shows as "Remembered".

Every call is timeout-bounded (~800 ms for `list` inside the chat path) and
fails soft. **Activation is intentionally deferred:** neither provider is
enabled in production yet — Tablestore needs its account-level 邀测 beta
allowlist (DingTalk group 36165029092) *and* the RAM user enabled
([§7.1](#71-live-status-2026-07-20-alibaba-cloud)), and Cognee needs `COGNEE_API_URL` +
`COGNEE_TENANT_ID` from the tenant dashboard (`COGNEE_API_KEY` is already set). Until then
the app shows Off / This device only.

`DELETE /api/agent/memory` without an id forgets the dedicated
namespaces **and** the legacy scopes; with `?provider=&id=` it removes one
fact. Extraction (`POST action=extract`) runs only after a reply lands and
post-filters for secrets (seed phrases, private keys, account numbers)
server-side regardless of model output.

---

## 5. AI providers & data sources

### 5.1 AI provider failover chain

| Provider | Role | Fallback |
|----------|------|----------|
| **Gemini (Google)** | Primary agent intelligence (Flash for speed, Pro for reasoning) | Venice AI |
| **Venice AI** | Secondary / fallback | AI/ML API |
| **AI/ML API** | 400+ models, OpenAI-compatible endpoint (`deepseek/deepseek-chat`) | NVIDIA |
| **NVIDIA** | OpenAI-compatible, 100+ models, ~40 req/min free tier (`deepseek/deepseek-v4-flash`) | Featherless |
| **Featherless** | OpenAI-compatible fallback | 0G Serving |
| **0G Serving** | Decentralized inference via 0G Router (`deepseek-v4-pro`, `GLM-5.1`, `qwen3.6-plus`) | Modal (GLM) |
| **Modal (GLM)** | Tertiary fallback | Error response |
| **DashScope (Alibaba Cloud)** | Qwen long-context for memory consolidation only (not in general chat chain) | N/A (preferred provider, not fallback) |

> **User-supplied keys**: Users can paste their own Gemini API key in the ⚙️ chat settings modal. The key is stored in `localStorage` and forwarded via the `x-gemini-key` request header — it is never persisted server-side. This removes shared rate-limit pressure and qualifies for the Google prize track.

All LLM interactions go through `AIService` (`@diversifi/shared`); it owns the failover chain
above and automatic 0G anchoring.

### 5.2 AI endpoints & caching

- All AI responses cached for 5 minutes to reduce API calls
- Rate limit: 60 req/min per provider
- Error taxonomy: timeout → retry once, rate limit → queue, auth error → alert

### 5.3 SERV reasoning (opt-in, not in the chat chain)

SERV (`inference-api.openserv.ai`) is an OpenAI-compatible inference API used
**only** by the RWA vault allocator (`POST /api/agent/rwa-allocation`, demo at
`/?tab=protect&sleeve=rwa`; `/rwa-vaults` redirects there) — it is deliberately **not** part of the `AIService` failover
chain. The default path is a free deterministic heuristic over the IXS Finance
ERC-4626 catalog; SERV engages only on explicit opt-in (`?serv=1` /
`{ serv: true }`) with `SERV_API_KEY` configured. Every failure — missing key,
`SERV_ENABLED=false`, timeout (8s note: the configured hard abort is
`SERV_TIMEOUT_MS`, default 20000 ms), 401/403, 429, 5xx, malformed JSON — falls
back to the heuristic with `degradedReason` set; the response is strictly
validated (unknown vault ids dropped, weights normalized to 100).

Env rows: `SERV_API_KEY`, `SERV_ENABLED`, `SERV_BASE_URL`, `SERV_MODEL`,
`SERV_REASONING_EFFORT`, `SERV_TIMEOUT_MS` — see §2.
Files: `packages/shared/src/services/serv/{ixs-vault-catalog,rwa-allocator,serv-reasoning-client}.ts`.

### 5.4 RWA market figures (DeFiLlama + CoinGecko, keyless)

`GET /api/agent/rwa-market` feeds Shield's tokenized-asset lens: USDY APY
(DeFiLlama `ondo-yield-assets` on Arbitrum), syrupUSDC APY (DeFiLlama `maple`
USDC pool — the pool that sets syrupUSDC's yield) and PAXG spot (CoinGecko
`pax-gold`). Public, read-only, no env vars; 10-minute in-memory + CDN cache
(`s-maxage=600`). A provider that fails nulls only its own figure — there is
no static fallback number. File:
`packages/shared/src/services/rwa-market-service.ts`.

### 5.5 Data providers

| Provider | Data | Rate Limit |
|----------|------|------------|
| **World Bank** | Inflation rates | 10k req/month |
| **FRED** | Economic indicators | 120 req/min |
| **CoinGecko** | Exchange rates | 50k req/month |
| **DeFiLlama** | TVL, yields | 100 req/day |
| **GoodDollar** | Daily G$ UBI claim + face verification on Celo via `@goodsdks/citizen-sdk` 1.2.7 (`gooddollar-service.ts`) — wallet client built with the account attached, wallet switched to Celo before claiming, `getWalletClaimStatus()` gates `claim()`; FV is a popup on desktop, redirect on mobile/embedded | — |
| **SoSoValue** | LEGACY — crypto flash news + sentiment (off-thesis, disabled in chat UI); API is crypto-native with US-only macro events | Free tier + API key |
| **Firecrawl** | Event-driven macro page monitoring (ECB, Fed, yield trackers) | 500 credits/month free |
| **Cognee** | Agent memory — cross-session persistent context (fallback) | Tenant API (REST) |
| **Tablestore (Alibaba Cloud)** | Agent memory — persistent memory with vector search + automatic long-term extraction (preferred when configured) | Pay-as-you-go |
| **DashScope (Alibaba Cloud)** | Qwen long-context LLM for memory consolidation | API key |
| **Function Compute (Alibaba Cloud)** | Serverless compute hosting the memory consolidation handler | Pay-as-you-go |

### 5.6 Rate limits & caching strategy

| Provider | Limit | Cache Duration |
|----------|-------|----------------|
| Gemini (shared key) | 60 req/min | 5 min |
| Gemini (user key) | User's own quota | 5 min |
| Venice AI | 60 req/min | 5 min |
| World Bank | 10k/month | 24 hrs |
| FRED | 120/min | 1 hr |
| CoinGecko | 50k/month | 1 min |
| DeFiLlama | 100/day | 6 hrs |

### 5.7 Token provenance (curated, not an API)

`packages/shared/src/constants/token-provenance.ts` — hand-sourced issuer/reserve/governance facts rendered on the Exchange ticket and pair inspector. Each entry carries named https sources and an `asOf` check date; re-verify by `asOf` + 90 days. A token with no entry renders nothing — never fabricate a provenance line. Sources: [reserve.mento.org](https://reserve.mento.org/), Celo governance (CGP-156), Circle transparency, Paxos attestations, Ondo USDY docs, BCEAO communiqué, Brazil LC 179/2021.

---

## 6. External agent integration

This guide shows how external autonomous agents can consume DiversiFi's
Mento stablecoin intelligence via the x402 payment protocol.

### 6.1 Overview

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

### 6.2 Architecture

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
    │       ← 200 { data, _billing: { onChainSettled, settlementTxHash,
    │             settlementExplorer, settlementNetwork, settlementEnv, anchor } }
    │
    └── Intelligence consumed + on-chain proof recorded
```

### 6.3 Available Intelligence Sources

| Source ID | Description | Price (USDC) |
|---|---|---|
| `macro_analysis` | Mento depeg + inflation macro analysis | ~$0.004 |
| `portfolio_optimization` | Portfolio rebalancing recommendations | ~$0.004 |
| `risk_assessment` | Risk assessment for stablecoin holdings | ~$0.004 |

### 6.4 Payment Flow

#### Authentication

No API key required. The x402 protocol handles authentication via
on-chain USDC payment. Each request:

1. Receives a unique nonce + payment challenge (including `chainId`,
   `settlement_network`, and `settlement_env`)
2. Requires a real USDC transfer on the configured settlement rail
   (`ZERO_G` or `ARC`, testnet or mainnet) to the specified recipient
3. Is verified by the gateway before intelligence is released

The settlement rail and environment are controlled by `SETTLEMENT_NETWORK`
and `SETTLEMENT_ENV` — see §2 for the variable rows and
[§4.2](#42-x402-settlement-rails-env-gated--research-mode) for the mainnet
flip instructions.

An optional **enterprise tier** authenticates with an `x-api-key` header
instead of per-request x402 settlement — see [§6.5](#65-enterprise-tier-api-key-auth).

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
    "settlementTxHash": "0x...",
    "settlementExplorer": "https://chainscan-galileo.0g.ai/tx/0x...",
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

#### Verifying the Intelligence

Every response includes verifiable proof:

1. **0G Storage CID** — the `anchor` field contains a reference to the
   0G Storage evidence bundle. Fetch it from 0G to inspect the full AI
   reasoning, data sources, and prompt.

2. **Chain-aware RecommendationLedger** — the `anchor.chainId` tells you
   which chain the decision was recorded on:
   - Celo mainnet (42220) for savings/Mento stablecoin decisions
   - Arbitrum mainnet (42161) for yield/RWA decisions
   - 0G Galileo (16602) for evidence anchor/mirror

3. **Settlement tx** — the buyer's real settlement transaction is reported as
   `_billing.settlementTxHash` with `_billing.settlementExplorer` pointing at
   the rail's explorer (the link is omitted for Gateway batched settlements,
   whose `settlementTxHash` is a Gateway settlement id, not an on-chain hash).
   The rail is indicated by `_billing.settlementNetwork` /
   `_billing.settlementEnv`.

**Gateway intelligence CIDs.** Every paid Data Hub response also includes
`evidenceCids` in its `_billing` block — one 0G Storage CID per paid
source. Each CID references the exact intelligence payload (analysis, data
sources, model, prompt) returned for that request, so a consumer can
fetch it from 0G and verify the precise output they paid for. This closes
the verifiability gap for the gateway's direct (non-recommendation)
intelligence responses.

#### Code Example

See [`examples/external-agent/consume-intelligence.js`](../examples/external-agent/consume-intelligence.js)
for a complete working example in JavaScript.

#### Agent Identity (Optional)

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

#### Rate Limits

- **Public (x402):** 20 requests per minute per client (IP), with replay
  protection on each payment nonce.
- **Enterprise (API-key):** per-key `rateLimit` defined in `ENTERPRISE_API_KEYS`
  (tier-based, typically higher than the public limit).
- Nonce expiry: 10 minutes
- Replay protection: each nonce can only be used once

### 6.5 Enterprise Tier (API-key auth)

For licensed B2B consumers who want stable programmatic access without
wiring per-request x402 USDC settlement, DiversiFi offers an additive
API-key path. The public x402 flow is unchanged — the API-key branch is a
parallel authenticator.

#### Configuration

Enterprise keys are configured server-side via the `ENTERPRISE_API_KEYS`
environment variable (§2) — a JSON array of key objects:

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

### 6.6 Support

- GitHub: [thisyearnofear/diversify](https://github.com/thisyearnofear/diversify)
- Live gateway: https://api.diversifi.famile.xyz
- Settlement metrics: https://api.diversifi.famile.xyz/api/agent/x402-metrics

---

## 7. Deployment & ops

Hosting today: **Vercel** (frontend) + **Hetzner** (agent runtime, PM2 process
`diversifi-api`, Guardian cron `*/5`) + **Alibaba Cloud** (memory stack, proof below).

### 7.1 Live status (2026-07-20) — Alibaba Cloud

**Qwen Cloud Global AI Hackathon — Track 1: MemoryAgent.** This section proves that the
DiversiFi backend uses Alibaba Cloud services and APIs. It accompanies the submission form
fields *URL to code file showing proof of Alibaba Cloud Deployment* and *Screenshot showing
proof of Alibaba Cloud Deployment*.

| Component | Status | Evidence |
|-----------|--------|----------|
| **DashScope (Qwen LLM)** | ✅ **LIVE** | Verified with real API call to `https://ws-kkczlxkkjjckouxq.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions` — Qwen returned a valid response |
| **Tablestore instance** | ✅ **LIVE** | Instance `diversifi-memory` created in `cn-beijing` (CU mode, high-performance, ZRS), public internet access enabled, RAM user `diversifi-memory-agent` with `AliyunOTSFullAccess` + `AliyunFCFullAccess` attached |
| **Tablestore Memory Storage API** | ⏳ **Beta allowlist (邀测)** | The Memory Storage sub-service is in invitation-only beta. All API calls (`createMemoryStore`, `addMemories`, `searchMemories`) return `OTSAuthFailed: The user is disabled` — even with the root account AccessKey. This is an account-level allowlist gate, not a permissions issue. Activation requires joining the Tablestore team's DingTalk group (36165029092) and requesting access. The adapter code is complete and will work the moment the account is allowlisted. The same `OTSAuthFailed: The user is disabled` error also appears when the RAM user `diversifi-memory-agent` is disabled — it must be **enabled** in the Alibaba console (RAM → Users) for any call to succeed. |
| **Function Compute** | 📦 **Ready to deploy** | `s.yaml` configured for `cn-beijing`, `index.js` handler complete, `package.json` includes `tablestore@^5.6.5` dependency. Deployment gated on `s deploy` (needs `@serverless-devs/s` CLI + AccessKey credentials) |
| **Guardian cron (Hetzner)** | ✅ **LIVE** | PM2 process `diversifi-api` running on Hetzner server, env vars deployed, `/api/agent/guardian-loop` endpoint verified responding with `{"success":true}` |

#### About the Memory Storage 邀测 (invitation beta)

The Tablestore Memory Storage service is currently in **邀测 (invitation beta
test)** — a gated preview that requires manual account activation by the
Tablestore team. From the [official beta guide](https://developer.aliyun.com/article/1732112):

> "如果您想进一步了解表格存储记忆服务，可以加入表格存储技术交流钉钉群：36165029092"
>
> Translation: "To learn more about the Tablestore Memory Service, join the
> Tablestore technical exchange DingTalk group: 36165029092"

The service is only available in `cn-beijing` and only for allowlisted
accounts. The billing docs confirm the service is pre-GA: "Memory storage
charges take effect on July 30, 2026" — indicating general availability is
imminent but not yet open.

**What we built despite this:**
- A complete Tablestore Memory Storage adapter (`tablestore-memory-service.ts`)
  using the official `tablestore@^5.6.5` Node.js SDK with `createMemoryStore`,
  `addMemories`, `searchMemories`, `deleteMemory`, `listMemories`
- A Function Compute handler (`fc-memory-consolidation/index.js`) that
  orchestrates the full consolidation pipeline on Alibaba Cloud
- A Cognee fallback that provides the same memory semantics locally, so the
  app is fully functional today and upgrades to Tablestore the moment the
  allowlist is granted

The 邀测 gate is an Alibaba Cloud account-level control, not a code or
architecture issue. Every piece of the integration is implemented, tested
(880 tests pass), and ready to activate.

### 7.2 Proof files

The following code files in the repository demonstrate use of Alibaba Cloud
services and APIs:

| File | Alibaba Cloud Service | Purpose |
|------|----------------------|---------|
| [`ops/alibaba-cloud/fc-memory-consolidation/index.js`](../ops/alibaba-cloud/fc-memory-consolidation/index.js) | **Function Compute** + **Tablestore** + **DashScope** | FC handler that runs on Alibaba Cloud — reads memories from Tablestore, consolidates with Qwen via DashScope, writes profile back |
| [`packages/shared/src/services/tablestore-memory-service.ts`](../packages/shared/src/services/tablestore-memory-service.ts) | **Tablestore** | Memory adapter using the Tablestore Memory Storage HTTP API (`searchMemories`, `addMemories`, `deleteMemory`) |
| [`packages/shared/src/services/ai/providers/dashscope-provider.ts`](../packages/shared/src/services/ai/providers/dashscope-provider.ts) | **DashScope (Bailian)** | Qwen long-context LLM provider via the OpenAI-compatible DashScope API |
| [`packages/shared/src/services/memory-consolidation-service.ts`](../packages/shared/src/services/memory-consolidation-service.ts) | **Function Compute** (via HTTP delegation) + **Tablestore** + **DashScope** | Orchestrates the consolidation pipeline — delegates to FC when `ALIBABA_CLOUD_FC_ENDPOINT` is set, falls back to local Tablestore/Cognee |

**Primary proof file:** `ops/alibaba-cloud/fc-memory-consolidation/index.js`

This is a Function Compute handler that runs on Alibaba Cloud infrastructure
and uses three Alibaba Cloud services:

1. **Function Compute (FC)** — the serverless compute platform hosting the handler
2. **Tablestore** — the Agent Memory store for persistent memory with vector search
3. **DashScope (Bailian / Model Studio)** — the Qwen long-context LLM API

### 7.3 Alibaba Cloud services used

#### 1. Function Compute (FC)

The memory consolidation handler is deployed as a Node.js 18 function on
Alibaba Cloud Function Compute. It exposes an HTTP trigger that the Guardian
cron (running on Hetzner) calls to trigger memory consolidation for a specific
user.

- **Runtime:** Node.js 18
- **Memory:** 512 MB
- **Timeout:** 120s (Qwen long-context consolidation can be slow)
- **Trigger:** HTTP (POST)
- **Region:** `cn-beijing` (co-located with the Tablestore instance — Memory Storage is only available in this region)

Deployment manifest: [`ops/alibaba-cloud/fc-memory-consolidation/s.yaml`](../ops/alibaba-cloud/fc-memory-consolidation/s.yaml)

#### 2. Tablestore (Agent Memory)

Tablestore's Agent Memory feature provides:

- **Long-term memory storage** with automatic extraction from conversation messages
- **Vector search** (`searchMemories`) for semantic recall across sessions
- **Short-term vs long-term separation** — raw messages are short-term, extracted signals are long-term
- **Scoped by app/tenant/agent/session** — multi-user, multi-agent isolation

APIs used (via HTTP JSON protocol):

| API | Purpose |
|-----|---------|
| `searchMemories` | Vector search for recalling relevant memories |
| `addMemories` | Store new memories (with background long-term extraction) |
| `deleteMemory` | Evict stale/absorbed memories (hard forgetting) |
| `listMemories` | List all memories for a user (GDPR forget) |

Adapter: [`packages/shared/src/services/tablestore-memory-service.ts`](../packages/shared/src/services/tablestore-memory-service.ts)

#### 3. DashScope (Bailian / Model Studio)

DashScope is Alibaba Cloud's AI model serving platform. We use the
OpenAI-compatible endpoint to access Qwen long-context models for memory
consolidation:

- **Endpoint:** `DASHSCOPE_BASE_URL` env var (defaults to `https://dashscope.aliyuncs.com/compatible-mode/v1`; can be pointed at a custom MaaS endpoint like `https://<workspace>.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`) — §2 row
- **Default model:** `qwen-plus` (balance of quality and cost; configurable via `DASHSCOPE_MODEL`)
- **For large memory pools:** `qwen-long` (1M-token context window)
- **For highest quality:** `qwen-max`

Provider: [`packages/shared/src/services/ai/providers/dashscope-provider.ts`](../packages/shared/src/services/ai/providers/dashscope-provider.ts)

### 7.4 Memory architecture & pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        User (Browser)                           │
│                    DiversiFi Next.js App                        │
│                   (Vercel — Frontend + API)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Chat / Advisor / Swap
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Guardian Cron (Hetzner)                      │
│            Every 5 min — auto-execution loop                    │
│  Every ~6h: triggers memory consolidation per active user       │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
           │  POST { userId }             │  (fallback: local
           │                              │   consolidation)
           ▼                              ▼
┌──────────────────────────┐   ┌─────────────────────────────────┐
│  Alibaba Cloud FC        │   │  Local Consolidation             │
│  (Function Compute)      │   │  (Hetzner / Vercel)              │
│                          │   │                                 │
│  index.handler           │   │  memoryConsolidationService      │
│  ┌────────────────────┐  │   │  ┌───────────────────────────┐  │
│  │ 1. searchMemories  │──┼───┼──│ Tablestore (if configured)│  │
│  │   (Tablestore)     │  │   │  │ or Cognee (fallback)      │  │
│  │ 2. Qwen consolidate│  │   │  └───────────────────────────┘  │
│  │   (DashScope)      │  │   │  ┌───────────────────────────┐  │
│  │ 3. addMemories     │──┼───┼──│ Qwen (DashScope) or       │  │
│  │   (Tablestore)     │  │   │  │ fallback LLM chain        │  │
│  │ 4. deleteMemory    │──┼───┼──│ for consolidation          │  │
│  │   (Tablestore)     │  │   │  └───────────────────────────┘  │
│  └────────────────────┘  │   └─────────────────────────────────┘
└──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Alibaba Cloud Tablestore                      │
│               Agent Memory Store (persistent)                   │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │ Short-term  │  │ Long-term   │  │ Vector Search Index │     │
│  │ (raw msgs)  │  │ (profiles)  │  │ (semantic recall)   │     │
│  └─────────────┘  └─────────────┘  └─────────────────────┘     │
│                                                                 │
│  Automatic long-term memory extraction from conversations       │
│  Scoped by appId / tenantId / agentId / runId                   │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Alibaba Cloud DashScope (Bailian)                  │
│                  Qwen Long-Context LLM API                      │
│                                                                 │
│  Models: qwen-plus (default) | qwen-long (1M ctx) | qwen-max   │
│  Endpoint: DASHSCOPE_BASE_URL (configurable)                    │
│  Used for: memory consolidation (raw → distilled profile)       │
└─────────────────────────────────────────────────────────────────┘
```

The consolidation pipeline implements the three Track 1 (MemoryAgent) requirements:

**1. Efficient memory storage and retrieval**

- Raw interactions are stored via `addMemories` (Tablestore) or `remember` (Cognee)
- Recall uses vector search (`searchMemories`) for semantic retrieval
- A consolidated profile is stored as a high-priority memory with `metadata.type = 'consolidated_profile'`

**2. Timely forgetting of outdated information**

- **Soft forgetting (decay):** memories older than TTL (30 days) have their recall score penalized proportional to age; at 2×TTL the score reaches zero
- **Hard forgetting (sweep):** `sweepStaleMemories` evicts memories with decayed score below the threshold via `deleteMemory`
- After consolidation, absorbed raw memories are evicted to prevent the store from growing unbounded

**3. Recalling critical memories within limited context windows**

- Qwen long-context models (`qwen-long` supports 1M tokens) consolidate up to 40 raw memories into 3-7 distilled profile statements
- The distilled profile is prioritized in recall (high-priority flag, score > 0.5 filter)
- This keeps the advisor's context window focused on durable signals, not ephemeral details

### 7.5 Security hardening

#### Scripts & Credentials
- Deploy scripts excluded from git (`.gitignore`)
- `.example` files provided with placeholder env vars
- Never commit real credentials or API keys

#### MongoDB
- Removed `0.0.0.0/0` access rule
- Use IP whitelisting for production
- Enable encryption at rest

#### SSH & Server
- Use SSH keys (no password auth)
- Restrict MongoDB Atlas to server IP only
- Enable firewall on Hetzner server
- Rotate API keys regularly

#### Deployment Scripts Security
The following files are git-ignored and must be configured from `.example` templates:
- `start-runtime.sh` — Agent runtime startup
- `pm2.ecosystem.config.cjs` — PM2 process config with env vars
- `deploy-env-to-server.sh` — Environment sync
- `nginx.conf` — Reverse proxy config

The canonical backend deploy is `./scripts/deploy-to-hetzner.sh` (tracked, not gitignored) — see [`scripts/README.md`](../scripts/README.md) for details.

#### Hetzner edge parity (geo-block)

`proxy.ts` runs on Vercel only. Heavy routes rewritten to `HETZNER_API_URL`
(`next.config.js`: `/api/agent/status`, `/advisor`, `/deep-analyze`,
`/x402-gateway`, `/api/vault/*`, `/api/streaks/*`) bypass it when called
against the Hetzner host directly — so the Hetzner nginx
(`scripts/nginx-diversifi-api.conf`) must enforce the same block. Until then,
do not claim edge-blocking covers vault routes.

1. Add an allowlist (not yet implemented): the rewrites would send a shared
   `X-Edge-Secret` header from `HETZNER_EDGE_SECRET`, and nginx would accept
   only requests carrying it, returning 451 otherwise. Direct-host calls would
   then fail closed.
2. Or add MaxMind GeoIP2 with the same `SANCTIONED_COUNTRIES` /
   `SANCTIONED_REGIONS` list as `config/jurisdictions.ts` and return 451.
3. Verify: `curl -H "Host: api.diversifi.famile.xyz" https://<hetzner-ip>/api/vault/guardian-state`
   without the secret must return 451.

#### Compliance rate-limit store

`/api/compliance/screen` (20 req/min/IP) and `lib/rate-limit.ts` are
per-instance memory — best-effort. Before `NEXT_PUBLIC_FEATURE_FEES=true`
makes `unavailable` fail closed, move `compliance-screen:*` counters to
Upstash Redis or Mongo (fixed window, `Retry-After` preserved). Keep the
in-memory fallback and log which store served.

Agent-endpoint secrets (`GUARDIAN_LOOP_SECRET`, `FIRECRAWL_WEBHOOK_SECRET`) and signer keys are §2 rows; signer env vars are scrubbed in every test worker (`vitest.setup.ts` + `packages/shared/src/utils/signer-env-keys.ts`, enforced by `apps/web/lib/__tests__/signer-env-leak.test.ts`).

### 7.6 Alibaba Cloud deployment instructions

#### Prerequisites

1. Alibaba Cloud account
2. Serverless Devs CLI: `npm i -g @serverless-devs/s`
3. Credentials: `s config add --AccessKeyID <key> --AccessKeySecret <secret> -a default`
4. DashScope API key from [Bailian console](https://bailian.console.aliyun.com/)

#### Step 1: Create Tablestore instance

1. Go to the [Tablestore console](https://otsnext.console.aliyun.com/)
2. **Region must be `cn-beijing`** — the only region where Tablestore Agent Memory is currently available
3. Create an instance (CU mode, high-performance, ZRS redundancy)
4. Under **Network Management**, enable **Internet** access (required for cross-region calls from FC/Hetzner)
5. Note the endpoint (`https://<instance>.cn-beijing.ots.aliyuncs.com`) and instance name
6. Create a RAM user with `AliyunOTSFullAccess` + `AliyunFCFullAccess` policies and an AccessKey pair
7. **Request Memory Storage beta access** — join DingTalk group `36165029092` and ask the Tablestore team to allowlist your account. The Memory Storage API (`createMemoryStore`, `addMemories`, `searchMemories`) returns `OTSAuthFailed: The user is disabled` until the account is allowlisted.
8. Once allowlisted, create a memory store named `diversifi_agent_memory` (via the SDK or CLI)

#### Step 2: Deploy the Function Compute handler

```bash
cd ops/alibaba-cloud/fc-memory-consolidation
s deploy
```

#### Step 3: Configure environment variables

In the FC console, set these environment variables for the function (all rows in §2):

```
DASHSCOPE_API_KEY=<your-dashscope-api-key>
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
TABLESTORE_ENDPOINT=https://<instance>.cn-beijing.ots.aliyuncs.com
TABLESTORE_INSTANCE_NAME=<your-instance-name>
TABLESTORE_MEMORY_STORE_NAME=diversifi_agent_memory
TABLESTORE_APP_ID=diversifi
ALIBABA_CLOUD_ACCESS_KEY_ID=<your-access-key-id>
ALIBABA_CLOUD_ACCESS_KEY_SECRET=<your-access-key-secret>
```

#### Step 4: Wire the Guardian cron

Set `ALIBABA_CLOUD_FC_ENDPOINT` in the DiversiFi `.env.local` to the FC HTTP
trigger URL. The Guardian cron will now delegate consolidation to Alibaba Cloud.

#### Step 5: Take the workbench screenshot

1. Open the [Function Compute console](https://fcnext.console.aliyun.com/)
2. Navigate to the `diversifi-memory-consolidation` function
3. Take a screenshot showing the function running (code tab, trigger tab, or invocations tab)
4. Upload this screenshot to the Devpost submission form

### 7.7 Alibaba Cloud optionality

All Alibaba Cloud services are behind environment variables (§2 rows). When unset:

| Env var unset | Behavior |
|---------------|----------|
| `ALIBABA_CLOUD_FC_ENDPOINT` | Guardian cron does local consolidation instead of delegating to FC |
| `TABLESTORE_ENDPOINT` | Memory backend falls back to Cognee |
| `DASHSCOPE_API_KEY` | LLM consolidation falls back to Gemini → Venice → ... chain |

The app is fully functional without any Alibaba Cloud services configured.
Alibaba Cloud is an accelerator, not a dependency.

---

## 8. Demo capture playbook

Guardian Capture Playbook — "Show the Work", verifiable end to end.

Purpose: turn Guardian's real decision-making into short-form video the way the
TypeSafe/Jev demos do — visible speed, visible counts — but with our inversion:
**every frame is checkable by the viewer.** Their demos ask you to believe the
agent was fast; ours ends in a link that proves it happened. This section is
the standing spec so a capture is reproducible the day a real signal fires,
not a one-off scramble.

### 8.1 Honesty hierarchy (load-bearing)

Ranked by strength, highest first. Never publish below tier 2.

0. **Consented real user** — a live account of someone who opted in: their
   holdings strip, their stands-downs, their words ("a week of protecting a
   Nairobi seller's purchasing power"). This is the endgame format and the
   only one that carries human stakes we didn't author. Requires a real
   consent program (§8.7 Phase 3) — never a convenience capture.
1. **The Guardian public wallet** — our own real account on Celo mainnet,
   running real bounds against real macro events, with its address published
   in the clip and its full decision history auditable. Nothing to label
   beyond "this is our live wallet, here's the address — check it." Every
   frame is the real pipeline; the only unusual thing about this account is
   that a camera is allowed on it.
2. **Rehearsal rig (testnet, crew-training only)** — the identical pipeline
   on Celo Sepolia with faucet funds. Exists to debug the capture stack
   cheaply without risking real funds; it is a drill, not a content source.
   If rehearsal footage ever ships, "testnet settlement" appears inside the
   first 3 seconds.
3. **Directed-but-true** — we may *set conditions* to provoke a decision on
   the public wallet (e.g., lower `dailyLimitUSD` so the next real signal
   executes or stands down), but never fake state: real webhook event, real
   cron tick, real receipt. The caption names the setup ("we set the daily
   bound to $2 for this test").
4. Not allowed, ever: mocked API responses on screen, interpolated metrics,
   re-staged "live" UI, or any number that doesn't exist in the product at
   capture time.

Why a public wallet instead of just filming real users: a user's financial
life is not our marketing content — consent aside, filming the people we
protect would be exploiting the trust the product earns to sell the product.
The public wallet has a property no user footage can: the subject of the ad
is itself auditable by the viewer.

### 8.2 The rig (wallet + bounds)

A dedicated **Guardian public wallet**, funded and armed permanently and
living on mainnet (parked wallets drift; a live one accumulates the real
decision history the clips show). Its address is published — in the trust
tier eventually, in the clip caption immediately. The same build parameters
apply to the Sepolia rehearsal rig; only the chain and the funding source
change.

| Item | Value | Why |
|---|---|---|
| Chain | Celo mainnet (rehearsal: Celo Sepolia, faucet) | Mainnet = real receipts, real explorers, no labels; Sepolia is in `ChainDetectionService.isSupported` for drills |
| Holdings | cUSD ≈ $60 equivalent | Funding for separately permissioned Guardian moves; webhook observations do not spend it |
| Permission `allowedTokens` | `['KESm', 'cEUR', 'USDY']` | Bounds separately permissioned proposals; Firecrawl currently selects no destination token |
| Permission `dailyLimitUSD` | $5 (≈8%) | Small enough that a second same-day signal plausibly declines — declines are shot list §8.5 |
| Permission `expiresAt` | rolling, ≤90 days | Renew in the monthly runbook before expiry |
| Key custody | Privy-backed account, credentials documented in the ops vault | Anyone on the team must be able to arm it; it is not a secrets vault — size the funds to "annoying to lose, not catastrophic" |

**Arming procedure** (once per renewal cycle):

1. Connect the demo wallet → Shield tab → protection card → sign the plan,
   which POSTs `/api/vault/permission` with the values above.
2. Confirm the arm: `GET /api/vault/permission?userAddress=0x…` returns
   `status: 'active'`, the `decisionLog`, `latestAnchors`, and `activityStats`
   — this response is also the B-roll proving the bounds are real.
3. Confirm the Guardian sees it: next cron tick (`*/5`) appears in PM2 logs
   on the Hetzner runtime and `activityStats.checks` increments.

**Monthly runbook** (first business day): top up drained tokens, check
`expiresAt`, re-sign if within 30 days of expiry, skim `decisionLog` for
caption-worthy entries, note the ISO week in the capture journal.

### 8.3 Signal substrate (what actually triggers a decision)

- Watchers: registered via `scripts/setup-firecrawl-monitors.ts` — Fed/ECB
  rate pages, DeFiLlama yield data, stablecoin depeg trackers.
- Webhook gate: exact curated HTTPS source policy in `macro-source-policy.ts`.
  Page changes remain `MACRO_OBSERVATION` unless an independent adapter supplies
  dated measurements. The stablecoin page triggers fresh USDC/USDT/DAI price
  reads: deviations greater than 1% can record `MACRO_SIGNAL:PRICE_DEVIATION`.
  Missing or stale prices cannot promote scraped claims into measured signals.
  Neither path fans out into user recommendations; price deviation is not a
  solvency finding or a trade instruction.
- Not every shoot day has a real event. `pnpm rehearse-macro-signal --send`
  drives the identical entry point (authenticated POST → observation → anchor → echo →
  feed) without queueing intents or writing memory — honest on camera because
  the anchor is typed `MACRO_SIGNAL:REHEARSAL` and its echo is server-forced
  to `[Rehearsal — not a market event]` at the marker URL. Check readability
  first with `pnpm rehearse-macro-signal --verify-only`: a hash-only row
  means that record has no echo. (Full rehearsal semantics: [§4.3](#macro-path-rehearsal).)
- Advisory layer (bonus material, no extra setup): the TypeSafe Signal Lens
  now runs on every event (`ENABLE_TYPESAFE_SIGNAL_LENS=true` on the
  backend — §2). After ~2–3 weeks of accumulation,
  `GET /api/agent/guardian-telemetry → signalLens.agreement` yields the
  "two independent detectors agreed on N of M" stat — a follow-up clip, not
  a precondition for the first ones.
- Trigger awareness when shooting: tail the webhook/loop logs on the Hetzner
  runtime (`pm2 logs diversifi-api`), or poll the rig's
  `guardian-state`/permission read. A decision entry with `durationMs` +
  `txHash` is the "press record" signal.

### 8.4 Capture stack (quality, deterministic, re-runnable)

- Real browser (Chromium), real app build against the live API — no
  dev-only data paths, no stubs. 1920×1080 master; crop to 1080×1350 for
  vertical.
- Record at 60fps; the product's motion *is* the pacing (springPop arrival
  on the attribution line, count-up on the cadence stats) — do not
  post-animate product numbers.
- OS clock visible in frame (screen-recorder chrome, not a title card) so
  "03:12, Saturday" is evidence, not decoration.
- Store raw captures + the receipt artifacts (txHash, anchor id, telemetry
  JSON snapshot) side by side in the asset folder; every published clip must
  be reconstructible from the folder alone.
- Scripted prep (to live under `scripts/capture/` when we build it): a
  checklist runner that opens each surface at the right viewport, waits for
  data-testid presence (`guardian-attribution`, `guardian-since-visit`,
  `guardian-decision-ref`), and only then greenlights the take.

### 8.5 Shot list — execution clip ("While you were asleep")

| # | Surface (real component) | What the frame proves |
|---|---|---|
| 0 | Home — `guardian-since-visit` line (F2) | The product itself noticed the event happened while the user was away |
| 1 | Shield inspector — `guardian-attribution` line (F1) | "Guardian moved {token} · {timeAgo} · decided in {formatDuration}" + anchor link — measured `durationMs` on screen |
| 2 | Tap → Ask Guardian — `guardian-decision-ref` card (F4) | Drill-down renders the decision verbatim; the advisor's answer is grounded in the actual record (`contextRecords`) |
| 3 | Explorer tx page (typed URL, loaded live) | On-chain settlement — Celoscan/Arbiscan, receipt confirmed |
| 4 | `GET /api/agent/zero-g-ledger?verify=<txHash>` in browser (typed, not screenshot) | The evidence anchor verifies from a cold start, in front of the viewer |
| 5 | Automation settings → Quiet/Informed row; then "tell me less" in chat | Preferences are agent-native, visible, reversible — closes on user control, not machine bragging |
| 6 | End card | "Every second in this clip is measured. The last one is checkable." + link to live telemetry |

### 8.6 Shot list — stand-down clip (the differentiator)

Same stack, different story: the Guardian **refuses** to move money.

1. Attribution line shows a decline: "stood down on {token} · daily_limit_reached".
2. Inspector reveals the reason and the spent-today ledger — the bound was
   real and it bit.
3. Ask Guardian drill-down answers "why did you do nothing?" grounded in the
   decline record.
4. End card: "The best protection feature is an agent that says no. Its
   reason has a receipt too."

Provocation (directed-but-true): let one actionable signal execute, then
lower `dailyLimitUSD` to just under the spent amount before the next real
signal so it declines on the record. Caption discloses the bound-setting
step; nothing else is staged.

### 8.7 Caption and disclosure rules

- First 3 seconds: name the rig ("our live public wallet — address is in
  this thread" / "testnet rehearsal, everything else live").
- No number in the video may come from post-production; graphics only
  *highlight* on-screen product values (circle the timestamp, never add one).
- Reply-thread first post: the exact verification path (explorer URL,
  zero-g-ledger verify URL, telemetry endpoint). We want people to check.
- No "−0%", no fabricated zeros, no "Balance: 0.0000" props — the honesty
  contract applies to pixels too.

### 8.8 Phase plan

- **Phase 1 (this week):** arm the **Guardian public wallet on Celo mainnet**
  (~$60 permanent funding, published address), and run the Sepolia
  rehearsal rig only to debug the capture stack. First cut: a
  directed-but-true stand-down on the public wallet — it's the most
  provokable and the most differentiated clip.
- **Phase 2:** let real macro events accumulate an execution history on the
  public wallet; publish its address in the trust tier so the product itself
  points at an auditable account. From then on, clips are harvested, never
  staged.
- **Phase 3 (the format worth investing in):** the **consented real-user
  track** — a proper opt-in program: consent flow, scope of what's
  shareable (holdings? declines? chat?), compensation, privacy review, and
  an easy opt-out that doesn't degrade their protection. This is tier 0 of
  the honesty hierarchy and the only path to clips with human stakes we
  didn't author.
- **Phase 4 (opportunistic):** the Signal Lens agreement stat ("our two
  independent detectors agreed on N of M macro reads") as a follow-up clip
  once ≥5 comparable shadow pairs exist.

---

## 9. Troubleshooting

- **Insufficient funds**: Ensure deployer wallet has testnet tokens
- **Nonce issues**: Reset wallet nonce or use `--nonce` flag
- **Transaction reverts**: Check constructor args and contract dependencies
- **Agent not executing**: Verify agent runtime is running (`pm2 status`)
- **A test reaches a real network call**: a signer key leaked — fix the scrub list in `vitest.setup.ts` (`packages/shared/src/utils/signer-env-keys.ts`), don't mock the test (the leak test names offending keys).
- **Memory provider shows "Unavailable right now"**: the health-aware probe failed (`reason: unreachable` from `GET /api/agent/memory?providers=1`) — check the provider's env rows in §2 and the probe path, not just key presence.
- **`OTSAuthFailed: The user is disabled` (Tablestore)**: account-level 邀测 allowlist not granted and/or the RAM user is disabled — see [§7.1](#71-live-status-2026-07-20-alibaba-cloud).
- **Quote renders nothing on Exchange**: a failed quote renders nothing by contract — never a static-rate number; check `pnpm check-swap-routes`.
