# Product

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

## Current State vs. Vision (2026-07-12)

**Delivered today:**
- **Philosophy/values system** — live and deeply integrated. Strategy configs, AI prompts, asset filtering, compliance, and the Protection Scorecard all adapt to the user's chosen philosophy.
- **Retail FX-risk awareness** — the country/currency risk moment, the curated depreciation dataset, the Protection Scorecard, and the counterfactual calculator are live in the app.
- **Autonomous execution** — the Guardian loop auto-rebalances within user-signed permission bounds and records every decision on the chain-aware ledger + 0G evidence.
- **Best-yield engine** — vaults.fyi and GMX GM-pool deposits are integrated on Arbitrum.
- **Enterprise audit** — the `x-api-key` enterprise gateway and audit export are implemented for B2B licensing.

**North star / in progress:**
- **SME FX-risk intelligence layer** — the importer/trader archetype, purchase-cycle model, per-cycle FX drag report, and cycle-aware Guardian execution are designed and sequenced in `docs/sme-fx-implementation-plan.md` but not yet shipped in the consumer app. The concierge FX drag report (`scripts/fx-drag-report.ts`) is already validating the math with real traders.
- **Retail → business graduation** — signal detection and a self-serve graduation CTA are planned; today the app only surfaces a small "How this can affect a business" hint in onboarding.

The retail app is the proof surface and top-of-funnel. The business intelligence layer is the real product we are building toward.

## Two layers, one product

| Layer | What it is | Who consumes it |
|---|---|---|
| **FX-risk intelligence layer (the real product)** | Quantifies per-purchase-cycle currency drag for SMEs and autonomously flattens it. Chain-aware settlement ledger, 0G evidence anchoring, open SDK, and enterprise gateway for rails players. | SME importers/traders; external agents and rails players that license the intelligence |
| **Reference consumer (Guardian app — top-of-funnel)** | The DiversiFi Guardian — a savings protection agent for volatile economies. Proves the intelligence layer end-to-end and funnels retail trust into the business tier. | End users in emerging markets who want protection without complexity; individual entrepreneurs who graduate to the importer archetype |

The FX-risk intelligence layer is the product. The Guardian app is the
proof surface and top-of-funnel. External agents and rails players are
consumers #2+. This is what makes DiversiFi infrastructure other teams
depend on, not a consumer app with infrastructure framing.

## Primary Persona (Guardian app)

A stablecoin saver who wants to protect purchasing power but does not want
to manually monitor macro data, risk signals, and yield opportunities.
They want one practical answer — hold, rebalance, or de-risk — with
attached proof, not a verbose AI explanation.

## North Star — The Importer & the Retail→Business Funnel (2026-07-11)

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
(Ghana VASP Act 1154), and sequencing: [`sme-fx-strategy.md`](./sme-fx-strategy.md).

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

2. **The philosophy/values system — a structural moat.** No other DeFi or fintech product builds cultural identity into the product. Africapitalism, Buen Vivir, Islamic Finance, Confucian, Gotong Royong — these are not risk-tolerance sliders; they are identity markers that drive retention and community. This is the reason someone stays when the yield is identical elsewhere.

3. **Chain-aware verifiability.** Every decision is recorded on a verified `RecommendationLedger` on the chain where the money moves — Celo for savings actions, Arbitrum for yield actions. The user sees the decision on the explorer where their money actually moved. Reasoning is anchored to 0G Storage as tamper-proof evidence.

4. **Autonomous Guardian.** A server-side cron loop monitors markets 24/7 via Firecrawl, synthesizes signals with multi-provider AI (Gemini → Venice → 0G Serving → Modal), and auto-executes rebalancing within user-signed permission bounds — no manual intervention needed.

5. **Chain-aware optimization.** Celo/Mento provide local stablecoin access with near-zero fees; Arbitrum provides deep liquidity and RWA yield; the **APAC rail** (HashKey Chain) provides regulated-market savings settlement for East/SE Asia (Confucian / Gotong Royong plans). The Guardian routes each action to the chain that best serves the user's goal. Each chain has a genuine, irreplaceable role — neither is a vanity deployment. See [`apac-rail.md`](./apac-rail.md).

