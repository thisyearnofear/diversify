# Product

## Core Story

DiversiFi is a **savings protection app** for people in volatile economies. It protects purchasing power from inflation and currency devaluation through guided stablecoin diversification using advanced cross-chain orchestration.

**What it is**: A calm, simple savings protection experience.
**What it is not**: A trading terminal, DeFi control panel, or yield farming dashboard.

## Advanced Capabilities

DiversiFi uses **LI.FI Composer** to execute atomic, multi-step DeFi workflows in a single user transaction. By abstracting complex cross-chain bridges, swaps, and contract interactions (such as vault deposits), we deliver a "DeFi Mullet" experience: consumer-grade simplicity in the front, and powerful cross-chain orchestration in the back.

## Hackathon Direction

DiversiFi presents as a **proof-of-research rebalancer** for the Arc Nano Payments hackathon:

- The user asks whether to hold, rebalance, or hedge.
- The advisor buys fresh evidence from multiple independent sources using x402 / Circle Nanopayments.
- Each premium purchase triggers a real USDC micro-transaction on Arc, returned as a tx hash.
- Evidence is scored for freshness, reputation, and source agreement before a recommendation is made.
- The payment is part of the decision loop, not a separate product surface.

### What Was Shipped

| Area | What's live |
|------|-------------|
| **x402 gateway** | HTTP 402 challenge → payment proof → data, with nonce/replay protection and rate limiting |
| **Real Arc settlement** | Every paid request fires `USDC.transfer` on Arc via EOA; tx hash returned in `_billing` |
| **Gemini synthesis** | `macro_analysis`, `portfolio_optimization`, `risk_assessment` call Gemini Flash with live data |
| **Live data sources** | World Bank, FRED, CoinGecko, DeFiLlama, Yearn, Alpha Vantage — real API calls |
| **Evidence bundles** | Single request can fetch multiple sources; bundle scored for confidence and agreement |
| **Provider badge** | Chat UI shows "Powered by Gemini" / "✦ Venice" per message |
| **User API key** | ⚙️ modal lets users supply their own Gemini key; forwarded via `x-gemini-key` header |
| **Metrics endpoint** | `/api/agent/x402-metrics` — payment count, pricing proof, agent wallet balance, Arc Explorer link |

### Out of Scope

- New payment protocol layers that do not replace existing x402 plumbing
- New chain support unless it directly improves the research or settlement story
- Separate research dashboards that duplicate advisor output


## How It Works

1. **User connects** → Privy creates Safe smart account
2. **User picks a Protection Plan** → Signs spending permission ($50/day, 7 days)
3. **User deposits stablecoins** → Agent diversifies per plan
4. **User monitors** → Real-time receipts, allocations, P&L
5. **User withdraws anytime** → Fees settled at withdrawal

## Financial Strategies (Protection Plans)

| Plan | Philosophy | Focus |
|------|-----------|-------|
| **Africapitalism** | African prosperity | Keep wealth in African economies (cUSD, KESm, COPm) |
| **Buen Vivir** | Latin American balance | Balance material wealth with community (LatAm stablecoins) |
| **Confucian** | East Asian prudence | Long-term stability, low volatility |
| **Gotong Royong** | Southeast Asian mutual aid | Community-first, shared risk (PHPm, regional) |
| **Islamic Finance** | Sharia-compliant | No interest-bearing assets, ethical screening |
| **Global Diversification** | Maximum spread | Geographic diversification across all regions |
| **Custom** | User-defined | Set your own allocation targets |

## Terminology Guide

| Internal Term | User-Facing Term |
|--------------|-----------------|
| Agent | Advisor |
| Strategy | Protection Plan |
| Exchange | Protect |
| Agent Fuel | Protection Balance |
| Rebalance | Re-protect |
| Vault | Savings |

## Product Principles

1. **Enhancement first** — Improve existing flows before adding new ones
2. **Consolidation** — Merge duplicate surfaces, reduce cognitive load
3. **Prevent bloat** — Say no to features that don't serve the core story
4. **DRY, clean, modular** — Code quality enables product clarity
5. **Performant** — Fast loads, smooth interactions
6. **Delete, don’t deprecate** — Remove unused code paths once the replacement is live

## What to Cut

- Trading-terminal identity (no charts, no order books)
- Protocol-first messaging (user outcomes first)
- Duplicate recommendation surfaces (consolidate into Advisor)
- Advanced controls (hide behind "Advanced" toggle until core flow is complete)
- Voice/automation features (until core flow is polished)

## Ideal Navigation

| Tab | Purpose |
|-----|---------|
| **Home** | Portfolio overview, protection status, quick actions |
| **Protect** | Deposit, choose plan, view allocation |
| **Advisor** | AI recommendations, explanations, market context |
| **Learn** | Inflation education, strategy guides, glossary |

## Priority Roadmap

### P0 (Now)
- Demote trading-terminal identity
- Rename Agent → Advisor throughout UI
- Merge deposit + plan selection into single flow

### P1 (Next)
- Rewrite all copy to match calm, savings-first tone
- Move advanced controls behind toggle
- Consolidate recommendation surfaces

### P2 (Later)
- Reassess secondary systems (voice, automation, social)
- Expand to additional emerging market stablecoins
- Farcaster mini-app
- Open agent registry

## Fee Structure

| Fee | Amount | When |
|-----|--------|------|
| Management | 1% annual | Pro-rated, settled at withdrawal |
| Performance | 10% above high-water mark | Only on gains above previous peak |
| Swap spread | 0.10% | Per swap |

## Hackathon Pedigree

DiversiFi was built across multiple hackathons:
- **Celo "Build Agents for the Real World"** — Financial inclusion, autonomous operations, UX innovation
- **Auth0 "Authorized to Act"** — Dual permission model (on-chain + off-chain consent)
- **Arc "Agentic Economy on Arc"** — Real on-chain settlement, Gemini-powered evidence synthesis, x402 per-request monetisation

Key accomplishments: culturally-aligned strategies, Agent Fuel Model, inflation-first design, proactive monitoring, privacy-first AI, real Arc settlement loop.

## Target Users

People in emerging markets who:
- Experience high local inflation (>10% annually)
- Want to protect savings, not speculate
- Need guidance, not DeFi complexity
- Value cultural alignment with their financial philosophy
