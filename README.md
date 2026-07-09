# DiversiFi: Agent Intelligence Protocol for Stablecoin Markets

## Multi-chain intelligence + verifiable settlement for autonomous agents

> *DiversiFi is a multi-chain agent intelligence protocol that makes stablecoin and yield markets agent-readable. Autonomous agents consume real-time depeg, inflation, and yield intelligence via x402 nanopayments, settle every decision on a verified ledger on the chain where the money moves, and anchor reasoning to 0G — with the DiversiFi Guardian as the reference consumer and an open SDK for any agent to subscribe. Full pitch: [`docs/product.md`](./docs/product.md).*

The **DiversiFi Guardian** is the first agent built on the protocol — a proactive AI that monitors markets, detects inflation shifts, and protects stablecoin savings by routing capital between Celo/Mento (local stablecoins) and Arbitrum (deep liquidity, RWA yield), with on-chain proof of every decision.

**Live App:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app)

---

## Chain Architecture

Each chain has a genuine, irreplaceable role. The ledger of record follows the money — decisions settle on the chain where the action executes, not on a single canonical chain.

| Layer | Chain | Role | Why this chain |
|---|---|---|---|
| **Savings + Identity** | **Celo** | Hold, save, rebalance across local stablecoins (cUSD, cEUR, cREAL, KESm, COPm, PHPm). `RecommendationLedger` records savings decisions here. ERC-8004 agent identity. | Regional Mento stablecoins exist nowhere else. Near-zero fees. SocialConnect ODIS identity. GoodDollar UBI. |
| **Yield + Execution** | **Arbitrum** | Deep-liquidity DEXs and RWA yield (Uniswap V3, 1inch, Camelot, PAXG, USDY, SYRUPUSDC). `RecommendationLedger` records yield decisions here. EIP-7702 path to on-chain ERC-7710 permission enforcement. | Deepest USDC + RWA liquidity. EIP-7702-capable for true on-chain permission enforcement. |
| **Evidence + Verifiability** | **0G** | Content-addressed Storage (evidence CIDs), TEE-verified Compute, DA (state snapshots). The tamper-proof evidence layer that both ledgers reference. | No other chain offers storage or verifiable inference. 0G is not the ledger of record — it is the proof layer. |
| **Money Movement** | **Arbitrum / Arc / 0G (env-gated)** | x402 nanopayment settlement rail for paid intelligence. `SETTLEMENT_NETWORK=ARBITRUM\|ZERO_G\|ARC`, `SETTLEMENT_ENV=testnet\|mainnet`. | Arbitrum has live Circle USDC on mainnet today; Arc and 0G mainnet settlement remain pending verified USDC contracts. |

**AI Reasoning Engine (Gemini → Venice → 0G Serving → Modal)**: Multi-provider failover chain. Each response is tagged with the provider that produced it.

**x402 Settlement Rail (Autonomous Economics)**: Premium intelligence flows are gated by HTTP 402 challenges settled on the configured rail (`ARBITRUM` recommended for mainnet, `ZERO_G` default, `ARC` optional; `testnet` or `mainnet`). External agents pay USDC to consume Mento depeg + inflation + yield intelligence.

---

## Key Features

*   **Intelligence Gateway**: x402-gated Mento depeg + inflation + yield intelligence, open to any agent via SDK. The Guardian is the reference consumer; external agents are consumers #2+.
*   **Chain-Aware Ledger**: `RecommendationLedger` records decisions on the chain where the money moves — Celo for savings, Arbitrum for yield. Each entry references a 0G Storage evidence CID.
*   **Guardian Pulse**: AI-synthesized market insights, powered by real-time data and anchored for truth via 0G.
*   **Proactive Pilot**: Autonomous rebalancing intent discovery, allowing users to approve complex financial strategies with one tap.
*   **0G Audit Trail**: An in-app dashboard to verify the raw evidence and decision logs of your agent.
*   **Dual-Chain Routing**: Guardian automatically chooses Celo for stable-savings actions and Arbitrum for liquidity/RWA actions. Each chain has a verified ledger of record.
*   **Frictionless Onboarding**: Secure, social-login-first (Privy) UX that abstracts away the complexity of managing agent wallets.

---

## Deployment Proofs

