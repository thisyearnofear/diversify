# DiversiFi: The Proactive AI Guardian
## Autonomous Savings Protection for Volatile Economies

> *A savings protection app for people in volatile economies. A proactive AI Guardian monitors markets, detects inflation shifts, and protects stablecoin savings by routing capital between Celo/Mento (local stablecoins) and Arbitrum (liquidity / RWA yield) — with on-chain proof of every decision. Full pitch: [`docs/product.md`](./docs/product.md).*

Every high-impact Guardian decision is verifiable: the full reasoning is encrypted and stored on **0G**, the decision hash is recorded on-chain, and autonomous execution stays within user-signed ERC-7715-style permission bounds (currently enforced in application code, not on-chain — see [`docs/guardian-enforcement-model.md`](./docs/guardian-enforcement-model.md)).

**Live App:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app)

---

## 🏗️ Dual-Chain + Verifiable Architecture

DiversiFi is built on a deliberate chain split that matches real user needs:

| Layer | Chain | Role |
|---|---|---|
| **Savings / Local Stables** | **Celo** | Hold, save, and rebalance across local stablecoins (cUSD, cEUR, regional Mento assets) with near-zero fees. |
| **Liquidity / RWA Yield** | **Arbitrum** | Deploy into deep-liquidity DEXs and RWA yield opportunities (e.g., Uniswap V3, Aave, Centrifuge, Maple). |
| **Verifiable Evidence** | **0G Storage + 0G DA** | Encrypt and store the full reasoning bundle for every Guardian decision; anchor attestations for cross-chain consistency. |
| **On-Chain Ledger** | **Arbitrum** | `RecommendationLedger` records `user → action → evidence CID → serving model → confidence` on an Arbitrum chain (required for prize eligibility). |
| **Autonomous Inference** | **0G Compute + 0G Serving** | High-impact Guardian decisions can be routed through 0G Compute Direct with TEE-verified inference proofs. |

**AI Reasoning Engine (Gemini → Venice → 0G Serving → Modal)**: Multi-provider failover chain. Each response is tagged with the provider that produced it.

**Arc Network x402 (Autonomous Economics)**: Premium research flows are gated by HTTP 402 challenges settled on Arc (with a path to Arbitrum-native x402 where available).

---

## 🚀 Key Features

*   **ArcAgent Service**: `ArcAgent` class extending `AgentService` with ARC testnet-first wallet and session-based execution. Re-exported from `@diversifi/shared`.
*   **ESLint v9 Configuration**: Migrated from `.eslintrc.json` to `eslint.config.cjs` (flat config) with Next.js core-web-vitals rules.

*   **Guardian Pulse**: AI-synthesized market insights, powered by real-time data and anchored for truth via 0G.
*   **Proactive Pilot**: Autonomous rebalancing intent discovery, allowing users to approve complex financial strategies with one tap.
*   **0G Audit Trail**: An in-app dashboard to verify the raw evidence and decision logs of your agent.
*   **Dual-Chain Routing**: Guardian automatically chooses Celo for stable-savings actions and Arbitrum for liquidity/RWA actions.
*   **Frictionless Onboarding**: Secure, social-login-first (Privy) UX that abstracts away the complexity of managing agent wallets.

---

## 🔑 Deployment Proofs

### Arbitrum Deployment
- **Deployment script**: `./scripts/deploy-all.sh arbitrum_sepolia --verify` uses the unified `scripts/DeployArbitrum.s.sol` script and deploys all three Arbitrum Sepolia contracts in one run.
- **RecommendationLedger Contract** (Arbitrum Sepolia, chainId `421614`): [`0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996`](https://sepolia.arbiscan.io/address/0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996)
- **StrategyVault Contract** (Arbitrum Sepolia, chainId `421614`): [`0xd83797702AE6ef15349e762B22bfe79322B46975`](https://sepolia.arbiscan.io/address/0xd83797702AE6ef15349e762B22bfe79322B46975)
- **AgenticHub Contract** (Arbitrum Sepolia, chainId `421614`): [`0x72c78a27a47d07656bb6b606d7DB5Ae5F114bf92`](https://sepolia.arbiscan.io/address/0x72c78a27a47d07656bb6b606d7DB5Ae5F114bf92)
- **Payment token**: Arbitrum Sepolia USDC `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` (baked into `DeployArbitrum.s.sol`).
- **Arbitrum Frontend RPC**: Configured in `components/app/ProviderTree.tsx` / `context/PrivyProvider.tsx`.

### 0G Stack (Verifiable AI)
- **RecommendationLedger Mirror** (0G Galileo Testnet, chainId `16602`): [`0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED`](https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED) — optional audit replica. The 0G Bridge Wave 3 work promotes a 0G mainnet deployment to canonical.
- **0G Storage Evidence**: Every Guardian recommendation uploads an encrypted evidence bundle (prompt + reasoning + sources) and records its CID in the Arbitrum ledger.
- **0G Compute (Direct)**: High-impact decisions can be routed through TEE-verified providers with `processResponse()` proof verification.
- **Verifiable AI Dashboard**: Open the **"Verifiable AI"** tab in-app to view live evidence CIDs, serving-model IDs, and chain receipts.

### Arc Stack (Autonomous Payments)
- **Agent Wallet (Arc Testnet)**: `0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8`
- **Settlement Metrics**: [https://api.diversifi.famile.xyz/api/agent/x402-metrics](https://api.diversifi.famile.xyz/api/agent/x402-metrics)
- **Arc Explorer**: [testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8](https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8)

---

## 🛠️ Development

```bash
pnpm install
# Ensure .env.local is configured per docs/getting-started.md
pnpm dev
```
For deep-dive documentation on our cross-chain architecture and settlement flow, see [docs/architecture.md](docs/architecture.md).
