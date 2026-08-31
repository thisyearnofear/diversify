# Rails — regional savings & settlement lanes

## APAC Rail

*For the overall chain architecture, see [`architecture.md`](./architecture.md). For protection philosophies, see [`product.md`](./product.md).*

## Summary

The **APAC rail** is DiversiFi's **regulated-market savings and settlement home** for East and Southeast Asia (live on **HashKey Chain mainnet**, chain 177, pending deployer HSK gas). It is where **Confucian** and **Gotong Royong** protection plans execute when the user's goal is prudence, compliance-adjacent trust, and local market access — not maximum RWA depth.

It is **not** a replacement for Arbitrum (yield), Celo (EM local stables), Arc (x402 intelligence tolls), or 0G (evidence). It fills a **geographic + trust gap** the current four-chain stack does not cover.

**One-line positioning:** *APAC rail is where APAC-facing savings actions settle; Arbitrum still handles global yield; Arc still pays for intelligence; 0G still anchors reasoning.*

---

## The gap today

DiversiFi's chain stack is built around **where money is deepest or most local**:

| Rail | Job today |
|------|-----------|
| **Celo** | Regional Mento stables + savings ledger (Africa, LatAm, emerging markets) |
| **Arbitrum** | Deep liquidity + RWA yield execution |
| **Arc** | Micropayments to buy intelligence (x402) |
| **0G** | Evidence + verifiable compute |
| **HashKey (APAC rail)** | APAC savings ledger (Confucian / Gotong Royong + Asia region) |

The product already **detects** APAC users (`JP`, `HK`, `SG`, `PH`, etc. → `Asia` region) and ships **East/SE Asian protection philosophies** (**Confucian**, **Gotong Royong**). The roadmap names SE Asia onramps (**StraitsX**, **Coins.ph**).

What was missing was an **execution + trust home** for those users. A Confucian-plan saver in Tokyo previously routed through "Celo for some stables / Arbitrum for yield" — chains chosen for emerging markets and global DeFi, not for **APAC-regulated finance**.

The APAC rail closes that gap (code shipped 2026-07-10; mainnet deploy pending HSK gas).

---

## What the APAC rail is

| It is | It is not |
|-------|-----------|
| The chain where **APAC-facing savings actions settle** | Another yield chain |
| A **trust + compliance-adjacent** savings home | A replacement for Arc or 0G |
| The **Asia leg** of onramp → protect → offramp | A duplicate ledger for actions that already execute on Celo or Arbitrum |

