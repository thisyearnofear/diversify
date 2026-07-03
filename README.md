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
| **Money Movement** | **Arc** | USDC-native gas nanopayment settlement for x402 intelligence consumption. Sub-cent, sub-second. | USDC as native gas. Circle Gateway integration. Built-in FX engine. |

**AI Reasoning Engine (Gemini → Venice → 0G Serving → Modal)**: Multi-provider failover chain. Each response is tagged with the provider that produced it.

**Arc Network x402 (Autonomous Economics)**: Premium intelligence flows are gated by HTTP 402 challenges settled on Arc. External agents pay USDC to consume Mento depeg + inflation + yield intelligence.

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
- **RecommendationLedger**: *(mainnet deployment in progress — see `docs/roadmap.md`)*

### Arbitrum Mainnet
- **RecommendationLedger** (yield decisions of record): [`0x3BCf7dFd68ce98880618c89A351168960724369C`](https://arbiscan.io/address/0x3BCf7dFd68ce98880618c89A351168960724369C)
- **First recommendation**: [`0x2a034aad…`](https://arbiscan.io/tx/0x2a034aad48a7bf026358df745b43126f89f5da09b3521ba7b5d2fa7cc5eea8f0) — yield rotation USDC→USDY, confidence 85%
- **Deployment**: `forge script scripts/DeployRecommendationLedger.s.sol --rpc-url arbitrum_one --broadcast`

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

### Arc Stack (Autonomous Payments)
- **Agent Wallet (Arc Testnet)**: `0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8`
- **Settlement Metrics**: [https://api.diversifi.famile.xyz/api/agent/x402-metrics](https://api.diversifi.famile.xyz/api/agent/x402-metrics)
- **Arc Explorer**: [testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8](https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8)

---

## Development

```bash
pnpm install
# Ensure .env.local is configured per docs/getting-started.md
pnpm dev
```
For deep-dive documentation on our cross-chain architecture and settlement flow, see [docs/architecture.md](docs/architecture.md).
