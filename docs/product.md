# Product

> **Current state (2026-09-15):** the connected-wallet experience shares one portfolio data model across all tabs — live holdings, plan-target gaps, and data freshness everywhere; the adaptive experience (signal-detected persona routing + landing-page FX calculator) is live. Dated change history: [`roadmap-log.md`](./roadmap-log.md).

## Core Story

DiversiFi is an **FX-risk intelligence and autonomous protection layer**
for businesses that earn in one currency and must purchase in another.

Two things make DiversiFi unique. Everything else is commodity:

1. **FX-risk intelligence layer** — the ability to quantify and
   autonomously flatten currency risk for a business that earns in one
   currency and must purchase in another. A Ghanaian importer buying from
   China in USD. A US retailer sourcing from the Eurozone. A UK business
   paying suppliers in USD. The currencies change; the problem is identical.
   The SME bleeds margin in the window between local sales and the next
   supplier payment. **No player in the market offers FX risk
   quantification + autonomous protection.**

2. **The philosophy/values system** — no other product in DeFi or fintech
   has this. It's not a feature; it's a structural moat that creates
   identity-based retention and cultural community. When a user chooses
   Africapitalism, Buen Vivir, or Islamic Finance, they are declaring a
   cultural identity, not just a risk tolerance. **This is the reason
   someone stays when the yield is identical elsewhere.**

The **retail savings app is top-of-funnel.** It proves the technology,
builds trust, and surfaces the risk moment to individual entrepreneurs and
diaspora professionals whose personal savings are also working capital. The
**business intelligence layer is the real product.** The **philosophy
system is the retention moat.**

**The audience runs in both directions.** Savers in volatile-currency
economies use DiversiFi to protect purchasing power. Businesses and savers
in developed markets use it to trade *with* emerging markets and to
diversify along cultural, values, or philosophy lines — an importer in
Accra bleeding cedi margin and a London saver allocating to KESm under an
Africapitalist plan are the same machinery seen from opposite ends. FX
exposure is quantified identically in both directions; the persona changes
the frame, not the engine.

The **DiversiFi Guardian** is the autonomous agent that executes this
protection. It monitors markets, detects inflation and FX shifts, and
protects capital by routing between **Celo/Mento** (local stablecoins,
low-cost savings), **Arbitrum** (deep liquidity, RWA yield), and **HashKey
Chain** (APAC regulated-market savings) — with on-chain proof of every
decision.

**What it is:** An FX-risk intelligence layer with a reference consumer
(the Guardian savings app) that demonstrates the full loop: risk
quantification → autonomous decision → on-chain settlement → verifiable
evidence.
**What it is not:** A payment rail, a trading terminal, a DeFi control panel,
or a yield farming dashboard.

## Current State vs. Vision

**Delivered today:**
- **Philosophy/values system** — live and deeply integrated. Strategy configs, AI prompts, asset filtering, compliance, and the Protection Scorecard all adapt to the user's chosen philosophy.
- **Retail FX-risk awareness** — the country/currency risk moment, the curated depreciation dataset, the Protection Scorecard, and the counterfactual calculator are live in the app.
- **Autonomous execution** — the Guardian loop auto-rebalances within user-signed permission bounds and records every decision on the chain-aware ledger + 0G evidence.
- **Best-yield engine** — vaults.fyi and GMX GM-pool deposits are integrated on Arbitrum.
- **Enterprise audit** — the `x-api-key` enterprise gateway and audit export are implemented for B2B licensing.

**North star / in progress:**
- **SME FX-risk intelligence layer** — the importer/trader archetype, purchase-cycle model, per-cycle FX drag report, and cycle-aware Guardian execution are designed and sequenced in `docs/strategy.md` but not yet shipped in the consumer app. The concierge FX drag report (`scripts/fx-drag-report.ts`) is already validating the math with real traders.
- **Retail → business graduation** — signal detection and a self-serve graduation CTA are planned; today the app only surfaces a small "How this can affect a business" hint in onboarding.

