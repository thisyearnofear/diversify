# DiversiFi — Project Overview

**Future Caribbean Global AI Buildathon 2026 — Finance, Payments & MSME Capital track**

> Companion documents: [Logbook](./logbook.md) (build-in-public record) · [Architecture](../architecture.md) · [Setup](../setup.md) · [License](../../LICENSE) (MIT)
> Live proof: RecommendationLedger `0x3BCf…369C` on Celo/Arbitrum/HashKey/0G mainnet · Agentic ID `0x6815…33D60` on 0G mainnet

---

## Problem statement

The Caribbean does not operate as a unified financial system. A hotel in Trinidad paying a supplier in Jamaica routes **BBD → USD → JMD** through correspondent banks that charge a ~7% corridor cost, take days, and depend on infrastructure outside the region. The region already has the liquidity — **it cannot see or coordinate it.**

At the same time, 80–90% of Caribbean businesses are MSMEs operating with no structured financial visibility: their savings sit in currencies that quietly depreciate (JMD −22% vs USD over 3 years; food inflation 7.1% in Jamaica after Hurricane Beryl), and their FX conversions bleed 7% per cycle. This is not a capital opportunity. It is a **coordination and infrastructure opportunity**.

## Solution

**DiversiFi** is a risk-aware treasury and FX-coordination layer: two connected systems, one platform.

### 1. The FX coordination layer (core of this submission)

A working prototype of the CARICOM FX Swap Network brief — **match, net, settle**:

- **P2P FX matching engine** (`packages/shared/src/services/fx-netting/matching-engine.ts`): businesses post intents (sell X, buy Y, with deadline). Opposing needs match **directly at mid-market — no USD bridge**. BBD↔JMD, TTD↔BBD, GHS↔NGN, any pair. Partial fills supported.
- **Net settlement layer**: many pairwise matches aggregate into few net obligations per settlement chain, minimizing capital requirements and on-chain transactions. Cross-region flows are never netted together (region-canonical settlement: Caribbean/Africa → Celo cUSD, APAC → HashKey USDT).
- **Hosted intent pool**: an intent posted today is matched by a counterparty tomorrow — coordination across time, not just simultaneous discovery (the honest answer to thin two-sided liquidity).
- **Zero-custody settlement execution**: the debtor pays from their own wallet; the server verifies the ERC-20 Transfer **on-chain** (right token/debtor/creditor/amount) before marking settled, then anchors an `FX_SETTLE` receipt to the ledger. No one ever holds user funds.
- **Quantified savings**: every match reports savings vs. the traditional corridor (default 700 bps, from regional remittance-cost averages) — the system *measures* the value it creates per the track's "measurable outcomes" bar.
- **DiverseFi Guardian (agentic layer)**: an autonomous-but-bounded advisory agent runs on a cron heartbeat, recording cohort-labelled recommendations on-chain (including a Caribbean-cohort advisory on Celo), with human-in-the-loop execution: autonomous action only inside user-signed permission bounds, everything else is advisory.

### 2. The savings surface (liquidity on-ramp)

A mobile-first app that shows visitors their own currency's depreciation vs. USD/EUR/gold (28 currencies, 5 Caribbean), lets them choose a values lens (Pan-Caribbean, Africapitalism, Buen Vivir, Islamic Finance…), and renders a protection plan. Diaspora members and SMEs arriving for savings become the FX layer's matched flows — **remittance capital redirected into coordination, not consumption**.

### Why this is a system, not an app

The bar set by this track: *"Strong teams build financial infrastructure. Weak teams build apps."* The netting engine is currency-agnostic infrastructure (built Caribbean-first, generalized on day two), the settlement layer is chain-configurable per region, and the intent pool is a market-design primitive. The same engine that nets BBD↔JMD nets GHS↔NGN — the Caribbean deployment is the first instance of a global pattern.

## Business model & go-to-market

**Business model:**
- **FX netting fee (primary):** a small bps fee on matched-and-settled volume — priced at a fraction of the ~700 bps corridor it replaces; the engine already computes the savings split per match, which is the sales conversation.
- **Institutional dashboard (B2B):** banks, credit unions, and MSME lenders see netting liquidity, cohort risk, and verifiable audit trails (on-chain receipts) via API or decision-support dashboards.
- **Stablecoin treasury management (prosumer tier):** the savings surface graduates SMEs from "protected savings" to "managed treasury" — the funnel from remittance to business banking.

