# Caribbean Strategy — Future Caribbean 2026

**Status:** Drafted 2026-07-03
**Purpose:** Assess and design DiversiFi's Caribbean positioning for the Future
Caribbean 2026 competition (Finance, Payments & MSME Capital track).

This doc is the strategic design. Code changes (new `FinancialStrategy`,
strategy config, archetype token, AI prompt) follow this design and are
listed in §6.

---

## 1. The token supply problem — and the honest answer

**Mento does not offer any Caribbean stablecoin.** The full Mento roster
(USDm, EURm, BRLm, KESm, PHPm, COPm, GHSm, NGNm, GBPm, CADm, AUDm, CHFm,
JPYm, XOFm, ZARm, cUSD, cEUR, cREAL) contains zero Caribbean currencies.
There is no JMDm, TTDm, BBDm, XCDm, or GYDm.

**The Caribbean digital currency landscape is real but not onchain:**

| Project | Status (July 2026) | On a public chain? | Bridgeable to Celo? |
|---|---|---|---|
| **Carib$ (CaribDollar)** | Pan-Caribbean complementary currency. Backed by BBD/XCD/TTD. Field-tested in Barbados, St Vincent, T&T (May 2025). CTU/CARICOM-backed. | Private/permissioned DLT — own wallet app | **No** — no public token contract, no bridge |
| **SandDollar (Bahamas)** | Live CBDC since 2020. Legal tender. | Central Bank of Bahamas permissioned ledger | **No** |
| **JAM-DEX (Jamaica)** | Live CBDC since June 2022. ~J$260M issued. Legal tender. | eCurrency DSC3 — centralized ledger at BOJ, not blockchain | **No** |
| **DCash (Eastern Caribbean)** | Pilot ended Jan 2024. Transitioning to DCash 2.0. | Was Hyperledger Fabric (private) | **No** |

**Conclusion:** There is no native Caribbean stabletoken on any public
chain today. Every Caribbean digital currency is a CBDC or permissioned
complementary currency on a private ledger. None are bridgeable to Celo,
Arbitrum, or 0G.

**This is not fatal — it changes the angle.** The Caribbean protection
thesis is not "hold a Jamaican stablecoin to escape JMD inflation." It is
"hold USD-pegged stablecoins to escape imported inflation, FX scarcity,
and remittance friction — with a Guardian that watches the specific
Caribbean inflation drivers."

---

## 2. The real Caribbean pain points (researched July 2026)

### 2.1 Imported inflation, not hyperinflation

Caribbean inflation is moderate but **food inflation is the real story**:

| Country | Headline inflation (2025) | Food inflation (2025) | Driver |
|---|---|---|---|
| Jamaica | 4.2% | 7.1% | Import dependence (43% from US), US tariff pass-through |
| Guyana | 3.6% | 8.2% | Oil boom + import dependence, terms of trade worsening |
| Barbados | 2.3% | n/a | 80%+ imports from US — highest US dependency in region |
| Trinidad & Tobago | 1.5% | 3.0% | Energy exporter, but food imported |
| Caribbean avg | 3.9% (est) | 5-8% | US tariffs, energy prices, hurricane disruption |

The region imports ~43% of goods from the US. US tariff pass-through
hits Caribbean import prices directly. This is **imported inflation
protection** — the Guardian monitors US tariff policy, food commodity
prices, and FX trends, then rebalances before the next import cycle
erodes purchasing power.

### 2.2 FX liquidity + USD scarcity

Caribbean businesses constantly struggle for USD liquidity to pay
importers. Carib$'s entire thesis is reducing USD dependency. A
USD-pegged stablecoin savings vehicle directly addresses this — the
saver holds USD-pegged value that can be deployed for import payments,
remittances, or yield, without depending on local bank USD queues.

### 2.3 Diaspora remittance corridor

The Caribbean diaspora in the US, UK, and Canada is enormous relative
to home-country populations. Traditional remittance costs 6-10%.
Celo + MiniPay delivers <1% (network fee under $0.001, off-ramp via
Noah/partners to 40+ local currencies). This is the strongest
immediate PMF — and MiniPay already operates in 66+ countries.

### 2.4 Hurricane / disaster financial resilience

