# SME FX Strategy — Importer/Exporter Working Capital & the Retail→Business Funnel

## SME FX Strategy — Importer/Exporter Working Capital & the Retail→Business Funnel

**Status:** Drafted 2026-07-11 (north-star direction). Updated 2026-07-13 with shipped payment-cycle slice + trust pass. Reframed 2026-07-19 to reflect the universal nature of the problem. Updated 2026-08-24 with adaptive experience architecture — Phase 0 (landing page calculator) and Phase 1 (signal detection + adaptive routing) are shipped.
**Purpose:** Capture the strategic direction that emerged from a real user
conversation — a Ghanaian importer who buys in USD abroad (China, US, UK)
and sells locally in cedis — plus the market research, competitive gap,
and funnel model that make this the long-term market opportunity. The
Ghanaian importer is the wedge — the most extreme, clearest case — but
the problem is universal: any business with a currency mismatch between
revenue and costs faces the same working-capital risk.

**Implementation plan:** `docs/strategy.md` — the phased build plan that turns this strategy into code, aligned with the Core Principles.

**Current-state honesty:** The free payment-cycle report, wallet-authenticated cycle CRUD, monitoring proposals, and recommendation queue **are live** (2026-07-13). Phase 0 (FX drag calculator landing page) and Phase 1 (signal detection + adaptive tab labels) **are shipped** (2026-08-24). The Importer `FinancialStrategy` + graduation funnel are still planned. Concierge tooling (`scripts/fx-drag-report.ts`) remains useful for offline trader validation.

> **Adaptive experience (2026-08-24):** The SME FX layer is delivered through an adaptive experience architecture — the same backend serves all personas; the frontend is a configuration that changes based on signals (geo, wallet, behavior). The landing page calculator (§4.2 below) is Phase 0 of this architecture. Signal detection + adaptive tab labels (Phase 1) are wired into the app shell. See [`docs/product.md`](./product.md) for the full signal architecture, routing schema, and implementation phases.

---

## 1. The persona and the pain (universal problem, Ghanaian wedge)

The problem is not African. It is universal. **Any business that earns in
one currency and must purchase in another faces FX risk on its working
capital during the window between sale and supplier payment.** The
currencies change; the mechanics are identical:

| Business | Earns in | Pays suppliers in | Exposed window |
|---|---|---|---|
| Ghanaian importer (Accra) | GHS | USD (China, US, UK) | 2–8 weeks |
| US retailer sourcing from Eurozone | USD | EUR | 2–6 weeks |
| UK exporter selling to EU | GBP | EUR (or USD for raw materials) | 3–8 weeks |
| Brazilian exporter | BRL | USD (imports) / receives USD (exports) | 2–12 weeks |
| Philippine BPO (already proven on HashKey) | PHP | USD (software, infrastructure) | monthly cycle |
| South African manufacturer | ZAR | USD/EUR (machinery, chemicals) | 4–12 weeks |

The Ghanaian importer is the **wedge** — the most extreme, clearest case
because the cedi's volatility makes the bleed undeniable. But a UK
exporter who quoted in EUR and sees GBP rally 5% before settlement loses
the same margin, just less visibly. The pain scales with currency
volatility, not with geography.

An importer in Accra buys inventory in USD from suppliers in China, the
US, and the UK, and sells locally in cedis. Their money is not idle
savings — it is **cyclical working capital**: cedis accumulate from local
sales, sit exposed for 2–8 weeks, then convert to USD for the next
supplier payment. Three pains, in their own words:

1. **Volatility / currency risk** — the cedi can slip between sale and
   supplier payment, silently eating margin.
2. **Cognitive burden** — they begrudge even having to think about FX.
3. **Quantification** — the losses are real but invisible; they never
   show up as a line item.

These three pains are identical for a US retailer watching EUR/USD, a UK
exporter watching GBP/EUR, or a Brazilian manufacturer watching BRL/USD.
The cognitive burden may even be *higher* in "stable" currency economies
because the risk is less salient — a 3% GBP move over 6 weeks is real
margin loss, but no UK business owner is losing sleep over it the way a
Ghanaian importer would over a 15% cedi move. **The invisibility is the
product opportunity, not the volatility level.**

