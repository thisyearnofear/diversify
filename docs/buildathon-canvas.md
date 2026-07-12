# Arbitrum Open House London — Product + GTM Canvas

*DiversiFi Guardian · July 2026*

> **Status note (2026-07-12):** This canvas describes the long-term differentiated vision and the buildathon target. The **philosophy/values system and the retail FX-risk moment are live in the app today**. The **SME importer archetype, purchase-cycle UI, and per-cycle drag report are the north star** we are building toward; the concierge FX drag report (`scripts/fx-drag-report.ts`) is already validating the math with real traders. See `docs/sme-fx-implementation-plan.md` for the phased build plan.

---

## The Core Differentiation

**Two things make DiversiFi unique. Everything else is commodity.**

1. **FX-risk intelligence layer** — the ability to quantify and autonomously flatten currency risk for businesses that earn in one currency and must purchase in another. A Ghanaian importer buying from China in USD. A US retailer sourcing from the Eurozone. A UK business paying suppliers in USD. The currencies change; the problem is identical. The SME bleeds margin in the window between local sales and the next supplier payment. **No player in the market offers FX risk quantification + autonomous protection.** Not in Africa. Not in America. Not anywhere.

2. **The philosophy/values system** — no other product in DeFi or fintech has this. It's not a feature; it's a structural moat that creates identity-based retention and cultural community. When a user chooses "Africapitalism" or "Buen Vivir" or "Islamic Finance," they're not picking a risk tolerance — they're declaring a cultural identity. This turns a financial tool into a community marker. It's the reason someone stays when the yield is identical elsewhere.

**The retail savings app is top-of-funnel.** It proves the tech, builds trust, and funnels users into the business intelligence layer. The business intelligence layer is the real product. The philosophy system is the retention moat.

---

## Product Canvas

### Team Name

DiversiFi Guardian

### One Line: What You're Building

**FX-risk intelligence and autonomous protection for businesses that earn in one currency and must purchase in another.** Every decision quantified, autonomous, and verifiable on-chain. The retail savings app is top-of-funnel; the business intelligence layer is the real product. The philosophy/values system is the retention moat.

### Who Is This For

**Primary: The SME importer/trader.** A business that earns revenue in local currency (cedis, naira, shillings — or dollars, euros, pounds) but must pay suppliers in a different currency. They accumulate local-currency proceeds between purchase cycles, and those proceeds are exposed to FX volatility for 2–8 weeks. The loss is real but invisible — it never shows up as a line item.

This is **universal**: a Ghanaian plastics manufacturer importing $50K of resin quarterly, a US retailer sourcing from China, a UK business buying from the Eurozone. The currencies change; the problem is identical. The SME bleeds margin in the window between local sales and the next supplier payment.

**Secondary (top-of-funnel):** The individual entrepreneur or diaspora professional whose personal savings ARE working capital. For a Ghanaian or Nigerian trader, the personal/business boundary is thin — personal savings is working capital. The retail app is where they first encounter the tech, see their currency risk quantified, pick a philosophy that matches their values, and build trust in the autonomous execution.

### What They Do Today

**The business:** Wire through a bank or payment rail, eat the spread invisibly, and hope the currency doesn't slip between quotation and settlement. A mid-sized Ghanaian manufacturer importing $50K quarterly eats an unplanned $2,500 loss if the cedi slips just 5% — and these losses "rarely show up as clear line items." The cognitive burden is real: they begrudge even having to think about FX.

**The individual:** Park savings in a local bank account earning below-inflation interest. Or manually buy USD stablecoins across 3–4 apps with no risk framework, no automation, and no cultural/values alignment. Nobody wakes up wanting "premium macro research." They wake up wanting to know their money won't evaporate.

### The Wedge

**For the business:** Define a purchase cycle (expected USD obligation: amount + approximate date) → the Guardian monitors local-currency depreciation and inflation signals → autonomously rebalances accumulating proceeds toward USD-pegged stables as the payment date approaches → delivers a **per-cycle FX drag report**: "this cycle, protection preserved ₵X vs holding cedis." Quantified, exportable, ledger-backed. An audit trail for the business's books.

**For the individual (top-of-funnel):** Open the app → see your own currency's depreciation against gold/USD/EUR in your local context ("your 100,000 KES lost 12% vs gold this year") → pick a savings philosophy that matches your values (Africapitalism, Buen Vivir, Islamic Finance, Confucian, Global Diversification, or custom) → Shield tab auto-generates a protection plan → Guardian executes on Arbitrum within your permission bounds.

**The philosophy system is the retention moat.** When a user chooses "Africapitalism," they're not picking a risk tolerance — they're declaring a cultural identity. This turns a financial tool into a community marker. It's the reason someone stays when the yield is identical elsewhere. The philosophy shapes every recommendation, every protection plan, every Guardian decision. It's not a one-time onboarding; it's the lens through which the AI sees the user's savings.

