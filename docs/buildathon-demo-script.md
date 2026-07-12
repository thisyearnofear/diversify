# Arbitrum Open House London — Demo Script

*DiversiFi Guardian · July 2026 · ~5-minute walkthrough*

---

## Before the Demo: Prep Checklist

- [ ] Prod deployment is live (run `./scripts/deploy-to-hetzner.sh` if not done today)
- [ ] Verify healthz: `curl https://api.diversifi.famile.xyz/api/healthz` — should return `{"status":"ok",...}`
- [ ] GEMINI_API_KEY or VENICE_API_KEY is set server-side (otherwise chat shows "Advisor is currently unavailable")
- [ ] NEXT_PUBLIC_PRIVY_APP_ID is baked into the prod build (login/onboarding breaks without it)
- [ ] Clear browser cache + open incognito (demo the cold-start experience, not your dev state)
- [ ] Have a phone ready for the mobile demo (dvh units, touch-drag-to-dismiss)
- [ ] Avoid picking Confucian or Gotong Royong philosophy unless NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT is set (surfaces "APAC savings rail coming soon" banner on Shield tab)

---

## The Demo Arc (5 minutes)

**Theme:** "Nobody wakes up wanting premium macro research. They wake up wanting to know their savings won't evaporate."

**Narrative:** Walk through the experience of a first-time visitor from Kenya. Don't explain architecture. Don't explain chains. Show the pain, show the relief, show the proof.

---

## Minute 0–1: The Risk Moment

**Open the app in incognito (cold start).**

> "Let me show you what happens when someone from Nairobi opens DiversiFi for the first time."

The app auto-detects the visitor's country via IP geolocation. The WelcomeScreen shows:

- **The currency risk moment:** "Your 100,000 KES lost ~12% of its purchasing power against gold over the past year." (Not abstract. Not "inflation is bad." Their *own money*, in *their* currency.)
- **Three benchmarks:** vs USD, vs EUR, vs gold. The gold comparison is the "aha" moment — gold has outperformed every currency, including "stable" ones.

> "This is not a prescription. We're not saying 'move to USD.' We're showing you what's happening to your savings, in your own money, so you can decide what to do about it."

**Tap to advance to philosophy selection.**

> "Now we ask: what kind of saver are you? Not 'what's your risk tolerance' — that's a DeFi question. We ask: what values drive your financial decisions?"

Show the philosophy cards briefly:
- **Africapitalism** — build African wealth, community prosperity
- **Buen Vivir** — balance personal resilience with people and place
- **Islamic Finance** — Sharia-compliant, ethical, risk-sharing
- **Confucian** — patience, long-term stability
- **Global Diversification** — spread risk across regions
- **Custom** — build your own plan

> "You pick one. This shapes every recommendation the Guardian makes for you. It's not a one-time onboarding — it's the lens through which the AI sees your savings."

Pick **Africapitalism** for the demo (safe choice, no APAC rail banner).

---

## Minute 1–2: Shield — The Protection Layer

**Land on the Shield tab (reordered to be the primary tab).**

> "This is Shield. It's not a DeFi dashboard. It's a protection layer."

Show:
- **Protection Scorecard** — philosophy-aware summary. For Africapitalism: "Your protection plan prioritizes African stablecoins (cUSD, KESm), regional yield, and community-aligned RWA."
- **The plan preview** — allocation chips showing how the Guardian would protect 10,000 units of the visitor's currency.
- **"Enable Shield" button** — one tap to activate autonomous protection.

> "You don't need to understand DeFi. You don't need to pick tokens. You just enable Shield, set your permission bounds, and the Guardian works for you."

**Briefly show the other tabs exist** (Overview, Swap, Agent) but emphasize: "Shield is the front door. Everything else is secondary."

---

## Minute 2–3: The AI Advisor — Streaming, Real

**Tap the "Ask" FAB (visible in beginner mode now).**

The chat drawer opens (mobile sheet with dvh units, touch-drag-to-dismiss).

> "Let me ask the Advisor a question."

Type: **"What's happening to the Shilling right now?"**

The response streams in real-time (SSE, Gemini or Venice provider). No fake "Scanning market data..." messages. No rotating canned text. Real tokens, arriving as they're generated.

> "This is real streaming. No theater. The AI is actually thinking, actually pulling from real market data, actually giving you a personalized answer."

If the response includes a recommendation:

> "And here's the key: every recommendation the Guardian makes is recorded on the Arbitrum blockchain. You can verify it. You can audit it. It's not a black box."

---

## Minute 3–4: The Proof — On-Chain Verifiability

**Navigate to the Agent tab (or show the "recently verified on-chain" ticker if visible).**

> "Let me show you the proof."

Show:
- **RecommendationLedger records** — recent Guardian decisions, each with an Arbitrum tx hash and explorer link.
- **0G evidence anchors** — the AI reasoning behind each decision, immutably stored.

> "This is what 'verifiable AI' means. Not 'trust our algorithm.' Here's the Arbitrum transaction. Here's the 0G evidence. You can check it yourself."

**If the zero-g-ledger endpoint returns records:**

> "And this is live. These are real recommendations the Guardian made, recorded on Arbitrum mainnet, anchored to 0G Storage. The contract is at `0x3BCf…369C` — you can look it up on Arbiscan."