6. **Regional inflation awareness.** Protection plans are culturally aligned (Africapitalism, Buen Vivir, etc.) and target specific emerging-market inflation profiles, not generic "crypto yields."

7. **Calm UX.** Designed as a savings protection app, not a trading terminal. The Guardian proposes one clear action at a time. **Simple mode** (default for new users) shows three tabs — Shield, Home, Learn — and hides the experience toggle, chain pill, Exchange tab, and Advisor FAB until the user opts into Standard mode.

8. **Guided first run.** Philosophy onboarding (`StrategyModal` → detect country → show risk → choose plan) is the primary first-run flow. A lightweight **3-step** `GuidedTour` (risk moment → Shield tab → connect wallet) only runs when philosophy onboarding was skipped. Region, goal, and philosophy persist in `ProtectionProfileProvider` / `use-protection-profile` (`diversifi-protection-profile-v2`); `useStrategy()` reads `config.philosophy` from the same provider.

9. **Tab discoverability.** First-visit users get an action-oriented hint above the tab bar. Tab visits are tracked via `useTabDiscovery` — the hint auto-dismisses after **2** tabs visited or the first swipe.

10. **Verifiable trust surface.** LiveProofCard shows recent Guardian receipts merged across mainnet ledgers (Celo, Arbitrum, HashKey when configured) on Protect and Overview before wallet connect — proof-first, not splash-first.

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
| **Multi-chain** | Celo (EM savings ledger), Arbitrum (yield ledger), HashKey (APAC savings ledger, chain 177 — deploy pending HSK), 0G (evidence/anchoring), Arc (x402 nanopayment rail) |
| **Wallet** | Privy Safe smart accounts + social login + Farcaster/MiniPay compatibility |
| **Best-yield engine** | Arbitrum yield is a dynamic engine, not a fixed menu: vaults.fyi per-wallet best-deposit recommendations across 1,000+ risk-rated vaults (paid, engagement-gated), **GMX GM-pool deposits — LIVE** (`GmxGmDepositStrategy`, validated with a real deposit on Arbitrum One, blue-chip pools only, slippage-protected), free LI.FI Earn + DefiLlama base. Surfaced + depositable via `BestYieldCard`. See `docs/roadmap.md` § Yield Engine Strategy. |
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

**North-star persona (funnel target):** the individual entrepreneur /
importer / exporter whose "savings" are actually cyclical working capital
— local-currency proceeds exposed between purchase cycles. They enter as
retail savers and graduate their business. See [`sme-fx-strategy.md`](./sme-fx-strategy.md).

**Regional execution:** EM savers route through Celo (local Mento stables). Global yield legs route through Arbitrum. APAC savers on Confucian or Gotong Royong plans route savings decisions to **HashKey Chain** (when deployed); until mainnet go-live, an honest banner explains that protection still runs on global chains today. See [`apac-rail.md`](./apac-rail.md).

## APAC Rail (HashKey Chain — shipped, deploy pending)

DiversiFi detects Asia-region users and offers East/SE Asian protection philosophies. The **APAC rail** on **HashKey Chain mainnet (chain 177)** is the execution + trust home for those plans:

- **Job:** Regulated-market savings ledger for Japan, HK, Singapore, Philippines, and adjacent markets
- **Not:** A yield chain (Arbitrum), EM stablecoin chain (Celo), intelligence toll (Arc), or evidence layer (0G)
- **Enables:** Region → philosophy → chain alignment; SE Asia on-ramp → protect → optional Arbitrum yield → off-ramp lifecycle

Full rationale, routing rules, go-live runbook, and hackathon submission: [`apac-rail.md`](./apac-rail.md) · [`hackathon-hashkey-buidl.md`](./hackathon-hashkey-buidl.md).

## Current Priorities

See `roadmap.md` for the 14-day improvement plan targeting 9/10 across Product Design, UI/UX, Cogency, Performance, and Architecture.
