# Arbitrum Open House London — Product + GTM Canvas

*DiversiFi Guardian · July 2026*

---

## Product Canvas

### Team Name

DiversiFi Guardian

### One Line: What You're Building

An AI savings agent that detects your currency's depreciation risk, aligns protection with your values, and autonomously executes on-chain — every recommendation verifiable on the Arbitrum ledger.

### Who Is This For

A professional in or from an emerging-market economy (Nigeria, Kenya, Ghana, Philippines, Colombia, etc.) whose salary may be in GBP/USD but whose family's savings are in a local currency losing 8–15% per year against gold. Also: the diaspora member in London/NYC sending money home who realizes their parents' bank deposits are evaporating.

Secondary: the SME importer who bleeds 3–6% on every FX conversion between local sales and supplier payments.

### What They Do Today

Park savings in a local bank account earning below-inflation interest. Or manually buy USD stablecoins across 3–4 apps with no risk framework, no automation, and no cultural/values alignment. The importer wires through a bank and eats the spread invisibly.

Nobody wakes up wanting "premium macro research." They wake up wanting to know their savings won't evaporate.

### The Wedge

Open the app → see your own currency's depreciation against gold/USD/EUR in your local context ("your 100,000 KES lost 12% vs gold this year") → pick a savings philosophy that matches your values → Shield tab auto-generates a protection plan → Guardian executes on Arbitrum within your permission bounds.

One narrow thing done better than any alternative: **risk-aware, values-driven treasury management** with verifiable on-chain execution. Not a DeFi dashboard. Not a trading terminal. A protection layer.

### Why Now

- EM currency crises in 2024–25 (Naira -40%, Cedi -30%, Shilling -20%) made depreciation pain acute and personal.
- Stablecoin settlement is mainstream in EM (USDC, cUSD, regional stables).
- Account abstraction (ZeroDev / Privy) removes wallet UX friction for non-crypto-native users.
- AI advisors can personalize macro risk in plain language — no more "read a 40-page World Bank report."
- GMX best-yield engine turns the Guardian from a static 3-token menu into dynamic Arbitrum DeFi optimization.

### Alternatives and Gaps

| Alternative | Why It Falls Short |
|---|---|
| Local bank savings | Below-inflation returns, no FX hedge, no automation |
| Manual DeFi (Uniswap, Aave) | Requires expertise, no risk framework, no cultural alignment, no autonomous execution |
| Crypto savings apps (generic) | No risk-aware framing, no philosophy system, no on-chain verifiability, no autonomous Guardian |
| Importer FX rails (Waza, Juicyway) | Solve the *movement* of money, not the *risk* in the window between local sales and next supplier payment |

**Gap:** No product combines risk-aware framing + values-driven philosophy + autonomous on-chain execution with verifiable proof of every decision.

### Why Onchain, Why Arbitrum

On-chain is not decorative — the entire value proposition breaks without it:

| On-chain property | How DiversiFi uses it |
|---|---|
| **Verifiability** | Every Guardian recommendation recorded on the Arbitrum `RecommendationLedger` (mainnet contract `0x3BCf…369C`) — users and auditors can verify every decision |
| **Programmability** | Guardian auto-executes within user-signed ERC-7715-style permission bounds — no manual intervention |
| **Composability** | GMX GM-pool deposits for blue-chip yield, vaults.fyi for best-yield routing across 1,000+ Arbitrum vaults |
| **Transparency** | 0G evidence anchoring — AI reasoning is immutable and auditable, not a black box |

Arbitrum specifically: lowest fees for small-ticket EM savings, deepest DeFi liquidity (GMX, Aave, Morpho, Pendle), and the Guardian's primary execution layer.

### First 5–10 Users

1. African diaspora professionals in London (3–5 via community WhatsApp/Slack groups)
2. EM tech workers at Open House London who feel the depreciation pain personally
3. Two SME importers from the Accra/Lagos trader interviews that shaped the FX north star
4. Confucian/Gotong Royong philosophy users (APAC rail on HashKey)
5. Early Guardian testers already on the app (651 tests green, prod deployed)

### Ship This Weekend

The live demo path, end-to-end:

