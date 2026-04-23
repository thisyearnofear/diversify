# Product

## Core Story

DiversiFi is a **savings protection app** for people in volatile economies. It protects purchasing power from inflation and currency devaluation through guided stablecoin diversification using advanced cross-chain orchestration.

**What it is**: A calm, simple savings protection experience.
**What it is not**: A trading terminal, DeFi control panel, or yield farming dashboard.

## Advanced Capabilities

DiversiFi uses **LI.FI Composer** to execute atomic, multi-step DeFi workflows in a single user transaction. By abstracting complex cross-chain bridges, swaps, and contract interactions (such as vault deposits), we deliver a "DeFi Mullet" experience: consumer-grade simplicity in the front, and powerful cross-chain orchestration in the back.

## Hackathon Direction

For the Arc Nano Payments hackathon, DiversiFi should present as a **proof-of-research rebalancer**:

- The user asks whether to hold, rebalance, or hedge.
- The advisor buys fresh evidence from multiple sources using x402 / Circle Nanopayments.
- The system scores source agreement, freshness, and reputation before making a recommendation.
- The payment is part of the decision loop, not a separate product surface.
- Existing advisor cards and action cards stay in place; we enhance them instead of creating a new dashboard.

### Implementation Plan

| Day | Files | Change |
|-----|-------|--------|
| 1 | `pages/api/agent/_advisor-core.ts`, `pages/api/agent/x402-gateway.ts`, `config/features.ts` | Audit duplicate source/payment logic and collapse into one canonical flow |
| 2 | `packages/shared/src/*` or existing shared utility module | Add a single source registry for pricing, reputation, and freshness metadata |
| 3 | `pages/api/agent/x402-gateway.ts` | Support evidence bundles instead of single-source reads |
| 4 | `pages/api/agent/_advisor-core.ts` | Score evidence quality and emit HOLD / REBALANCE / HEDGE guidance |
| 5 | `docs/HACKATHON_DEMO_SCRIPT.md` | Rewrite the demo story around paid research and confidence-scored recommendations |
| 6 | `docs/integrations.md`, `docs/getting-started.md` | Document the runtime flags, source dependencies, and submit-ready flow |

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

Key accomplishments: culturally-aligned strategies, Agent Fuel Model, inflation-first design, proactive monitoring, privacy-first AI.

## Target Users

People in emerging markets who:
- Experience high local inflation (>10% annually)
- Want to protect savings, not speculate
- Need guidance, not DeFi complexity
- Value cultural alignment with their financial philosophy
