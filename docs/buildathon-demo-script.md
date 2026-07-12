# Arbitrum Open House London — Demo Script

*DiversiFi Guardian · July 2026 · ~5-minute walkthrough*

> **Status note (2026-07-12):** This script demos the **live retail product** (risk moment, philosophy onboarding, Shield, AI chat, on-chain proof, yield engine). The **SME importer story** is the north star and should only be shown if you have the concierge FX drag report output ready (`scripts/fx-drag-report.ts`). The self-serve purchase-cycle UI is not yet in the consumer app. See `docs/sme-fx-implementation-plan.md` for the build plan.

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

**Theme:** "Currency risk is invisible. We make it quantifiable, autonomous, and verifiable."

**Narrative:** Walk through the live retail experience as top-of-funnel. Frame the business intelligence path as the north star, not as a live consumer feature. Don't explain architecture. Don't explain chains. Show the pain, show the intelligence, show the philosophy, show the proof.

**Key differentiators to emphasize:**
1. FX-risk intelligence layer (the real product)
2. Philosophy/values system (the retention moat)
3. Autonomous execution with on-chain verifiability

---

## Minute 0–1: The Risk Moment + Philosophy System

**Open the app in incognito (cold start).**

> "Let me show you the top-of-funnel experience — the retail savings app that builds trust and funnels users into the business intelligence layer."

The app auto-detects the visitor's country via IP geolocation. The WelcomeScreen shows:

- **The currency risk moment:** "Your 100,000 KES lost ~12% of its purchasing power against gold over the past year." (Not abstract. Not "inflation is bad." Their *own money*, in *their* currency.)
- **Three benchmarks:** vs USD, vs EUR, vs gold. The gold comparison is the "aha" moment — gold has outperformed every currency, including "stable" ones.

> "This is not a prescription. We're not saying 'move to USD.' We're showing you what's happening to your savings, in your own money."

**Tap to advance to philosophy selection.**

> "Now here's the key differentiator: we ask what values drive your financial decisions. Not 'what's your risk tolerance' — that's a DeFi question. We ask: what's your cultural identity?"

Show the philosophy cards briefly:
- **Africapitalism** — build African wealth, community prosperity
- **Buen Vivir** — balance personal resilience with people and place
- **Islamic Finance** — Sharia-compliant, ethical, risk-sharing
- **Confucian** — patience, long-term stability
- **Global Diversification** — spread risk across regions
- **Custom** — build your own plan

> "You pick one. This shapes every recommendation the Guardian makes for you. It's not a risk tolerance slider — it's a values declaration. 'I'm Africapitalism' is a community marker, not a feature. No other product has this."

Pick **Africapitalism** for the demo (safe choice, no APAC rail banner).

---

## Minute 1–2: Shield + Graduation CTA

**Land on the Shield tab (reordered to be the primary tab).**

> "This is Shield. It's the protection layer for individuals."

Show:
- **Protection Scorecard** — philosophy-aware summary. For Africapitalism: "Your protection plan prioritizes African stablecoins (cUSD, KESm), regional yield, and community-aligned RWA."
- **The plan preview** — allocation chips showing how the Guardian would protect 10,000 units of the visitor's currency.
- **"Enable Shield" button** — one tap to activate autonomous protection.

> "You don't need to understand DeFi. You don't need to pick tokens. You just enable Shield, set your permission bounds, and the Guardian works for you."

**Show the graduation CTA:**

> "And here's the funnel: the retail app shows you what holding cedis cost you personally. The business version shows what it cost *per purchase cycle*. The CTA is: 'This is what it cost you personally. Run it on your business.'"

> "For an SME importer, that's the real product. Let me show you."

---

## Minute 2–3: The Business Intelligence Layer (The Real Product)

> "Now let me show you the real product. The SME importer."

**If the FX drag report tool is ready (`npx tsx scripts/fx-drag-report.ts`):**

> "A Ghanaian plastics manufacturer imports $50K of resin quarterly from China. They accumulate cedis over 6 weeks, then convert to USD. If the cedi slips 5% between sale and payment, they eat an unplanned $2,500 loss. These losses rarely show up as line items — they're invisible."

Show the concierge tool output (or walk through the business flow):

> "We define the purchase cycle: 'I need $50K USD in 6 weeks.' The Guardian monitors local-currency depreciation + inflation signals in real-time. As the payment date approaches, it autonomously rebalances accumulating proceeds toward USD-pegged stables."

> "Then we deliver the per-cycle FX drag report: 'This cycle, protection preserved ₵X vs holding cedis.' Quantified, exportable, ledger-backed. An audit trail for the business's books."

> "This is the intelligence layer that sits on top of the payment rails. Waza, Juicyway, Cedar — they handle the movement of money. DiversiFi handles the risk in the window between local sales and next supplier payment."

**If the tool isn't ready, describe it:**

