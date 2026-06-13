# Product

## Core Story

DiversiFi is a **savings protection app** for people in volatile economies. A proactive AI Guardian monitors markets, detects inflation shifts, and protects stablecoin savings by routing capital between **Celo/Mento** (local stablecoins, low-cost savings) and **Arbitrum** (deep liquidity, RWA yield) — with on-chain proof of every decision.

**What it is:** A calm, simple savings protection experience guided by verifiable AI.
**What it is not:** A trading terminal, DeFi control panel, or yield farming dashboard.

## Primary Persona

A stablecoin saver who wants to protect purchasing power but does not want to manually monitor macro data, risk signals, and yield opportunities. They want one practical answer — hold, rebalance, or de-risk — with attached proof, not a verbose AI explanation.

## How It Works

1. **Connect** — Privy creates a Safe smart account (email, social login, or existing wallet)
2. **Pick a Protection Plan** — Sign an ERC-7715 spending permission (e.g., $50/day, 7 days)
3. **Deposit stablecoins** — The Guardian diversifies per plan across regions and asset types, choosing Celo/Mento for stable-savings and Arbitrum for liquidity/RWA yield
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

1. **Verifiable AI.** Every recommendation is anchored to 0G Storage (encrypted evidence CID) and recorded on-chain via `RecommendationLedger` on **Arbitrum**. Users can inspect the raw data behind every decision in the in-app Verifiable AI Dashboard — it's not a black box.

2. **Autonomous Guardian.** A server-side cron loop monitors markets 24/7 via Firecrawl, synthesizes signals with multi-provider AI (Gemini → Venice → 0G Serving → Modal), and auto-executes rebalancing within user-signed permission bounds — no manual intervention needed.

3. **Dual-chain optimization.** Celo/Mento provide local stablecoin access with near-zero fees; Arbitrum provides deep liquidity and RWA yield. The Guardian routes each action to the chain that best serves the user's goal.

4. **Regional inflation awareness.** Protection plans are culturally aligned (Africapitalism, Buen Vivir, etc.) and target specific emerging-market inflation profiles, not generic "crypto yields."

5. **Calm UX.** Designed as a savings protection app, not a trading terminal. The Guardian proposes one clear action at a time. Advanced controls are hidden behind an experience mode toggle.

6. **Guided first run.** A 5-step GuidedTour replaces three separate onboarding surfaces. New users pick their region and protection goal inline during the tour, persisted via `useProtectionProfile`. No modal wizard, no duplicate inline onboarding.

7. **Tab discoverability.** First-visit users get an animated swipe hint above the tab bar. Tab visits and swipe gestures are tracked via a shared `useTabDiscovery` context — the hint auto-dismisses after 3 tabs or the first swipe.

8. **Verifiable trust surface.** The LiveProofCard shows recent 0G-anchored Guardian actions (recommendations, rebalances) on the Protect and Overview tabs before the user connects a wallet — proof-first, not splash-first.

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
| **Swap execution** | 12+ strategies: Mento (Celo), LiFi, 1inch, Uniswap V3, Hyperliquid perps, direct RWA, Arbitrum-native DEX, Curve Arc, Emerging Markets |
| **Guardian loop** | Cron-driven autonomous execution with ERC-7715 permission enforcement, confidence thresholds, and daily caps |
| **x402 payments** | HTTP 402 challenge → real Arc USDC settlement → paid evidence with on-chain tx proof |
| **0G verifiability** | Full stack: Serving (inference) → Storage (evidence CID) → DA (state) → Chain (RecommendationLedger) |
| **Live data** | 12+ sources feed the Guardian's macro awareness: World Bank, FRED, CoinGecko, DeFiLlama, SynthData, BrightData, SoSoValue, Firecrawl |
| **Agent memory** | Cognee for cross-session persistent context |
| **Multi-chain** | Celo (stable savings), Arbitrum (liquidity + canonical ledger), Arc Testnet (x402 payments) |
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
| **Protect** | Choose plan, view allocation, deposit — with 4-state Guardian pipeline scrollytelling before connect |
| **Exchange** | Swap stablecoins across regions and chains |
| **Pilot** | AI Guardian recommendations, verifiable proof, backtesting, Guardian tier state |
| **Learn** | Inflation education, strategy guides, glossary |

New users see this order (Protect second). Swipe/tap discovery hint animates in above the tab bar on first visit — dismissed after 3 tabs visited or first swipe gesture.

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