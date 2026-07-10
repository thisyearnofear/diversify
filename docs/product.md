# Product

## Core Story

DiversiFi is a **multi-chain agent intelligence protocol** that makes
stablecoin and yield markets agent-readable. Autonomous agents consume
real-time depeg, inflation, and yield intelligence via x402 nanopayments,
settle every decision on a verified ledger on the chain where the money
moves, and anchor reasoning to 0G — with the DiversiFi Guardian as the
reference consumer and an open SDK for any agent to subscribe.

The **DiversiFi Guardian** is the first agent built on the protocol. It is
a proactive AI that monitors markets, detects inflation shifts, and
protects stablecoin savings by routing capital between **Celo/Mento**
(local stablecoins, low-cost savings) and **Arbitrum** (deep liquidity,
RWA yield) — with on-chain proof of every decision.

**What it is:** An intelligence protocol with a reference consumer (the
Guardian savings app) that demonstrates the full loop: intelligence →
decision → on-chain settlement → verifiable evidence.
**What it is not:** A trading terminal, DeFi control panel, or yield
farming dashboard.

## Two layers, one product

| Layer | What it is | Who consumes it |
|---|---|---|
| **Intelligence protocol** | x402-gated Mento depeg + inflation + yield intelligence, chain-aware settlement ledger, 0G evidence anchoring. Open to any agent via SDK. | External Celo/Arbitrum agents that pay via x402 and consume intelligence payloads |
| **Reference consumer (Guardian app)** | The DiversiFi Guardian — a savings protection agent for volatile economies. Uses the protocol to monitor, decide, and execute on behalf of users. | End users in emerging markets who want protection without complexity |

The intelligence protocol is the product. The Guardian app is consumer
#1. External agents are consumers #2+. This is what makes DiversiFi
infrastructure other teams depend on, not a consumer app with
infrastructure framing.

## Primary Persona (Guardian app)

A stablecoin saver who wants to protect purchasing power but does not want
to manually monitor macro data, risk signals, and yield opportunities.
They want one practical answer — hold, rebalance, or de-risk — with
attached proof, not a verbose AI explanation.

## How It Works (Guardian app)

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

1. **Protocol, not just an app.** The intelligence gateway is open. Any agent can consume Mento depeg intelligence via x402 and settle decisions on-chain. The Guardian is the reference consumer — proof that the protocol works end-to-end, not the only consumer.

2. **Chain-aware verifiability.** Every decision is recorded on a verified `RecommendationLedger` on the chain where the money moves — Celo for savings actions, Arbitrum for yield actions. The user sees the decision on the explorer where their money actually moved. Reasoning is anchored to 0G Storage as tamper-proof evidence.

3. **Autonomous Guardian.** A server-side cron loop monitors markets 24/7 via Firecrawl, synthesizes signals with multi-provider AI (Gemini → Venice → 0G Serving → Modal), and auto-executes rebalancing within user-signed permission bounds — no manual intervention needed.

4. **Chain-aware optimization.** Celo/Mento provide local stablecoin access with near-zero fees; Arbitrum provides deep liquidity and RWA yield; a planned **APAC rail** will provide regulated-market savings and settlement for East/SE Asia (Confucian / Gotong Royong plans). The Guardian routes each action to the chain that best serves the user's goal. Each chain has a genuine, irreplaceable role — neither is a vanity deployment. See [`apac-rail.md`](./apac-rail.md).

5. **Regional inflation awareness.** Protection plans are culturally aligned (Africapitalism, Buen Vivir, etc.) and target specific emerging-market inflation profiles, not generic "crypto yields."

6. **Calm UX.** Designed as a savings protection app, not a trading terminal. The Guardian proposes one clear action at a time. **Simple mode** (default for new users) shows three tabs — Shield, Home, Learn — and hides the experience toggle, chain pill, Exchange tab, and Advisor FAB until the user opts into Standard mode.

7. **Guided first run.** Philosophy onboarding (`StrategyModal` → detect country → show risk → choose plan) is the primary first-run flow. A lightweight **3-step** `GuidedTour` (risk moment → Shield tab → connect wallet) only runs when philosophy onboarding was skipped. Region, goal, and philosophy persist in `useProtectionProfile` (`diversifi-protection-profile-v2`); `StrategyContext` is a thin React wrapper over the profile's `philosophy` field (legacy `financialStrategy` localStorage key auto-migrates).