**Leading candidate infrastructure:** [HashKey Chain](https://docs.hashkeychain.net/) — compliance-forward L1, APAC ecosystem ramps, and HSP (HashKey Settlement Protocol) for structured payment/settlement sync. Final chain selection is a product decision; the **rail role** is fixed regardless of vendor.

---

## What it offers users

### 1. A credible home for Confucian / Gotong Royong plans

Protection philosophies are culturally specific; execution chains mostly are not, for Asia.

With an APAC rail:

- **Confucian** → conservative stablecoin parking + low-volatility protection on infrastructure aligned with APAC regulated crypto markets
- **Gotong Royong** → community-first savings with SE Asia on-ramp partners that land on the same rail, not only abstract Celo/Arbitrum paths

Without it, "Confucian prudence" is branding. With it, **region → plan → chain** lines up.

### 2. A different trust model

| User type | Primary concern |
|-----------|-----------------|
| Celo saver | Local currency (KES, COP, PHP) |
| Arbitrum path | Yield depth |
| APAC saver | **Institutional credibility** — savings on rails their market recognizes |

Relevant for Japan / HK / Singapore retail, diaspora seeking stability without generic offshore DeFi framing, and future B2B treasury-lite where audit trails matter.

### 3. Completing the regional lifecycle

The roadmap already maps onramps by region. The APAC rail answers **where stablecoins live and get protected** after on-ramp:

```
Fiat (PHP / SGD / HKD / JPY path) → stablecoin on APAC rail → Guardian protects →
optional yield leg on Arbitrum → off-ramp to local fiat
```

- **Celo** owns Africa / LatAm legs
- **APAC rail** owns the Asia leg
- **Arbitrum** stays the **yield optimizer**, not the savings account

### 4. Settlement semantics beyond micropayments

| Layer | Role |
|-------|------|
| **Arc / x402** | Toll booth for intelligence API (sub-cent agent tolls) |
| **APAC settlement (HSP-style)** | Structured payment messages: request → confirm → receipt — for agent fees above micropayment size, user-visible rebalance receipts, partner integrations |
| **RecommendationLedger on APAC** | Immutable record that a savings decision happened **on that rail** |

Arc and APAC settlement are **different layers**, not duplicates.

---

## Guardian routing (ledger follows the money)

```
User region + protection plan + action type
        │
        ├─ EM local stable rebalance     → Celo ledger
        ├─ RWA / deep yield rotation     → Arbitrum ledger
        ├─ APAC conservative hold/save   → APAC rail ledger
        │
        ├─ Paid intel fetch              → Arc (always)
        └─ Reasoning evidence            → 0G (always)
```

### Example — Singapore user, Gotong Royong plan

1. On-ramp via StraitsX → USDC on APAC rail
2. Guardian: "HOLD 70% USDC, rotate 30% to yield"
3. **70%** recorded on **APAC ledger** (savings home)
4. **30%** executed on **Arbitrum** (e.g. USDY), recorded on **Arbitrum ledger**
5. Intelligence paid via **Arc**; reasoning anchored on **0G**

Arbitrum is not replaced — it is **specialized** for the yield slice. The APAC rail holds the trust-sensitive core.

---

## What it does not offer

| Misconception | Reality |
|---------------|---------|
| Better RWA yields than Arbitrum | No — keep Arbitrum for execution |
| Replacement for Mento local stables | No — Celo still owns cUSD / KESm / COPm / PHPm |
| Cheaper agent API payments | No — Arc stays for x402 |
| More verifiable AI | No — 0G stays for evidence |

If the APAC rail is added expecting any of the above, it is bloat.

---

## When to build

Build the APAC rail when committing to **Asia as a first-class market**:

1. **Confucian / Gotong Royong** get real default allocation paths on APAC, not generic Global Diversification
2. Pursuing **StraitsX / Coins.ph / HashKey-ecosystem** onramps within the product horizon
3. Shipping a **two-tier Guardian**: "park safely on APAC rail" vs "chase yield on Arbitrum" with user-visible clarity
4. Requiring **payment-grade audit trails** for agent actions in regulated markets

Skip when:

- Asia users are a negligible traffic share
- Maintaining another ledger + RPC + compliance story is not justified
- The rail would only duplicate receipts already on Celo or Arbitrum

---

## Implementation status

**Deployed on HashKey mainnet (2026-07-10).** Chain **177**, contract `0x3BCf7dFd68ce98880618c89A351168960724369C`. First APAC seed: [explorer tx](https://hashkey.blockscout.com/tx/0xc220dc0f991242ecef75086e625c24c889f93a9103daa996667f1d542011f1f8). Hetzner API runtime synced; Vercel frontend needs `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` for live banner. **FX Protection Insight #25** (2026-07-12, real per-cycle FX drag for a PHP importer, computed from live rates): [explorer tx](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b) — see [`strategy.md`](./strategy.md) § HSP Settlement & FX Protection Insight.

| Piece | Status |
|-------|--------|
| Chain config | ✅ `HASHKEY_LEDGER_CONTRACT` / `HASHKEY_RPC_URL` in the ledger registry (`recommendation-ledger.service.ts`), `hashkey` RPC endpoint in `foundry.toml`, explorer `https://hashkey.blockscout.com` |
| `RecommendationLedger` | ✅ `0x3BCf7dFd68ce98880618c89A351168960724369C` on chain 177 — seeded rec #1 (Confucian HOLD → USDC) |
| Guardian routing | ✅ `getLedgerChainForAction(action, token, routingContext)` — APAC-profile (`isApacRailProfile` in `types/strategy.ts`, single source of truth) savings/hold actions → HashKey 177; yield rotations → Arbitrum unchanged; Celo local stables → Celo unchanged |
| Guardian loop | ✅ `guardian-loop.ts` passes `deriveLedgerRoutingContextFromVault(vault.strategy)` on ledger writes (Asia region assumed for APAC philosophies until vault persists region) |
| Heartbeat | ✅ `guardian-heartbeat.ts` records an APAC-cohort savings advisory on HashKey in parallel with the primary beat when `HASHKEY_LEDGER_CONTRACT` is set |
| Proof feed | ✅ `GET /api/agent/zero-g-ledger` fans out across Arbitrum + Celo + HashKey when no user/chainId filter; `LiveProofCard` shows multi-chain headlines and per-receipt chain labels |
| UX | ✅ `constants/apac-rail.ts` + `apac-rail` contextual banner on Home/Shield — honest "coming soon" until `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` is set, then live copy + HashKey explorer link |
| Plan preview | ✅ Confucian / Gotong Royong allocations show APAC savings home (HashKey) + Arbitrum yield split in onboarding and Guardian wizard |
| Settlement (HSP) | ✅ Code complete, tests green (675/675) — see [`strategy.md`](./strategy.md) § HSP Settlement & FX Protection Insight. `HASHKEY` added as a fourth x402 settlement rail; a paid `fx_protection` insight settles zero-custody via HSP (EIP-712 mandate, REST-only client — no SDK dependency). Its ledger anchor is **region-canonical** (follows the money): an **APAC**-currency importer's record lands here on HashKey (payment + proof on one chain); an African importer's on Celo; else Arbitrum. **The anchor is proven live** — [rec #25](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b), HSK gas only, no Coordinator needed. HSP mandate/receipt settlement itself is blocked on Coordinator KYC (submitted, pending), not on more code; a plain-transfer settlement path (USDT on HashKey) is ready and needs only a funded payer wallet. |

Yield execution stays on Arbitrum. Intelligence stays on Arc. Evidence stays on 0G.

### Go-live runbook

1. Fund the deployer (`LEDGER_PRIVATE_KEY` address) with HSK on chain 177 (bridge: https://bridge.hsk.xyz)
2. `./scripts/deploy-all.sh hashkey`
3. Set `HASHKEY_LEDGER_CONTRACT` + `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` in `.env.local`
4. `npx tsx scripts/seed-mainnet-recommendation.ts hashkey` — first APAC savings record via real routing
5. `DEPLOY_SYNC_ENV=true ./scripts/deploy-to-hetzner.sh` — banner flips to live, heartbeat starts attesting, proof feed picks up HashKey receipts

### Hackathon submission

BUIDL copy, demo script, and checklist: see the go-live runbook above.

---

## Related docs

- [`product.md`](./product.md) — Protection plans, personas, multi-chain table
- [`architecture.md`](./architecture.md) — Guardian loop, ledger decorators, external services diagram
- [`roadmap.md`](./roadmap.md) — Post-9/10 fintech infrastructure and onramp provider map
- [`strategy.md`](./strategy.md) § HSP Settlement & FX Protection Insight — the HSP settlement rail + paid FX Protection Insight that anchors here


---

## Caribbean Rail — Future Caribbean 2026

**Status:** Drafted 2026-07-03. Updated 2026-08-04 — Caribbean rail shipped (FX netting engine + currency-risk data + API routes).
**Purpose:** DiversiFi's Caribbean positioning for the Future Caribbean 2026 competition (Finance, Payments & MSME Capital track). The Caribbean is the third regional rail alongside Africa (Celo) and APAC (HashKey) — global reach preserved, Caribbean added.

---

## 0. Current state (shipped 2026-08-04)

The strategic design in §1–8 below is now implemented. What shipped:

| Component | File | What it does |
|---|---|---|
| **Pan-Caribbean archetype** | `hooks/useFinancialStrategies.ts`, `strategy.service.ts`, `plan-preview.ts` | Full `pan_caribbean` strategy: AI prompt (imported inflation, BBD/XCD pegs, hurricane disaster-mode, diaspora corridors), plan preview allocation (cUSD 50% / PAXG 30% / cEUR 20%), selectable in onboarding under "Local prosperity" values lens |
| **Caribbean currency-risk data** | `constants/currency-risk.ts` | 5 Caribbean entries (HTG, JMD, TTD, BBD, XCD) — Jamaica is the evidence country (7.1% food inflation, Hurricane Beryl). Visitors from JM/BB/TT/HT now get the first-run "aha" risk moment. Dataset: 23 → 28 currencies |
| **Caribbean FX-drag region** | `packages/shared/src/services/fx-drag/regions.ts` | `'caribbean'` added to `FxRegion` + 7 currency codes (JMD, BBD, TTD, XCD, HTG, DOP, GYD). FX-protection records now anchor to the Caribbean rail's canonical ledger |
| **Caribbean ledger routing** | `pages/api/agent/x402-gateway.ts` | `FX_ANCHOR_CHAIN_BY_REGION.caribbean = 42220` (Celo — no native Caribbean chain; USD-pegged stables on Celo are the savings rail) |
| **FX matching engine** | `packages/shared/src/services/fx-netting/matching-engine.ts` | Pure functions: `matchIntents()` (pairwise currency matching at mid-market, no USD bridge — BBD↔JMD, GHS↔NGN, XOF↔XAF, any pair), `computeNetObligations()` (nets all pairwise flows to single cUSD obligations), `runNetting()` (full pipeline + savings reporting) |
| **Settlement plan generator** | `packages/shared/src/services/fx-netting/settlement.ts` | `buildSettlementPlan()` — region-aware ledger anchor params (action `FX_MATCH`, detects region from currency pair → routes to canonical chain: Africa/Caribbean/LatAm → Celo, APAC → HashKey) + cUSD transfer instructions + residual routing for unmatched intents |
| **Live rate adapter** | `packages/shared/src/services/fx-netting/rate-adapter.ts` | Bridges the fawazahmed0 currency dataset (200+ currencies) into the matching engine's `MidRateFn` |
| **Match API** | `pages/api/fx-netting/match.ts` | `POST /api/fx-netting/match` — accepts intents, runs matching at live mid-market rates, returns settlement plan, anchors each match to the RecommendationLedger (fire-and-forget) |
| **Intent API** | `pages/api/fx-netting/intent.ts` | `POST /api/fx-netting/intent` — wallet-authenticated intent creation + validation |
| **Tests** | `fx-netting/__tests__/` | 26 tests (matching + settlement, Caribbean + African currency pairs); 912 total tests pass |

### The track's build goal — delivered

| Track asks for | Delivered |
|---|---|
| Multi-currency matching (2–3 currencies min) | ✅ BBD↔JMD + GHS↔NGN + XOF↔XAF direct matching at mid-market (no USD bridge) — engine is currency-agnostic, any pair with a mid-market rate can be matched |
| Reduced FX cost vs traditional bank routes | ✅ $700 saved on $10,000 matched (7% corridor cost avoided) |
| Net settlement across multiple participants | ✅ `computeNetObligations` nets all pairwise flows to single cUSD transfers |
| Clear path to institutional integration | ✅ On-chain RecommendationLedger anchor per match (Celo) + 0G evidence trail; wallet-authenticated API with rate limiting |

### What remains

- **Priority 5a (done, first release)**: `CaribbeanFxNetCard` UI component — two-phase card (intent form → match review) in the Overview FX Corridor / business section. Reuses the pre-existing `useFxNetting` hook (read-only matching via `POST /api/fx-netting/match`); wallet-signed intent creation is available via `POST /api/fx-netting/intent` for the hosted-pool path. The chat drawer's `open_fx_netting_review` hand-off now lands on this card. Honest fallback when no counterparty pool is hosted yet ("your intent stays open for the next cycle").
- **Priority 5b (done)**: Guardian `FX_MATCH` recommendation type — `open_fx_netting_review` action on `GuardianRecommendationAction` + `buildFxNettingContract()` producer (`recommendation-contract.ts`); handled in the chat drawer's exhaustive switch; on-chain settlement already uses the `FX_MATCH` action.
- **Priority 6 (done)**: `isCaribbeanRailProfile` routing helper in `types/strategy.ts` (mirrors `isApacRailProfile`)
- **Next work to make it live**: ~~a hosted intent pool~~ **Done** — `models/FxIntentRecord.ts` (Mongo pool: remainingSell decrements, status advances `open → partially_matched → matched`, matchId audit trail) + `lib/fx-intent-pool.ts` (loadOpenPool / upsertPoolIntent / persistMatchOutcomes, DI-seamed for Mongo-free tests). `POST /api/fx-netting/match` now upserts body intents, loads the full open pool, matches, and persists outcomes (`poolSize` in the response); `POST /api/fx-netting/intent` persists (and `GET` lists the caller's intents). Remaining: settlement execution from the net obligations.

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

> **2026-08-04 update:** All §6 items shipped. The Pan-Caribbean archetype,
> strategy config, archetype token, AI prompt, ambient, and tests are live.
> Additionally shipped beyond §6's scope: 5 Caribbean currency-risk entries
> (Gap B fix), the `caribbean` FX-drag region (Gap A fix), the Caribbean
> ledger routing in `x402-gateway.ts`, and the full CARICOM FX matching +
> net-settlement engine (`packages/shared/src/services/fx-netting/`) with
> API routes (`pages/api/fx-netting/match.ts`, `intent.ts`). See §0 above.

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

> **2026-08-05 update:** The FX matching engine has been generalized from
> Caribbean-only to multi-region. It now handles African currency pairs
> (GHS↔NGN, XOF↔XAF) and any other pair with a mid-market rate. The
> settlement layer is region-aware: it detects the region from the matched
> currency pair and routes the ledger anchor to the canonical chain
> (Africa/Caribbean/LatAm → Celo, APAC → HashKey). 26 tests cover Caribbean
> + African pairs; 912 total tests pass.
>
> **2026-08-04 update:** The CARICOM FX matching engine + net-settlement
> layer is now shipped (the track's flagship build goal). The "Caribbean
> native token" gap remains honest — no onchain Caribbean stabletoken
> exists, so settlement happens in USD-pegged cUSD on Celo. The FX
> matching engine delivers the track's "BBD ↔ JMD — Direct" scenario:
> $10,000 matched, $700 saved (7% corridor cost avoided), zero net
> settlement capital needed (perfect mid-market match = capital efficiency).
> Remaining: UI component (`CaribbeanFxNetCard`) + Caribbean user/partner
> evidence (LOI from a Caribbean MSME or credit union).


---

## Implementation Plan: Arbitrum as an x402 Settlement Rail

## Goal

Enable the DiversiFi x402 Data Hub to accept USDC payments on **Arbitrum** (mainnet and Sepolia), so the Arbitrum buildathon demo can truthfully say:

> *"The DiversiFi Guardian keeps its treasury in USDC on Arbitrum and pays for premium intelligence directly on the same chain where it executes yield."*

This is a code-only extension of the existing env-gated settlement system. No new services, no new packages, no new gateway endpoints.

---

## Current State

The settlement layer is already env-gated via `SETTLEMENT_NETWORK` + `SETTLEMENT_ENV`:

- `packages/shared/src/services/settlement-service.ts` builds per-rail configs for `ARC` and `ZERO_G`.
- `pages/api/agent/x402-gateway.ts` already reads the active config via `getSettlementConfig()` and returns the right `chainId`, `settlement_network`, `settlement_env` in the 402/quote responses.
- `pages/api/agent/x402-metrics.ts` already derives explorer + stats from the active config.
- `SettlementNetwork` is currently `'ARC' | 'ZERO_G'`.

What is missing is an `ARBITRUM` rail in the config registry and the Arbitrum USDC addresses.

---

## Core Principles Mapping

| Principle | How this plan honours it |
|---|---|
| **ENHANCEMENT FIRST** | Extend `settlement-service.ts` and `config/index.ts`; do not create a new settlement service or gateway. |
| **CONSOLIDATION** | Delete the `settleOnArc`/`getArcSettlementStats` convenience re-exports if they are no longer used; collapse the duplicate Arbitrum USDC constant in `HYPERLIQUID_CONFIG` into `ARBITRUM_TOKENS`. |
| **PREVENT BLOAT** | Only one new rail entry in the existing `NETWORK_CONFIGS`. No new middleware, no new API route, no new analytics module. |
| **DRY** | Arbitrum USDC mainnet/testnet addresses come from the existing `ARBITRUM_TOKENS` / `ARBITRUM_SEPOLIA_TOKENS` constants. RPCs come from the existing `NETWORKS.ARBITRUM_ONE` / `NETWORKS.ARBITRUM_SEPOLIA` entries. |
| **CLEAN** | Settlement remains the sole responsibility of `settlement-service.ts`; the gateway remains payment-agnostic. |
| **MODULAR** | The rail is selectable at runtime, so tests can run against `ARBITRUM_SEPOLIA` without touching mainnet. |
| **PERFORMANT** | Reuses the existing provider/signer/USDC caches per `SettlementNetwork`. No extra RPC calls. |
| **ORGANIZED** | All network-specific constants stay in `packages/shared/src/config/index.ts`; all settlement logic stays in `packages/shared/src/services/settlement-service.ts`. |

---

## Step-by-Step Implementation

### Step 1 — Consolidate the Arbitrum USDC constant in config

**File:** `packages/shared/src/config/index.ts`

- `ARBITRUM_TOKENS.USDC` already holds the correct mainnet USDC address: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`.
- `HYPERLIQUID_CONFIG.USDC_TOKEN_ID` duplicates this value. Replace it with `ARBITRUM_TOKENS.USDC` so the Hyperliquid config points to the single source of truth.
- Ensure `ARBITRUM_SEPOLIA_TOKENS.USDC` is correct: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`.

### Step 2 — Add the `ARBITRUM` rail to settlement service

**File:** `packages/shared/src/services/settlement-service.ts`

1. Expand the type:
   ```ts
   export type SettlementNetwork = 'ARC' | 'ZERO_G' | 'ARBITRUM';
   ```

2. Add an `ARBITRUM` branch to `buildNetworkConfigs(env)`:
   - **testnet** (`SETTLEMENT_ENV=testnet`)
     - `rpcUrl`: `process.env.ARBITRUM_SEPOLIA_RPC_URL || NETWORKS.ARBITRUM_SEPOLIA.rpcUrl`
     - `usdcAddress`: `process.env.ARBITRUM_TESTNET_USDC || ARBITRUM_SEPOLIA_TOKENS.USDC`
     - `explorerBase`: `NETWORKS.ARBITRUM_SEPOLIA.explorerUrl`
     - `chainId`: `NETWORKS.ARBITRUM_SEPOLIA.chainId`
     - `name`: `'Arbitrum Sepolia'`
   - **mainnet** (`SETTLEMENT_ENV=mainnet`)
     - `rpcUrl`: `process.env.ARBITRUM_ONE_RPC_URL || NETWORKS.ARBITRUM_ONE.rpcUrl`
     - `usdcAddress`: `process.env.ARBITRUM_MAINNET_USDC || ARBITRUM_TOKENS.USDC`
     - `explorerBase`: `NETWORKS.ARBITRUM_ONE.explorerUrl`
     - `chainId`: `NETWORKS.ARBITRUM_ONE.chainId`
     - `name`: `'Arbitrum'`

3. Use the same `recipientAddress` pattern as the other rails (`DATA_HUB_RECIPIENT_ADDRESS` || `ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS`).

### Step 3 — Clean up unused convenience exports

**File:** `packages/shared/src/services/settlement-service.ts` and `packages/shared/src/index.ts`

- `settleOnArc` and `getArcSettlementStats` were created for the old Arc-only era. If nothing imports them, delete them. If they are still imported anywhere, evaluate whether those callers should use the generic `settleOnChain` / `getSettlementStats` with `DEFAULT_SETTLEMENT_NETWORK` instead.
- The goal is one generic settlement API, not per-rail shims.

### Step 4 — Update the package exports

**File:** `packages/shared/src/index.ts`

- No new exports are needed if `SettlementNetwork` and `SettlementConfig` types are already exported.
- Verify that `getSettlementConfig`, `SETTLEMENT_ENV`, and `DEFAULT_SETTLEMENT_NETWORK` remain exported (already done in previous commit).

### Step 5 — Verify the gateway is rail-agnostic

**File:** `pages/api/agent/x402-gateway.ts`

- Confirm it uses `getSettlementConfig()` for `chainId`, RPC, and USDC in `verifyOnChainPayment`.
- Confirm the 402/quote response uses `settlementConfig.chainId` and adds `settlement_network` / `settlement_env`.
- Remove any remaining Arc-specific language in comments.
- No new logic is needed; the gateway already works for any rail returned by `getSettlementConfig()`.

### Step 6 — Verify metrics are rail-agnostic

**File:** `pages/api/agent/x402-metrics.ts`

- Already uses `getSettlementConfig()` for `explorerBase` and `getSettlementStats(DEFAULT_SETTLEMENT_NETWORK, ...)`.
- No changes needed.

### Step 7 — Document the new env vars

**File:** `.env.example`

In the "MAINNET FLIP" section, add an Arbitrum block:

```bash
## Arbitrum settlement (USDC-native, deep liquidity, already-live mainnet)
ARBITRUM_ONE_RPC_URL=
ARBITRUM_SEPOLIA_RPC_URL=
ARBITRUM_MAINNET_USDC=          # defaults to 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
ARBITRUM_TESTNET_USDC=          # defaults to 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

Also update the comment to note that **Arbitrum is the only rail with a verified, live mainnet USDC contract today**, so it is the natural choice for the buildathon demo.

### Step 8 — Update tests

**File:** `packages/shared/src/services/__tests__/settlement-service.test.ts`

Add a new describe block:

- `SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=mainnet` returns `chainId` 42161, `explorerBase` `https://arbiscan.io`, `usdcAddress` `ARBITRUM_TOKENS.USDC`.
- `SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=testnet` returns `chainId` 421614, `explorerBase` `https://sepolia.arbiscan.io`, `usdcAddress` `ARBITRUM_SEPOLIA_TOKENS.USDC`.
- Override via env var works (e.g. `ARBITRUM_MAINNET_USDC=0x...`).

### Step 9 — Update docs

- `docs/integrations.md`: add `ARBITRUM` to the settlement-rail table and note that it is the only rail with a live, verified mainnet USDC contract today.
- `docs/README.md` § Getting Started: mention Arbitrum as a settlement option, especially for the buildathon.
- `docs/roadmap.md`: update the mainnet settlement blocker to state that Arbitrum is now a supported rail and is the preferred path for the buildathon.
- `README.md`: update the Money Movement / x402 Settlement Stack section to include Arbitrum.

### Step 10 — Verification & deploy

1. `pnpm build`
2. `pnpm test`
3. `pnpm lint`
4. Fund the agent wallet (`VAULT_PRIVATE_KEY`) with Arbitrum Sepolia USDC for testnet validation, or Arbitrum mainnet USDC for the live demo.
5. Set `SETTLEMENT_NETWORK=ARBITRUM` and `SETTLEMENT_ENV=mainnet` (or `testnet`) in `.env.local`.
6. Deploy with `DEPLOY_SYNC_ENV=true ./scripts/deploy-to-hetzner.sh`.

---

## Expected Demo Behaviour

With `SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=mainnet`:

```bash
curl https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis
```

returns:

```json
{
  "error": "Premium Source Required",
  "amount": "0.004",
  "currency": "USDC",
  "chainId": 42161,
  "settlement_network": "ARBITRUM",
  "settlement_env": "mainnet",
  "recipient": "0x...",
  ...
}
```

The buyer sends a USDC transfer on Arbitrum mainnet to the recipient. The gateway verifies it on `arb1.arbitrum.io/rpc`, settles the intelligence, and returns `_billing.explorer` links to Arbiscan.

`GET /api/agent/x402-metrics` will report:

```json
{
  "settlement": {
    "network": "ARBITRUM",
    "env": "mainnet",
    "name": "Arbitrum",
    "explorerBase": "https://arbiscan.io"
  }
}
```

---

## Funding & Operational Notes

- **Mainnet demo:** `VAULT_PRIVATE_KEY` must hold real Arbitrum USDC + a small amount of ETH for gas. The recipient address (`DATA_HUB_RECIPIENT_ADDRESS`) must also be funded or at least able to receive USDC.
- **Testnet validation:** Arbitrum Sepolia USDC is available from the Circle testnet faucet. This is the recommended way to verify the integration before risking mainnet funds.
- **Gas:** each `USDC.transfer` on Arbitrum costs ~$0.01–$0.05 in gas. The intelligence payment itself is $0.001–$0.01, so gas is the dominant cost at tiny payment sizes. For the demo, this is acceptable; for production, batching/credits already amortize this.

---

## What This Delivers for the Buildathon

1. A **true Arbitrum mainnet payment story** for the x402 intelligence gateway.
2. A **single-config mainnet flip** (`SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=mainnet`) backed by verified Circle USDC.
3. No new architecture, no new services, no new endpoints — just a new rail in the existing, tested settlement system.
4. Full backwards compatibility with the current `ZERO_G` testnet default; the old Arc/0G paths remain untouched.