Hurricane Melissa disrupted Jamaica's western economy in Dec 2025.
Physical cash and banking infrastructure fail during disasters. Onchain
stablecoins on a mobile-first chain (Celo) are disaster-resilient —
value persists independent of local physical infrastructure, accessible
from any phone. This maps to the "Climate Risk & Disaster Coordination"
and "Energy, Climate & Resilience" tracks as a secondary angle.

### 2.5 CSME cross-border trade friction

CARICOM's "25 by 2025" initiative wants seamless cross-border payments.
Carib$ is the institutional answer; DiversiFi can be the consumer/savings
answer on the same thesis. A future DiversiFi ↔ Carib$ integration
(DiversiFi as the savings/yield layer, Carib$ as the cross-border
settlement layer) is a compelling long-term partnership narrative.

---

## 3. The token strategy that actually works

Since there is no onchain Caribbean currency, the Caribbean protection
plan is **USD-pegged savings + diaspora on/off-ramp + inflation-aware
rebalancing**, not local-currency stablecoins.

| Layer | Token(s) | Chain | Why |
|---|---|---|---|
| **Savings vehicle** | USDC, cUSD | Celo | Caribbean currencies are largely USD-pegged or stable vs USD (BBD 2:1 fixed, XCD 2.7:1 fixed, TTD floats but stable). USD-pegged stablecoins ARE the inflation protection. Celo = mobile-first, sub-cent fees, MiniPay distribution. |
| **Yield vehicle** | USDY, PAXG, SYRUPUSDC | Arbitrum | Same as current Arbitrum thesis — deep RWA yield liquidity. PAXG (gold) hedges against the imported inflation that drives Caribbean food prices. |
| **Local-currency off-ramp** | MiniPay / Noah partners | Celo → local rails | MiniPay supports 40+ local currencies via partner rails. Cash-out to Caribbean bank accounts / mobile money. Diaspora corridor: US/UK/CA → Caribbean. |
| **Inflation hedge** | PAXG (gold) | Arbitrum | Gold tracks the commodity inflation that drives Caribbean food/import prices. The Guardian increases PAXG weight when food commodity indices spike. |
| **Future: Carib$** | Carib$ (when onchain or API-open) | TBD | Long-term partnership. CaribCoin is Barbados-based, CTU-backed. If Carib$ opens an API or deploys on a public chain, DiversiFi integrates it as the regional settlement layer. |

### Why this is honest, not hand-wavy

We are NOT claiming "Caribbean users hold cJMD." We ARE claiming:
1. Caribbean savers face real purchasing-power erosion from imported
   inflation (7-8% food inflation in Jamaica/Guyana).
2. USD-pegged stablecoins are a proven hedge — most Caribbean currencies
   are USD-pegged or stable vs USD, so USD-pegged stablecoins preserve
   local-currency purchasing power better than holding local cash.
3. The Guardian's inflation monitoring (World Bank, FRED, Firecrawl)
   already tracks Caribbean countries and US tariff/commodity pass-through.
4. The diaspora remittance corridor is the strongest immediate adoption
   path — Celo + MiniPay already serve this use case at <1% cost.

---

## 4. The Pan-Caribbean protection plan

### Plan name: Pan-Caribbean (CSME)

| Field | Value |
|---|---|
| **Philosophy** | Caribbean resilience. Protect purchasing power against imported inflation, FX scarcity, and disaster disruption. Keep wealth in the region where possible; hold hard USD value when local currencies weaken. |
| **Cultural alignment** | CSME / "25 by 2025" regional integration. Pan-Caribbean identity — not single-country. Diaspora-aware (US/UK/CA → home). |
| **Target regions** | Caribbean (T&T, Jamaica, Barbados, Guyana, ECCU, Bahamas) + Commodities (gold hedge) |
| **Target allocation** | 40-50% USD-pegged stablecoins (USDC/cUSD on Celo), 20-30% RWA yield (USDY/PAXG on Arbitrum), 10-20% Commodities (PAXG gold — inflation hedge), 10-20% Global diversification |
| **Prioritize assets** | USDC, cUSD, PAXG, USDY |
| **Exclude assets** | None (no Sharia constraint) — but de-emphasize speculative perps |
| **Inflation trigger** | Guardian watches Caribbean food inflation (STATIN Jamaica, Central Bank of T&T, ECCB), US tariff policy, food commodity indices. Rebalances toward PAXG/USDY when food inflation > 6%. |
| **Disaster mode** | Guardian detects hurricane alerts (Firecrawl webhook) → shifts to USDC/cUSD (max liquidity, max portability) → user can withdraw from any phone post-disaster. |
| **Diaspora mode** | User sets "home country" → Guardian optimizes off-ramp path (US/UK/CA → home country via MiniPay/Noah) → minimizes remittance cost. |

