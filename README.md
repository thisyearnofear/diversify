# DiversiFi - Arc Nano Payments Submission

DiversiFi is an AI advisor for wealth protection that pays for live evidence before recommending portfolio actions.  
For the Arc hackathon track, it runs as a proof-of-research rebalancer using Arc settlement, USDC, and Circle-powered x402/nanopayment flows.

Hackathon page: [Agentic Economy on Arc](https://lablab.ai/ai-hackathons/nano-payments-arc)

## Quick Start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Submission Mode

Set these environment flags for the hackathon flow:

```bash
NEXT_PUBLIC_ENABLE_ARC=true
ENABLE_AUTONOMOUS_MODE=true
ARC_RPC_URL=https://rpc.testnet.arc.network
DATA_HUB_RECIPIENT_ADDRESS=<your_data_hub_wallet>
```

## What This Demo Proves

- Per-action pricing at or below `$0.01` USDC across registered paid sources
- High-frequency paid evidence loop through `/api/agent/x402-gateway`
- Confidence-scored recommendations from multi-source evidence bundles
- Transaction-frequency reporting via `/api/agent/x402-metrics`

## Judge-Facing Commands

```bash
pnpm test-x402
pnpm test-x402-comprehensive
pnpm test-x402-frequency
```

## Required Video Proof (Hackathon Rule)

Your final submission video should include:

1. A USDC transaction executed through Circle Developer Console
2. Verification of that transaction on Arc Explorer
3. Frequency evidence showing 50+ settled payment events
4. Margin explanation for why this model fails under traditional gas costs

Detailed runbook: `docs/submission-checklist.md`

## Documentation

| Doc | Covers |
|-----|--------|
| [Getting Started](docs/getting-started.md) | Setup, env vars, testnets, deployment |
| [Architecture](docs/architecture.md) | System design, payment loop, and demo evidence path |
| [Product](docs/product.md) | Vision, protection plans, roadmap, terminology |
| [Integrations & Security](docs/integrations.md) | APIs, providers, DEX routing, hardening |
| [Submission Checklist](docs/submission-checklist.md) | End-to-end steps for hackathon submission proof |

## Core Stack

Next.js 15 · Privy + Safe · Circle Wallets/Gateway · Arc Testnet · USDC · x402 · LI.FI Composer
