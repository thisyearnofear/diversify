# Arbitrum Open House London — Pitch Deck Outline

*DiversiFi Guardian · July 2026 · ~10 slides*

> **Status note (2026-07-12):** This deck describes the long-term differentiated vision and the buildathon target. The **philosophy/values system and the retail FX-risk moment are live in the app today**. The **SME importer archetype, purchase-cycle UI, and per-cycle drag report are the north star** we are building toward; the concierge FX drag report (`scripts/fx-drag-report.ts`) is already validating the math with real traders. See `docs/sme-fx-implementation-plan.md` for the phased build plan.

---

## Slide 1: Title

**DiversiFi Guardian**

*FX-risk intelligence and autonomous protection for businesses that earn in one currency and must purchase in another.*

The retail savings app is top-of-funnel. The business intelligence layer is the real product. The philosophy/values system is the retention moat.

Arbitrum Open House London · July 2026

---

## Slide 2: The Problem

**Currency risk is invisible. It bleeds margins silently.**

A Ghanaian plastics manufacturer imports $50K of resin quarterly from China. They sell locally in cedis, accumulate proceeds over 6 weeks, then convert to USD to pay the supplier.

If the cedi slips 5% between sale and payment, they eat an **unplanned $2,500 loss**. These losses "rarely show up as clear line items" — they're invisible, cognitive burden.

This is **universal**:
- A US retailer sourcing from China (USD/CNY volatility)
- A UK business importing from the Eurozone (GBP/EUR volatility)
- A Nigerian trader buying from Dubai (NGN/USD volatility)

The currencies change. The problem is identical.

The SME bleeds margin in the window between local sales and the next supplier payment.

---

## Slide 3: The Insight

**The movement-of-money problem is crowded. The risk layer is missing.**

Everyone builds roads. Nobody builds the driver.

The payment rails are solved: Waza, Juicyway, Cedar Money, Verto, Yellow Card — they handle the *movement* of money. But they don't handle the *risk* in the window between local sales and next supplier payment.

**No player offers FX risk quantification + autonomous protection.**

Not in Africa. Not in America. Not anywhere.

The exposed window — local-currency proceeds accumulating between purchase cycles — is unserved everywhere.

---

## Slide 4: The Solution

**DiversiFi Guardian: FX-risk intelligence + autonomous protection + values-driven philosophy.**

Three layers, each a differentiator:

**Layer 1: FX-Risk Intelligence (the real product)** *(north star; concierge-validated today)*
- Define a purchase cycle: "I need $50K USD in 6 weeks to pay my supplier"
- Guardian monitors local-currency depreciation + inflation signals in real-time
- Autonomously rebalances accumulating proceeds toward USD-pegged stables
- Delivers **per-cycle FX drag report**: "this cycle, protection preserved ₵X vs holding cedis"
- Quantified, exportable, ledger-backed. An audit trail for the business's books.
- **Honesty label:** The self-serve purchase-cycle UI is not yet in the consumer app; the concierge FX drag report is validating the math with real traders.

**Layer 2: Autonomous Execution (the trust layer)** *(live today)*
- Guardian executes on Arbitrum within user-signed permission bounds
- Every recommendation recorded on the `RecommendationLedger` + anchored to `0G Storage`
- Not "trust our AI" — you can *check.* The accountant can verify every tx.

**Layer 3: Philosophy System (the retention moat)** *(live today)*
- Pick a cultural identity: Africapitalism, Buen Vivir, Islamic Finance, Confucian, Gotong Royong, Global Diversification, or custom
- This is not a risk tolerance slider — it's a values declaration that shapes every recommendation
- "I'm Africapitalism" is a community marker, not a feature. No other product has this.

**Top-of-funnel:** The retail savings app shows the individual their currency risk, lets them pick a philosophy, and builds trust. The graduation CTA: "This is what it cost you personally. Run it on your business." *(Graduation detection and CTA are planned; a small business-context hint is live in onboarding.)*

---

## Slide 5: The Wedge

**The smallest credible product surface.** *(North star: the SME importer wedge. The live wedge today is the retail savings app with the philosophy/values system.)*

| One ICP | SME importer that earns in one currency, pays in another |
|---|---|
| **One painful workflow** | "My margin is evaporating in the window between local sales and supplier payment" |
| **One core action** | Define purchase cycle → Guardian monitors → autonomous protection → per-cycle drag report |
| **One proof point** | Per-cycle drag report showing margin preserved, verifiable on Arbitrum + Robinhood Chain ledger |