The retail app is the proof surface and top-of-funnel. The business intelligence layer is the real product we are building toward.

## Two layers, one product

| Layer | What it is | Who consumes it |
|---|---|---|
| **FX-risk intelligence layer (the real product)** | Quantifies per-purchase-cycle currency drag for SMEs and autonomously flattens it. Chain-aware settlement ledger, 0G evidence anchoring, open SDK, and enterprise gateway for rails players. | SME importers/traders; external agents and rails players that license the intelligence |
| **Reference consumer (Guardian app — top-of-funnel)** | The DiversiFi Guardian — a savings protection agent for volatile economies. Proves the intelligence layer end-to-end and funnels retail trust into the business tier. | End users in emerging markets who want protection without complexity; developed-market savers and businesses who trade with emerging markets or want values/philosophy-aligned diversification; individual entrepreneurs who graduate to the importer archetype |

The FX-risk intelligence layer is the product. The Guardian app is the
proof surface and top-of-funnel. External agents and rails players are
consumers #2+. This is what makes DiversiFi infrastructure other teams
depend on, not a consumer app with infrastructure framing.

## Primary Persona (Guardian app)

A stablecoin saver who wants to protect purchasing power but does not want
to manually monitor macro data, risk signals, and yield opportunities.
They want one practical answer — hold, rebalance, or de-risk — with
attached proof, not a verbose AI explanation.

The same persona exists mirrored in developed markets: a saver or small
business that trades with emerging economies, or simply wants exposure
aligned with their cultural values or philosophy (Sharia-compliant,
Africapitalist, community-first) rather than generic yield. For them the
FX line runs the other way — taking *on* emerging-market exposure
deliberately, with the depreciation risk quantified rather than hidden —
but the product surface is identical: one practical answer, with proof.

## North Star — The Importer & the Retail→Business Funnel

The long-term market opportunity is the **import/export SME in a
volatile-currency market** — crystallized by a real Ghanaian importer who
buys in USD abroad (China, US, UK), sells locally in cedis, and bleeds
margin invisibly in the window between local sales and the next supplier
payment. The rails for moving that money (Waza, Juicyway, Cedar Money,
Yellow Card…) are crowded and well-capitalized; **the FX risk
quantification + autonomous protection layer on top of them is unserved
— and it is exactly what DiversiFi has built.**

Retail and enterprise are not competing priorities; they are one funnel:

1. **Retail (trust)** — the individual entrepreneur tries the Guardian
   with personal savings, sees their currency risk quantified, builds
   trust in the autonomy and the on-chain proof.
2. **Business (revenue)** — the same person graduates their working
   capital: a cycle-aware Importer/Trader archetype with a per-cycle FX
   drag report. For this persona, personal savings *is* working capital —
   the funnel is one person at two levels of trust.
3. **Protocol (scale)** — rails players license the intelligence +
   Guardian via the enterprise gateway (Track 1d) as embedded "treasury
   autopilot."

Market evidence, competitive gap, archetype design, regulatory posture
(Ghana VASP Act 1154), and sequencing: [`strategy.md`](./strategy.md).

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

1. **FX-risk intelligence layer — the real product.** We quantify the currency drag on a business's working capital and autonomously protect it per purchase cycle. The retail savings app is the proof surface and top-of-funnel; the business intelligence layer is what scales.

2. **The philosophy/values system — a structural moat.** No other DeFi or fintech product builds cultural identity into the product. Africapitalism, Buen Vivir, Islamic Finance, Confucian, Gotong Royong — these are not risk-tolerance sliders; they are identity markers that drive retention and community. Protection plans target specific emerging-market inflation profiles, not generic "crypto yields." This is the reason someone stays when the yield is identical elsewhere.