1. Visitor lands → auto-detected country → sees their currency's depreciation vs gold/USD/EUR
2. Picks a savings philosophy (Africapitalism, Buen Vivir, Islamic Finance, etc.)
3. Shield tab shows Protection Scorecard with philosophy-aware recommendations
4. AI Advisor explains the plan in plain language (streaming, real SSE)
5. Guardian auto-executes on Arbitrum: GMX GM-pool deposit, RecommendationLedger record, 0G evidence anchor
6. Verifiable end-to-end: every step has an explorer link

---

## GTM Canvas

### Core Message, One Sentence

"Your savings are losing value every day. DiversiFi protects them automatically — aligned with your values, verified on-chain."

Repeatable version: "I opened the app and saw my Shilling lost 12% this year, so I turned on Shield."

### The Star Customer

**Who:** The diaspora professional in London whose family's savings in Nairobi are evaporating.

| Stage | Mechanic |
|---|---|
| **Find** | Currency risk moment — the app detects their country and shows them their *own money* losing value. Not abstract "inflation," not "diversify your portfolio." Personal, visceral, immediate. |
| **Trust** | Verifiable AI — every recommendation anchored on 0G, recorded on Arbitrum ledger, open-source. No black-box "trust our algorithm." The user can *check.* |
| **Stay** | Guardian auto-executes within permission bounds. Yield compounds. The user doesn't need to come back daily — the agent works for them. Engagement tiers (Free / Saver / Committed) gate premium insights on real deposits, not speculation. |
| **Share** | The risk moment is inherently viral. "Did you know the Naira lost 40% vs gold in two years?" is a conversation starter. The philosophy system gives it cultural identity ("I'm Africapitalism" / "I'm Buen Vivir"). |

### Three Discovery Paths

| Path | How DiversiFi uses it |
|---|---|
| **Borrowed** | EM diaspora community channels (WhatsApp groups, Slack communities, church/mosque networks, Afrotech events). The risk moment is a natural fit for "here's something that helped me" sharing. Partner with EM-focused fintechs (Mento, Good Dollar) for co-distribution. |
| **Bought** | NOT points/airdrops. Instead: engagement-tiered premium insights. Free tier = data open to all. Saver tier (≥$100 or 7-day streak) = personalized AI recommendations. Committed tier (≥$1,000 or 30-day) = vaults.fyi best-yield routing. The incentive is *better intelligence*, not token speculation. |
| **Earned** | The risk moment is inherently shareable. "My currency lost X% vs gold this year" is a stat people talk about. Founder-led presence in EM crypto communities. On-chain verifiability as a trust signal (public ledger, public 0G anchors). |

### Discovery → Trust → Stay → Share (Detail)

**Discover — "How does the user discover you?"**

