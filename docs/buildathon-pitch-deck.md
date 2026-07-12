# Arbitrum Open House London — Pitch Deck Outline

*DiversiFi Guardian · July 2026 · ~10 slides*

---

## Slide 1: Title

**DiversiFi Guardian**

*Your savings are losing value every day. We protect them automatically.*

Risk-aware, values-driven treasury management on Arbitrum.

Arbitrum Open House London · July 2026

---

## Slide 2: The Problem

**Nobody wakes up wanting "premium macro research."**

They wake up wanting to know their savings won't evaporate.

- The Nigerian professional in London sends money home. Their parents' bank deposit in Naira lost **40% vs gold** in two years.
- The Kenyan tech worker's savings in Shilling lost **20% vs gold** in one year.
- The Ghanaian importer buys in USD, sells in Cedis, and bleeds **3–6% on every FX conversion** — invisibly, in the window between local sales and the next supplier payment.

**The pain is not abstract. It is personal. It is measurable. It is happening right now.**

---

## Slide 3: The Insight

**Risk is universal, not currency-specific.**

"Stable" currencies (USD, EUR, GBP) are not risk-free. Gold has outperformed all of them. Inflation erodes purchasing power universally. Political and concentration risk exist in every jurisdiction.

A US investor worried about political instability, an African diaspora member in New York whose family's savings are in KES, or a Muslim in London seeking Sharia-compliant holdings — **all of them have risk, and all of them can find a philosophy that matches their values.**

**Risk is contextual. The response is values-driven.**

---

## Slide 4: The Solution

**DiversiFi Guardian: risk-aware, values-driven treasury management.**

1. **Risk moment** — The app detects your country and shows you your *own currency's* depreciation against gold, USD, and EUR. Not abstract. Not prescriptive. Just the data, in your local context.

2. **Philosophy** — You pick a savings philosophy that matches your values: Africapitalism, Buen Vivir, Islamic Finance, Confucian, Global Diversification, or your own. This shapes every recommendation.

3. **Shield** — The Guardian monitors markets, detects inflation shifts, and protects your savings by routing between stablecoins, yield, and real-world assets. Autonomous, within your permission bounds.

4. **Verifiable** — Every recommendation is recorded on the **Arbitrum RecommendationLedger** and anchored to **0G Storage**. Not "trust our AI." You can *check.*

---

## Slide 5: The Wedge

**The smallest credible product surface.**

| One ICP | EM diaspora professional in London, sending money home |
|---|---|
| **One painful workflow** | "My family's savings are losing value and I don't know what to do" |
| **One core action** | Enable Shield → Guardian auto-protects |
| **One proof point** | Recommendation on Arbitrum ledger, verifiable by anyone |

This is not a DeFi dashboard. Not a trading terminal. Not a yield farming app.

**It is a protection layer.**

---

## Slide 6: Why Arbitrum

**On-chain is not decorative — the entire value proposition breaks without it.**

| Property | How DiversiFi uses Arbitrum |
|---|---|
| **Verifiability** | `RecommendationLedger` on Arbitrum mainnet (`0x3BCf…369C`) — every Guardian decision is public and auditable |
| **Programmability** | Guardian auto-executes within user-signed permission bounds — no manual intervention |
| **Composability** | GMX GM-pool deposits for blue-chip yield, vaults.fyi for best-yield routing across 1,000+ Arbitrum vaults |
| **Transparency** | 0G evidence anchoring — AI reasoning is immutable and auditable, not a black box |

**Arbitrum specifically:** lowest fees for small-ticket EM savings, deepest DeFi liquidity (GMX, Aave, Morpho, Pendle), and the Guardian's primary execution layer.

---

## Slide 7: The Yield Engine

**From a hardcoded 3-token menu to a best-yield engine.**

- **vaults.fyi** (live): per-wallet best-deposit recommendations across 1,000+ risk-rated vaults. Free-first: raw APY stays free (DefiLlama); we pay only for the personalized layer.
- **GMX GM-pool deposits** (live): blue-chip markets only (BTC/ETH, never memecoin pools). Dynamic execution fee + slippage floor from live GM price. Validated with real deposits on Arbitrum One mainnet.
- **Cost discipline:** engagement tiers gate paid insights by real usage (Free / Saver ≥$100 or 7-day streak / Committed ≥$1,000 or 30-day). Default-deny — we never pay for the unengaged.

**Real yield from protocol fees, not token inflation.** (GMX blueprint.)

---

## Slide 8: The Multi-Chain Story

**One agent, three chains, verifiable receipts.**

| Action | Chain | Why |
|---|---|---|
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
| **Prod deployment** | Live on Hetzner, healthz gate passing, all endpoints HTTP 200 |
| **Tests** | 651 passing |
| **Arbitrum mainnet** | RecommendationLedger deployed (`0x3BCf…369C`), GMX real deposits validated (tx `0x9004d233…`) |
| **Celo mainnet** | RecommendationLedger deployed, Guardian heartbeat + Guardian loop (5-min cron) |
| **0G mainnet** | Evidence anchoring live, ledger mirror deployed |
| **HashKey mainnet** | APAC rail — ledger deployed, "coming soon" honesty until mainnet gas funded |
| **AI** | Real SSE streaming (Gemini + Venice), intent fast-path, mobile sheet, analytics |
| **Voice** | ElevenLabs TTS + Scribe STT, feature-flagged |
| **Free web search** | TinyFish API, free-first (covers paid marketplace search) |
| **Bundle size** | First-load JS: 4.24 MB → 0.90 MB gz (deep-imported around CommonJS barrel) |

**What we're asking for this weekend:**

- Mentorship on sharpening the wedge (importer SME persona vs. diaspora retail)
- Intros to EM diaspora community leaders in London
- Feedback on the philosophy system: is it a retention mechanic or a gimmick?

---

## Appendix: Architecture (if asked)

- **Next.js frontend** (standalone build, deployed to Hetzner, PM2-managed)
- **Shared package** (`@diversifi/shared`): AI service (multi-provider failover), market pulse service, Cognee memory, vault services, swap orchestrator
- **Guardian loop** (`/api/agent/guardian-loop`): 5-min cron, auto-executes within user permission bounds
- **RecommendationLedger**: Solidity contract on Arbitrum + Celo + HashKey mainnets
- **0G Storage**: evidence anchoring for AI reasoning
- **x402 nanopayments**: paid intelligence marketplace (vaults.fyi, future providers)

## Appendix: Team

*(Fill in before submission)*

| Name | Role | Background |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |
