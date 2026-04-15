# DiversiFi — AI Wealth Protection

AI-powered stablecoin diversification. Protect your purchasing power from inflation and currency volatility.

## Quick Start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## What It Does

- **Regional Stablecoins** — Diversify across cUSD, cEUR, KESm, COPm, PHPm, cREAL
- **Inflation-Aware Rebalancing** — Agent monitors inflation rates and recommends swaps
- **Protection Plans** — 7 cultural philosophies (Africapitalism, Islamic Finance, Global Diversification, etc.)
- **Non-Custodial** — Funds stay in your Safe smart account. Agent transacts only within permission limits
- **Transparent Fees** — 1% management + 10% performance above high-water mark + 0.10% swap spread
- **Contextual AI Help** — Ask AI button on every card for instant, context-aware assistance

## Key Features

### 🤖 Contextual AI Assistance
Every card includes an "Ask AI" button that provides context-aware help:
- **Zero Balance Detection** — Inline onramp with AI guidance when wallet is empty
- **Protection Plan** — Ask about risks, diversification, and optimization
- **Swap Interface** — Get advice on token swaps and inflation differences
- **Quick Questions** — Pre-populated questions for common scenarios
- **Custom Input** — Ask anything about the platform or your portfolio

**Usage:**
```tsx
<Card
  aiPrompt="Explain my protection plan"
  aiQuickQuestions={[
    "What's my biggest risk?",
    "Should I rebalance?",
    "How to improve?"
  ]}
>
  {/* Your content */}
</Card>
```

## Documentation

| Doc | Covers |
|-----|--------|
| [Getting Started](docs/getting-started.md) | Setup, env vars, testnets, deployment |
| [Architecture](docs/architecture.md) | System design, agent tiers, security, fuel model |
| [Product](docs/product.md) | Vision, protection plans, roadmap, terminology |
| [Integrations & Security](docs/integrations.md) | APIs, providers, DEX routing, hardening |

## Tech Stack

Next.js 15 · Privy + Safe · Venice AI · Mento Protocol · Circle CCTP · Hyperliquid · LI.FI Composer

## 🌉 Cross-Chain Infrastructure

DiversiFi leverages **LI.FI Composer** for seamless multi-chain yield optimization:

| Capability | Implementation |
|------------|----------------|
| **Chains** | Ethereum, Base, Arbitrum, Celo |
| **Protocols** | Morpho, Aave V3, Lido, EtherFi, Seamless |
| **Transactions** | Atomic swap + bridge + deposit in single tx |
| **Routing** | Optimal path selection across 27 bridges, 31 DEXs |

**Example Flow:**
```
User deposits USDC on Celo 
  → LI.FI routes to Morpho vault on Base 
  → Single transaction, optimal fees
  → User receives yield-bearing vault tokens
```

### Why LI.FI Composer?

- **One-Click Deposits**: Complex multi-step operations (swap → bridge → vault deposit) in a single user transaction
- **Protocol Agnostic**: Access 15+ DeFi protocols without individual integrations
- **Cost Optimized**: Automatic routing finds cheapest path across bridges and DEXs
- **User Experience**: "DeFi Mullet" - simple front-end, powerful cross-chain orchestration in the back
