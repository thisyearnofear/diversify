# Product

## Core Story

DiversiFi is a **savings protection app** for people in volatile economies. A proactive AI Guardian monitors markets, detects inflation shifts, and protects stablecoin savings by diversifying across stronger economies — with on-chain proof of every decision.

**What it is:** A calm, simple savings protection experience guided by verifiable AI.
**What it is not:** A trading terminal, DeFi control panel, or yield farming dashboard.

## Primary Persona

A stablecoin saver who wants to protect purchasing power but does not want to manually monitor macro data, risk signals, and yield opportunities. They want one practical answer — hold, rebalance, or de-risk — with attached proof, not a verbose AI explanation.

## How It Works

1. **Connect** — Privy creates a Safe smart account (email, social login, or existing wallet)
2. **Pick a Protection Plan** — Sign an ERC-7715 spending permission (e.g., $50/day, 7 days)
3. **Deposit stablecoins** — The Guardian diversifies per plan across regions and asset types
4. **Monitor** — Real-time receipts, allocations, P&L in a single dashboard
5. **Withdraw anytime** — Fees settled at withdrawal

## Protection Plans

| Plan | Philosophy | Focus |
|------|-----------|-------|
| **Africapitalism** | African prosperity | Keep wealth in African economies (cUSD, KESm, COPm) |
| **Buen Vivir** | Latin American balance | Balance material wealth with community |
| **Confucian** | East Asian prudence | Long-term stability, low volatility |
| **Gotong Royong** | Southeast Asian mutual aid | Community-first, shared risk |
| **Islamic Finance** | Sharia-compliant | No interest-bearing assets, ethical screening (excludes perp strategies) |
| **Global Diversification** | Maximum spread | Geographic diversification across all regions |
| **Custom** | User-defined | Set your own allocation targets |

## What Makes It Different

1. **Verifiable AI.** Every recommendation is anchored to 0G Storage (evidence CID) and recorded on-chain via `RecommendationLedger`. Users can inspect the raw data behind every decision in the in-app Verifiable AI Dashboard — it's not a black box.

2. **Autonomous Guardian.** A server-side cron loop monitors markets 24/7 via Firecrawl, synthesizes signals with multi-provider AI (Gemini → Venice → 0G Serving → Modal), and auto-executes rebalancing within user-signed permission bounds — no manual intervention needed.

3. **Regional inflation awareness.** Protection plans are culturally aligned (Africapitalism, Buen Vivir, etc.) and target specific emerging-market inflation profiles, not generic "crypto yields."

4. **Calm UX.** Designed as a savings protection app, not a trading terminal. The Guardian proposes one clear action at a time. Advanced controls are hidden behind an experience mode toggle.

## Terminology Guide

| Internal Term | User-Facing Term |
|--------------|-----------------|
| Agent | Advisor / Guardian |
| Strategy | Protection Plan |
| Exchange | Protect |
| Agent Fuel | Protection Balance |
| Rebalance | Re-protect |
| Vault | Savings |

## Core Capabilities (What's Shipped)

| Area | Status |
|------|--------|
| **AI inference** | Multi-provider chain: Gemini Flash → Venice → Featherless → 0G Serving → Modal, with circuit breakers and 5-min caching |
| **Swap execution** | 13 strategies: Mento, LiFi, 1inch, Uniswap V3, Hyperliquid perps, direct RWA, Robinhood AMM, Curve Arc, Emerging Markets |
| **Guardian loop** | Cron-driven autonomous execution with ERC-7715 permission enforcement, confidence thresholds, and daily caps |
| **x402 payments** | HTTP 402 challenge → real Arc USDC settlement → paid evidence with on-chain tx proof |
| **0G verifiability** | Full stack: Serving (inference) → Storage (evidence CID) → DA (state) → Chain (RecommendationLedger) |
| **Live data** | World Bank, FRED, CoinGecko, DeFiLlama, SynthData, BrightData, SoSoValue, Firecrawl |
| **Agent memory** | Cognee for cross-session persistent context |
| **Multi-chain** | Celo, Arbitrum, Arc Testnet, Robinhood Chain |
| **Wallet** | Privy Safe smart accounts + social login + Farcaster/MiniPay compatibility |

## Product Principles

1. **Enhancement first** — Improve existing flows before adding new ones
2. **Consolidation** — Merge duplicate surfaces, reduce cognitive load
3. **Prevent bloat** — Say no to features that don't serve the core story
4. **DRY, clean, modular** — Code quality enables product clarity
5. **Performant** — Fast loads, smooth interactions
6. **Delete, don't deprecate** — Remove unused code paths once the replacement is live

## What We Cut / Deferred

- Trading-terminal identity (no charts, no order books)
- Protocol-first messaging (user outcomes first)
- Voice/automation features (until core flow is polished)
- Separate research dashboards that duplicate advisor output

## Ideal Navigation

| Tab | Purpose |
|-----|---------|
| **Overview** | Portfolio summary, inflation impact, quick actions |
| **Protection** | Choose plan, view allocation, deposit |
| **Exchange** | Swap stablecoins across regions and chains |
| **Agent** | AI Guardian recommendations, verifiable proof, backtesting |
| **Info** | Inflation education, strategy guides, glossary |

## Fees

| Fee | Amount | When |
|-----|--------|------|
| Management | 1% annual | Pro-rated, settled at withdrawal |
| Performance | 10% above high-water mark | Only on gains above previous peak |
| Swap spread | 0.10% | Per swap |

## Target Users

People in emerging markets who:
- Experience high local inflation (>10% annually)
- Want to protect savings, not speculate
- Need guidance without DeFi complexity
- Value cultural alignment with their financial philosophy

## Current Priorities

See `roadmap.md` for the 14-day improvement plan targeting 9/10 across Product Design, UI/UX, Cogency, Performance, and Architecture.