**The graduation moment must be designed, not hoped for.** The retail scorecard already shows a user what holding cedis cost them; the business version shows what it cost *per purchase cycle* — and the CTA is "run this on your business."

One narrow thing done better than any alternative: **FX-risk intelligence + autonomous protection + values-driven philosophy** with verifiable on-chain execution. Not a payment rail (partners own the licensed money movement). Not a DeFi dashboard. Not a trading terminal. An intelligence layer that sits on top of the rails.

### Why Now

**The FX volatility trigger is universal and acute:**
- **Global supply chain stress:** Post-2020, businesses face unprecedented currency volatility. The USD/EUR/GBP swing 10-15% annually. EM currencies swing 20-40%.
- **SME exposure is invisible:** Traditional banks don't quantify the FX drag on working capital. The loss is real but never shows up as a line item.
- **Stablecoin rails are live:** USDC/USDT settlement is now infrastructure, not speculation. The rails exist; the intelligence layer on top is missing.
- **AI can quantify risk in plain language:** No more "read a 40-page World Bank report." The Guardian monitors depreciation, inflation, and macro signals in real-time and delivers per-cycle quantification.
- **Account abstraction removes wallet friction:** ZeroDev / Privy make onboarding non-crypto-native business operators feasible.

**The competitive gap is wide open:** The movement-of-money problem is crowded (Waza, Juicyway, Cedar Money, Verto, Yellow Card, Flutterwave, Paystack). **No player offers FX risk quantification, hedging, or automated protection for these businesses.** The exposed window — local-currency proceeds accumulating between purchase cycles — is unserved everywhere. Not just in Africa. In America. In Europe. In Asia.

### Alternatives and Gaps

| Alternative | Why It Falls Short |
|---|---|
| **Traditional bank FX desk** | Manual, slow, expensive. No automation. No quantification of the per-cycle drag. No audit trail. |
| **Payment rails (Waza, Juicyway, Cedar)** | Solve the *movement* of money, not the *risk* in the window between local sales and next supplier payment. No intelligence layer. |
| **Manual DeFi (Uniswap, Aave)** | Requires expertise, no risk framework, no cycle-awareness, no autonomous execution, no cultural/values alignment, no quantification. |
| **Generic crypto savings apps** | No FX-risk framing, no per-cycle intelligence, no philosophy system, no on-chain verifiability, no autonomous Guardian. |
| **Treasury management software (Kyriba, Reval)** | Enterprise-only, $50K+/yr, not designed for SME importers, no on-chain settlement, no AI autonomy. |

