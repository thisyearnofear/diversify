# DiversiFi — Arc Nano Payments Submission

DiversiFi is an AI advisor that **buys premium evidence on-chain before recommending any allocation decision**.

For the Arc hackathon, it runs as a proof-of-research rebalancer: the advisor negotiates access with an x402-style `402 Payment Required` challenge, accepts a real Arc USDC payment proof from the buyer, then settles its own research spend on Arc before returning the response. Gemini synthesises the paid evidence into a confidence-scored recommendation.

**Live app:** https://diversifiapp.vercel.app  
**Hackathon:** [Agentic Economy on Arc](https://lablab.ai/ai-hackathons/nano-payments-arc)

---

## What This Demo Proves

| Requirement | Proof |
|---|---|
| Per-action pricing ≤ $0.01 | `allSourcesAtOrBelowOneCent: true` — [metrics endpoint](https://api.diversifi.famile.xyz/api/agent/x402-metrics) |
| 50+ on-chain transactions | `totalSettledPayments` is derived from Arc USDC `Transfer` logs for the live agent wallet |
| Real Arc settlement | Every paid request fires `USDC.transfer` — tx hash in `_billing.txHashes` |
| Observable payment loop | `successRate`, `topSources`, and `recentSpending` fall back to chain-derived evidence if runtime analytics reset after deploy |
| Margin explanation | $0.004/request vs $2–5 ETH gas = 500–1,250× — impossible on L1 |

## User and Use Case

- **Primary user:** a saver who wants evidence-backed guidance before moving stablecoin allocations.
- **Core workflow:** ask whether to hold or rebalance, let the advisor buy current macro/risk/yield evidence, then review a recommendation with attached payment proof.
- **Hackathon claim:** payment is part of the decision loop, not a separate checkout flow or abstract API billing layer.

**Agent wallet (Arc testnet):**  
`https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8`

---

## Judge-Facing Endpoints

```bash
# Transaction frequency + pricing + agent wallet balance
https://api.diversifi.famile.xyz/api/agent/x402-metrics

# Live x402 payment challenge
https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis

# Bundle: three Gemini-synthesised premium sources + three Arc settlements
https://api.diversifi.famile.xyz/api/agent/x402-gateway?sources=macro_analysis,portfolio_optimization,risk_assessment
```

---

## Quick Start (local)

```bash
pnpm install
cp .env.example .env.local
# Add API keys (see docs/getting-started.md)
pnpm dev
```

## Submission Mode Environment Variables

```bash
NEXT_PUBLIC_ENABLE_ARC=true
ENABLE_AUTONOMOUS_MODE=true
ARC_RPC_URL=https://rpc.testnet.arc.network
DATA_HUB_RECIPIENT_ADDRESS=<hub_wallet>
VAULT_PRIVATE_KEY=<funded_arc_eoa>   # fires real USDC settlements
GEMINI_API_KEY=<key>                 # primary AI provider
CIRCLE_API_KEY=<key>                 # optional Circle API experimentation
```

## Verification Commands

```bash
pnpm test-x402                # gateway challenge/response
pnpm test-x402-comprehensive  # full payment loop across all sources
pnpm test-x402-frequency      # verify chain-derived settled payment count
pnpm generate-x402-volume     # generate real paid requests with a funded buyer EOA
```

## Documentation

| Doc | Covers |
|-----|--------|
| [Demo Script](docs/HACKATHON_DEMO_SCRIPT.md) | Screen-by-screen walkthrough for judges — start here |
| [Submission Checklist](docs/submission-checklist.md) | Video segments, form fields, Circle feedback |
| [Architecture](docs/architecture.md) | Arc settlement flow, Gemini synthesis, AI routing |
| [Getting Started](docs/getting-started.md) | Setup, env vars, agent wallet funding |
| [Integrations](docs/integrations.md) | APIs, providers, on-chain settlement flow |
| [Product](docs/product.md) | Vision, protection plans, hackathon direction |

## Core Stack

Next.js 15 · Privy + Safe · x402-style payment negotiation · Arc Testnet · USDC · Gemini Flash · Venice AI · LI.FI Composer · Circle APIs (supplementary)