### Celo Mainnet
- **ERC-8004 Agent Identity**: agentId 9654, registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — [Celoscan tx](https://celoscan.io/tx/0xb698d493282c1826546cb4a78258cf1cdff33f325770917cd215c4c90f14e5d1)
- **RecommendationLedger** (savings decisions of record): [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://celoscan.io/address/0x3BCf7dFd68ce98880618c89A351168960724369C#code) — ✅ source verified
- **First recommendation**: [`0xea1b169a…`](https://celoscan.io/tx/0xea1b169acd6cee8e3a50fcde9fd6f1d862a0a9609272e49ee0666b65187d2d5e) — Mento rebalance to cUSD, confidence 82%

### Arbitrum Mainnet
- **RecommendationLedger** (yield decisions of record): [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://arbiscan.io/address/0x3BCf7dFd68ce98880618c89A351168960724369C#code) — ✅ source verified
- **First recommendation**: [`0x2a034aad…`](https://arbiscan.io/tx/0x2a034aad48a7bf026358df745b43126f89f5da09b3521ba7b5d2fa7cc5eea8f0) — yield rotation USDC→USDY, confidence 85%
- **Deployment**: `forge script scripts/DeployRecommendationLedger.s.sol --rpc-url arbitrum_one --broadcast`

### 0G Mainnet
- **RecommendationLedger** (evidence anchor): [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://chainscan.0g.ai/address/0x3BCf7dFd68ce98880618c89A351168960724369C)
- **First recommendation**: [`0x981086b4…`](https://chainscan.0g.ai/tx/0x981086b466438af7eb2dc0a8c97f4370ed6e926abfc9095a8f610afbd86e864e) — evidence anchor, confidence 95%
- **Deployment**: `forge script scripts/DeployRecommendationLedger.s.sol --rpc-url zero_g_mainnet --broadcast`

### Arbitrum Sepolia (testnet)
- **RecommendationLedger**: [`0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996`](https://sepolia.arbiscan.io/address/0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996)
- **StrategyVault**: [`0xd83797702AE6ef15349e762B22bfe79322B46975`](https://sepolia.arbiscan.io/address/0xd83797702AE6ef15349e762B22bfe79322B46975)
- **AgenticHub**: [`0x72c78a27a47d07656bb6b606d7DB5Ae5F114bf92`](https://sepolia.arbiscan.io/address/0x72c78a27a47d07656bb6b606d7DB5Ae5F114bf92)
- **Deployment script**: `./scripts/deploy-all.sh arbitrum_sepolia --verify`

### 0G Stack (Verifiable Evidence)
- **0G Galileo Testnet Mirror** (chainId `16602`): [`0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED`](https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED)
- **0G Storage Evidence**: Every Guardian recommendation uploads an encrypted evidence bundle (prompt + reasoning + sources) and records its CID in the chain-aware ledger.
- **0G Compute (Direct)**: High-impact decisions can be routed through TEE-verified providers with `processResponse()` proof verification.
- **Verifiable AI Dashboard**: Open the **"Verifiable AI"** tab in-app to view live evidence CIDs, serving-model IDs, and chain receipts.

### x402 / Settlement Stack (Autonomous Payments)
|- **Default rail**: `ZERO_G` testnet; buildathon mainnet rail is `ARBITRUM` via `SETTLEMENT_NETWORK=ARBITRUM` + `SETTLEMENT_ENV=mainnet` (config-only)
|- **Legacy testnet agent wallet (Arc Testnet)**: `0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8`
|- **Arbitrum mainnet agent wallet**: fund `VAULT_PRIVATE_KEY` with Circle USDC on Arbitrum (address shown in x402-metrics)
|- **Arbitrum settlement contract**: Circle USDC at `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (chainId 42161)
|- **Settlement Metrics**: [https://api.diversifi.famile.xyz/api/agent/x402-metrics](https://api.diversifi.famile.xyz/api/agent/x402-metrics)
|- **Active explorer**: returned by the metrics endpoint under `settlement.explorerBase` (legacy alias `arcSettlement`)

---

## Development

```bash
pnpm install
# Ensure .env.local is configured per docs/getting-started.md
pnpm dev
```
For deep-dive documentation on our cross-chain architecture and settlement flow, see [docs/architecture.md](docs/architecture.md).