**Live wedge today:**
- One ICP: EM diaspora professional / individual entrepreneur whose savings are working capital
- One painful workflow: "My family's savings are losing value and I don't know what to do"
- One core action: Enable Shield → Guardian auto-protects
- One proof point: Recommendation on Arbitrum ledger, verifiable by anyone

This is not a DeFi dashboard. Not a trading terminal. Not a yield farming app.

**It is an intelligence layer that sits on top of the payment rails.**

The payment rails (Waza, Juicyway, Cedar) handle the movement of money. DiversiFi handles the risk in the window between local sales and next supplier payment.

---

## Slide 6: The Philosophy System (Key Differentiator)

**No other product in DeFi or fintech has this.**

When a user chooses a philosophy, they're not picking a risk tolerance — they're declaring a cultural identity.

| Philosophy | Values | Allocation Focus |
|---|---|---|
| **Africapitalism** | Build African wealth, community prosperity | African stablecoins (cUSD, KESm), regional yield |
| **Buen Vivir** | Balance personal resilience with people and place | Latin American stables, community development |
| **Islamic Finance** | Sharia-compliant, ethical, risk-sharing | Halal-certified stables, profit-sharing yield |
| **Confucian** | Patience, long-term stability, filial responsibility | USD-pegged stables, gold-backed assets |
| **Gotong Royong** | Community resilience, mutual aid | Southeast Asian stables, cooperative yield |
| **Global Diversification** | Spread risk across regions and asset types | Multi-currency stables, global RWA |
| **Custom** | Build your own plan | User-defined allocation |

**Why this is a moat:**
- **Identity-based retention:** Users don't just use the app — they *belong* to a philosophy. "I'm Africapitalism" is a community marker.
- **Cultural resonance:** Financial decisions are not just mathematical — they're cultural, ethical, and personal.
- **Structural moat:** This is the reason someone stays when the yield is identical elsewhere.
- **Regulatory protection:** Non-prescriptive framing (never "move to USD") is protection in anti-dollarization climates.

The philosophy shapes every recommendation. It's not a one-time onboarding checkbox — it's the lens through which the AI sees the user's savings.

| Property | How DiversiFi uses Arbitrum |
|---|---|
| **Verifiability** | `RecommendationLedger` on Arbitrum mainnet (`0x3BCf…369C`) — every Guardian decision is public and auditable |
| **Programmability** | Guardian auto-executes within user-signed permission bounds — no manual intervention |
| **Composability** | GMX GM-pool deposits for blue-chip yield, vaults.fyi for best-yield routing across 1,000+ Arbitrum vaults |
| **Transparency** | 0G evidence anchoring — AI reasoning is immutable and auditable, not a black box |

**Arbitrum specifically:** lowest fees for small-ticket EM savings, deepest DeFi liquidity (GMX, Aave, Morpho, Pendle), and the Guardian's primary execution layer. **Robinhood Chain** (an Arbitrum Dedicated Blockchain) extends this into tokenized RWAs — USDG, SGOV, SPY/QQQ — as additional hedging instruments.

---

## Slide 7: The Yield Engine

**From a hardcoded 3-token menu to a best-yield engine.**

- **vaults.fyi** (live): per-wallet best-deposit recommendations across 1,000+ risk-rated vaults. Free-first: raw APY stays free (DefiLlama); we pay only for the personalized layer.
- **GMX GM-pool deposits** (live): blue-chip markets only (BTC/ETH, never memecoin pools). Dynamic execution fee + slippage floor from live GM price. Validated with real deposits on Arbitrum One mainnet.
- **Cost discipline:** engagement tiers gate paid insights by real usage (Free / Saver ≥$100 or 7-day streak / Committed ≥$1,000 or 30-day). Default-deny — we never pay for the unengaged.

**Real yield from protocol fees, not token inflation.** (GMX blueprint.)

---

## Slide 8: The Multi-Chain Story

**One agent, four chains, verifiable receipts.**

| Action | Chain | Why |
|---|---|---|
| RWA / stock-token hedging | **Robinhood Chain** | Tokenized stocks, ETFs, and USDG on an Arbitrum Dedicated Blockchain — additional hedge layer for FX-risk protection |
| APAC savings / hold decisions | **HashKey Chain** | Regulated-market savings home for Confucian / Gotong Royong philosophy users — immutable audit trail APAC users recognize |
| RWA / yield rotations | **Arbitrum** | Deep DeFi liquidity, GMX yield, best-yield engine |
| EM local stables (cUSD, KESm, …) | **Celo** | Local stablecoins, low-cost savings for African / Latin American users |
| AI reasoning evidence | **0G Storage** | Immutable anchoring — AI reasoning is auditable, not a black box |