### Why "Pan-Caribbean" not "Jamaica-first"

The Future Caribbean rubric rewards "scalability across multiple
markets" and "global deployment." A single-country plan is narrower.
Pan-Caribbean covers CARICOM/CSME — the same regional integration thesis
that Carib$ and the "25 by 2025" initiative serve. Jamaica is the
primary evidence country (largest diaspora, clearest food inflation
data, JAM-DEX context) but the plan scales across the region.

### Jamaica as the evidence country

Jamaica is the concrete market for PMF evidence:
- **Largest Caribbean diaspora** in US/UK/Canada — strongest remittance corridor
- **Clear food inflation** (7.1% Dec 2025) — Guardian's inflation thesis is provable
- **JAM-DEX live** — even though it's not onchain, it proves Jamaica has digital-currency appetite and BOJ is pushing adoption
- **STATIN publishes monthly inflation** — Guardian can consume this via Firecrawl
- **Hurricane Melissa (Dec 2025)** — disaster-resilience thesis is provable

---

## 5. The Guardian's Caribbean intelligence diet

The Guardian already consumes 12+ data sources. For the Caribbean plan,
it adds Caribbean-specific signals:

| Signal | Source | What it triggers |
|---|---|---|
| Jamaica food inflation | STATIN monthly bulletins (Firecrawl) | Rebalance toward PAXG/USDY when > 6% |
| T&T inflation | Central Bank of T&T Economic DataPack (Firecrawl) | Rebalance toward USDC when > 2% |
| Guyana food inflation | Bureau of Statistics (Firecrawl) | Rebalance toward PAXG when > 6% |
| US tariff policy | USTR / news webhooks (Firecrawl) | Pre-emptive rebalance — tariffs pass through to Caribbean import prices within 1-2 quarters |
| Food commodity indices | FAO Food Price Index, World Bank Pink Sheet | Increase PAXG weight when food commodity index spikes |
| Hurricane alerts | NHC / regional meteorological webhooks | Disaster mode → shift to USDC/cUSD (max liquidity) |
| USD/XCD, USD/BBD, USD/TTD FX | Central bank rates / open FX APIs | Detect local-currency stress → increase USD-pegged allocation |

This is the "thoughtful use of Agentic AI" the rubric asks for — the
Guardian is not just calling an LLM; it is synthesizing Caribbean-specific
macro signals into actionable rebalancing decisions with on-chain proof.

---

## 6. Code changes required (design, not yet implemented)

To ship the Pan-Caribbean plan, the following changes follow the
existing protection-plan pattern:

| File | Change | Lines |
|---|---|---|
| `packages/shared/src/types/strategy.ts` | Add `'pan_caribbean'` to `FinancialStrategy` union | +1 |
| `packages/shared/src/config/index.ts` | Add `CARIBBEAN: 'Caribbean'` to `GEOGRAPHIC_REGIONS` | +1 |
| `packages/shared/src/services/strategy/strategy.service.ts` | Add `case 'pan_caribbean':` config block (preferredRegions: Caribbean + Commodities, targetAllocations, prioritizeAssets: USDC/cUSD/PAXG/USDY) | +25 |
| `packages/shared/src/services/strategy/strategy.service.ts` | Add `case 'pan_caribbean':` AI prompt block (Caribbean inflation thesis) | +12 |
| `components/protection-cards/tokens.ts` | Add `pan_caribbean` archetype (surface gradient: Caribbean sea — deep teal → turquoise → sand) | +12 |
| `components/protection-cards/tokens.ts` | Add `'pan_caribbean'` to `ArchetypeId` union + `ARCHETYPE_ORDER` | +2 |
| `components/protection-cards/cards.tsx` | Add Pan-Caribbean card | +20 |
| `components/protection-cards/heroes.tsx` | Add Pan-Caribbean hero | +30 |
| `hooks/useFinancialStrategies.ts` | Add Pan-Caribbean to strategy options list | +8 |
| `components/tabs/protect/ProtectionAmbient.tsx` | Add Pan-Caribbean ambient | +5 |
| `components/portfolio/StrategyMetrics.tsx` | Add `getPanCaribbeanMetrics()` (Caribbean exposure %, food inflation hedge ratio, diaspora corridor cost) | +40 |
| `packages/shared/src/services/swap/swap-orchestrator.service.ts` | Add Pan-Caribbean to strategy routing | +5 |
| Guardian loop / Firecrawl monitors | Add Caribbean inflation source monitors (STATIN, CBTT, ECCB) | +30 |
| Tests | Pan-Caribbean strategy config test + AI prompt test | +30 |

