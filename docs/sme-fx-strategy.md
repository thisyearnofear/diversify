# SME FX Strategy — Importer Working Capital & the Retail→Business Funnel

**Status:** Drafted 2026-07-11 (north-star direction). Updated 2026-07-13 with shipped payment-cycle slice + trust pass.
**Purpose:** Capture the strategic direction that emerged from a real user
conversation — a Ghanaian importer who buys in USD abroad (China, US, UK)
and sells locally in cedis — plus the market research, competitive gap,
and funnel model that make this the long-term market opportunity.

**Implementation plan:** `docs/sme-fx-implementation-plan.md` — the phased build plan that turns this strategy into code, aligned with the Core Principles.

**Current-state honesty:** This doc remains strategic design for the full Importer/Trader archetype (§5). The free payment-cycle report, wallet-authenticated cycle CRUD, monitoring proposals, and recommendation queue **are live** (2026-07-13). The Importer `FinancialStrategy` + graduation funnel are still planned. Concierge tooling (`scripts/fx-drag-report.ts`) remains useful for offline trader validation.

---

## 1. The persona and the pain

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

This is the same persona as the Kenyan business example that crystallized
the Track 3 reframe (a business that would have preserved purchasing power
saving in USD around an election, but "the headaches meant they just kept
everything in KES") — one border over, at transaction volume instead of
savings scale.

The pain is quantifiable: [a mid-sized Ghanaian plastics manufacturer
importing $50,000 of resin quarterly eats an unplanned $2,500 loss if the
cedi slips just 5% between quotation and settlement — and these losses
"rarely show up as clear line items"](https://yellowcard.io/blog/currency-volatility-is-killing-manufacturing-margins/).

---

## 2. Market evidence (researched 2026-07-11)

| Signal | Number | Source |
|---|---|---|
| China–Africa trade (2025) | **$348B**, +20% YoY, still routed via correspondent banks | [Afridigest](https://afridigest.substack.com/p/afridigest-signal-nigerias-daya-raises) |
| SSA stablecoin volume (Q1 2026) | **$50B**, +340% YoY, large B2B share | [Transak / Chainalysis](https://transak.com/blog/africa-fintech-stablecoin-report-2026) |
| Africa cross-border payments | **$329B (2025) → $1T by 2035** (Oui Capital) | [WeeTracker](https://weetracker.com/2026/06/01/africa-cross-border-payments-boom/) |
| Global stablecoin B2B payments | **~$226B in 2025, +733% YoY** (McKinsey/Artemis) | [Tazapay](https://tazapay.com/guides/stablecoin-payments-guide-global-businesses) |
| Africa currency-conversion losses | **~$5B/year** (AfCFTA / Afreximbank) | [Tribune](https://tribuneonlineng.com/africa-loses-5bn-annually-to-currency-conversion-afcfta-secretariat/) |
| Cedi track record | −50% vs USD in 2022 (54% inflation); −23% in 2023 | `constants/currency-risk.ts`, [Yogupay](https://yogupay.com/stablecoins-vs-banks-for-african-importers/) |
| Ghana crypto volume | **$10B+ by Nov 2025** (up from ~$6B) | [MyJoyOnline](https://www.myjoyonline.com/new-regulatory-framework-brings-stability-to-ghanas-10-billion-dollar-crypto-market/) |
| Traditional rails cost | 4–10 business days, 5–10% fees vs 0.5–2.5% all-in stablecoin | [Yogupay](https://yogupay.com/african-importers-using-stablecoins-for-payments/) |

Importers in Lagos, Accra, and Nairobi are already settling Chinese
supplier invoices in USDT/USDC — the behavior shift has happened. What
has not shipped anywhere is the **risk layer** on top of it.

---

## 3. Competitive landscape — everyone builds roads, nobody builds the driver

The movement-of-money problem is crowded and well-capitalized:

| Player | What they do | What they don't do |
|---|---|---|
| [Waza](https://techcrunch.com/2024/08/19/waza-comes-out-of-stealth-with-8m-to-power-global-trade-for-african-businesses/) (YC W23) | ~$700M annualized B2B volume, trade finance, Lync multicurrency accounts | No risk quantification or automated protection |
| [Juicyway](https://disruptafrica.com/2025/11/11/how-nigerias-juicyway-is-helping-african-businesses-send-receive-and-hold-foreign-currency/) | Profitable, 12k+ business customers, $300M+/mo, stablecoin orchestration | Same |
| [Cedar Money](https://techcrunch.com/2025/01/30/qed-seeds-9-9m-in-cedar-money-a-stablecoin-payment-platform/) | QED-backed, fiat UX over stablecoin rails, T+1 | Same |
| [Verto](https://verto.co/), Conduit, AZA | Multi-currency accounts, FX liquidity, treasury ops | Same |
| Yellow Card, [Accrue Business](https://techcabal.com/2026/07/10/accrue-launches-accrue-business/) | Ramps + business stablecoin banking | Same |
| Flutterwave, Paystack, [Visa pilot](https://techtrendske.co.ke/2026/07/06/visa-stablecoin-pilot-africa/) | Incumbents adding stablecoin settlement | Same |

The battleground is orchestration, liquidity, virtual accounts, and
ramps. **No player surfaced in the research offers FX risk
quantification, hedging, or automated protection for these importers.**
The exposed window — cedis accumulating between purchase cycles — is
unserved.

That gap maps one-to-one onto what DiversiFi has already built:

| Importer pain | DiversiFi surface (shipped) |
|---|---|
| "Hard to quantify" | `constants/currency-risk.ts` dataset + counterfactual calculator + protection scorecard |
| "Don't want to think about it" | Guardian autonomous loop within signed permission bounds |
| "Can I trust it / prove it" | Chain-aware `RecommendationLedger` + 0G evidence — an audit trail an accountant can use |
| Distribution to businesses | Track 1d enterprise gateway (API-key auth, audit export) — licensable to the rails players themselves |

**Positioning: DiversiFi is not another rail. It is the FX risk
intelligence and autonomous protection layer that sits on top of the
rails.**

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
one person and one pool of money at two levels of trust. Precedents for
the consumer→business graduation: Wise, Revolut, PayPal, M-Pesa — all
rode individual trust into business accounts.

**The graduation moment must be designed, not hoped for.** The bridge is
the FX drag report: the retail scorecard already shows a user what
holding cedis cost them; the business version shows what it cost *per
purchase cycle* — and the CTA is "run this on your business."

**Instrument the funnel.** Retail users who are actually traders are
detectable: cyclical deposit/withdraw patterns, larger amounts,
corridor-shaped swaps (GHS↔USD-pegged). Track these as
graduation-candidate signals before building any business tier.

**Current-state honesty:** The graduation signal detection and CTA are not yet implemented in the consumer app. A small business-context hint is live in onboarding; the full graduation funnel is planned in `docs/sme-fx-implementation-plan.md` Phase 4.

---

## 5. The Importer/Trader archetype (design — FinancialStrategy still planned)

Unlike the eight philosophy archetypes (allocation-target-based), the
Importer archetype is **cycle-aware**:

| Field | Value |
|---|---|
| **Philosophy** | Protect trade margin, not idle savings. Park sales proceeds in USD-pegged value between purchase cycles; be liquid on payment day. |
| **Core model** | A **purchase cycle**: expected USD obligation (amount + approximate date) → protect accumulating local-currency proceeds against slippage until conversion. This obligation/cycle model is the one genuinely new concept — everything else reuses the existing pattern. |
| **Default allocation** | USD-pegged stables (cUSD/USDC on Celo) between cycles; GHSm/local leg only as ramp liquidity allows |
| **Guardian behavior** | Monitor GHS (or local ccy) depreciation + inflation signals; rebalance proceeds toward USD-pegged stables as the payment date approaches; never prescriptive — the user picks the protection level |
| **Signature surface** | **Per-cycle FX drag report** — "this cycle, protection preserved ₵X vs holding cedis" — quantified, exportable, ledger-backed |
| **Proof** | Every cycle decision on the chain-aware ledger + 0G evidence = an audit trail for the business's books |

Reuses wholesale: Guardian loop, ERC-7715 permissions, swap orchestrator,
`RecommendationLedger`, currency-risk dataset, archetype card system.
Follows the ENHANCEMENT FIRST pattern (~same footprint as the
Pan-Caribbean plan in `caribbean-strategy.md` §6, plus the cycle model).

**Status:** Design only. The implementation plan is in `docs/sme-fx-implementation-plan.md` Phase 1–2.

---

## 6. Ramps and supplier payout — partner, don't build

The off-ramp conversion is [the largest single cost component in these
corridors](https://tazapay.com/guides/stablecoins-cross-border-payments-emerging-markets).
Owning ramps is a different, capital-intensive, licensed business.

- **GHS on/off-ramp:** partner (Yellow Card, Accrue, Kotani Pay, Fonbnk,
  MiniPay/Noah — already mapped in `roadmap.md` Post-9/10 table).
- **Supplier payout (China/US/UK legs):** out of scope. The rails players
  own it — which is exactly why they are licensing targets, not
  competitors (§4, protocol stage).
- **GHSm liquidity on Mento is likely thin** — early cycles run
  cUSD/USDC with fiat legs at the partner.

---

## 7. Regulation — Ghana as the test market

- The [**VASP Act, 2025 (Act 1154)**](https://thebftonline.com/2026/02/16/new-rules-of-the-game-breaking-down-the-virtual-assets-service-providers-act/)
  was signed 2025-12-29; Bank of Ghana is primary licensing authority,
  phased licensing from Q1 2026, sandbox running. Legal clarity is good
  news.
- The BoG is [openly concerned that dollar stablecoins are hollowing out
  the cedi](https://www.ecofinagency.com/news/1905-55715-ghanas-silent-currency-war-dollar-stablecoins-are-hollowing-out-the-cedi-while-the-state-bets-on-gold)
  and is exploring gold-backed alternatives.

Two implications:

1. **The non-prescriptive philosophy framing is regulatory protection,
   not just brand ethos.** DiversiFi never prescribes "move to USD" — it
   quantifies risk and lets the user choose. In an anti-dollarization
   regulatory climate, that framing matters.
2. **Position as intelligence/software; a licensed partner holds custody
   and conversion.** This keeps DiversiFi outside the licensing perimeter
   while the ramp partner (already licensed or licensing under Act 1154)
   owns the regulated activity.

---

## 8. Sequencing

| Step | Status | What | Gate to next step |
|---|---|---|---|
| 1. **Concierge validation** | **Tooling shipped.** | Produce the Ghana user's personal FX drag report manually from their real cycle numbers (`currency-risk.ts` has the GHS data). Repeat with 10–20 traders (Accra, Lagos, Nairobi). `npx tsx scripts/fx-drag-report.ts <cycles.json>` — real historical mid rates, timing/spread/fees decomposition, honest negative-drag handling. Sample input: `scripts/fx-drag/sample-cycles.kenya-textbooks.json`. | "I want this running automatically" from ≥ a third of them |
| 2. **Importer archetype** | **Planned.** Detailed in `docs/sme-fx-implementation-plan.md` Phase 1. Purchase-cycle data model (Phase 2) shipped 2026-07-13. | Ship §5 philosophy framing inside the existing app — an archetype, not a new product. Instrument graduation signals (§4). | Real cycles protected; drag reports generated from live data |
| 3. **Self-serve drag report** | **In-app free surface shipped 2026-07-13** (`PaymentCycleReport` + `fx-cycle-report`). **A paid, agent-facing sibling shipped 2026-07-12 and is live on-chain**: `docs/hsp-fx-protection.md` — same drag-calc engine in `@diversifi/shared`, x402 source with a confirmed [HashKey mainnet anchor tx](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b). | Turn the concierge script into an in-app, per-cycle report for importer users. | Users generate reports from their own cycle data without manual support |
| 4. **Cycle-aware Guardian execution** | **Partial.** Monitoring + proposals + queue enqueue shipped (`docs/sme-fx-implementation-plan.md` Phase 5). Auto-execution of `CYCLE_PROTECTION` still uses the existing rebalance path when confidence/permissions allow. | Guardian reads active purchase cycles and proposes (then, within bounds, executes) conversion toward USD-pegged stables as the payment date approaches. | Real payments protected end-to-end on a pilot cycle |
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
| Off-ramp cost eats the value proposition | Quantify all-in cycle cost in the drag report — honesty is the product. Partner selection on off-ramp spread. |
| BoG anti-dollarization posture tightens | Non-prescriptive framing (§7); intelligence/software positioning; licensed partner holds custody. |
| Solo-dev attention split (retail polish vs business wedge) | The wedge is an archetype inside the existing app until §8 step 7 forces a split. |
| Docs outrun the code | Current-state honesty labels and a public implementation plan (`docs/sme-fx-implementation-plan.md`) keep claims aligned with reality. |

---

## Sources

[Afridigest — Africa-Asia corridor](https://afridigest.substack.com/p/afridigest-signal-nigerias-daya-raises) ·
[Transak — Africa stablecoin report 2026](https://transak.com/blog/africa-fintech-stablecoin-report-2026) ·
[WeeTracker — cross-border payments boom](https://weetracker.com/2026/06/01/africa-cross-border-payments-boom/) ·
[Tazapay — stablecoin B2B guide](https://tazapay.com/guides/stablecoin-payments-guide-global-businesses) ·
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