**The gap:** No product combines **FX-risk intelligence** (quantify the drag per cycle) + **autonomous protection** (Guardian executes within permission bounds) + **values-driven philosophy** (cultural identity, not just risk tolerance) + **verifiable on-chain proof** (audit trail for the business's books).

### Why Onchain, Why Arbitrum

On-chain is not decorative — the entire value proposition breaks without it:

| On-chain property | How DiversiFi uses it |
|---|---|
| **Verifiability** | Every Guardian recommendation recorded on the Arbitrum `RecommendationLedger` (mainnet contract `0x3BCf…369C`) — the business owner and their accountant can verify every decision. Not "trust our algorithm." |
| **Programmability** | Guardian auto-executes within user-signed ERC-7715-style permission bounds — no manual intervention. The business defines the bounds once; the Guardian works autonomously. |
| **Composability** | GMX GM-pool deposits for blue-chip yield, vaults.fyi for best-yield routing across 1,000+ Arbitrum vaults. The intelligence layer routes to the best yield venue, not a hardcoded menu. |
| **Transparency** | 0G evidence anchoring — AI reasoning is immutable and auditable. The business can prove to their accountant (or regulator) why every decision was made. |

**Arbitrum specifically:** lowest fees for high-frequency SME transactions, deepest DeFi liquidity (GMX, Aave, Morpho, Pendle), and the Guardian's primary execution layer. The business doesn't care about the chain — they care about the quantified drag report and the audit trail.

### First 5–10 Users

**Target business users (validation / north star):**
1. Two SME importers from the Accra/Lagos trader interviews that shaped the FX north star — one plastics manufacturer (₦20M quarterly imports), one textiles trader (₦15M quarterly)
2. One US-based retailer sourcing from China — $100K quarterly, currently using a bank FX desk
3. One UK-based business importing from the Eurozone — £50K quarterly, exposed to GBP/EUR volatility

**Retail (top-of-funnel, live today):**
4. African diaspora professionals in London (3–5 via community WhatsApp/Slack groups) — personal savings are working capital, graduation candidates
5. EM tech workers at Open House London who feel the depreciation pain personally

**Why this mix:** The business users validate the intelligence layer (per-cycle drag quantification, autonomous protection, audit trail). The retail users validate the top-of-funnel trust-building and the philosophy system. Both prove the tech works end-to-end. The business layer is not yet a self-serve app feature; the concierge FX drag report is the current validation tool.

### Ship This Weekend

**Live demo path (retail top-of-funnel) — this works in the app today:**

1. Visitor lands → auto-detected country → sees their currency's depreciation vs gold/USD/EUR
2. Picks a savings philosophy (Africapitalism, Buen Vivir, Islamic Finance, etc.) — the values system is a key differentiator
3. Shield tab shows Protection Scorecard with philosophy-aware recommendations
4. AI Advisor explains the plan in plain language (streaming, real SSE)
5. Guardian auto-executes on Arbitrum within permission bounds
6. Every decision recorded on the Arbitrum RecommendationLedger + 0G evidence anchor

**North-star demo path (SME importer) — what we are building toward:**

1. Importer lands → defines a purchase cycle: "I need $50K USD in 6 weeks to pay my supplier"
2. The Guardian monitors local-currency depreciation + inflation signals in real-time
3. Per-cycle FX drag report: "this cycle, protection preserved ₵X vs holding cedis" — quantified, exportable
4. Guardian auto-executes on Arbitrum: rebalances accumulating proceeds toward USD-pegged stables as payment date approaches
5. Every decision recorded on the Arbitrum RecommendationLedger + 0G evidence anchor — an audit trail for the business's books
6. Verifiable end-to-end: the business owner and their accountant can check every tx

**Honesty boundary:** The importer purchase-cycle UI and autonomous cycle protection are not yet in the consumer app. The concierge FX drag report (`scripts/fx-drag-report.ts`) validates the math with real trader data; the self-serve product surface is sequenced in `docs/sme-fx-implementation-plan.md`.

---

## GTM Canvas

### Core Message, One Sentence

**For the business:** "Your working capital is exposed to currency risk every day. DiversiFi quantifies the drag, protects it autonomously, and gives you an audit trail you can show your accountant."

**For the individual (top-of-funnel):** "Your savings are losing value every day. DiversiFi protects them automatically — aligned with your values, verified on-chain."

Repeatable versions:
- Business: "I'm an importer. I define my purchase cycle, and the Guardian protects my margin. Here's the per-cycle drag report."
- Individual: "I opened the app and saw my Shilling lost 12% this year, so I turned on Shield."

### The Star Customer

**Primary: The SME importer/trader.** A business that earns in local currency but must pay suppliers in a different currency. They accumulate proceeds between purchase cycles, and those proceeds are exposed to FX volatility. The loss is real but invisible — it never shows up as a line item.

This is universal: a Ghanaian plastics manufacturer, a US retailer sourcing from China, a UK business importing from the Eurozone. The currencies change; the problem is identical.

**Secondary (top-of-funnel):** The diaspora professional or individual entrepreneur whose personal savings ARE working capital. The retail app is where they first encounter the tech, pick a philosophy that matches their values, and build trust in the autonomous execution.

| Stage | Mechanic (Business) | Mechanic (Individual) |
|---|---|---|
| **Find** | The importer hears about DiversiFi through trader networks, supply chain partners, or the graduation CTA from the retail app. The pain is acute: they've been burned by FX volatility. | Currency risk moment — the app detects their country and shows them their *own money* losing value. Not abstract "inflation." Personal, visceral, immediate. |
| **Trust** | Verifiable AI — every recommendation anchored on 0G, recorded on Arbitrum ledger. The per-cycle drag report is quantified, exportable, ledger-backed. An audit trail for the business's books. The accountant can verify every tx. | Verifiable AI — every recommendation anchored on 0G, recorded on Arbitrum ledger, open-source. No black-box "trust our algorithm." The user can *check.* |
| **Stay** | The Guardian monitors the purchase cycle, rebalances autonomously, delivers the per-cycle drag report. The business doesn't need to think about FX — the agent works for them. The audit trail is a compliance moat. | Guardian auto-executes within permission bounds. Yield compounds. The user doesn't need to come back daily. Engagement tiers gate premium insights on real deposits, not speculation. **The philosophy system is the retention moat:** "I'm Africapitalism" is a cultural identity, not a risk tolerance. |
| **Share** | The per-cycle drag report is the signature surface: "This cycle, protection preserved ₵X vs holding cedis." Quantified, exportable, ledger-backed. The business shows it to their accountant, their partners, their peers. | The risk moment is inherently viral. "Did you know the Naira lost 40% vs gold in two years?" is a conversation starter. The philosophy system gives it cultural identity ("I'm Africapitalism" / "I'm Buen Vivir"). |

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