> "The per-cycle drag report is the signature surface. The importer defines their purchase cycle, the Guardian monitors and rebalances autonomously, and delivers a quantified report: 'This cycle, protection preserved ₵X.' The accountant can verify every tx on the Arbitrum ledger."

---

## Minute 3–4: The Proof — On-Chain Verifiability + Philosophy Alignment

**Navigate to the Agent tab (or show the "recently verified on-chain" ticker if visible).**

> "Let me show you the proof."

Show:
- **RecommendationLedger records** — recent Guardian decisions, each with an Arbitrum tx hash and explorer link.
- **0G evidence anchors** — the AI reasoning behind each decision, immutably stored.

> "This is what 'verifiable AI' means. Not 'trust our algorithm.' Here's the Arbitrum transaction. Here's the 0G evidence. You can check it yourself."

> "And here's the philosophy layer: the Guardian's decisions are aligned with the user's values. A user who chose 'Islamic Finance' will never be recommended interest-based yield. A user who chose 'Africapitalism' will see African stablecoins prioritized. The philosophy is the lens, not a one-time checkbox."

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

> "So that's DiversiFi. FX-risk intelligence and autonomous protection for businesses that earn in one currency and must purchase in another. The retail savings app is top-of-funnel. The business intelligence layer is the real product. The philosophy system is the retention moat."

> "Three key differentiators:"
> 1. **FX-risk intelligence layer** — per-cycle drag quantification, autonomous protection, audit trail. No player offers this. Not in Africa. Not in America. Not anywhere. *(Self-serve purchase-cycle UI is the north star; the concierge FX drag report is already validating the math with real traders.)*
> 2. **Philosophy/values system** — identity-based retention, cultural resonance, structural moat. No other product has this. *(Live today.)*
> 3. **Verifiable on-chain execution** — every recommendation on Arbitrum ledger, anchored on 0G. Not "trust our AI" — you can check. *(Live today.)*

> "What we're asking for this weekend:"
> 1. **Mentorship on the wedge** — should we go deeper on diaspora retail first, or push directly to SME importers?
> 2. **Intros to SME importers in London** — our target validation cohort for the concierge FX drag report.
> 3. **Feedback on the philosophy system** — is it a retention mechanic or a gimmick?

> "The app is live. The code is open-source. The contracts are on Arbitrum mainnet. We're not demoing a concept — we're demoing a product."

> "Thank you."

---

## If You Have Extra Time: The Intelligence Layer (The Real Product)

> "Let me show you what makes this more than just another savings app."

If the FX drag report tool is ready (`npx tsx scripts/fx-drag-report.ts`):

> "This is the intelligence layer. We don't just move money — we quantify the FX drag: timing loss, spread, fees — vs converting on arrival. Real historical rates. And then we autonomously flatten that risk."

> "This isn't limited to emerging markets. A US importer buying from China faces the same problem. A UK business importing from the Eurozone faces the same problem. The currencies change, but the intelligence layer works everywhere."

> "The retail savings app is top-of-funnel. The business intelligence layer is the real product. It's the ability to help businesses flatten currency risk and volatility from exogenous shocks."

Then pivot to the philosophy system:

> "And here's the other differentiator: the philosophy system. When a user chooses 'Africapitalism' or 'Buen Vivir' or 'Islamic Finance,' they're not picking a risk tolerance — they're declaring a cultural identity. This is identity-based retention. No other product has this."

> "The philosophy shapes every recommendation. It's not a checkbox. It's the lens through which the AI sees your savings. This is the retention moat."

---

## Demo Pitfalls to Avoid

| Don't | Do Instead |
|---|---|
| Lead with "savings app" or "DeFi" | Lead with the live risk moment and the philosophy system. The business intelligence story is the north star; the retail app is the proof surface today. |
| Say "DeFi" or "stablecoin" unprompted | Say "intelligence layer" and "autonomous protection." DeFi is the how, not the what. |
| Treat the philosophy system as a feature | Treat it as a key differentiator. It's the retention moat, not a checkbox. |
| Explain architecture first | Show the live risk moment first. Architecture comes after the "aha." The per-cycle drag report is the north-star extra, not the default demo. |
| Demo the paid research bundle (x402) | Stick to free-tier probes. Paid path requires MONGODB_URI + settlement USDC config — don't demo what you can't verify end-to-end. |
| Pick Confucian / Gotong Royong philosophy | Unless NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT is set, it surfaces "APAC rail coming soon" on Shield. Pick Africapitalism, Buen Vivir, or Islamic Finance. |
| Demo voice if ELEVENLABS_API_KEY isn't set | The mic renders greyed out, which is fine. Don't demo a feature that's gated off. |
| Explain the tech stack unless asked | Judges care about the business problem, not your Next.js version. |
| Say "we're composable" without a native reason | GMX integration is a real yield path. Say "we route to GMX for real yield," not "we're composable." |
| Say "we need users" | Say "we need 5 SME importers in London who feel the FX drag pain." Specific ICP, not broad. |

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