3. **Verifiable autonomy.** A server-side Guardian loop monitors markets 24/7 and auto-executes within user-signed permission bounds. Every decision is recorded on a verified `RecommendationLedger` on the chain where the money moves — Celo for savings, Arbitrum for yield — with reasoning anchored to 0G Storage as tamper-proof evidence. LiveProofCard surfaces those receipts before wallet connect: proof-first, not splash-first. Each chain has an irreplaceable role — see [`rails.md`](./rails.md).

4. **Calm instrument UX.** A savings protection app, not a trading terminal — the Guardian proposes one clear action at a time and every tab is a single manipulable object ([`design-language.md`](./design-language.md)). First run is guided: philosophy onboarding (detect country → show risk → choose plan) is primary; a 3-step tour and a 2-tab discovery hint cover the skipped path. Simple mode (default) shows Shield, Home, Learn until the user opts into more.

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
| **Live data** | 11+ sources feed the Guardian's macro awareness: World Bank, FRED, CoinGecko, DeFiLlama, SynthData, BrightData, TinyFish Search, Firecrawl |
| **Agent memory** | Cognee for cross-session persistent context |
| **Multi-chain** | Celo (EM savings ledger), Arbitrum (yield ledger), HashKey (APAC savings ledger, chain 177 — deploy pending HSK), 0G (evidence/anchoring), Arc (x402 nanopayment rail) |
| **Wallet** | Privy Safe smart accounts + social login + Farcaster/MiniPay compatibility |
| **Best-yield engine** | Arbitrum yield is a dynamic engine, not a fixed menu: vaults.fyi per-wallet best-deposit recommendations across 1,000+ risk-rated vaults (paid, engagement-gated), **GMX GM-pool deposits — LIVE** (`GmxGmDepositStrategy`, validated with a real deposit on Arbitrum One, blue-chip pools only, slippage-protected), free LI.FI Earn + DefiLlama base. Surfaced + depositable via `BestYieldCard`. See `docs/roadmap-log.md` § Yield Engine Strategy. |
| **Voice** | Advisor voice output (ElevenLabs TTS) + voice input (ElevenLabs Scribe STT) — runs on ElevenLabs alone, no OpenAI. Live in prod. |
| **Free web/news search** | TinyFish Search (web/news/research) feeds the Guardian region-specific context (FX news, central-bank moves) — free, replaces paid marketplace search. |
| **Cost discipline** | Paid insights (e.g. vaults.fyi) are engagement-gated (`insight-tier.ts`): Free → Saver (≥$100 or 7-day streak) → Committed. Default-deny; free data open to all. |

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
| **Learn** | Wealth-protection calculator (cash vs your mix over time) |

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

**North-star persona (funnel target):** the individual entrepreneur /
importer / exporter whose "savings" are actually cyclical working capital
— local-currency proceeds exposed between purchase cycles. They enter as
retail savers and graduate their business. See [`strategy.md`](./strategy.md).

**Regional execution:** EM savers route through Celo (local Mento stables). Global yield legs route through Arbitrum. APAC savers on Confucian or Gotong Royong plans route savings decisions to **HashKey Chain** (when deployed); until mainnet go-live, an honest banner explains that protection still runs on global chains today. See [`rails.md`](./rails.md).

## Current Priorities

See [`roadmap.md`](./roadmap.md) for active priorities (the 14-day quality plan is closed — detail in [`roadmap-log.md`](./roadmap-log.md)).

## Adaptive experience

The same backend serves all personas; the frontend is a configuration. Signals (geo, wallet, history, device) resolve an `AdaptivePersona` → `AdaptiveConfig` that morphs tab labels, Guardian mode, and business surfaces — no forks, no separate products. Phase 0 (public FX drag calculator at `/fx-drag-calculator`, no wallet required) and Phase 1 (signal detection + adaptive tab labels) are live; behavioral graduation signals and multi-corridor learning are planned.

Full design doc — signal schema, per-persona routing examples, implementation phases: [`internal/adaptive-experience.md`](./internal/adaptive-experience.md).
