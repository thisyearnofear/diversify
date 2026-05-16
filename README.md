# DiversiFi: The Proactive AI Guardian
## Decentralized Intelligence for the Agentic Economy

DiversiFi is an autonomous financial advisor powered by a verifiable, on-chain research loop. We protect wealth from high inflation by combining real-time AI synthesis with decentralized storage and settlement.

**Live App:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app)  
**Hackathon Tracks:** 🤖 Agentic Economy · 🛡️ Verifiable AI (0G) · 🪙 Autonomous Payments (Arc)

---

## 🏗️ The 0G-Powered Architecture
At our core, we believe the future of AI agents relies on **verifiable data**. 

- **0G Storage (The Decentralized Backbone)**: Every insight, backtest simulation, and agent decision is streamed to **0G Storage**. This creates an immutable "Proof of Intelligence" that allows users and auditors to verify the data sources the agent actually used to make a recommendation.
- **AI Reasoning Engine (Venice + Gemini 3.1)**: Primary inference via Venice AI with automatic fallback to Google Gemini 3.1 Flash-Lite. Multi-provider resilience ensures 99.9% uptime.
- **Arc Network x402 (Autonomous Economics)**: Our agent manages its own P&L, negotiating premium data access using x402 nanopayments settled on-chain.
- **Proof of Efficacy (Backtesting)**: Before recommending any allocation, our agent simulates its proposed action on the **Robinhood Testnet**, anchoring the backtest result to 0G for future verification.

---

## 🚀 Key Features

*   **Guardian Pulse**: AI-synthesized market insights, powered by real-time data and anchored for truth via 0G.
*   **Proactive Pilot**: Autonomous rebalancing intent discovery, allowing users to approve complex financial strategies with one tap.
*   **0G Audit Trail**: An in-app dashboard to verify the raw evidence and decision logs of your agent.
*   **Frictionless Onboarding**: Secure, social-login-first (Privy) UX that abstracts away the complexity of managing agent wallets.

---

## 🔑 Judge Verification Proofs

- **Agent Wallet (Arc Testnet)**: `0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8`
- **Audit Trail**: Open the **"Verifiable AI"** modal in the Guardian Pulse dashboard to view live 0G anchors.
- **Settlement Metrics**: [https://api.diversifi.famile.xyz/api/agent/x402-metrics](https://api.diversifi.famile.xyz/api/agent/x402-metrics)
- **Explorer**: [testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8](https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8)

---

## 🛠️ Development

```bash
pnpm install
# Ensure .env.local is configured per docs/getting-started.md
pnpm dev
```
For deep-dive documentation on our cross-chain architecture and settlement flow, see [docs/architecture.md](docs/architecture.md).