**Net: ~220 lines across ~12 files, 0 new modules.** Follows the
ENHANCEMENT FIRST principle — extends existing strategy/archetype
pattern, no new packages or parallel surfaces.

---

## 7. What we are NOT claiming (honesty guardrails)

- We are NOT claiming Caribbean users hold a local-currency stablecoin.
  There is none onchain. We are claiming USD-pegged stablecoins are the
  right hedge, and that is provable.
- We are NOT claiming integration with JAM-DEX, SandDollar, or DCash.
  They are not onchain and have no public API we can settle against.
- We ARE claiming a future Carib$ integration is the long-term play —
  but only if/when Carib$ opens an API or deploys on a public chain.
- We ARE claiming the Guardian can monitor Caribbean inflation drivers
  today (STATIN, CBTT, ECCB, FAO, NHC) via Firecrawl — this is real and
  buildable.
- We ARE claiming the diaspora remittance corridor is the strongest
  immediate adoption path — Celo + MiniPay already serve this at <1%
  cost vs 6-10% traditional.

---

## 8. Competitive positioning for Future Caribbean 2026

### Where this strategy scores well

**Agentic AI Excellence (50%):** Unchanged — strong. The Caribbean
strategy adds a new Guardian intelligence diet (Caribbean inflation
signals, hurricane alerts, diaspora corridor optimization) which is
exactly the "thoughtful, distinctive, efficient" use of Agentic AI the
rubric rewards. The verifiable AI stack (0G evidence, chain-aware
ledger, multi-provider failover) is already best-in-class.

**Product Innovation (Business Strength):** Stronger with the Caribbean
plan. "Verifiable AI agent that protects Caribbean savings from imported
inflation and disaster disruption" is more category-defining than
"multi-chain agent protocol." The disaster-mode + diaspora-mode
features are novel and regionally specific.

**Product-Market Fit (Business Strength):** This is where the Caribbean
plan moves the needle — from "aspirational global" to "Caribbean-evidenced."
Jamaica food inflation (7.1%), diaspora corridor (US/UK/CA → Jamaica),
and hurricane Melissa (Dec 2025) are concrete, citable PMF evidence.
The plan scales across CARICOM/CSME — "scalability across multiple
markets" from a Caribbean base.

### Where this strategy still leaves gaps

**Team Quality:** Unknown — depends on founder/team narrative. No code
change fixes this; it is a grant-application narrative task.

**Caribbean native token:** We cannot show a Caribbean stablecoin
integration because none exists onchain. This is an honest limitation.
The mitigation is the USD-pegged thesis + Carib$ future partnership —
but a judge who expected "cJMD on Celo" will not find it.

**Caribbean user / partner evidence:** The strategy is designed but
not yet deployed with a Caribbean user. One LOI from a Caribbean MSME,
credit union, or diaspora remittance corridor would shift PMF from
"designed for" to "evidenced by."

### Net assessment

The Caribbean strategy moves DiversiFi from "partial fit" to "credible
applicant" for Future Caribbean 2026. The Agentic AI excellence is
already strong; the Caribbean plan fixes the PMF and product-innovation
gaps that a Caribbean-focused judge would penalize. The remaining gap
is team narrative + one piece of Caribbean user/partner evidence —
neither is a code problem.
