# SME FX Strategy — Importer/Exporter Working Capital & the Retail→Business Funnel

**Status:** Drafted 2026-07-11 (north-star direction). Updated 2026-07-13 with shipped payment-cycle slice + trust pass. Reframed 2026-07-19 to reflect the universal nature of the problem.
**Purpose:** Capture the strategic direction that emerged from a real user
conversation — a Ghanaian importer who buys in USD abroad (China, US, UK)
and sells locally in cedis — plus the market research, competitive gap,
and funnel model that make this the long-term market opportunity. The
Ghanaian importer is the wedge — the most extreme, clearest case — but
the problem is universal: any business with a currency mismatch between
revenue and costs faces the same working-capital risk.

**Implementation plan:** `docs/sme-fx-implementation-plan.md` — the phased build plan that turns this strategy into code, aligned with the Core Principles.

**Current-state honesty:** This doc remains strategic design for the full Importer/Trader archetype (§5). The free payment-cycle report, wallet-authenticated cycle CRUD, monitoring proposals, and recommendation queue **are live** (2026-07-13). The Importer `FinancialStrategy` + graduation funnel are still planned. Concierge tooling (`scripts/fx-drag-report.ts`) remains useful for offline trader validation.

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

**Current-state honesty:** The graduation signal detection and CTA are not yet implemented in the consumer app. A small business-context hint is live in onboarding; the full graduation funnel is planned in `docs/sme-fx-implementation-plan.md` Phase 4.

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

**Status:** Design only. The implementation plan is in `docs/sme-fx-implementation-plan.md` Phase 1–2.

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
| 2. **Importer archetype** | **Planned.** Detailed in `docs/sme-fx-implementation-plan.md` Phase 1. Purchase-cycle data model (Phase 2) shipped 2026-07-13. | Ship §5 philosophy framing inside the existing app — an archetype, not a new product. Instrument graduation signals (§4). | Real cycles protected; drag reports generated from live data |
| 3. **Self-serve drag report** | **In-app free surface shipped 2026-07-13** (`PaymentCycleReport` + `fx-cycle-report`). **A paid, agent-facing sibling shipped 2026-07-12 and is live on-chain**: `docs/sme-fx-implementation-plan.md` § HSP Settlement & FX Protection Insight — same drag-calc engine in `@diversifi/shared`, x402 source with a confirmed [HashKey mainnet anchor tx](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b). | Turn the concierge script into an in-app, per-cycle report for importer users. | Users generate reports from their own cycle data without manual support |
| 4. **Cycle-aware Guardian execution** | **Shipped 2026-07-14.** Monitoring, proposals, queue enqueue, and fail-closed auto-execution of `CYCLE_PROTECTION` all live (`docs/sme-fx-implementation-plan.md` Phase 5). Scoped to Celo-only permissions and verified Mento funding rails (KES/COP/PHP/BRL → cUSD) with per-cycle idempotency and explicit second-stage consent; unsupported currencies stay advisory-only. | Guardian reads active purchase cycles and proposes (then, within bounds, executes) conversion toward USD-pegged stables as the payment date approaches. | Real payments protected end-to-end on a pilot cycle |
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
  `docs/sme-fx-implementation-plan.md` Phases 1 and 4. The free payment-cycle
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
| Docs outrun the code | Current-state honesty labels and a public implementation plan (`docs/sme-fx-implementation-plan.md`) keep claims aligned with reality. |

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
