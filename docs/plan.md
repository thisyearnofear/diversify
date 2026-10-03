# Plan

Forward-looking work only. The trust model it serves: [`guardian.md`](./guardian.md).
Positioning: [`product.md`](./product.md). Chains, rails and settlement state:
[`architecture.md`](./architecture.md). Dated history:
[`history/roadmap-log.md`](./history/roadmap-log.md). Closed grant tracks and past
submissions: [`archive/`](./archive/) — reference, not roadmap.

**Ordering rule:** priority 1 is the work that makes the product's one claim true.
Nothing that earns money or adds surface ships ahead of it.

---

## Three priorities

| # | Priority | Why this order |
|---|---|---|
| **1** | **Make the claim true** — build useful deterministic candidates on the closed authority boundary, then decide on ERC-7710 | Verifiability *is* the differentiator; a claim that outruns the code is not tech debt, it's a lost moat. Every row below inherits this gate. |
| **2** | **Make it earn** — Phase 0 compliance exit gate, then disclosed fee capture | No swap fee is collected on any route today, so volume earns $0; and nothing that earns or promotes may ship before counsel signs off. |
| **3** | **Make the plan model hold** — exposure-based plans, chain-capability matrix | Direct user feedback (customising a philosophy doesn't work) plus both production swap bugs were chain-list class failures. |

---

## 1 · Guardian determinism — gating work

The four legacy authority paths now fail closed; the [audit](./guardian.md#where-the-model-still-decides)
records their safety boundaries. A deterministic allocation-repair optimizer now
uses authenticated wallet identity, saved targets, pinned-block balances, and
independently dated prices. It proposes same-chain, review-only moves and
quantifies pre-fee allocation drift, not returns or savings:

- Legacy research analysis returns code-owned HOLD. Model output is bounded
  commentary only, not an action, token, chain, risk level, or savings number.
- Analysis-owned swap, bridge, hedge, and simulated execution paths are removed.
  Any future execution must use verified permission and common authorization gates.
- Without validated calculations, savings are absent and portfolio risk is UNKNOWN.
  Notifications do not invent zero savings or annualize an unsupported estimate.
- Firecrawl rejects unknown sources. The stablecoin monitor independently
  retrieves provider prices and observation dates; deviations above 1% with
  evidence no older than five minutes can record measured price signals.
  Other page changes remain unverified observations. Neither path queues trades.
- Guardian's allocation inspector passes exact token quantities to Exchange,
  discards cached quotes, and leaves execution to the user's review/signature.

Next: rehearse the server measurement path against live providers, expand
source-specific adapters beyond stablecoin prices, and enforce venue/asset policy
in owner-authorized on-chain delegations before enabling richer autonomy.
Preserve the disclosed ERC-20 savings scope and fail closed on unavailable data.

**Unification** (the longer-term reasoning domain, staged with golden
tests): ONE reasoning domain — signals → deterministic synthesizer floor →
optional AI rank/explain within the gates → pure `GatesEvaluator` → one artifact +
one on-chain reasoning builder. Draft:
[`internal/guardian-reasoning-service.md`](./internal/guardian-reasoning-service.md).

**Decision to make, not work to do:** ERC-7710 on-chain policy beyond a spend
grant is the single largest gap of this shape. Either fund it as its own slot or
keep saying *bounded* rather than *constrained*. Do not let the docs drift into
the stronger word by default.

**Standing check** — the claims-vs-implementation audit for every "verified" /
"anchored" / "enforced" / "live" claim now lives in
[`guardian.md`](./guardian.md) § Standing check. Run it before any release
touching verifiability surfaces.

## 2 · Monetisation — compliance first, then fees, then the thesis layer

Full phase detail: this section is the live summary; the original plan file is
merged here.

**Why these routes.** The savings app is a strong base and the lowest-return part
of the business. Two higher-return routes sit on the same architecture: FX spread
on volume (revenue mechanism), Guardian FX-risk management for businesses with
recurring cross-currency payables (volume engine), and the thesis layer —
"currencies are the original memes" — dated, cited sovereign-debt facts that give
retail a reason to act and share (distribution layer; every move it drives pays
the route-1 spread).

**Arithmetic of the target.** As of 2026-09-29 no swap fee is collected on any
route (LI.FI sets an `integrator` but no `fee`; 1inch/Uniswap/Mento pass none; the
Guardian executor hard-codes `swapFee = 0`). $1M/day gross at candidate take
rates: 0.10% → $365k/yr · 0.25% → $912k/yr · 0.50% → $1.83M/yr · 1.00% →
$3.65M/yr. Reaching $1M/day needs ~20,000 retail swaps at ~$50, or 20–50 business
payments at $20–50k (≈150–300 active importers on weekly/fortnightly cycles) —
i.e. the volume comes from businesses; retail is brand, trust and funnel.

**Phase 0 — compliance foundation (gates everything).** Entity + counsel opinions
on: fee-bearing non-custodial interface as regulated CASP/broker activity (EU
MiCA, Ghana VASP Act 1154, Nigeria SEC, US money-transmission/adviser); whether
Guardian proposals are personal recommendations; UK financial-promotion rules;
data protection (GDPR, Nigeria NDPA). Shipped in code 2026-09-29: jurisdiction
switches default-off (`config/jurisdictions.ts`), sanctions geo-block (451 →
`/restricted`) + wallet screening before every swap with prescreen and 20 req/min
per-IP limit, legal page drafts `noindex` until `NEXT_PUBLIC_LEGAL_APPROVED`,
retail perps off with PAXG spot substitution, no streaks/badges for real-money
swaps.
*Still open:* counsel's written answers + `[COUNSEL: …]` placeholders (brief
outline: [`archive/compliance-competitors-2026-10.md`](./archive/compliance-competitors-2026-10.md)
§4); the direct-Hetzner geo gap (heavy routes are rewritten from Vercel to Hetzner, so a
direct call to the Hetzner host bypasses the Vercel proxy geo-block — close with an
origin allowlist (Host + secret header) or GeoIP at the reverse proxy, runbook in
`reference.md` §7); rate-limit store shared across instances (Upstash Redis or
Mongo) before fees make "unavailable" fail closed. Screening is keyless today
(Chainalysis on-chain oracle on Celo, Arbitrum fallback — best-effort by
Chainalysis's own caveat; daily probe + free API key for redundancy) so autonomy is not
blocked on a missing key; `jurisdictions.ts` entries need `last-reviewed + source`
comments.

**Phase 1 — disclosed fee capture.** `config/fees.ts` bps by tier + treasury per
chain + per-jurisdiction switch; every quote shows the fee line **in-app before
the wallet prompt**, receipt repeats it, `getEstimate` returns `feeUSD`. Capture
per route: LI.FI `fee` + registered integrator/fee wallet; 1inch `fee` +
`referrer`; **Uniswap Trading API `integratorFees`** on `/quote` (up to 4
recipients, ≤500 bips total; multi-recipient needs `x-universal-router-version:
2.1.1` and exact-input) — prefer the API fee path wherever the Trading API is
already the quote source; Mento and any on-chain-only Uniswap V3 path outside the
Trading API still need a small audited `FeeRouter` (Foundry, `contracts/`) that
pulls input, routes the fee to treasury and swaps for the user in one approve +
one swap, or stay fee-free until that audit. Guardian 7710 batches add a fee
transfer leg. Invariant tests: fee shown = fee taken, every route collects or is
explicitly exempt, jurisdiction off ⇒ $0. Revenue ledger: `fee_collected` event +
`pnpm reconcile-fees`. Starting tiers to validate: ~0.5% retail, 0.15–0.3%
business (context: MetaMask 0.875%, card/bank FX 1–3%, global remittance ~6%).

**Phase 2 — thesis dataset** (curated, dated, cited):
`constants/sovereign-debt.ts` on the token-provenance pattern — per-issuer debt,
interest as % of revenue, currency drift from the corridor data, `asOf`, source
URL, 90-day re-verify; tests enforce fields; no entry ⇒ nothing renders. US live
from Treasury Fiscal Data ("Debt to the Penny") labelled with its publication
date; others hand-entered from IMF/central-bank releases. Scope: issuers the app
can execute (USD, EUR, GBP, JPY, NG, GH, KE + Mento corridors). No legal
dependency for the dataset; its surfacing has one.

**Phase 3 — in-app surfaces.** Depth layers apply: new facts enter at L2
inspector / L3 Ask Guardian. Issuer panel in the pair inspector (both sides,
dated, cited); personal framing in Home's region inspector behind the balance
privacy switch; release-driven dated `LiveLine` beats; Ask Guardian grounded via
`formatPairFacts` + debt facts with the no-prediction rules held. Persona-correct
framing is **config, not model output** — an EM saver sees "the dollar is less
safe than it looks — consider gold alongside it", never "leave the dollar".

**Phase 4 — thesis moves (monetised).** Three curated themes (e.g. Debasement
hedge, Dollar drift, Local-currency floor), each with case **and** counter-case,
the 1y/3y/5y time machine honest both ways, and a Guardian-enforced size cap
(e.g. ≤10% of savings per theme). No leverage, no perps. Adopt = one-tap proposal
→ Exchange prefilled `origin: thesis` → receipt, Phase 1 spread applies. Where
counsel requires: appropriateness check + first-time cooling-off, switched per
jurisdiction. Copy is general information + a sized scenario the user chooses —
never "you should" — and is counsel-approved before launch.

**Phase 5 — virality + engagement assets.** ✅ Stamps/postcards shipped
2026-09-29 (curated dated facts as seals pressed onto a move, one `StampSheet`
behind three L2 doors; `/postcard/[from]/[to]` + `/api/og/postcard` resolve every
number from stamp IDs, never URL params; no user text, no feed, no rewards — zero
moderation surface; open question is whether people enjoy pressing and sharing:
`stamp_sheet_open`, `stamp_press`, `postcard_share`). Remaining: `/debt/[code]`
public page + OG card (dataset-derived, no numeric params); "interest clock"
share asset derived from a cited annual figure and labelled derived (static on
the card, never a ticking in-app widget); "theme adopted" card — theme + dated
fact, never amounts or returns; Farcaster frame; referrals as recognition only.
`hasHype` guard on all thesis and share copy; no coordination language; no token.

**Revenue routes:** swap spread (tiered, disclosed) · thesis moves (same spread,
multi-leg volume) · business tier (payment-cycle protection subscription + lower
spread, KYB via partner, parallel after Phase 1) · data licensing (debt + FX-drag
datasets via the `x-api-key` gateway) · paid Protection Review ($1 artifact,
deployment-dependent) · partner shares (onramp, vault referrals — only if
disclosed and never influencing Guardian recommendations).
**Rejected:** own token, sponsored themes, paid placement, returns-bragging cards,
monetary referral bonuses, leveraged retail products.

**Metrics:** share → visit → move conversion per asset · revenue per move · fee
shown vs collected (reconciled) · volume/month retail vs business against $1M/day
· compliance health (screening blocks, geo declines, last re-verify date).

**Order:** Phase 0 gates all · 1 and 2 in parallel after 0 · then 3 · then 4 once
copy is approved, with 5 alongside 4.

## 3 · Exposure-based plans

Plans become **exposures** (USD, EUR, KES, gold…) with bands, not tickers;
holdings score by exposure on any chain; the floor is the user's anchor currency;
the Guardian suggests tilts within bands while code picks the token and chain and
validates every suggestion. Trigger: customising a philosophy doesn't work today
(Custom has no legs; the Guardian uses a different target model than the ring) and
non-Celo recommendations lose their chain. Five PRs — design detail:
[`internal/exposure-plans.md`](./internal/exposure-plans.md).

1. **Chain-honest execution** — kill the `rebalance.ts` → cEUR coercion, carry
   `toChainId` end to end.
2. **Exposure registry + scoring.**
3. **Anchor currency** as the plan floor.
4. **Guardian tilts** within bands + the scenario suite.
5. **Custom plan editor** — give Custom real legs or remove it.

## 4 · Chain-capability matrix

One `getChainCapabilities(chainId)` contract in `packages/shared` replacing five
divergent "supported chain" lists (swap-executable, wallet-addable, token-map,
RPC, `getTokenAddresses` fallback). Phase 0 ✅ shipped 2026-09-27
(`config/chain-capabilities.ts`; swap/wallet/daily-limit lists delegate; invariant
tests; fixed the daily-limit list naming retired Alfajores). Remaining: merge the
duplicated `NETWORKS`/`NETWORK_TOKENS` config between `apps/web/config` and
shared · kill the silent Celo fallback in `getTokenAddresses`/`getChainAssets` ·
surface chain notices and a swap error taxonomy in the UI.

## 5 · SME FX — the commercial destination

Thesis: any business that earns in one currency and must purchase in another
carries FX risk on working capital during the window between sale and supplier
payment. The rails for moving that money (Waza, Juicyway, Cedar Money, Yellow
Card…) are crowded and well-capitalised; the **risk quantification + autonomous
protection layer on top of them is unserved**. The Ghanaian importer is the wedge
because cedi volatility makes the bleed undeniable; the problem is not African, it
is universal — it scales with volatility, not geography.

Funnel, one person at two levels of trust: retail (trust) → business (revenue) →
protocol (rails players license the intelligence + Guardian-as-a-service). The
graduation moment is designed, not hoped for — the retail scorecard shows what
holding local currency cost, the business version shows cost per purchase cycle,
CTA is "run this on your business."

Shipped: purchase-cycle data model (wallet-signed CRUD, address derived from
signature, never a client `userAddress`), per-cycle FX drag report (Shield/Home,
walletless), cycle-aware Guardian execution with **fail-closed** scoping —
`CYCLE_PROTECTION` auto-execution restricted to Celo-only permissions and verified
Mento funding rails (KES/COP/PHP/BRL → cUSD), per-cycle idempotency, two-tick
no-double-execute tests, unsupported currencies advisory-only, second-stage
consent via `Permission.autoExecuteCycleProtection`, reserved server-origin fields
rejected on browser writes. The behaviour-based graduation prompt on Home is
**live** (`lib/graduation-prompt.ts`, `hooks/use-graduation-signal.ts`,
`pages/api/agent/business/graduation-signals.ts`, rendered in
`ConnectedOverview.tsx`) — an earlier strategy doc still says otherwise; that line
is stale.

Remaining: the importer `FinancialStrategy` archetype (config sketch + Shield ring
morph, no new tabs — the archetype lives inside the existing app until demand
forces a split) · graduation-funnel **measurement** (conversion, not the prompt) ·
a GHS on/off-ramp partner (partnered, never built — partner-not-build: we stay
non-custodial intelligence, a licensed rail onboards; see the archived compliance
brief §2) · a rails design partner (LOI)
· the business dashboard + enterprise endpoints behind
`NEXT_PUBLIC_BUSINESS_DASHBOARD_ENABLED`, gated on prior phases proving per-cycle
value. Report engine is USD-targets-only today; generalise when a non-USD-target
cycle is real.

Market evidence, competitor numbers, and the HSP settlement record are archived
with their dates at [`archive/strategy-2026-07.md`](./archive/strategy-2026-07.md)
— figures there are 2024–2026 vintage with no re-verification schedule, so treat
them as dated claims, not current numbers.

## 6 · Instrument lenses

A lens is a state of a tab's existing object, entered through the transition slot
and left via an in-object "←" — preview-only (design-language §5). Shipped:
**Concentration** (Home) · **Stronger floor** (Shield) · **Decision window**
(Exchange, opens only on fresh dated macro beats ≤14 days, never a predicted
direction). Pending: **Reality** (only if the ticket's staples rows prove
insufficient) · **Scenario** (needs a curated dated `scenarios.ts` registry with
asOf + 90-day re-verify before any UI).

## 7 · Verification and open items

- **Macro signal write path — prove it in production.** All five deployed ledgers
  hold **zero** `MACRO_SIGNAL` records (1,610 scanned; only `ADVISORY_HEARTBEAT`
  and `EVIDENCE_MIRROR` families present), so the beats engine has no data source
  yet. Unblocked 2026-09-28: both Firecrawl env vars are in `required-env.json`
  (the deploy gate now fails if either is absent), the key is on the server, all 7
  monitors are registered (ECB, Fed, DeFiLlama yields, stablecoin depeg, STATIN
  Jamaica CPI, T&T central bank, NHC cyclones), the runtime is redeployed, and the
  webhook returns 401 to unsigned POSTs. Signals arrive on monitor schedules —
  exercise on demand with `pnpm rehearse-macro-signal`. The capture playbook
  depends on a real anchored signal.
- **Signal-lens shadow evaluation.** Server-only structured review of public
  macro-source changes is shipped behind `ENABLE_TYPESAFE_SIGNAL_LENS=false`.
  Free and non-authoritative: it records calibrated materiality / category /
  urgency / source-quality comparisons without touching Guardian queueing,
  permissions, or execution. Run the shadow cohort, review precision and latency
  and fallback data, then decide whether to offer a visible opt-in lens — and
  eventually monetise broader coverage, not basic safety. The paired
  Ask-the-World router (`ENABLE_TYPESAFE_ASK_WORLD_SPIKE`) routes skeletons into
  deterministic facts and never invents numbers.
- **0G Data Availability — deliberately not integrated.** Storage-first is the
  architecture: durable evidence bundles and recoverable state snapshots use the
  supported TypeScript Storage SDK. 0G DA is a distinct Go/gRPC product for
  high-throughput rollup-style availability, not a drop-in archival replacement.
  Revisit only with a concrete high-frequency execution-state workload — and never
  describe Storage as DA again (audit finding #1).
- **Yield engine.** Robinhood Earn diligence (7% insured USDG via Morpho, Lloyd's
  cover, non-custodial, Arbitrum Orbit L2) — regulatory posture and USDG
  availability in target markets before wiring; context (2026-10): Uniswap reports
  dominant DEX share for tokenized equities and deep Uniswap deposits on
  Robinhood Chain, UniswapX v3 lists chain 4663 — **watch**, not in-app execution.
  PAXGy (Paxos yield-accruing gold receipt, launched 2026-09-24) — **watch**;
  spot PAXG on Arbitrum remains the commodities leg, do not substitute; revisit
  only if it's live on an executable chain with curated provenance. Alchemy infra
  swap (better RPC + token-balance API could retire the ethers multicall in
  first-load). Parked: ZeroDev (rejoin the wallet/AA track), Dune, Fhenix. Open
  questions: payment auth for vaults.fyi x402 calls (operator wallet vs existing
  rail); resell recommendations per-call or bundled into a tier.
- **Product quality.** axe-core CI pass is unverified from the closed 14-day plan.
- **Comprehension sessions.** Not run yet. Protocol is in
  `product.md` § Comprehension sessions; recruitment is pending. Record consented
  observations verbatim — never invent conversion metrics or completed sessions.

## 8 · Track status

**Closed — archived, do not plan against these:** 0G Bridge buildathon (all five
waves delivered; 0G remains the evidence substrate and the architecture detail is
live in `architecture.md`) · HashKey Horizon (ledger deployed and seeded on chain
177 since 2026-07-10; the APAC savings rail stays behind the "coming soon" banner
until `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` is set, and savings decisions do not
route there before then) · Celo Prezenti · Arbitrum Open House · Future Caribbean
(rail parity, settlement execution, credit-layer embryo and liquidity bootstrap
all shipped; the partner LOI never arrived) · SERV Hackathon Ed. 01 · Qwen
MemoryAgent · Enterprise tier B2B (API-key gateway + audit export shipped; x402
settlement env-gated; no licensing customer) · 14-day product quality plan.
Material: [`archive/`](./archive/), [`history/roadmap-log.md`](./history/roadmap-log.md).

**Still live work, not tracks:** items 1–7 above.

**Codebase rule:** do not delete Arc infrastructure (`ArcAgent`, Curve/AeonDEX
strategies, `use-arc-balance`) — it keeps long-term value at Arc mainnet
independent of any submission.

## 9 · Deferred (correct but wrong timing)

| Task | Why deferred |
|---|---|
| Package split (`@diversifi/shared` → `shared-ai`, `-swap`, `-guardian`, `-data`, `-core`) | ~53K-line monolith will surface circular-dependency nightmares. Revisit at a second team. |
| API versioning (`/api/v1/`) | Zero external consumers; all routes are internal Next.js routes. Add with the first SDK or mobile app. |
| Turbopack migration | Mixing bundler changes with component refactors makes debugging untraceable. Standalone once the codebase is stable. |
| Design tokens (CSS custom properties) | Low ROI for a solo dev; revisit with a second designer or a white-label need. |
| Test coverage expansion | Integration tests for the Guardian loop and onboarding in the next cycle. |
| Active-idle fact promotion (~30s idle) | The live line already rotates facts every 7s; the return-visit lead (≥6h away) shipped instead. Build only if `stamp_press`/share data shows surfaced beats outperform rotation. Ruled out regardless: popups/toasts, countdown urgency, any event fact adjacent to the "Move savings" CTA. |

## 10 · Full-stack money infrastructure — provider map (no commitments)

DiversiFi's product today is savings protection (hold → protect → monitor). The
natural expansion completes the lifecycle: onramp → protect + grow → offramp.
Listed so the integration surface is visible and the decisions stay intentional —
**nothing here is a commitment to a provider.** Deferred because it needs counsel
sign-off and a fee route before a fiat leg makes sense, and because without an
onramp users must already hold crypto — the biggest UX gap, and the reason it waits.

| Layer | Target | Priority providers | Why |
|---|---|---|---|
| **Onramp** (fiat → stablecoins) | Kenya, Nigeria, Ghana | Fonbnk (Celo-native, M-Pesa), Kotani Pay (Celo-native), Yellow Card | Closes the "need existing crypto" gap |
| **Onramp** (LatAm) | Mexico, Brazil, Colombia | Bitso, TransFi, dLocal | Maps to Buen Vivir / Global Diversification plans |
| **Onramp** (SE Asia) | Philippines, Singapore | StraitsX, Coins.ph | Maps to Gotong Royong; settles on the APAC rail once activated |
| **Earn / yield** (protocol) | Global | Ethena (sUSDe), Ondo (USDY — already a swap target), Aave, Fluid, Morpho | Turns idle protection into active growth |
| **Earn / yield** (managed) | Global | Yield.xyz, Veda Labs | Alternative if a managed vault suits the UX better |
| **Offramp** (stablecoins → fiat) | Africa, LatAm, SE Asia | Kotani Pay, MoneyGram (Stellar), Yellow Card (Polygon USDC) | Exit to local currency; Kotani does mobile-money cash-out on Celo |
| **Card** | Global | Rain, Wirex, Bridge | Post-revenue; needs a card-issuing partner + compliance |

Compliance posture per provider + dated regulatory backdrop:
[`archive/compliance-competitors-2026-10.md`](./archive/compliance-competitors-2026-10.md).
