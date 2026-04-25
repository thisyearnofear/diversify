# Arc Nano Payments Hackathon — Demo Script
## DiversiFi: AI Wealth Protection with Real On-Chain Evidence

**Tracks:** 🤖 Agent-to-Agent Payment Loop · 🪙 Per-API Monetization Engine
**Duration:** 3–4 minutes
**Tagline:** "Your savings advisor buys fresh evidence on-chain before it moves your money."

---

## The Story (say this out loud)

> "Most AI advisors guess. DiversiFi pays for proof.
>
> Before recommending any portfolio action, our advisor buys live macro,
> yield, and risk data from multiple independent sources — each purchase
> settled as a real USDC micro-transaction on Arc, verified on-chain,
> before the recommendation is made.
>
> The payment is not a demo. The intelligence is not canned.
> Both are happening right now."

---

## Screen-by-Screen Walkthrough

### 1 — Open the metrics endpoint first (30 seconds)
**Why:** Establishes credibility before touching the UI. Judges see hard numbers upfront.

Open in browser:
```
https://api.diversifi.famile.xyz/api/agent/x402-metrics
```
or the production IP equivalent.

**Point out:**
- `transactionFrequency.totalSettledPayments` — 100+ real settled payments
- `pricing.allSourcesAtOrBelowOneCent: true` — every source ≤ $0.01
- `pricing.maxPerActionPriceUSDC: 0.01`
- `arcSettlement.agentAddress` — the live EOA wallet
- `arcSettlement.agentExplorer` — click it

**Say:**
> "This is not simulated. Every number here comes from real requests that
> settled real USDC on Arc."

---

### 2 — Arc Explorer: the agent wallet (30 seconds)
**Why:** On-chain proof is a hard submission requirement.

Click `arcSettlement.agentExplorer` or open directly:
```
https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8
```

**Point out:**
- Wallet balance (funded with 20 USDC, draining with each research request)
- Transaction list — each row is a real USDC transfer triggered by a research request
- Click one tx — show `to: DATA_HUB_RECIPIENT`, `value: 0.001–0.01 USDC`

**Say:**
> "Each of these transactions was triggered automatically — not by a human
> clicking send, but by an AI agent buying evidence before advising."

---

### 3 — Fire a live paid request via the gateway (45 seconds)
**Why:** Shows the x402 payment loop raw — before the UI abstracts it.

Open a new tab and hit the gateway directly:
```
https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis
```

**Show:** `402` response with `nonce`, `amount: "0.004"`, `currency: "USDC"`, `expires`

Now submit with a payment proof:
```
https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis
Header: x-payment-proof: circle-gateway-live-demo-001:0.004
```

**Point out in the 200 response:**
- `data.macro_regime`, `data.confidence`, `data.recommended_stance` — **real Gemini analysis**,
  not a hardcoded string. Changes with market conditions.
- `_billing.arcSettled: true`
- `_billing.txHashes[0]` — paste this into Arc Explorer
- `_billing.explorer[0]` — direct link to the on-chain proof

**Say:**
> "Gemini Flash pulled live data from World Bank, CoinGecko, and FRED,
> synthesised a macro regime analysis, and the payment for that analysis
> just settled on Arc. The tx hash is right there."

---

### 4 — Bundle request: three premium sources at once (30 seconds)
**Why:** Demonstrates agent-level orchestration — not one tx, many.

```
https://api.diversifi.famile.xyz/api/agent/x402-gateway?sources=macro_analysis,portfolio_optimization,risk_assessment
Header: x-payment-proof: circle-gateway-bundle-demo-001:0.015
```

**Point out:**
- Three separate AI analyses returned
- `_billing.cost: 0.015` — sum of all three sources
- `_billing.txHashes` — array with one tx per paid source
- `_billing.arcSettled: true`

**Say:**
> "One API call, three independent Gemini analyses of live data,
> three on-chain settlements. The agent pays for exactly what it uses —
> no batching, no custody, no intermediary."

---

### 5 — The advisor UI: full loop end to end (60 seconds)
**Why:** Shows the user-facing product and connects everything above.

Open the app (production URL). Show the Advisor tab.

