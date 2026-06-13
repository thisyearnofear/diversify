# DiversiFi: The Proactive AI Guardian
## Autonomous Savings Protection for Volatile Economies

DiversiFi is an autonomous savings guardian. It protects stablecoin savings from local inflation by routing capital between **Celo/Mento** (local stablecoins, low-cost savings) and **Arbitrum** (deep liquidity, RWA yield). Every high-impact Guardian decision is verifiable: the full reasoning is encrypted and stored on **0G**, the decision hash is recorded on-chain, and autonomous execution stays within user-signed ERC-7715 permission bounds.

**Live App:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app)  
**Hackathon Tracks:** 🏆 Arbitrum Overall / Best Agentic Project · 🤖 Agentic Economy · 🛡️ Verifiable AI (0G) · 🪙 Autonomous Payments (Arc)

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

## 🔑 Judge Verification Proofs

### Arbitrum Deployment (Prize Eligibility)
- **RecommendationLedger Contract** (Arbitrum Sepolia, chainId `421614`): *Deployment in progress — address will be updated after `scripts/DeployArbitrumLedger.s.sol` is run.*
- **StrategyVault Contract** (Arbitrum Sepolia, chainId `421614`): *Deployment in progress.*
- **AgenticHub Contract** (Arbitrum Sepolia, chainId `421614`): *Deployment in progress.*
- **Arbitrum Frontend RPC**: Configured in `components/app/ProviderTree.tsx` / `context/PrivyProvider.tsx`.

### 0G Stack (Verifiable AI)
- **RecommendationLedger Mirror** (0G Galileo Testnet, chainId `16602`): [`0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED`](https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED) — optional audit replica; the Arbitrum ledger is the canonical prize-eligible record.
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