**If the ledger is empty (no records yet):**

> "The social-proof ticker disappears when empty, which is honest. We're seeding the first recommendations now."

---

## Minute 4–5: The Yield Engine + Multi-Chain Story

**Navigate to the Protection tab or BestYieldCard (if visible).**

> "The Guardian doesn't just give you advice. It executes. And it finds the best yield across the whole Arbitrum ecosystem."

Show (if visible):
- **BestYieldCard** — personalized/GMX/free picks with tier-unlock prompt.
- **GMX GM-pool deposits** — "We're depositing into GMX GM-pools. Blue-chip only — BTC and ETH, never memecoin pools. Real yield from protocol fees, not token inflation."

**Briefly mention the multi-chain story:**

> "DiversiFi is one agent, three chains. APAC savings decisions settle on HashKey Chain — a regulated market that APAC users trust. EM local stables (cUSD, KESm) settle on Celo — low-cost, community-aligned. Yield rotations execute on Arbitrum — deepest liquidity, best yield. And every AI reasoning step is anchored to 0G Storage."

> "We're not deploying everywhere for the sake of it. We're deploying where it matters, based on the user's philosophy and region."

---

## Closing: The Ask

> "So that's DiversiFi. Risk-aware, values-driven treasury management on Arbitrum. The Guardian protects your savings, aligned with your values, verified on-chain."

> "What we're asking for this weekend:"
> 1. **Mentorship on the wedge** — are we sharpening the right persona? Diaspora retail or importer SME?
> 2. **Intros to EM diaspora community leaders in London** — our first 10 users are in this room's network.
> 3. **Feedback on the philosophy system** — is it a retention mechanic or a gimmick?

> "The app is live. The code is open-source. The contracts are on Arbitrum mainnet. We're not demoing a concept — we're demoing a product."

> "Thank you."

---

## If You Have Extra Time: The Importer Story

> "Let me show you the north star. The long-term market is the SME importer."

If the FX drag report tool is ready (`npx tsx scripts/fx-drag-report.ts`):

> "This is a concierge tool we built for a Ghanaian importer. It quantifies their FX drag — the timing loss, the spread, the fees — vs converting on arrival. Real historical rates."

> "The retail savings app is top-of-funnel. The importer/exporter business tier is the long-term market. The FX risk intelligence + autonomous protection layer on top of the crowded EM stablecoin rails — that's the unserved gap."

---

## Demo Pitfalls to Avoid

| Don't | Do Instead |
|---|---|
| Explain architecture first | Show the risk moment first. Architecture comes after the "aha." |
| Say "DeFi" or "stablecoin" unprompted | Say "protection" and "savings." DeFi is the how, not the what. |
| Demo the paid research bundle (x402) | Stick to free-tier probes. Paid path requires MONGODB_URI + settlement USDC config — don't demo what you can't verify end-to-end. |
| Pick Confucian / Gotong Royong philosophy | Unless NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT is set, it surfaces "APAC rail coming soon" on Shield. Pick Africapitalism, Buen Vivir, or Islamic Finance. |
| Demo voice if ELEVENLABS_API_KEY isn't set | The mic renders greyed out, which is fine. Don't demo a feature that's gated off. |
| Explain the tech stack unless asked | Judges care about the user problem, not your Next.js version. |
| Say "we're composable" without a native reason | GMX integration is a real yield path. Say "we route to GMX for real yield," not "we're composable." |

---

## Quick Reference: Live Endpoints

| Endpoint | URL |
|---|---|
| Health | https://api.diversifi.famile.xyz/api/healthz |
| Agent status | https://api.diversifi.famile.xyz/api/agent/status |
| x402 metrics | https://api.diversifi.famile.xyz/api/agent/x402-metrics |
| Zero-G ledger | https://api.diversifi.famile.xyz/api/agent/zero-g-ledger |
| Arbitrum contract | `0x3BCf…369C` (RecommendationLedger) |
| Celo contract | `0x3BCf…369C` (RecommendationLedger) |
| 0G contract | `0x3BCf…369C` (RecommendationLedger) |
| Self Protocol | Agent `0xE8cDb7CA…f170` (Celo mainnet) |

---

## Troubleshooting During the Demo

| Issue | Quick Fix |
|---|---|
| Chat shows "Advisor is currently unavailable" | GEMINI_API_KEY or VENICE_API_KEY not set server-side. Switch to a provider that's configured, or demo the risk moment + Shield without the AI chat. |
| Zero-G ledger returns empty | No recommendations seeded yet. Say "We're seeding the first recommendations now" and move on. |
| Voice mic is greyed out | ELEVENLABS_API_KEY not set. Don't demo voice. |
| "APAC savings rail coming soon" banner appears | You picked Confucian or Gotong Royong. Switch to Africapitalism or Buen Vivir. |
| Mobile layout looks wrong | Make sure you're using the prod URL, not localhost. The dvh units and touch-drag-to-dismiss only work on the deployed build. |
| Guardian loop not executing | Check PM2 status: `ssh snel-bot 'pm2 status diversifi-api'`. The Guardian cron runs every 5 min — if the user just enabled Shield, wait a bit or demo the manual "Ask" flow instead. |