**Actions:**
1. Click **Ask AI** — type: *"Should I hold or rebalance given current inflation?"*
2. Watch the thinking steps — "Querying World Bank...", "Fetching DeFiLlama yields..."
3. Response arrives — point out the **"Powered by Gemini"** badge under the message
4. Click ⚙️ settings icon — show the user API key modal
   > "Users can bring their own Gemini key for higher rate limits.
   > It's stored locally, never persisted on our servers."
5. If a rebalance recommendation appears — show the action card

**Say:**
> "The user sees a calm, simple interface. Behind it, the agent bought
> evidence from five data sources, Gemini synthesised the analysis,
> and the payments settled on Arc — all before this response appeared."

---

### 6 — Margin explanation: why this only works on Arc (30 seconds)
**Why:** Hard requirement in the submission rules.

Show the source pricing table from `/api/agent/x402-metrics`:

```
macro_analysis:         $0.004 per request
portfolio_optimization: $0.005 per request
risk_assessment:        $0.006 per request
world_bank_analytics:   $0.001 per request
coingecko_analytics:    $0.001 per request
```

**Say:**
> "At $0.004 per macro analysis, we can afford to run this research
> loop every few minutes. On Ethereum mainnet, a single ERC-20 transfer
> costs $2–5 in gas. That's 500–1,250x the value of the data itself.
> The economics are simply impossible.
>
> Arc's dollar-denominated, gas-free settlement is not a nice-to-have —
> it's what makes this business model exist at all."

---

## Key Numbers for Judges

| Metric | Value |
|--------|-------|
| Max per-action price | $0.01 USDC |
| Cheapest source | $0.001 USDC |
| On-chain settlements | 100+ |
| Agent wallet | `0x6D5967...2DaC8` on Arc testnet |
| Arc Explorer | `testnet.arcscan.app/address/0x6D5967...2DaC8` |
| Metrics endpoint | `/api/agent/x402-metrics` |
| Premium data source | Gemini Flash — live synthesis, not hardcoded |
| AI fallback chain | Gemini → Venice AI → Modal GLM |

---

## Judging Criteria — How We Score

| Criterion | Our answer |
|-----------|-----------|
| **Application of Technology** | Arc settlement in every paid request; Gemini synthesises all premium data; Circle x402 is the payment primitive; Circle API key for verification |
| **Business Value** | Savings protection for emerging market users who face >10% annual inflation — a real underserved market |
| **Originality** | AI agent that *purchases* intelligence before advising — not just chat, but an economically grounded decision loop |
| **Presentation** | Live on-chain proof visible before any UI demo; tx hashes in every API response |

---

## Tracks Entered

**Primary — 🤖 Agent-to-Agent Payment Loop**
The advisor agent autonomously pays the x402 gateway for evidence. No human approves each transaction. The agent decides what evidence it needs, pays for it, and uses it.

**Secondary — 🪙 Per-API Monetization Engine**
The x402 gateway is a production API that charges per request in USDC, with tiered free/premium pricing, rate limiting, nonce replay protection, and real Arc settlement.

---

## Circle Product Feedback (submission form — $500 USDC bonus)

> **Products used:** Arc (settlement), USDC (payment token), Circle Nanopayments / x402
> (payment standard), Circle Wallets API (payment verification), Circle API key (developer auth).
>
> **Why we chose them:** x402 maps perfectly to HTTP API design — the 402 status code was
> purpose-built for this. Arc's dollar-denominated fees gave us predictable unit economics.
> USDC as the gas token eliminated the "ETH price risk eats my margin" problem entirely.
>
> **What worked well:** Arc RPC was stable and fast throughout development. The x402
> challenge/response pattern required zero new infrastructure — it fits inside a standard
> Next.js API route. The Circle API key activation was instant.
>
> **What could be improved:** The entity secret setup for developer-controlled wallets has
> significant friction for hackathon pace (RSA key generation, recovery file management,
> one-time-use ciphertext rotation). A first-class EOA-based developer wallet path in the
> Circle Console — similar to how MetaMask works — would dramatically lower the barrier.
>
> **Recommendations:** (1) Provide a testnet "quick wallet" in the Circle Console that
> requires no entity secret — just an API key — for prototyping. (2) Add a webhook endpoint
> that fires when a payment is received, so agents can react to incoming payments without
> polling. (3) The Arc block explorer could show USDC token transfers more prominently —
> right now you need to dig into logs to see the amount.