Chain-aware routing: the Guardian picks the right chain for the right action based on the user's philosophy and region. Not "deploy everywhere," but **deploy where it matters.**

---

## Slide 9: GTM — How Users Find, Trust, Stay, Share

| Stage | Mechanic |
|---|---|
| **Find** | Risk moment — the app detects their country and shows them their *own money* losing value. Borrowed distribution via EM diaspora networks (WhatsApp, Slack, Afrotech events). |
| **Trust** | Verifiable AI — every recommendation on Arbitrum ledger, anchored on 0G. Honest UX (never prescribes, never fabricates data). Economic alignment (engagement tiers on real deposits, not speculation). |
| **Stay** | Guardian auto-executes. Yield compounds. Philosophy identity deepens. Protection Scorecard shows progress. On-chain ledger shows growing history of verified decisions. |
| **Share** | The risk moment is viral ("My currency lost 12% vs gold this year"). Philosophy identity is cultural ("I'm Africapitalism"). Verifiable proof ("Here's the Arbitrum tx"). |

**Anti-patterns avoided:** No token. No points theater. No "we're composable" without native reason. No "we need users" (specific ICP: EM diaspora professional in London, 28–40, sending money home).

---

## Slide 10: Traction + What's Live

| Signal | Status |
|---|---|
| **Prior live usage** | Shipped as a Farcaster mini app — real users onboarded and transacted, enough to receive **Arbitrum funding** from that usage. Retention was low; the current reframe (the philosophy/values system, the currency risk moment, the verifiable Guardian, the values-driven product quality pass) is the direct response to what retention data taught us. |
| **Prod deployment** | Live on Hetzner, healthz gate passing, all endpoints HTTP 200 |
| **Tests** | 651 passing |
| **Arbitrum mainnet** | RecommendationLedger deployed (`0x3BCf…369C`), GMX real deposits validated (tx `0x9004d233…`) |
| **Celo mainnet** | RecommendationLedger deployed, Guardian heartbeat + Guardian loop (5-min cron) |
| **0G mainnet** | Evidence anchoring live, ledger mirror deployed |
| **Robinhood Chain mainnet** | RecommendationLedger deployed (`0x3BCf…369C`), first recommendation recorded (`HOLD → USDG`) |
| **HashKey mainnet** | APAC rail — ledger deployed, "coming soon" honesty until mainnet gas funded |
| **AI** | Real SSE streaming (Gemini + Venice), intent fast-path, mobile sheet, analytics |
| **Voice** | ElevenLabs TTS + Scribe STT, feature-flagged |
| **Free web search** | TinyFish API, free-first (covers paid marketplace search) |
| **Bundle size** | First-load JS: 4.24 MB → 0.90 MB gz (deep-imported around CommonJS barrel). SME FX layer: concierge FX drag report validates the math; self-serve importer archetype + purchase-cycle UI are planned (see `docs/sme-fx-implementation-plan.md`). |

**What we're asking for this weekend:**

- Mentorship on sharpening the wedge (importer SME persona vs. diaspora retail)
- Intros to EM diaspora community leaders in London
- Feedback on the philosophy system: is it a retention mechanic or a gimmick?

---

## Appendix: Architecture (if asked)

- **Next.js frontend** (standalone build, deployed to Hetzner, PM2-managed)
- **Shared package** (`@diversifi/shared`): AI service (multi-provider failover), market pulse service, Cognee memory, vault services, swap orchestrator
- **Guardian loop** (`/api/agent/guardian-loop`): 5-min cron, auto-executes within user permission bounds
- **RecommendationLedger**: Solidity contract on Arbitrum + Robinhood Chain + Celo + HashKey mainnets
- **0G Storage**: evidence anchoring for AI reasoning
- **x402 nanopayments**: paid intelligence marketplace (vaults.fyi, future providers)

## Appendix: Team

**Solo build by papa** — Nairobi, Kenya 🇰🇪

| Handle | Profile |
|---|---|
| [@papa](https://farcaster.xyz/papa) | Farcaster |
| [@papajams](https://palus.app/u/papajams) | Lens |

DiversiFi is built end-to-end by one developer — the Solidity contracts,
the five-chain mainnet ledger deployments (Arbitrum, Celo, 0G, HashKey,
Robinhood Chain), the Guardian autonomous loop, the GMX integration, the
multi-provider AI service with 0G anchoring, the 650+ tests, and the
3-agent security review. The problem is personal: Kenyan shillings lose
value against the dollar, and the people hurt most are the least equipped
to defend against it.