Borrowed distribution via EM diaspora networks. The risk moment (see your currency's depreciation in your own money) is the discovery hook — it's not "come try our DeFi app," it's "here's what's happening to your savings right now."

First reachable audience: London-based African professionals (via Afrotech London, community WhatsApp groups, Open House network). They feel the pain personally, they have the budget, they can switch (already comfortable with cross-border money flows).

**Trust — "Why do they believe you're safe?"**

Three trust mechanisms, none relying on "trust us":

1. **Verifiable AI** — Every Guardian recommendation is recorded on the Arbitrum RecommendationLedger (public, auditable). AI reasoning is anchored to 0G Storage (immutable evidence). Open-source code.
2. **Honest UX** — The app never prescribes "move to USD." It presents depreciation as neutral data. It labels APAC rail "coming soon" until mainnet deploy. It never fabricates price feeds (honest EM price service with staleness indicators).
3. **Economic alignment** — Engagement tiers gate premium insights on *real deposits*, not speculation. The cost discipline (free-first, pay only for differentiated intelligence) means the business model is sustainable without token inflation.

**Stay — "Why do they keep using you?"**

- **Utility lock-in:** Shield runs autonomously. The user sets permission bounds once; the Guardian monitors, decides, and executes within those bounds. No daily check-in required.
- **Yield:** GMX GM-pool deposits (blue-chip BTC/ETH only), vaults.fyi best-yield routing across 1,000+ Arbitrum vaults. Real yield from protocol fees, not token inflation.
- **Philosophy identity:** The user chose Africapitalism, Buen Vivir, Islamic Finance, etc. This isn't a one-time onboarding — it shapes every recommendation, every protection plan. The identity deepens over time.
- **Progress:** The Protection Scorecard shows improvement. The on-chain ledger shows a growing history of verified decisions. The user sees their savings *being protected*, not just sitting there.

**Share — "Why do they bring others?"**

- **The risk moment is viral:** "My currency lost 12% vs gold this year" is a stat people share. It's not "I use this DeFi app" (boring); it's "look what's happening to our money" (urgent, personal, cultural).
- **Philosophy identity:** "I'm Africapitalism" / "I'm Buen Vivir" is a cultural identifier. People share identity. The philosophy system turns a financial tool into a community marker.
- **Verifiable proof:** The on-chain ledger means users can *show* their Guardian's decisions. Not "trust me, it works" but "here's the Arbitrum tx." Social proof with receipts.

### GTM Anti-Patterns We Avoid

| Trap | How we avoid it |
|---|---|
| "I have contacts that will promote us" | The risk moment is the distribution, not contacts. Contacts amplify, but the product is inherently shareable. |
| "We have points" | Engagement tiers are based on real deposits + real usage, not speculation. No token = no points theater. |
| "We have a token" | No token. Revenue from intelligence resale (vaults.fyi, x402 nanopayments), not token emission. |
| "We are composable" | GMX integration is a real yield path (blue-chip GM-pool deposits), not a money-lego flex for composability's sake. |
| "We'll partner with protocols" | Specific: Mento (EM stablecoins), Good Dollar (basic income), vaults.fyi (yield intelligence). Each partner gets something concrete. |
| "We need users" | Specific ICP: EM diaspora professional in London, 28–40, sending money home, already comfortable with cross-border flows. Not "everyone in crypto." |

### GMX as Blueprint

| GMX Lesson | DiversiFi Application |
|---|---|
| **Composability → Free distribution** | GMX built GLP as a money lego (28+ protocols built on it). DiversiFi builds the *risk-aware protection layer* on top of Arbitrum yield — vaults.fyi, GMX, and future integrations distribute DiversiFi's intelligence to their users. |
| **Real-fee yield → Trust** | GMX earned user yield from protocol fees, not token inflation. DiversiFi routes to GMX GM-pools (LPs earn 63% of fees) — real yield, verifiable on-chain. |
| **Staking & vesting → Stay** | GMX stakers locked esGMX for 12 months. DiversiFi's engagement tiers (Saver ≥$100 or 7-day, Committed ≥$1,000 or 30-day) create natural retention through accumulated intelligence history and on-chain proof. |
| **Referrals → Share** | GMX's referral system gave fee discounts + affiliate rewards. DiversiFi's share mechanic is organic: the risk moment + philosophy identity + verifiable on-chain proof. No referral program needed — the product markets itself through cultural identity. |

---

## Summary: The Arbitrum Alignment

| Arbitrum Guidance | DiversiFi Response |
|---|---|
| "Onchain should be necessary, not decorative" | The entire value prop (verifiable recommendations, autonomous execution, evidence anchoring) breaks without Arbitrum |
| "Start with the workflow, not the category" | Wedge: "I saw my currency losing value → Shield protected it." Not "DeFi savings" or "AI agent marketplace." |
| "Smallest credible product surface" | Shield tab. One ICP, one painful workflow, one core action (enable Shield), one proof point (recommendation on Arbitrum ledger). |
| "Trigger events create openings" | 2024–25 EM currency crises. The app detects the visitor's country and shows them their specific currency's depreciation. |
| "Alternatives are the real competitor" | Bank savings (below inflation), manual DeFi (no risk framework), generic crypto apps (no philosophy, no autonomy). Gap: no product combines risk-aware + values-driven + autonomous + verifiable. |
| "GMX: composability + real-fee yield" | GMX GM-pool deposits for real yield (blue-chip only, memecoin guard). vaults.fyi for best-yield routing across 1,000+ Arbitrum vaults. |
