# DiversiFi: The Proactive AI Guardian
## Decentralized Intelligence for the Agentic Economy

DiversiFi is an autonomous financial advisor powered by a verifiable, on-chain research loop. We protect wealth from high inflation by combining real-time AI synthesis with decentralized storage and settlement.

**Live App:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app)  
**Hackathon Tracks:** 🤖 Agentic Economy · 🛡️ Verifiable AI (0G) · 🪙 Autonomous Payments (Arc)

---

## 🏗️ The 0G-Powered Architecture
At our core, we believe the future of AI agents relies on **verifiable data**. DiversiFi uses the **full 0G stack** as its truth layer — every recommendation is traceable from inference → evidence → chain record:

- **0G Serving (Decentralized Inference)**: Recommendations can be generated through the 0G Router (`deepseek-v4-pro`, `GLM-5.1`, `qwen3.6-plus`) as part of the AI failover chain alongside Gemini and Venice.
- **0G Storage (Evidence Layer)**: Every premium research payload, prompt, and reasoning step is hashed and uploaded to **0G Storage**, producing a CID that anchors the advisor's "Proof of Intelligence".
- **0G DA (State Persistence)**: The agent's internal context (preferences, risk profile) is serialized to 0G Data Availability after every analysis for resilience across serverless invocations.
- **0G Chain — `RecommendationLedger`**: Every advisor recommendation is recorded on-chain on 0G Galileo Testnet, linking `user → action → evidence CID → serving model → settlement tx → confidence`. This is the immutable, queryable ledger of what the agent recommended and why.
- **AI Reasoning Engine (Gemini → Venice → 0G Serving → Modal)**: Multi-provider failover chain. Each response is tagged with the provider that produced it.
- **Arc Network x402 (Autonomous Economics)**: The agent negotiates premium data access using x402 nanopayments settled on Arc.
- **Proof of Efficacy (Backtesting)**: Before recommending any allocation, our agent simulates its proposed action on the **Robinhood Testnet**, anchoring the backtest result to 0G for future verification.

---

## 🚀 Key Features

*   **Guardian Pulse**: AI-synthesized market insights, powered by real-time data and anchored for truth via 0G.
*   **Proactive Pilot**: Autonomous rebalancing intent discovery, allowing users to approve complex financial strategies with one tap.
*   **0G Audit Trail**: An in-app dashboard to verify the raw evidence and decision logs of your agent.
*   **Frictionless Onboarding**: Secure, social-login-first (Privy) UX that abstracts away the complexity of managing agent wallets.

---

## 🔑 Judge Verification Proofs

### 0G Stack (Verifiable AI)
- **RecommendationLedger Contract** (0G Galileo Testnet, chainId `16602`): [`0x75C08758A099c27cE85600d6a7C5E933091C1495`](https://chainscan-galileo.0g.ai/address/0x75C08758A099c27cE85600d6a7C5E933091C1495)
- **Ledger API**: [https://api.diversifi.famile.xyz/api/agent/zero-g-ledger](https://api.diversifi.famile.xyz/api/agent/zero-g-ledger) — live on-chain recommendations + stats
- **Storage / DA**: Open the **"Verifiable AI"** dashboard in-app to view live 0G evidence CIDs, serving-model IDs, and chain receipts

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