8. **Tab discoverability.** First-visit users get an action-oriented hint above the tab bar. Tab visits are tracked via `useTabDiscovery` — the hint auto-dismisses after **2** tabs visited or the first swipe.

9. **Verifiable trust surface.** The LiveProofCard shows recent 0G-anchored Guardian actions (recommendations, rebalances) on the Protect and Overview tabs before the user connects a wallet — proof-first, not splash-first.

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
| **Intelligence gateway** | x402-gated Mento depeg + inflation + yield intelligence. HTTP 402 challenge → real USDC settlement → paid evidence with on-chain tx proof. Open to external agents. |
| **AI inference** | Multi-provider chain: Gemini Flash → Venice → Featherless → 0G Serving → Modal, with circuit breakers and 5-min caching |
| **Swap execution** | 12+ strategies: Mento (Celo), LiFi, 1inch, Uniswap V3, Hyperliquid perps, direct RWA, Arbitrum-native DEX, Curve Arc, Emerging Markets |
| **Guardian loop** | Cron-driven autonomous execution with user-signed permission enforcement (app-layer; ERC-7710 on-chain enforcement is deferred), confidence thresholds, and daily caps |
| **Chain-aware ledger** | `RecommendationLedger` records decisions on the chain where the action settles — Celo for savings, Arbitrum for yield. Each ledger entry references a 0G Storage evidence CID. |
| **0G verifiability** | Evidence layer: Storage (reasoning CIDs), Compute (TEE-verified inference), DA (state snapshots). 0G is not the ledger of record — it is the tamper-proof evidence layer that the ledgers reference. |
| **Live data** | 12+ sources feed the Guardian's macro awareness: World Bank, FRED, CoinGecko, DeFiLlama, SynthData, BrightData, SoSoValue, Firecrawl |
| **Agent memory** | Cognee for cross-session persistent context |
| **Multi-chain** | Celo (EM savings ledger), Arbitrum (yield ledger), 0G (evidence/anchoring), Arc (x402 nanopayment rail), APAC rail *(planned — Asia savings + settlement)* |
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
| **Protect** | Choose plan, view allocation, deposit — with compact Guardian status before connect |
| **Exchange** | Swap stablecoins across regions and chains |
| **Pilot** | AI Guardian recommendations, verifiable proof, backtesting, Guardian tier state |
| **Learn** | Inflation education, strategy guides, glossary |

**Simple mode** (beginner): Shield → Home → Learn only. Exchange and Advisor remain reachable via **More options** on Home. **Standard/Advanced** modes restore the full tab bar.

New users see Shield-first order. Swipe/tap discovery hint animates in above the tab bar on first visit — dismissed after 2 tabs visited or first swipe gesture.

## Fees

| Fee | Amount | When |
|-----|--------|------|
| Management | 1% annual | Pro-rated, settled at withdrawal |
| Performance | 10% above high-water mark | Only on gains above previous peak |
| Swap spread | 0.10% | Per swap |

## Target Users

People in emerging and APAC markets who:
- Experience high local inflation (>10% annually) or currency/regulatory uncertainty
- Want to protect savings, not speculate
- Need guidance without DeFi complexity
- Value cultural alignment with their financial philosophy (Africapitalism, Buen Vivir, Confucian, Gotong Royong, etc.)

**Regional execution:** EM savers route through Celo (local Mento stables). Global yield legs route through Arbitrum. APAC savers on Confucian or Gotong Royong plans will route through the **APAC rail** when shipped — until then, an honesty banner explains that protection runs on Celo/Arbitrum today. See [`apac-rail.md`](./apac-rail.md).

## APAC Rail (planned)

DiversiFi already detects Asia-region users and offers East/SE Asian protection philosophies, but lacks a dedicated **execution + trust home** for those plans. The APAC rail closes that gap:

- **Job:** Regulated-market savings and settlement for Japan, HK, Singapore, Philippines, and adjacent markets
- **Not:** A yield chain (Arbitrum), EM stablecoin chain (Celo), intelligence toll (Arc), or evidence layer (0G)
- **Enables:** Region → philosophy → chain alignment; SE Asia on-ramp → protect → optional Arbitrum yield → off-ramp lifecycle

Full rationale, routing rules, and build criteria: [`apac-rail.md`](./apac-rail.md).

## Current Priorities

See `roadmap.md` for the 14-day improvement plan targeting 9/10 across Product Design, UI/UX, Cogency, Performance, and Architecture.