This is the same persona as the Kenyan business example that crystallized
the Track 3 reframe (a business that would have preserved purchasing power
saving in USD around an election, but "the headaches meant they just kept
everything in KES") — one border over, at transaction volume instead of
savings scale.

The pain is quantifiable: [a mid-sized Ghanaian plastics manufacturer
importing $50,000 of resin quarterly eats an unplanned $2,500 loss if the
cedi slips just 5% between quotation and settlement — and these losses
"rarely show up as clear line items"](https://yellowcard.io/blog/currency-volatility-is-killing-manufacturing-margins/).
The same math applies to a UK exporter losing £15,000 on a £300,000 EU
contract from a 5% GBP/EUR move — it just doesn't make the trade press.

---

## 2. Market evidence (researched 2026-07-11, global context added 2026-07-19)

### The universal market

| Signal | Number | Source |
|---|---|---|
| Global cross-border B2B payments | **~$150T/year**, growing 5-7% annually | BIS / McKinsey |
| Global stablecoin B2B payments | **~$226B in 2025, +733% YoY** (McKinsey/Artemis) | [Tazapay](https://tazapay.com/guides/stablecoin-payments-guide-global-businesses) |
| SME FX losses (global, est.) | **$50-100B/year** — mid-market SMEs lack hedging tools that large corps have | IMF working paper est. |
| GBP/EUR volatility (post-Brexit) | 8-15% annualized swings — a UK exporter can lose 3-5% margin per cycle | ECB statistical reports |
| BRL/USD volatility | 15-25% annualized — Brazilian importers/exporters face severe cycle risk | BCB historical data |
| Traditional cross-border rails cost | 4–10 business days, 3–10% fees vs 0.5–2.5% all-in stablecoin | [Tazapay](https://tazapay.com/guides/stablecoin-payments-guide-global-businesses) |
| SME hedging access gap | <15% of SMEs in developed markets use any FX hedging; near 0% in emerging markets | BIS quarterly review |

The structural gap: large corporations have treasury teams and forward
contracts. SMEs have neither — they absorb FX risk silently, line item
by invisible line item. **This is true in Birmingham as much as in Accra.**

### The African wedge (highest pain, clearest entry)

| Signal | Number | Source |
|---|---|---|
| China–Africa trade (2025) | **$348B**, +20% YoY, still routed via correspondent banks | [Afridigest](https://afridigest.substack.com/p/afridigest-signal-nigerias-daya-raises) |
| SSA stablecoin volume (Q1 2026) | **$50B**, +340% YoY, large B2B share | [Transak / Chainalysis](https://transak.com/blog/africa-fintech-stablecoin-report-2026) |
| Africa cross-border payments | **$329B (2025) → $1T by 2035** (Oui Capital) | [WeeTracker](https://weetracker.com/2026/06/01/africa-cross-border-payments-boom/) |
| Africa currency-conversion losses | **~$5B/year** (AfCFTA / Afreximbank) | [Tribune](https://tribuneonlineng.com/africa-loses-5bn-annually-to-currency-conversion-afcfta-secretariat/) |
| Cedi track record | −50% vs USD in 2022 (54% inflation); −23% in 2023 | `constants/currency-risk.ts`, [Yogupay](https://yogupay.com/stablecoins-vs-banks-for-african-importers/) |
| Ghana crypto volume | **$10B+ by Nov 2025** (up from ~$6B) | [MyJoyOnline](https://www.myjoyonline.com/new-regulatory-framework-brings-stability-to-ghanas-10-billion-dollar-crypto-market/) |

Africa is the entry point because the pain is most acute and the
stablecoin behavior shift has already happened — importers in Lagos,
Accra, and Nairobi are already settling Chinese supplier invoices in
USDT/USDC. But the same behavior shift is underway globally: UK
exporters using USDC for EU settlement, Philippine BPOs paying USD
invoices in stablecoins, Brazilian traders holding USDC between cycles.

What has not shipped anywhere — in Africa, Europe, Asia, or the Americas
— is the **risk layer** on top of the rails.

---

## 3. Competitive landscape — everyone builds roads, nobody builds the driver

The movement-of-money problem is crowded and well-capitalized globally:

| Player | Region | What they do | What they don't do |
|---|---|---|---|
| [Waza](https://techcrunch.com/2024/08/19/waza-comes-out-of-stealth-with-8m-to-power-global-trade-for-african-businesses/) (YC W23) | Africa | ~$700M annualized B2B volume, trade finance, Lync multicurrency accounts | No risk quantification or automated protection |
| [Juicyway](https://disruptafrica.com/2025/11/11/how-nigerias-juicyway-is-helping-african-businesses-send-receive-and-hold-foreign-currency/) | Africa | Profitable, 12k+ business customers, $300M+/mo, stablecoin orchestration | Same |
| [Cedar Money](https://techcrunch.com/2025/01/30/qed-seeds-9-9m-in-cedar-money-a-stablecoin-payment-platform/) | Africa | QED-backed, fiat UX over stablecoin rails, T+1 | Same |
| [Verto](https://verto.co/), Conduit, AZA | Africa | Multi-currency accounts, FX liquidity, treasury ops | Same |
| Yellow Card, [Accrue Business](https://techcabal.com/2026/07/10/accrue-launches-accrue-business/) | Africa | Ramps + business stablecoin banking | Same |
| Flutterwave, Paystack, [Visa pilot](https://techtrendske.co.ke/2026/07/06/visa-stablecoin-pilot-africa/) | Africa | Incumbents adding stablecoin settlement | Same |
| [Wise Business](https://wise.com/business) | Global | Multi-currency accounts, mid-market FX, debit cards | No risk quantification, no autonomous protection, no on-chain evidence |
| [Revolut Business](https://www.revolut.com/business) | Global/UK/EU | Multi-currency accounts, FX conversion, spending | Same — treasury tools for humans, not autonomous agents |
| [Brex](https://www.brex.com/), [Ramp](https://ramp.com/) | US | Corporate cards, spend management, treasury | No FX risk layer — US-centric, no multi-currency working capital |
| [Conduit](https://conduit.com/), [Brbridge](https://brbridge.io/) | LatAm/Global | Cross-border stablecoin payments for businesses | Same — rails, not risk intelligence |
| Traditional banks (Barclays, HSBC, Standard Chartered) | Global | Forward contracts, FX options — for large corps | SME access gatekept by minimums ($100K+), credit checks, relationship managers |

The battleground is orchestration, liquidity, virtual accounts, and
ramps — globally. **No player surfaced in the research offers FX risk
quantification, hedging, or automated protection for SMEs.** Large-corp
treasury tools (forwards, options) exist but are inaccessible to SMEs due
to minimum sizes, credit requirements, and relationship-manager gating.
The exposed window — local currency accumulating between purchase cycles
— is unserved worldwide.

That gap maps one-to-one onto what DiversiFi has already built:

| Importer pain | DiversiFi surface (shipped) |
|---|---|
| "Hard to quantify" | `constants/currency-risk.ts` dataset + counterfactual calculator + protection scorecard |
| "Don't want to think about it" | Guardian autonomous loop within signed permission bounds |
| "Can I trust it / prove it" | Chain-aware `RecommendationLedger` + 0G evidence — an audit trail an accountant can use |
| Distribution to businesses | Track 1d enterprise gateway (API-key auth, audit export) — licensable to the rails players themselves |

**Positioning: DiversiFi is not another rail. It is the FX risk
intelligence and autonomous protection layer that sits on top of the
rails — for any SME with a currency mismatch, anywhere.**

---

## 4. The funnel thesis — retail and enterprise serve one vision

The retail savings app and the business opportunity are not competing
priorities; they are stages of one funnel:

```
Retail (trust)            Business (revenue)            Protocol (scale)
──────────────            ──────────────────            ────────────────
Individual entrepreneur   Same person graduates          Rails players license
tries the Guardian with   their working capital:         the intelligence +
personal savings. Sees    Importer archetype,            Guardian-as-a-service
their currency risk       cycle-aware protection,        via the Track 1d
quantified. Builds        per-cycle FX drag report,      enterprise gateway —
trust in autonomy +       priced against quantified      embedded "treasury
on-chain proof.           margin recovered.              autopilot."
```

Why the funnel is unusually short here: **for a Ghanaian or Nigerian
trader, the personal/business boundary is thin — personal savings IS
working capital.** This is not two personas connected by marketing; it is
one person and one pool of money at two levels of trust. The same is true
for a UK freelancer exporting to the EU, a Philippine BPO owner paying USD
infrastructure, or a Brazilian trader — the personal/business boundary is
thin everywhere for SMEs. Precedents for the consumer→business
graduation: Wise, Revolut, PayPal, M-Pesa — all rode individual trust
into business accounts, and none were Africa-specific.

**The graduation moment must be designed, not hoped for.** The bridge is
the FX drag report: the retail scorecard already shows a user what
holding their local currency cost them; the business version shows what
it cost *per purchase cycle* — and the CTA is "run this on your business."

**Instrument the funnel.** Retail users who are actually traders are
detectable: cyclical deposit/withdraw patterns, larger amounts,
corridor-shaped swaps (local currency ↔ supplier currency stable). Track
these as graduation-candidate signals before building any business tier.

**Current-state honesty:** The graduation signal detection and CTA are not yet implemented in the consumer app. A small business-context hint is live in onboarding; the full graduation funnel is planned in `docs/strategy.md` Phase 4.

---

## 5. The Importer/Exporter archetype (design — FinancialStrategy still planned)

Unlike the eight philosophy archetypes (allocation-target-based), the
Importer/Exporter archetype is **cycle-aware** — and currency-agnostic:

| Field | Value |
|---|---|
| **Philosophy** | Protect trade margin, not idle savings. Park sales proceeds in a stable value between purchase cycles; be liquid on payment day. |
| **Core model** | A **purchase cycle**: expected obligation in the supplier's currency (amount + approximate date) → protect accumulating local-currency proceeds against slippage until conversion. This obligation/cycle model is the one genuinely new concept — everything else reuses the existing pattern. Works for GHS→USD, GBP→EUR, BRL→USD, PHP→USD, or any currency pair. |
| **Default allocation** | USD-pegged stables (cUSD/USDC on Celo, or region-canonical stable) between cycles; local-currency leg only as ramp liquidity allows |
| **Guardian behavior** | Monitor local currency depreciation + macro signals (central bank decisions, inflation prints via FRED + World Bank + Firecrawl monitors); rebalance proceeds toward the supplier-currency stable as the payment date approaches; never prescriptive — the user picks the protection level |
| **Signature surface** | **Per-cycle FX drag report** — "this cycle, protection preserved X vs holding local currency" — quantified, exportable, ledger-backed |
| **Proof** | Every cycle decision on the chain-aware ledger + 0G evidence = an audit trail for the business's books |

Reuses wholesale: Guardian loop, ERC-7715 permissions, swap orchestrator,
`RecommendationLedger`, currency-risk dataset, archetype card system.
Follows the ENHANCEMENT FIRST pattern (~same footprint as the
Pan-Caribbean plan in `caribbean-strategy.md` §6, plus the cycle model).

**Status:** Design only. The implementation plan is in `docs/strategy.md` Phase 1–2.

---

## 6. Ramps and supplier payout — partner, don't build (universal)

The off-ramp conversion is [the largest single cost component in
cross-border trade](https://tazapay.com/guides/stablecoins-cross-border-payments-emerging-markets).
Owning ramps is a different, capital-intensive, licensed business — in
every jurisdiction.

- **GHS on/off-ramp:** partner (Yellow Card, Accrue, Kotani Pay, Fonbnk,
  MiniPay/Noah — already mapped in `roadmap.md` Post-9/10 table).
- **GBP/EUR on/off-ramp:** partner (Wise Business, Revolut Business, or
  FCA-licensed EMI partners).
- **PHP/ASEAN on/off-ramp:** partner (coins.ph, Maya Business, or
  BSP-licensed VASPs).
- **BRL on/off-ramp:** partner (Conduit, Brbridge, or BCB-licensed
  exchanges).
- **Supplier payout (all legs):** out of scope. The rails players own it
  — which is exactly why they are licensing targets, not competitors (§4,
  protocol stage).
- **Local-currency stablecoin liquidity (Mento, etc.) may be thin** for
  some pairs — early cycles run USD-pegged stables with fiat legs at the
  partner.

---

## 7. Regulation — Ghana as the test market, global expansion by jurisdiction

Ghana is the test market because the pain is most acute and the
regulatory clarity is good. But the regulatory landscape varies by
jurisdiction — the positioning must adapt.

### Ghana (test market)

- The [**VASP Act, 2025 (Act 1154)**](https://thebftonline.com/2026/02/16/new-rules-of-the-game-breaking-down-the-virtual-assets-service-providers-act/)
  was signed 2025-12-29; Bank of Ghana is primary licensing authority,
  phased licensing from Q1 2026, sandbox running. Legal clarity is good
  news.
- The BoG is [openly concerned that dollar stablecoins are hollowing out
  the cedi](https://www.ecofinagency.com/news/1905-55715-ghanas-silent-currency-war-dollar-stablecoins-are-hollowing-out-the-cedi-while-the-state-bets-on-gold)
  and is exploring gold-backed alternatives.

### Other jurisdictions (expansion markets)

- **UK/EU:** FCA's crypto regime (2025) and MiCA provide regulated
  stablecoin rails. The non-prescriptive framing matters less here (no
  anti-dollarization posture) but the intelligence/software positioning
  still avoids custody licensing.
- **Philippines/ASEAN:** BSP has a regulated VASP framework; the HashKey
  Chain APAC rail already serves this corridor. A PHP importer's FX drag
  report is [already proven on HashKey mainnet](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b).
- **Brazil/LatAm:** BCB's crypto framework (2024) is operational;
  stablecoin adoption for B2B is high. Conduit and Brbridge are the rail
  partners here, not Waza/Juicyway.

Two implications (universal):

1. **The non-prescriptive philosophy framing is regulatory protection,
   not just brand ethos.** DiversiFi never prescribes "move to USD" — it
   quantifies risk and lets the user choose. In an anti-dollarization
   regulatory climate (Ghana, Nigeria), that framing matters. In
   pro-stablecoin jurisdictions (UK, EU, Philippines), it's still good
   practice — it keeps the product neutral and adaptable.
2. **Position as intelligence/software; a licensed partner holds custody
   and conversion.** This keeps DiversiFi outside the licensing perimeter
   in every jurisdiction — the ramp partner (already licensed or
   licensing under the local framework) owns the regulated activity.

---

## 8. Sequencing

| Step | Status | What | Gate to next step |
|---|---|---|---|
| 1. **Concierge validation** | **Tooling shipped.** | Produce the Ghana user's personal FX drag report manually from their real cycle numbers (`currency-risk.ts` has the GHS data). Repeat with 10–20 traders (Accra, Lagos, Nairobi). `npx tsx scripts/fx-drag-report.ts <cycles.json>` — real historical mid rates, timing/spread/fees decomposition, honest negative-drag handling. Sample input: `scripts/fx-drag/sample-cycles.kenya-textbooks.json`. | "I want this running automatically" from ≥ a third of them |
| 2. **Importer archetype** | **Planned.** Detailed in `docs/strategy.md` Phase 1. Purchase-cycle data model (Phase 2) shipped 2026-07-13. | Ship §5 philosophy framing inside the existing app — an archetype, not a new product. Instrument graduation signals (§4). | Real cycles protected; drag reports generated from live data |
| 3. **Self-serve drag report** | **In-app free surface shipped 2026-07-13** (`PaymentCycleReport` + `fx-cycle-report`). **A paid, agent-facing sibling shipped 2026-07-12 and is live on-chain**: `docs/strategy.md` § HSP Settlement & FX Protection Insight — same drag-calc engine in `@diversifi/shared`, x402 source with a confirmed [HashKey mainnet anchor tx](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b). | Turn the concierge script into an in-app, per-cycle report for importer users. | Users generate reports from their own cycle data without manual support |
| 4. **Cycle-aware Guardian execution** | **Shipped 2026-07-14.** Monitoring, proposals, queue enqueue, and fail-closed auto-execution of `CYCLE_PROTECTION` all live (`docs/strategy.md` Phase 5). Scoped to Celo-only permissions and verified Mento funding rails (KES/COP/PHP/BRL → cUSD) with per-cycle idempotency and explicit second-stage consent; unsupported currencies stay advisory-only. | Guardian reads active purchase cycles and proposes (then, within bounds, executes) conversion toward USD-pegged stables as the payment date approaches. | Real payments protected end-to-end on a pilot cycle |
| 5. **Ramp partner** | **Planned.** | One GHS on/off-ramp integration via partner. No ramp building. | Cedis→protection→cedis loop works end-to-end for a pilot user |
| 6. **Rails design partner** | **Planned.** | Pitch one Waza/Juicyway-tier player on embedding the intelligence + Guardian via the Track 1d gateway. | Signed design partner or LOI |
| 7. **Promote to own track** | **Planned.** | Split SME product from the retail app only when forced by demand. | Repeated trader demand or the design-partner deal |

Until step 7, the importer wedge lives inside the existing app as an
archetype — no new tabs, no new product surface, per the prevent-bloat
principle.

---

## 9. What we are NOT claiming (honesty guardrails)

- We are NOT building a payment rail, ramp, or supplier-payout leg —
  partners own the licensed money movement.
- We are NOT claiming the full **Importer `FinancialStrategy` archetype** or
  graduation funnel is live — those remain sequenced in
  `docs/strategy.md` Phases 1 and 4. The free payment-cycle
  report + wallet-authenticated cycle CRUD + monitoring proposals *are* live
  for `upcoming_payment` money-purpose users.
- We are NOT claiming GHSm has sufficient Mento liquidity today — early
  cycles run cUSD/USDC with partner fiat legs.
- We are NOT offering hedging derivatives (forwards/options). Protection
  = stable-value parking + allocation timing + quantified reporting.
  That is what the persona asked for; it is honest to name what it isn't.
- Retail top-of-funnel does NOT mean mass consumer growth spend. It means
  targeted distribution into trader-dense channels where the retail app
  is the trust-building first touch.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Rails players build the risk layer themselves | Speed; the verifiable-evidence moat (none can show on-chain proof of every decision); their DNA is liquidity ops, not intelligence. Licensing to them (§4 protocol stage) converts the threat into the channel. |
| Off-ramp cost eats the value proposition | Quantify all-in cycle cost in the drag report — honesty is the product. Partner selection on off-ramp spread, per jurisdiction. |
| BoG anti-dollarization posture tightens | Non-prescriptive framing (§7); intelligence/software positioning; licensed partner holds custody. Same posture adapts to any jurisdiction's regulatory climate. |
| Geographic overreach — trying to launch everywhere at once | Ghana is the test market; each new jurisdiction is a deliberate step with a local ramp partner. The product is universal; the rollout is sequenced. |
| Solo-dev attention split (retail polish vs business wedge) | The wedge is an archetype inside the existing app until §8 step 7 forces a split. |
| Docs outrun the code | Current-state honesty labels and a public implementation plan (`docs/strategy.md`) keep claims aligned with reality. |

---

## Sources

**Global:**
[Tazapay — stablecoin B2B guide](https://tazapay.com/guides/stablecoin-payments-guide-global-businesses) ·
[Tazapay — cross-border stablecoin payments](https://tazapay.com/guides/stablecoins-cross-border-payments-emerging-markets) ·
[Wise Business](https://wise.com/business) ·
[Revolut Business](https://www.revolut.com/business) ·
[Brex](https://www.brex.com/) ·
[Ramp](https://ramp.com/) ·
[Conduit](https://conduit.com/) ·
[HashKey mainnet — PHP importer FX drag report](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b)

**Africa (test market):**
[Afridigest — Africa-Asia corridor](https://afridigest.substack.com/p/afridigest-signal-nigerias-daya-raises) ·
[Transak — Africa stablecoin report 2026](https://transak.com/blog/africa-fintech-stablecoin-report-2026) ·
[WeeTracker — cross-border payments boom](https://weetracker.com/2026/06/01/africa-cross-border-payments-boom/) ·
[Tribune — AfCFTA $5B conversion losses](https://tribuneonlineng.com/africa-loses-5bn-annually-to-currency-conversion-afcfta-secretariat/) ·
[Yellow Card — currency volatility & manufacturing margins](https://yellowcard.io/blog/currency-volatility-is-killing-manufacturing-margins/) ·
[TechCrunch — Waza](https://techcrunch.com/2024/08/19/waza-comes-out-of-stealth-with-8m-to-power-global-trade-for-african-businesses/) ·
[Disrupt Africa — Juicyway](https://disruptafrica.com/2025/11/11/how-nigerias-juicyway-is-helping-african-businesses-send-receive-and-hold-foreign-currency/) ·
[TechCrunch — Cedar Money](https://techcrunch.com/2025/01/30/qed-seeds-9-9m-in-cedar-money-a-stablecoin-payment-platform/) ·
[TechCabal — Accrue Business](https://techcabal.com/2026/07/10/accrue-launches-accrue-business/) ·
[B&FT — Ghana VASP Act 1154](https://thebftonline.com/2026/02/16/new-rules-of-the-game-breaking-down-the-virtual-assets-service-providers-act/) ·
[Ecofin — Ghana stablecoin/cedi tension](https://www.ecofinagency.com/news/1905-55715-ghanas-silent-currency-war-dollar-stablecoins-are-hollowing-out-the-cedi-while-the-state-bets-on-gold) ·
[TechTrendsKE — Visa stablecoin pilot](https://techtrendske.co.ke/2026/07/06/visa-stablecoin-pilot-africa/) ·
[MyJoyOnline — Ghana's $10B crypto market](https://www.myjoyonline.com/new-regulatory-framework-brings-stability-to-ghanas-10-billion-dollar-crypto-market/) ·
[Yogupay — importers using stablecoins](https://yogupay.com/african-importers-using-stablecoins-for-payments/)


---

## SME FX Layer Implementation Plan

**Status:** In progress (2026-07-14). Phases 0–3 + Guardian trust pass shipped in-app; Phase 5 (cycle-aware Guardian execution, fail-closed Celo-only) shipped.  
**Purpose:** Close the gap between the aligned docs vision (FX-risk intelligence + philosophy moat) and the actual app. The importer wedge stays inside the existing app as an archetype until forced by demand, per `docs/strategy.md` §8.

> **2026-07-13 update — Guardian + FX slice + trust pass:**
> - **Guardian identity consolidation** — single user-facing agent, non-modal proactive updates, shared six-question recommendation contract (`GuardianRecommendationCard`, `recommendation-contract.ts`)
> - **Money purpose** in onboarding/profile (`constants/money-purpose.ts`) — not a new philosophy
> - **Payment cycle report** — `PaymentCycleReport` on Shield/Home; `POST /api/agent/fx-cycle-report` is a **current-rate scenario with historical stress context** (USD targets only — not a future-day historical quote)
> - **PurchaseCycle Mongo model** — `models/PurchaseCycle.ts`, wallet-signed `GET/POST /api/agent/business/cycles` (`lib/wallet-auth.ts`)
> - **Cycle monitoring opt-in** — user enables after reviewing report; proactive client alerts + `runCycleMonitor()` inline in `guardian-loop` cron
> - **Payment-due confirmation** — date passing → `payment_due`; “post-payment report” only after user confirms with achieved amount/rate/fees
> - **Bounded recommendation queue** — `recommendationQueue` on GuardianState (cap 5); enqueue/dequeue so cycle/yield/macro proposals do not clobber each other
> - **Export** — shared `fx-drag-report-renderer.ts` (Markdown + CSV); CLI script delegates to it
> - Focused suite green (guardian-state / FX / AppShell / guardian-loop)

> **2026-07-12 update:** a separate, paid proof of the FX-risk intelligence layer shipped via the x402 gateway — pay a stablecoin (USDT on HashKey; HSP mandate settlement pending Coordinator KYC), unlock a real FX drag report, anchored on the importer's region-canonical ledger (APAC → HashKey, Africa → Celo, else Arbitrum — "follows the money"). **The anchor is live**: [a real HashKey mainnet tx](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b) recorded a PHP importer's FX drag report computed from live rates, for HSK gas only — no Coordinator needed. See § HSP Settlement & FX Protection Insight below. It is **not** the in-app importer-archetype surface this plan describes (that's still Phase 1–4 below, free-to-view for onboarded users) — it's an agent-facing, pay-per-report proof that reuses the exact same `analyzeCycles` engine, now moved to shared per Phase 0. The two surfaces will likely converge (an importer-archetype user's own cycles could power both the free in-app report and a resellable paid one), but that convergence isn't built yet.

## Guiding constraint

Until forced by demand, the importer wedge lives **inside the existing app as an archetype**, not a new product or tab. This mirrors the sequencing in `docs/strategy.md` §8 and honors **PREVENT BLOAT**.

## Phase 0 — Audit & Consolidation (no new features)

Goal: make the existing code safe to extend before adding business logic.

| Action | File(s) | Principle |
|---|---|---|
| **Audit `FinancialStrategy`** | `packages/shared/src/types/strategy.ts` | PREVENT BLOAT |
| Delete `halo`/`taco` if they are not real product strategies | `packages/shared/src/services/strategy/strategy.service.ts`, `components/protection-cards/tokens.ts` | CONSOLIDATION |
| ✅ **Move FX drag logic into `@diversifi/shared`** — done 2026-07-12 | `packages/shared/src/services/fx-drag/calc.ts` (canonical; `scripts/fx-drag/calc.ts` now re-exports it) | DRY |
| ✅ Add a serverless-safe rate provider (the filesystem-cached CLI one doesn't work in an API route) | `packages/shared/src/services/fx-drag/rates-serverless.ts` | DRY |
| ✅ **Move report renderer into shared** | `packages/shared/src/services/fx-drag/fx-drag-report-renderer.ts` (from `scripts/fx-drag-report.ts` render functions) | DRY |
| Keep `scripts/fx-drag-report.ts` as a thin CLI wrapper that delegates to the shared service | `scripts/fx-drag-report.ts` | ENHANCEMENT FIRST |
| **Delete or replace fake business scenarios** | `components/demo/RealWorldUseCases.tsx`, `components/demo/RealLifeScenario.tsx` | CONSOLIDATION |
| **Verification** | `pnpm test`, `pnpm lint`, `pnpm build` | — |

**Why first:** The concierge FX drag tool (`scripts/fx-drag-report.ts`) already proves the math works. The logic must become a shared service before it can power the app.

## Phase 1 — Importer Archetype as Strategy Extension

Goal: a business user is just another philosophy/archetype, not a new app.

| Action | File(s) | Principle |
|---|---|---|
| Add `'importer'` to `FinancialStrategy` union | `packages/shared/src/types/strategy.ts` | ENHANCEMENT FIRST |
| Add `case 'importer':` in `StrategyService.getConfig()` | `packages/shared/src/services/strategy/strategy.service.ts` | DRY |
| Add `case 'importer':` in `StrategyService.getAIPrompt()` | `packages/shared/src/services/strategy/strategy.service.ts` | DRY |
| Add importer archetype card/token | `components/protection-cards/tokens.ts` | ENHANCEMENT FIRST |
| Add importer to `plan-preview.ts` | `components/protection-cards/plan-preview.ts` | DRY |
| Add importer framing to `ProtectionScorecard` | `components/tabs/overview/ProtectionScorecard.tsx` | ENHANCEMENT FIRST |
| Add importer handling to `ProtectionAmbient` if needed | `components/tabs/protect/ProtectionAmbient.tsx` | ENHANCEMENT FIRST |
| Tests: importer config, prompt, archetype render | `packages/shared/src/services/strategy/__tests__/strategy.service.test.ts`, `components/protection-cards/__tests__/*.test.ts` | MODULAR |

**Importer config sketch:**

```ts
case 'importer':
  return {
    preferredRegions: ['Global'],
    targetAllocations: [
      { region: 'Global', min: 60, ideal: 80, max: 95 }, // USD-pegged core
    ],
    prioritizeAssets: ['USDC', 'USDm', 'cUSD', 'USDY'],
    scoringWeights: { regionalConcentration: 0.2, globalDiversification: 0.2, assetCompliance: 0.6 },
    successThresholds: { excellent: 85, good: 70, needsWork: 50 },
  };
```

**AI prompt sketch:**

> The user is an importer/trader. Protect trade margin, not idle savings. Park sales proceeds in USD-pegged value between purchase cycles. Prioritize liquidity and stability. Be ready for the supplier payment date.

**Why:** The entire philosophy infrastructure already exists. Adding an importer as a `FinancialStrategy` is the smallest credible extension that makes the business layer real.

## Phase 2 — Purchase Cycle Data Model

Goal: a minimal, clean data model for working-capital cycles.

**Status: shipped 2026-07-13** (wallet-authenticated CRUD; payment-due vs confirmed-outcome semantics).

| Action | File(s) | Principle |
|---|---|---|
| ✅ Add shared types | `packages/shared/src/types/purchase-cycle.ts` | CLEAN |
| ✅ Add `PurchaseCycle` Mongoose model | `models/PurchaseCycle.ts` | MODULAR |
| ✅ Add CRUD API (wallet-signed headers) | `pages/api/agent/business/cycles.ts`, `lib/wallet-auth.ts` | CLEAN |
| ✅ Derive address from signature — do not trust client `userAddress` | `lib/wallet-auth.ts` | DRY |
| ✅ Status: `active` → `payment_due` on date pass; `completed` requires `paymentOutcome` | cycles API + `PaymentCycleReport` | CLEAN |
| Tests: model + API | extend as needed | MODULAR |

**Model sketch (shipped shape):**

```ts
interface PurchaseCycle {
  userAddress: string;
  label: string;
  localCurrency: string; // e.g. 'GHS'
  targetCurrency: string; // currently USD-only in the report engine
  paymentDate: Date;
  targetAmountUsd: number;
  monitoringEnabled: boolean;
  status: 'draft' | 'active' | 'payment_due' | 'completed' | 'cancelled';
  lastReport?: CycleReportSnapshot;
  paymentOutcome?: {
    confirmedAt: Date;
    achievedLocalAmount: number;
    achievedRate?: number;
    achievedFeesLocal?: number;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Why:** A purchase cycle is the only genuinely new concept from `docs/strategy.md` §5. Everything else reuses the existing pattern.

## Phase 3 — Self-Serve Per-Cycle FX Drag Report

Goal: turn the concierge script into an in-app, self-serve report.

**Status: shipped 2026-07-13** (see header update for file list).

| Action | File(s) | Principle |
|---|---|---|
| ✅ Add API to compute drag report from cycles | `pages/api/agent/fx-cycle-report.ts` | MODULAR |
| ✅ Reuse `analyzeCycles` + report renderer | `packages/shared/src/services/fx-drag/*` | DRY |
| ✅ Create in-app report UI | `components/tabs/protect/PaymentCycleReport.tsx` | ENHANCEMENT FIRST |
| ✅ Mount on Shield/Home for `upcoming_payment` money purpose | `ProtectionTab.tsx`, `ConnectedOverview.tsx` | ENHANCEMENT FIRST |
| ✅ Markdown/CSV export | `fx-drag-report-renderer.ts` + download in UI | DRY |
| Tests: renderer unit tests | `packages/shared/src/services/fx-drag/__tests__/fx-drag-report-renderer.test.ts` | MODULAR |

**Why:** This is the "signature surface" from `docs/strategy.md` §5. It proves the FX intelligence layer to a business user before any autonomous execution.

## Phase 4 — Graduation Funnel

Goal: detect retail users who are actually traders and surface the business layer.

| Action | File(s) | Principle |
|---|---|---|
| Add server-side graduation signal detection | `pages/api/agent/business/graduation-signals.ts` or extend existing analytics | MODULAR |
| Signals: cyclical deposits/withdrawals, larger balances, corridor swaps (local stable ↔ USD stable) | query existing `vaultStore` / swap history / `FunnelEvent` | DRY |
| Store signal in `GuardianState` or `FunnelEvent` | `models/FunnelEvent.ts`, `pages/api/vault/_guardian-state.ts` | CLEAN |
| Add `BusinessPromptCard` | `components/business/BusinessPromptCard.tsx` (pattern: `PhilosophyPromptCard`) | ENHANCEMENT FIRST |
| Show prompt in Overview/Protection for high-signal users | `components/tabs/overview/ConnectedOverview.tsx` or `components/tabs/ProtectionTab.tsx` | ENHANCEMENT FIRST |
| CTA: "See what FX drag is costing your business" → opens `BusinessDragReport` | — | — |

**Why:** The graduation moment must be designed, not hoped for. The data already exists; we just need to surface it.

## Phase 5 — Cycle-Aware Guardian Execution

Goal: the Guardian autonomously protects working capital as a supplier payment approaches.

**Status: shipped (2026-07-14)** — monitoring opt-in, proposals, cron tick, and fail-closed `CYCLE_PROTECTION` auto-execution are all live. Auto-execution is intentionally scoped to Celo-only permissions and to local currencies with a verified Mento funding rail (KES, COP, PHP, BRL → cUSD); every other cycle stays advisory-only until a verified rail is added, rather than attempting an ambiguous swap.

| Action | File(s) | Principle |
|---|---|---|
| ✅ `PurchaseCycle` model + cycles API | `models/PurchaseCycle.ts`, `pages/api/agent/business/cycles.ts` | MODULAR |
| ✅ Compute days-until-payment + proposal contract | `recommendation-contract.ts`, `lib/guardian/cycle-monitor-run.ts` | DRY |
| ✅ Inline cycle monitor in guardian-loop cron | `pages/api/agent/guardian-loop.ts` | ENHANCEMENT FIRST |
| ✅ Client proactive alerts for monitored cycles | `hooks/use-proactive-agent.ts` | ENHANCEMENT FIRST |
| ✅ Bounded recommendation queue (no single-pointer clobber) | `pages/api/vault/_guardian-state.ts` (`enqueueRecommendation` / `dequeueRecommendation`) | CLEAN |
| ✅ Fail-closed execution plan (Celo-only, verified funding rail, vault-balance check) | `lib/guardian/cycle-execution.ts` (`deriveCycleExecutionPlan`) | ENHANCEMENT FIRST |
| ✅ `guardian-loop.ts` executes `CYCLE_PROTECTION` with cycle context, atomic per-cycle claim/finish idempotency | `pages/api/agent/guardian-loop.ts`, `lib/guardian/cycle-execution.ts` | ENHANCEMENT FIRST |
| ✅ Second-stage consent (`Permission.autoExecuteCycleProtection`) — `PATCH /api/vault/permission`, opt-in checkbox in the Protect tab | `pages/api/vault/permission.ts`, `hooks/use-purchase-cycles.ts`, `components/tabs/protect/PaymentCycleReport.tsx` | ENHANCEMENT FIRST |
| ✅ Browser writes to `guardian-state` rejected for reserved server-origin fields (`source: 'cycle-monitor'`, `cycleId`) | `pages/api/vault/guardian-state.ts` | CLEAN |
| ✅ Record on-chain with distinct `CYCLE_PROTECTION` action + `guardian-loop-cycle` serving model | `pages/api/agent/guardian-loop.ts` | DRY |
| ✅ Tests: plan derivation, staleness gate, claim/finish idempotency, two-tick no-double-execute, consent trust boundary | `lib/guardian/__tests__/cycle-execution.test.ts`, `pages/api/agent/__tests__/guardian-loop.test.ts`, `pages/api/vault/__tests__/guardian-state-handler.test.ts` | MODULAR |

**Why:** This is the autonomous protection half of the value proposition. It builds on Phase 2–4, not in parallel.

## Phase 6 — Business Dashboard & Enterprise API

Goal: give rails players and larger SMEs a business view.

| Action | File(s) | Principle |
|---|---|---|
| Add a "Business" section to the Overview tab | `components/tabs/overview/ConnectedOverview.tsx` | ENHANCEMENT FIRST |
| Gate behind `NEXT_PUBLIC_BUSINESS_DASHBOARD_ENABLED` or engagement signal | feature flag | PREVENT BLOAT |
| Surface: active cycles, upcoming payments, total FX drag, recent protection actions | `components/business/BusinessDashboard.tsx` | MODULAR |
| Add enterprise-scoped endpoints | `pages/api/agent/enterprise/business/cycles.ts`, `pages/api/agent/enterprise/business/drag-report.ts` | MODULAR |
| Reuse `validateApiKey` and audit patterns from existing enterprise audit | `pages/api/agent/enterprise/audit.ts` | DRY |

**Why:** This is the B2B licensing surface. It only matters once the prior phases prove the per-cycle value to individual users.

## Principle Alignment Summary

| Principle | How the plan honors it |
|---|---|
| **ENHANCEMENT FIRST** | Importer is a new `FinancialStrategy` value, not a new app. Drag report mounts in existing tabs. Guardian loop is extended. |
| **CONSOLIDATION** | FX drag calc/rates move from scripts to shared; fake demo scenarios are deleted; `halo`/`taco` are audited. |
| **PREVENT BLOAT** | Phase 0 is an audit with no new features. Business dashboard is feature-flagged. No new top-level tabs until forced. |
| **DRY** | Single `FxDragCalculator`, single `FxRateProvider`, single `StrategyService`, single `PurchaseCycle` model used by app + CLI + enterprise API. |
| **CLEAN** | Clear separation: `fx-drag` service = calculation, `business` API = data, `business` components = UI, `guardian-loop` = execution. |
| **MODULAR** | Each phase is independently testable. Shared services instantiate without Next.js request context. |
| **PERFORMANT** | FX rates are cached. Drag calculations are memoized. Cycle processing in the Guardian loop is bounded and non-blocking. |
| **ORGANIZED** | New files: `packages/shared/src/services/fx-drag/`, `models/PurchaseCycle.ts`, `components/business/`, `pages/api/agent/business/`. |

## Verification Gates (every phase)

1. `pnpm test` — all new tests pass; no regressions in philosophy/strategy tests.
2. `pnpm lint` — zero warnings.
3. `pnpm build` — clean build.
4. `pnpm validate-agent` — config integrity.
5. Manual walkthrough: onboarding → select importer → add purchase cycle → view drag report → see graduation prompt.

## What this plan does NOT do

- It does not build a payment rail, ramp, or supplier-payout leg (out of scope per `docs/strategy.md` §6).
- It does not add hedging derivatives (forwards/options).
- It does not split the SME product into a separate app until Phase 5 forces it.

## Related docs

- `docs/strategy.md` — strategic direction, market research, persona design, sequencing
- `docs/product.md` — product positioning and the two differentiators
- `docs/roadmap.md` — active tracks and the product quality plan
- `scripts/fx-drag-report.ts` — existing concierge validation tool
- **§ HSP Settlement & FX Protection Insight** below — the paid, HSP-settled proof of this layer (adjacent surface, see the 2026-07-12 note above)

---

## HSP Settlement & FX Protection Insight (paid, HashKey-settled)

**Status:** 2026-07-12. Code complete, typechecked, lint-clean, 675/675 tests
passing (16 new). **Live on HashKey mainnet** — the region-canonical ledger
anchor has a real, confirmed transaction (see "Live proof" below). **HSP
settlement itself is not yet exercised against a live Coordinator** — that
last step is blocked on Coordinator KYC (submitted, pending), not on missing
code; the anchor and the plain-transfer settlement path needed no Coordinator
at all and are proven live today. No mocks anywhere in this path.

### Live proof

| | |
|---|---|
| Tx hash | [`0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b`](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b) |
| Chain | HashKey Chain mainnet (177) |
| Contract | `RecommendationLedger` `0x3BCf7dFd68ce98880618c89A351168960724369C` — recommendation **#25** |
| Status | `SUCCESS`, block 24,761,823, 228,715 gas |
| What it recorded | `PROTECT → USDC` — the real Manila-importer FX Protection Insight (PHP, total drag 308,397 PHP / 1.6% across 2 cycles), computed from live mid-market rates |
| Cost | HSK gas only — **no stablecoin, no Coordinator, no KYC** |
| Reproduce | `npx tsx scripts/hashkey-fx-demo.ts anchor` (see "Demo without KYC" below) |

---

### What it is

A paid product: a user (or their agent) pays ~1 in stablecoin (USDT on HashKey)
via **HSP (HashKey Settlement Protocol)** and unlocks a verifiable **FX
Protection Insight** — a per-cycle FX drag report ("this cycle, protection
preserved ₵X vs holding cedis") computed from real historical mid-market
rates. The resulting recommendation anchors on the importer's
**region-canonical** `RecommendationLedger` — the audit trail "follows the
money" per [`rails.md`](./rails.md): an **APAC** importer's record
lands on HashKey (payment *and* proof on one chain), an **African** importer's
on Celo, otherwise Arbitrum. Either way the HSP settlement tx on HashKey is
recorded as the cross-chain settlement reference — the accountant-usable audit
trail `strategy.md` calls for.

Settlement chain and anchor chain are **deliberately decoupled**: settlement is
fungible (HSP-on-HashKey is the flagship option, config-selected via
`SETTLEMENT_NETWORK=HASHKEY`), while the anchor obeys the documented per-region
ledger routing. The "one chain" story is real specifically for APAC importers;
for others, HashKey settlement + region-appropriate anchor is the honest shape.

It ships as a new premium source (`fx_protection`) on the existing,
production x402 gateway (`pages/api/agent/x402-gateway.ts`), with HashKey
added as a fourth settlement rail alongside Arc / 0G / Arbitrum.

### Why HSP is safe to depend on

HSP's Coordinator is a plain REST API and its Mandate is standard EIP-712 —
verified against two independent primary sources (the hackathon docs and the
`project-hsp/hsp` repo source) before any code was written. That means:

- **No SDK dependency, no `github:` install.** An earlier attempt to
  `pnpm add github:project-hsp/hsp` was reverted — pulling unaudited
  third-party code from a mutable git ref is a real supply-chain risk, and
  the package didn't even resolve cleanly (`@hsp/core` 404s on npm). This
  implementation is a small, from-scratch EIP-712 client instead.
- **Field-exact to the protocol.** The vendored `packages/core/spec/typehashes.md`
  in the HSP repo gives the canonical `MANDATE_TYPEHASH` preimage. Our
  implementation is pinned to that string by a unit test — see Verification
  below.
- **Testnet-first.** HashKey testnet (chain 133) has a public faucet; nothing
  here has been claimed live on mainnet (177) without a real settled tx.

### What shipped

| Piece | Location |
|---|---|
| EIP-712 Mandate construction (`Signer`/`Recipient` structs, `mandateHash`) | `packages/shared/src/services/hsp/eip712.ts` |
| Coordinator REST client (register/observe/poll/verify) | `packages/shared/src/services/hsp/hsp-settlement.service.ts` |
| HashKey testnet config (chain 133) + tokens | `config/index.ts`, `packages/shared/src/config/index.ts` |
| `HASHKEY` settlement rail (sibling to Arc/0G/Arbitrum) | `packages/shared/src/services/settlement-service.ts` |
| Gateway: HSP challenge fields, `x-payment-hsp` verify path, replay dedup | `pages/api/agent/x402-gateway.ts` |
| `fx_protection` premium source (real `analyzeCycles` computation, no LLM) | `packages/shared/src/utils/arc-research-sources.ts`, `packages/shared/src/services/fx-drag/` |
| Serverless-safe historical rate provider (open dataset, no filesystem) | `packages/shared/src/services/fx-drag/rates-serverless.ts` |
| Frontend: in-wallet mandate signing + HashKey USDC transfer | `hooks/use-x402-payment.ts` (`payViaHsp`) |
| Receipt UI: network-aware "Verified on HashKey" label | `components/agent/ResearchReceipt.tsx` |
| Region-canonical `RecommendationLedger` anchor (currency → region → chain) | `pages/api/agent/x402-gateway.ts` (fire-and-forget) + `packages/shared/src/services/fx-drag/regions.ts` |

The FX-drag math itself (`analyzeCycles`) is not new — it's the existing
concierge tool's engine (`scripts/fx-drag-report.ts` → now
`packages/shared/src/services/fx-drag/calc.ts`, re-exported so the CLI is
unchanged), moved into shared so both the CLI and the paid API route call the
exact same computation. No LLM, no canned fallback: the numbers compute from
real cycle records against real historical rates, or the request errors
honestly.

### Design decisions worth knowing

- **Anchor chain is decoupled from settlement chain (follows the money).** The
  product (`analyzeCycles`) and settlement (any of the 4 rails; HSP-on-HashKey
  is the flagship option) are chain-agnostic. The *anchor* is region-canonical:
  `fxRegionForCurrency(currency)` → HashKey (APAC) / Celo (Africa & LatAm) /
  Arbitrum (default), matching the documented per-region ledger roles. This is
  the reconciliation with `rails.md`'s "ledger follows the money" — the FX
  problem is universal (`strategy.md`), and the anchor follows the
  importer's region, not a hardcoded chain. Payment identity for the
  anchor comes from the HSP signed mandate, so the anchor fires on the HSP path.
- **Distinct header, not overloaded.** HSP proofs travel on `x-payment-hsp`,
  never `x-payment-proof` — an HSP `paymentId` is also 32-byte hex and would
  otherwise be silently mis-routed into the Arc/0G on-chain verifier.
- **API key never reaches the browser.** The wallet signs the EIP-712 mandate
  and broadcasts the USDC transfer (zero-custody); the backend performs the
  authenticated Coordinator writes (`POST /payments`, `/observe`) using
  `HSP_API_KEY`, which is a server-only env var.
- **No double-settlement.** On the `HASHKEY` rail, the user's own wallet is
  the settlement transaction (observed and receipted by the Coordinator), so
  the gateway's usual agent-side `settleOnChain` fire-and-forget step is
  skipped for that rail.
- **`SettlementConfig` shape untouched.** HSP-specific fields (coordinator
  URL, verifying contract, chain name) live in a sibling `HSP_CONFIG` map
  keyed by chainId, not bolted onto the 4-rail `SettlementConfig` interface.
- **Authoritative token address at runtime, not hardcoded.** Two source
  documents disagreed on HashKey's settlement USDC/USDC.e address. Rather
  than guess, the client bootstraps `verifyingContract` and the token address
  from the Coordinator's `GET /chains` every time.
- **Sample input is labeled, everything else is real.** The FX Protection
  response uses a representative Ghana importer cycle set
  (`packages/shared/src/services/fx-drag/sample-ghana.ts`) when the caller
  doesn't POST their own `cycles`, and says so in the response
  (`is_sample: true`, a `disclaimer` field). The rates, the drag
  decomposition, the settlement, and the ledger anchor are all real regardless
  of whether the input is a sample or a real trader's books.

### Prerequisites to go live (not code — credentials only a human can supply)

1. **HSP Coordinator URL + Bearer API key** — self-service `/register` on the
   live Coordinator.
2. **A faucet-funded HashKey testnet wallet** (gas + test USDC) for the
   merchant/recipient side.
3. Set in `.env.local` (see `.env.example` → the HSP block):
   ```
   SETTLEMENT_NETWORK=HASHKEY
   SETTLEMENT_ENV=testnet
   HSP_COORDINATOR_URL=<from /register>
   HSP_API_KEY=<from /register>
   HASHKEY_PAY_RECIPIENT=<funded HashKey testnet wallet>
   ```

Once set, the loop is: `GET /api/agent/x402-gateway?source=fx_protection&quote=1`
returns a HashKey challenge carrying an `hsp` block → wallet signs the
mandate → wallet broadcasts the settlement token on HashKey → gateway registers +
observes + polls to `SETTLED` → `fx_protection` report unlocks → recommendation
anchors on its region-canonical ledger.

### Demo without KYC (`scripts/hashkey-fx-demo.ts`)

HSP's Coordinator requires KYC (slow to obtain). Because settlement and the
audit-trail anchor are decoupled, you don't need HSP to demonstrate the product
on HashKey. Two modes, using the **Manila importer sample** (PHP → Asia → the
recommendation anchors on HashKey 177):

- **`anchor` mode — free, no KYC, no stablecoin.** Computes the real FX drag
  report from live rates and records the recommendation on the HashKey
  `RecommendationLedger` (chain 177) via `recordRecommendation`. Needs only
  `LEDGER_PRIVATE_KEY` funded with **HSK gas** (which the ledger wallet already
  has) + `HASHKEY_LEDGER_CONTRACT`. Proves "verifiable AI FX intelligence,
  recorded on HashKey Chain" for $0 of stablecoin.
  ```
  npx tsx scripts/hashkey-fx-demo.ts anchor
  ```
- **`settle` mode — the full paid x402 flow.** Drives probe → `402` → USDT
  transfer on HashKey → re-fetch with proof → unlocked report; the gateway then
  anchors. Needs `SETTLEMENT_NETWORK=HASHKEY` on a running gateway and
  `DEMO_PAYER_PRIVATE_KEY` funded with **USDT + HSK** on HashKey mainnet.
  ```
  npx tsx scripts/hashkey-fx-demo.ts settle
  ```

**Stablecoin correction (verified on-chain):** HashKey mainnet's canonical
stablecoin is **USDT** (`0xf1b50ed6…9029`, 6 decimals), not USDC — bridged USDC
(`0x054ed458…D0a`, 6 decimals) also exists. The plain-transfer settlement path
defaults to USDT; the HSP path still reads its token authoritatively from the
Coordinator's `GET /chains`. (An earlier hardcoded `…a22cf95a70` from the HSP
repo guide was wrong for the real chain and has been corrected.)

### Verification

- **Crypto correctness, offline, no credentials needed:**
  `packages/shared/src/services/hsp/__tests__/eip712.test.ts` — 10 tests,
  including a full sign→recover round-trip that mirrors the HSP verifier's
  own strictness checks (65-byte signature, `v ∈ {27,28}`, low-`s`, recovered
  address matches). If this suite is green, our mandates will be accepted by
  the real Coordinator's signature check.
- **Product math, offline, seeded rates:**
  `packages/shared/src/services/fx-drag/__tests__/fx-drag.test.ts` — asserts
  the drag decomposition identity (`timing + spread + fees == totalDrag`) and
  determinism.
- **Full suite:** 675/675 passing (was 659 before this work; +16, zero
  regressions). `tsc --noEmit` and `eslint` clean on every changed file.
- **Live, on-chain:** the region-canonical anchor — confirmed `SUCCESS` on
  HashKey mainnet (see "Live proof" above). Proves `recordRecommendation`,
  the region-routing (`fxRegionForCurrency`), and the real FX-drag computation
  all work end-to-end in production, independent of HSP/Coordinator.
- **Not yet run:** a live register → pay → observe → `SETTLED` → unlock loop
  against the real HSP Coordinator (blocked on KYC). The plain-transfer
  settlement path (USDT on HashKey, no Coordinator) is code-complete and
  ready to run via `settle` mode once a payer wallet is funded.

### Related docs

- [`strategy.md`](./strategy.md) — the north-star direction this proves out (§8 sequencing, step 3)
- [`rails.md`](./rails.md) — the HashKey `RecommendationLedger` this anchors to
- [`integrations.md`](./integrations.md) — the canonical settlement-rail env var table
