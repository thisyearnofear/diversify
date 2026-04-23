# Arc Nano Payments Hackathon Demo Script
## DiversiFi - AI-Powered Wealth Protection with Paid Research

**Track:** Agentic Economy / Consumer AI Payments / B2B FinOps
**Duration:** 3-4 minutes
**Tagline:** "Spend fractions of a cent on better evidence before moving money."

---

## Demo Narrative

### Opening Hook (15 seconds)
> "Your savings do not fail because the market is invisible. They fail because the decision is stale. What if an AI could buy fresh evidence before it moved your money?"

**[Screen: Landing page with inflation, FX, commodity, and stablecoin risk panels]**

### Problem Statement (30 seconds)
> "Meet Sarah. She keeps $1,000 in stablecoins. The hard part is not sending money, it is knowing when to hold, rebalance, or hedge. If the agent relies on one source, or one stale signal, it can make the wrong call."

**[Screen: Portfolio overview with source freshness and confidence indicators]**

> "DiversiFi solves this by paying for multiple live sources on Arc, comparing them, and only then recommending an action."

### Solution Demo (2 minutes)

#### Part 1: Ask the Advisor
> "Sarah asks the advisor whether her portfolio should hold, rebalance, or hedge."

**[Screen: Advisor tab with Ask AI open]**

**Actions:**
1. Click `Ask AI` on the Protection Plan card
2. Ask: "Should I hold, rebalance, or hedge?"
3. Show the advisor requesting a research bundle
4. Show the gateway confirming the request is paid

**Narration:**
> "The advisor does not guess. It buys evidence first."

#### Part 2: Paid Evidence Loop
> "The system now fetches inflation, FX, commodity, and stablecoin data from multiple sources."

**[Screen: Evidence panel with source names, timestamps, and micro-payments]**

**Actions:**
1. Show 3+ source fetches settling through the Arc x402 gateway
2. Display source reputation, freshness, and cost
3. Show the evidence bundle being aggregated
4. Show the agent collecting 50+ tiny payment or research events in the demo path

**Narration:**
> "Each request is tiny, but the loop matters. This is only economical because settlement is cheap enough to support high-frequency research."

#### Part 3: Confidence-Scored Recommendation
> "Once the evidence is in, the advisor explains the recommendation."

**[Screen: Recommendation card with HOLD / REBALANCE / HEDGE state]**

**Actions:**
1. Show the source agreement score
2. Show the freshness score
3. Show the final recommendation and rationale
4. Show the margin explanation: why repeated research would not work with normal gas costs

**Narration:**
> "The payment is not the product. Better decisions are the product."

#### Part 4: Optional Action
> "If the evidence is strong enough, the advisor can trigger the existing action card."

**[Screen: Existing action card / rebalance flow]**

**Actions:**
1. Show HOLD if the portfolio is stable
2. Or show a small REBALANCE action if signals drift
3. Keep the existing UX surfaces; do not introduce a new dashboard

**Narration:**
> "DiversiFi stays calm and simple. The system only acts when the evidence justifies it."

---

## Key Features Highlight (30 seconds)

**[Screen: Split screen with the advisor, evidence panel, and action card]**

> "What makes this different is the decision loop:"

**Features:**
1. **Contextual AI Buttons** - `Ask AI` on every card
2. **Paid Research Loop** - micro-payments unlock live evidence
3. **Source Confidence** - freshness, reputation, and agreement scores
4. **Action Cards** - HOLD / REBALANCE / HEDGE instead of generic chat
5. **Arc Settlement** - repeated research is economically viable
6. **Real-Time Risk Data** - inflation, stablecoin, FX, and commodity signals

---

## Technical Deep Dive (30 seconds)

**[Screen: Architecture diagram or code snippet]**

> "Under the hood, the flow stays small and composable:"

```text
User Action -> Advisor -> x402 Gateway -> Evidence Bundle
                                  -> Shared Source Registry
                                  -> Confidence and Margin Scoring
                                  -> Action Card
```

**Narration:**
> "The advisor asks for a bundle, the gateway settles payment, the source registry resolves where to pull from, and the advisor decides whether the portfolio should move."

**Example:**
```typescript
const bundle = await fetch('/api/agent/x402-gateway?source=macro-regime');
const evidence = await bundle.json();

const recommendation = scoreEvidence({
  inflation: evidence.inflation,
  stablecoinRisk: evidence.stablecoinRisk,
  commoditySignals: evidence.commodities,
  confidenceThreshold: 0.8
});
```

---

## Impact & Results (20 seconds)

**[Screen: Dashboard showing recommendation history]**

> "Sarah's results after one week:"

**Metrics:**
- Evidence spend: less than $1 total
- Research checks performed: 50+
- Recommendation confidence: 0.87
- Bad move avoided: 1
- Protection outcome: multiple sources confirmed the decision

**Narration:**
> "The app is not selling certainty. It is selling better evidence at a cost small enough to make frequent research practical."

---

## Closing (15 seconds)

> "DiversiFi combines AI guidance with Arc micropayments to make evidence-backed financial decisions practical at scale. No stale data, no guesswork, just better protection."

**[Screen: Call to action]**

**Text on screen:**
- Try it: diversifi.app
- GitHub: github.com/thisyearnofear/diversify
- Built with: Arc, USDC, Circle Nanopayments, x402
- Track: Agentic Economy

**Narration:**
> "Built in one week for the Arc Nano Payments hackathon."

---

## Submission Checklist

- Show at least 50 onchain or settled microtransactions in the demo path
- Show per-action pricing at or below $0.01
- Show source freshness and agreement in the UI
- Include a clear margin explanation for why gas-heavy research would fail
- Keep the demo focused on the existing Advisor and action-card surfaces

