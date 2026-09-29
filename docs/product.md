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
- **Philosophy/values system** — live and deeply integrated. Strategy configs, AI prompts, asset filtering, compliance, and Shield's plan ring all adapt to the user's chosen philosophy.
- **Retail FX-risk awareness** — the country/currency risk moment, the curated depreciation dataset, the gold counterfactual, and the wealth-protection calculator (Shield's empty-wallet inspector) are live in the app.
- **SME FX-risk intelligence (consumer app)** — Shield's payment-cycle inspector is live, walletless: a per-cycle FX drag report for the next supplier payment ("Next payment") and a historical report for the last cycle ("Last cycle", trailing window, open-dataset mid-market rates). Connected users save purchase cycles and record payment outcomes; opting into monitoring lets the Guardian loop propose protection within 14 days of the payment date, and a separate consent allows supported execution (Celo local stable → USDm, within active Guardian limits).
- **Retail → business graduation** — a behaviour-based prompt on Home (from the wallet's own swaps and saved cycles, phrased as a question, dismissible, instrumented) and a persona morph that gives business personas the payment-cycle entry on Shield.
- **Guardian execution** — the Guardian loop proposes moves the user approves in one tap on Exchange; autonomous execution exists only through ERC-7715/7710 permissions enforced on-chain by the user's own smart account on supported chains. Every decision is recorded on the chain-aware ledger + 0G evidence.
- **Best-yield engine** — vaults.fyi and GMX GM-pool deposits are integrated on Arbitrum.
- **Enterprise audit** — the `x-api-key` enterprise gateway and audit export are implemented for B2B licensing.

**North star / in progress:**
- **SME FX-risk intelligence layer — remaining phases** — the importer/trader `FinancialStrategy` archetype, a GHS on/off-ramp partner, a rails design partner, and a measured graduation funnel ([`roadmap.md`](./roadmap.md), [`strategy.md`](./strategy.md)). The concierge FX drag report (`scripts/fx-drag-report.ts`) keeps validating the math with real traders.

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

## The product object: the decision artifact

Users do not buy research. They buy a decision they can approve. The unit
that reaches the approval surface is a **Protection Review** — a single
artifact carrying five things: the proposed action (hold / rotate /
hedge), the quantified stakes ("unhedged, this exposure cost ~$18 last
month"), the alignment note (why it fits the user's stated philosophy and
goals), the evidence footnote (sources + freshness + on-chain receipt —
one tap behind, never the headline), and the bounds state (within Guardian
permissions or needs approval).

- **Sources are COGS; artifacts are the product.** Per-source prices
  ($0.001–$0.01) are internal cost accounting bundled into an artifact —
  never surfaced. Retail and B2B license the same object (`fx_protection`
  at $1 is the prototype); only presentation differs.
- **Charge for decisions, not data.** The intended product model is that
  ambient monitoring is free and a Protection Balance funds artifact
  generation only when there is something worth deciding. "Nothing
  actionable" reviews stay free. This balance model is product direction;
  it should not be read as proof that cross-chain Gateway funding or a
  production prepaid balance is currently deployed.
- **Funding is the consent moment.** In the intended flow, the user signs
  once at top-up and the Guardian draws the funded balance within user-set
  bounds (per-call cap, daily cap). Escalate to the user only on empty
  balance or out-of-bounds action — never a signature per call. When a
  review needs funding, the app quotes it and shows the price **in-app
  first** — "Fund & run · $1.00" with the evidence provenance listed — so
  the wallet prompt is never the first place a number appears. This
  describes product intent, not confirmed production activation.
- **Evidence is empirical first.** Social proof ("68% of Lagos savers
  rotated") is staged behind real aggregate Guardian activity — per the
  honesty contract, it does not ship hollow.

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

1. **Connect** — Privy login or existing wallet (email, social login, embedded wallet onboarding)
2. **Pick a Protection Plan** — Savings stay in your own wallet; the Guardian starts proposing moves
3. **Approve a move** — One tap opens Exchange prefilled; you sign in your wallet. On supported chains, add a wallet-enforced limit (ERC-7715/7710, enforced on-chain by your own smart account) and the Guardian can act within those limits
4. **Monitor** — Real-time receipts, allocations, P&L in a single dashboard
5. **Your keys, always** — No deposit, no custodial account, revoke anytime

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

3. **Verifiable autonomy.** A server-side Guardian loop monitors markets 24/7 and proposes moves the user approves in one tap; it executes on its own only within an ERC-7715/7710 permission the user's smart account enforces on-chain. Every decision is recorded on a verified `RecommendationLedger` on the chain where the money moves — Celo for savings, Arbitrum for yield — with reasoning anchored to 0G Storage as tamper-proof evidence. LiveProofCard surfaces those receipts before wallet connect: proof-first, not splash-first. Each chain has an irreplaceable role — see [`rails.md`](./rails.md).

4. **Calm instrument UX.** A savings protection app, not a trading terminal — the Guardian proposes one clear action at a time and every tab is a single manipulable object ([`design-language.md`](./design-language.md)). First run is guided: philosophy onboarding (detect country → show risk → choose plan) is primary; a 3-step tour and a 2-tab discovery hint cover the skipped path. Two modes: Simple (default) shows Shield, Home, Exchange; Full adds Guardian and the swap ticket's extra detail. Asking for Guardian, three swaps, or the header's Simple | Full switch moves a user to Full.

5. **Currencies as stories — the engagement layer is the literacy layer.** Every token carries a curated provenance answering three questions — who controls it (origin, backing, keys), what has happened to it (dated geopolitical events), and what might happen next (the cadence and mechanism to watch, never a prediction). The memetic/cultural/political texture of money is surfaced at the moment of choice: the ticket's pair sentence, the coin-back flip in the picker, the pair inspector's event trail and watch lines. Facts are hand-sourced and dated (`packages/shared/src/constants/token-provenance.ts`), re-verified on a 90-day cycle — engagement built on understanding, never on tickers, leaderboards, or invented forecasts. The timeline teaches mechanism, not prediction.

6. **Purchasing-power vocabulary, not trading vocabulary.** A DEX shows price impact in basis points and a dollar equivalent; this ticket answers in staples and drift — "≈ 6 bags of rice · $292.80" sending, "≈ 6 bags of rice where it lands" receiving — priced from the curated `goodsAnchor` staples in `currency-risk.ts` (NGN/GHS rice, KES maize flour; absent where none is curated). The ticket also reacts to the world: a real dated `MACRO_SIGNAL:*` event from the anchored ledger supersedes the side's standing watch cadence for its freshness window ("Sep 18 🇳🇬: CBN held the benchmark rate"), read via the shared proof feed at zero incremental Firecrawl cost. Settlement is already sealed as a `PairReceipt` artifact on the pair itself — the spent coin travels the beam, the destination seals with a ✓, and the story, goods equivalent, and verified tx link replace any toast. The wallet's own capital history is shipped too: the journey rail under the pair stage reads the wallet's Celo transfers (Blockscout, mapped by contract address) and shows where the savings have lived — stations per currency received, settled swap legs in the inspector. The resting pair also carries a time machine: a 1y/3y/5y control on the corridor line re-weighs the beam to that window's drift and pins a labelled what-if ("moved to the dollar in 2020, 10 bags of rice would be ~25") — computed from curated depreciation ratios only, honest in both directions. Ask Guardian is shipped too: "Ask Guardian about this pair →" in the inspector sends only the two symbols and the server grounds the answer in the same registry facts (`formatPairFacts`), with rules that forbid uncurated claims and predictions. The remaining piece of the anti-DEX stack is the inspector naming that Mento routes at the reserve oracle — no bonding curve.

## Vocabulary

One name per concept in anything a user reads (UI, toasts, emails, the
Guardian's own replies). Internal code may keep its identifiers.
Tripwire: `apps/web/lib/__tests__/vocabulary.test.ts`.

| Concept | User-facing name | Never say | Internal |
|---|---|---|---|
| The agent | **Guardian** ("Ask Guardian") | Advisor, Agent, Auto-Saver, AI assistant | `advisor-core`, `useAdvisor`, `agent` tab id |
| Its permission (EIP-712, `COPILOT`) | **Daily limit** — proposal-only, you approve each move | "Auto-Saver is on", "Guardian may swap" | `requestPermission('COPILOT')` |
| Optional ERC-7715 grant + GUARDIAN re-sign (the one autonomy path) | **Let Guardian act for you** (wallet-enforced limit) | "Stronger protection", "Advanced Permissions" (except MetaMask's own errors) | `requestAdvancedPermission`, `delegationContext` |
| Pausing it | **Pause Guardian** | Revoke, stop Auto-Saver | `revokePermission` |
| The allocation choice | **Protection plan** (Africapitalism, …, Custom plan) | Strategy | `FinancialStrategy`, `vault.strategy` |
| Moving between currencies | **Move savings** | Rebalance, Re-protect, Execute | `rebalance` action type |
| Tabs | **Shield · Home · Exchange · Guardian** | Shield, Home, Exchange, Guardian as tab names | `protect / overview / exchange / agent` |
| Prepaid review credit | **Protection Balance** (intended; deployment-dependent) | Agent Fuel | x402 |
| Where money sits | **Your wallet** / **Savings** | Vault, deposit | `vault` |

"Protect" stays a verb ("Protect this", "Protect my savings"); it is never a
tab or a noun. Tab labels have one source — `TAB_LABELS` in
`apps/web/constants/tabs.ts` — and personas never rename tabs.

## Core Capabilities (What's Shipped)

| Area | Status |
|------|--------|
| **Intelligence gateway** | x402-gated Mento depeg + inflation + yield intelligence. HTTP 402 challenge → real USDC settlement → paid evidence with on-chain tx proof. Open to external agents. |
| **AI inference** | Multi-provider chain (code order in `ai-service.ts`): Venice → Gemini → AI·ML API → Featherless → 0G Serving → Modal → OpenAI → ElevenLabs → NVIDIA → DashScope, with circuit breakers and 5-min caching |
| **Swap execution** | 11 strategies: Mento v3 (Celo), LiFi, 1inch, Uniswap V3, Hyperliquid perps, GMX deposits, Curve Arc, Emerging Markets |
| **Guardian loop** | Cron-driven proposals with a one-tap user-signed default; opt-in autonomy via ERC-7715/7710 (MetaMask Advanced Permissions) enforced on-chain by the user's own smart account — kit-derived chain set, atomic approve+swap batches, confidence thresholds, and daily caps |
| **Chain-aware ledger** | `RecommendationLedger` records decisions on the chain where the action settles — Celo for savings, Arbitrum for yield, HashKey for APAC savings, Robinhood for RWA/stock-token legs, Arc for x402-settled intelligence, 0G as the evidence mirror. One `0x3BCf…369C` address; the canonical fan-out is `PROOF_FEED_CHAIN_IDS`. Each ledger entry references a 0G Storage evidence CID. |
| **0G verifiability** | Evidence layer: Storage (reasoning CIDs) + Compute (TEE-verified inference) + Guardian-state snapshots on 0G Storage. 0G DA is **not** integrated — see `architecture.md`. 0G is not the ledger of record — it is the tamper-proof evidence layer that the ledgers reference. |
| **Live data** | 11+ sources feed the Guardian's macro awareness: World Bank, FRED, CoinGecko, DeFiLlama, SynthData, BrightData, TinyFish Search, Firecrawl |
| **Agent memory** | Cognee for cross-session persistent context |
| **Multi-chain** | Celo (EM savings ledger), Arbitrum (yield ledger), HashKey (APAC savings ledger, chain 177 — contract live, see `rails.md` § Implementation status), Robinhood (RWA ledger, chain 4663 — env-gated), 0G (evidence/anchoring), Arc (x402 settlement rail, chain 5042 — env-gated) |
| **Wallet** | User's own wallet (MetaMask/MiniPay/Farcaster-compatible) + Privy for login and embedded-wallet onboarding — Privy never executes |
| **Best-yield engine** | Arbitrum yield is a dynamic engine, not a fixed menu: vaults.fyi per-wallet best-deposit recommendations across 1,000+ risk-rated vaults (paid, engagement-gated), **GMX GM-pool deposits — LIVE** (`GmxGmDepositStrategy`, validated with a real deposit on Arbitrum One, blue-chip pools only, slippage-protected), free LI.FI Earn + DefiLlama base. Surfaced + depositable via `BestYieldCard`. See `docs/roadmap-log.md` § Yield Engine Strategy. |
| **Voice** | Guardian voice output (ElevenLabs TTS) + voice input (ElevenLabs Scribe STT) — runs on ElevenLabs alone, no OpenAI. Live in prod. |
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

## Navigation

| Tab | Purpose |
|-----|---------|
| **Shield** | Choose a protection plan, see its allocation ring — savings stay in your wallet |
| **Home** | Risk Theater: your currency's moment + holdings coins |
| **Exchange** | Move savings between currencies (pair stage → ticket → receipt) |
| **Guardian** | The Guardian: daily limit, latest decision, journal and proof |

Tab IDs are `protect / overview / exchange / agent`; labels come only from `TAB_LABELS` (`apps/web/constants/tabs.ts`). The dock order is fixed — personas never reorder it.

**Simple mode**: Shield → Home → Exchange only. **Full mode** adds Guardian. Any hand-off to Guardian switches Simple → Full, as do three swaps or the header's Simple | Full switch (sm+). There is no Learn tab — the calculator lives as the Shield empty-wallet inspector + optional Home amount-inspect. See `design-language.md` §5.

New users land on Shield. Swipe/tap discovery hint animates in above the tab bar on first visit — dismissed after 2 tabs visited or first swipe gesture.

## Fees

| Fee | Amount | When |
|-----|--------|------|
| Management / performance | Under review — presupposed a custodial vault that no longer exists | — |
| Swap fee | None charged today | A disclosed, tiered fee is planned and goes live only after legal review — see [monetisation-plan.md](./monetisation-plan.md) |

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

The same backend serves all personas; the frontend is a configuration. Signals (geo, wallet, history, device) resolve an `AdaptivePersona` → `AdaptiveConfig` that morphs surfaces (`shieldMorph`: business personas get the payment-cycle entry on Shield) — never the dock order, no forks, no separate products. Phase 0 (FX drag calculator — now the payment-cycle inspector's "Last cycle" mode, with `/fx-drag-calculator` as a doorway; no wallet required) and Phase 1 (signal detection + the Shield business morph) are live, as is the behaviour-based graduation prompt; multi-corridor learning is planned.

Full design doc — signal schema, per-persona routing examples, implementation phases: [`internal/adaptive-experience.md`](./internal/adaptive-experience.md).