**GTM (sequenced, realistic):**
1. **Now:** open-source prototype + live mainnet proof (this submission); build-in-public to regional fintech communities.
2. **Post-buildathon:** 2–3 design partners (a Jamaican MSME importer + a Barbadian tourism operator is the canonical matched pair) under LOI; run netting on their real corridors with stablecoin rails.
3. **Then:** integrate one regional PSP/bank as liquidity provider; regulator conversations with the on-chain audit trail as the compliance story.
4. **Scale:** the engine is region-configurable — the CARICOM design generalizes to other fragmented-currency regions (the codebase already routes Africa, LatAm, APAC).

## Impact & scalability

**Evidence of validation (early, honest):**
- **Live mainnet, 5 chains:** ledger receipts incl. Caribbean-cohort advisories and FX anchors, explorable on Celo/Arbitrum/HashKey/0G explorers; Agentic ID minted on 0G mainnet.
- **1,169 tests / 144 files green**; MIT-licensed public repo with ~1,000 commits documenting every step (see [Logbook](./logbook.md)).
- **Honest limitation:** no live institutional volume yet. The prototype demonstrates the full path — intent → match → net → on-chain-verified settlement — with the savings math computed per run. Partner LOIs are the explicit next milestone.

**Path to deployment & global scaling:**
- Deployment path: stablecoin rails already live on mainnet (cUSD on Celo); the incremental work is partner onboarding and jurisdiction-by-jurisdiction compliance wrappers, not new architecture.
- Global scaling: the matching/netting engine is currency- and region-agnostic by construction — the codebase's region registry (Africa, Caribbean, LatAm, APAC) is the expansion map. A CARICOM system that works becomes the template for every fragmented-currency region — which is most of the world.

---

## Compliance & Responsible AI Statement

**Data privacy & protection.** DiversiFi is architected to minimize personal data. The savings app runs walletless-first: a visitor's country is detected via IP geolocation (coarse, non-identifying) and stored, if at all, only as a region code. The first-party analytics funnel records anonymous, aggregate events (no identifiers, DNT-respected, 90-day TTL). The FX intent pool stores *currency amounts and deadlines* — the minimum needed to match — not names or account data; settlement happens wallet-to-wallet with no intermediary holding funds or identities. Wallet addresses are pseudonymous by nature and are only ever processed to verify a settlement the user themselves initiated. Waitlist emails are stored plainly and are the dataset we would migrate to encrypted-at-rest storage before any scale deployment.

**Regulatory awareness.** GDPR/CCPA principles (purpose limitation, data minimization, deletion on request) are treated as design constraints, not afterthoughts: the datasets are small and deliberately shallow. As a finance-adjacent system, we track the relevant perimeter honestly: today DiversiFi is non-custodial software that never holds user funds, which keeps it outside licensing perimeters in most jurisdictions — but the institutional netting tier (§ Business model) would operate inside KYC/AML obligations, so the architecture already separates the *matching* layer (data-light, could sit inside a regulated entity) from the *settlement* layer (on-chain, auditable). Caribbean data-sovereignty considerations are respected by region-canonical settlement: Caribbean flows settle on the region's chosen rail rather than being routed through external infrastructure by default. The EU AI Act is monitored for relevance; the Guardian's recommendations are advisory with human confirmation, not autonomous high-risk decisions, and every recommendation is anchored with its reasoning to tamper-evident storage — a transparency trail that exceeds current disclosure norms.

**Bias mitigation, safety, ethics.** The AI layer coordinates rather than decides: match outcomes are computed by deterministic, pure functions (reviewable in `fx-netting/matching-engine.ts`), not model inference — the LLM advises and explains, and never executes outside user-signed bounds. Currency-risk data is curated from public sources and labeled with as-of dates; we show depreciation as neutral data and never prescribe a specific currency move — the user's values lens (including faith-based and regional lenses) shapes presentation, not the underlying math. Prices that are estimates are labeled as estimates; stale data is labeled stale; demo data is labeled "Sample data" — the product is engineered so nothing renders a state that cannot become true.

**Security practices.** No custodial keys server-side for user operations; settlement verification reads on-chain state rather than trusting client claims; signer credentials are scrubbed from test environments by an automated tripwire; the pre-push gate runs the full test suite (1,169 tests) on every push.

**Limitations & risks, managed.** Thin two-sided liquidity is the honest risk for any netting market: the hosted intent pool mitigates it across time, and the residual plan routes unmatched needs to conventional rails rather than pretending. Smart-contract risk is contained because settlement is plain ERC-20 transfers verified post-hoc — there is no vault holding funds. Oracle risk: mid-market rates come from multiple named sources with staleness labels. These limitations are stated in the product itself, not just this document.

**Licensing.** MIT (permissive, per the buildathon's recommendation): maximum adoptability for regional fintechs and institutions, which for infrastructure is the point. The license grant is compatible with commercial deployment by partners while keeping the reference implementation open.

*(~490 words)*
