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

## Documentation

| Doc | Covers |
|-----|--------|
| [Getting Started](docs/getting-started.md) | Setup, env vars, testnets, deployment |
| [Architecture](docs/architecture.md) | System design, agent tiers, security, fuel model |
| [Product](docs/product.md) | Vision, protection plans, roadmap, terminology |
| [Integrations & Security](docs/integrations.md) | APIs, providers, DEX routing, hardening |

## Tech Stack

Next.js 15 · Privy + Safe · Venice AI · Mento Protocol · OpenClaw · Circle CCTP · Hyperliquid · LI.FI Composer
