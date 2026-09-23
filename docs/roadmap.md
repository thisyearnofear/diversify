# Roadmap

Forward-looking plan only. Shipped work and dated history live in
[`roadmap-log.md`](./roadmap-log.md). Product positioning: [`product.md`](./product.md).
Market evidence and the SME funnel: [`strategy.md`](./strategy.md). Regional
settlement rails: [`rails.md`](./rails.md).

---

## Now — active priorities

| Priority | What | Why now |
|---|---|---|
| **Chain-capability matrix** | One `getChainCapabilities(chainId)` contract in `packages/shared` replacing the five divergent "supported chain" lists (swap-executable, wallet-addable, token-map, RPC, `getTokenAddresses` fallback). Phases: 0 — module + delegation + invariant tests; 1 — merge the duplicated `NETWORKS`/`NETWORK_TOKENS` config between `apps/web/config` and shared; 2 — kill the silent Celo fallback in `getTokenAddresses`/`getChainAssets`; 3 — surface chain notices + swap error taxonomy in the UI. | Both production swap bugs were this class of failure; see `roadmap-log.md` § Swap chain-safety. |
| **0G Bridge close-out** | Waves 1–5 shipped (file deltas in `roadmap-log.md` § Wave-by-Wave). Remaining: traction metrics, demo video, Demo Day at Token2049 Singapore (Oct 7–8, 2026). | Submission target |
| **TypeSafe Signal Lens — shadow evaluation** | Optional, server-only structured review of public macro-source changes is shipped behind `ENABLE_TYPESAFE_SIGNAL_LENS=false`. It is free and non-authoritative: TypeSafe records calibrated materiality/category/urgency/source-quality comparisons without changing Guardian queueing, permissions, or execution. Run the shadow cohort, review precision/latency/fallback data, then decide whether to offer a visible opt-in lens and eventually monetize broader coverage/workflow—not basic safety. Ask-the-World Jev router (`ENABLE_TYPESAFE_ASK_WORLD_SPIKE`) is the paired chat surface: same Gateway→direct fallback, confidence bar, and agreement cadence — it routes skeletons into deterministic facts, never invents numbers. | Product proof + future SME/enterprise differentiation |
| **0G DA decision gate** | Reviewer feedback (Wave 2–3) caught docs calling 0G Storage a "DA layer" when no 0G Data Availability SDK integration exists. The corrected, deliberate architecture is Storage-first: durable evidence bundles and recoverable state snapshots use the supported TypeScript Storage SDK; 0G DA is a distinct Go/gRPC product intended for high-throughput, rollup-style availability, not a drop-in archival-evidence replacement. Evaluate a real DA sidecar only when DiversiFi has a concrete high-frequency execution-state/rollup workload **or** an explicit buildathon eligibility requirement. | 0G Bridge, decision-gated |
| **Celo Prezenti resubmission** | Write `docs/grant-proposal.md` — named team, milestones, amount, sustainability. All technical gaps from reviewer feedback are closed (Celo mainnet ledger, external-agent example, Self ID verified). | Next Frontier round |
| **HashKey mainnet deploy** | APAC rail code shipped; deployment pending HSK gas. Runbook: [`rails.md`](./rails.md) § APAC Rail. | HashKey Horizon |
| **Caribbean evidence** | User/partner evidence (LOI) for the FX netting track; rail parity, settlement execution, credit-layer embryo, and liquidity bootstrap are all shipped. | Future Caribbean |
| **SME FX — remaining phases** | Importer `FinancialStrategy` archetype, GHS on/off-ramp partner, rails design partner, graduation funnel. Phased plan: [`strategy.md`](./strategy.md). | North star |
| **Macro signal write path — verify in production** | The read + echo path is fixed and tested, but all five deployed ledgers hold **zero** `MACRO_SIGNAL` records (1,610 records scanned; the only families present are `ADVISORY_HEARTBEAT` and `EVIDENCE_MIRROR`). So the beats engine currently has no data source. Check the Firecrawl key, registered monitors, and webhook deliveries on the server, then exercise the path on demand with `pnpm rehearse-macro-signal` ([`setup.md`](./setup.md) § Macro path rehearsal). | "Continuously reads macro signals" and the corridor beats are only demonstrable once a signal actually anchors; the capture playbook §2 depends on it. |
| **SERV Hackathon Ed. 01 close-out** | RWA Vaults allocator shipped (free heuristic + opt-in SERV Reasoning over the IXS catalog; `roadmap-log.md` § SERV Hackathon). Remaining: `SERV_API_KEY` on the backend, data-collection toggle at console.openserv.ai, demo video, public X post + form. Submission package: [`submission/serv-edition-01.md`](./submission/serv-edition-01.md). | Deadline 28 Sep 00:00 UTC |

---

## Track status snapshot

| Track | State | What's left |
|---|---|---|
| 0G Bridge buildathon | All 5 waves delivered; Agentic ID live on 0G mainnet | Traction + Demo Day |
| Celo Prezenti | Technical gaps closed | Grant proposal doc |
| Arbitrum Open House | Delivered — ledger on Arbitrum mainnet, chain-aware routing, external agent verified | Post-event follow-through |
| Enterprise tier (B2B) | API-key auth + audit export shipped; x402 settlement env-gated | First licensing customer |
| Qwen MemoryAgent | Shipped — Tablestore/DashScope memory, Function Compute proof, +38% eval | — |
| Product quality plan | 14-day plan closed (details + close-out notes in `roadmap-log.md`) | axe-core CI pass unverified |
| SME FX north star | Vertical slice + fail-closed cycle protection shipped | Phases above |
| SERV Hackathon Ed. 01 | Allocator + demo page shipped (`/rwa-vaults`, free-default, SERV opt-in) | Deploy key, video, X post, form |

---

## Long-term chain architecture (the end state)

Each layer owned by exactly one chain. The ledger of record follows the
money — decisions settle where the action executes; 0G holds the evidence
CIDs those entries reference (current-state detail:
[`architecture.md`](./architecture.md) § 0G Verifiability Stack).

| Layer | Chain | Why this chain | What it does NOT do |
|---|---|---|---|
| **Savings + Identity** | **Celo** | Regional Mento stablecoins (cUSD, cREAL, KESm, GHSm), SocialConnect ODIS, GoodDollar UBI | Agent execution (no EIP-7702), nanopayments |
| **Execution + Yield** | **Arbitrum** | Deepest USDC + RWA liquidity (Uniswap V3, 1inch, Camelot, PAXG, USDY, SYRUPUSDC); EIP-7702-capable for true on-chain ERC-7710 enforcement | Regional stablecoins, nanopayments |
| **Trust + Verifiability** | **0G** | Content-addressed Storage, TEE-verified Compute, DA | Payment settlement (gas-token friction), ledger of record |
| **Commerce / settlement** | **Arc** | x402 mandate-first settlement, Circle Gateway funding, CCTP domain 26 — invisible to retail; not a savings or execution chain | Verifiable AI, regional stablecoins, deep DEX liquidity |

### Payment-rail migration phases

0G Pay is a stopgap for the settlement rail. Arc public mainnet landed
2026-09-16 (chain ID 5042, USDC native gas, CCTP domain 26, Circle Gateway
+ Nanopayments live) — the conditions that argued for Arc owning this
layer are now real. What remains is operational: fix the staged config,
fund the vault wallet, then `SETTLEMENT_NETWORK=ARC SETTLEMENT_ENV=mainnet`.

| Phase | Trigger | Payment rail | Notes |
|---|---|---|---|
| **1 — Buildathon** | Now | 0G Pay (interim default) | `SETTLEMENT_NETWORK=ZERO_G`; Arc testnet for dev |
| **2 — Arc mainnet** | ✅ Mainnet landed 2026-09-16 | Arc | Mandate-first (EIP-3009): buyer signs, merchant settles — no chain switch, no buyer gas. Flip once vault is funded |
| **3 — Protection Balance** | Post-flip | Arc canonical | Circle Gateway funding: deposit USDC once on any supported chain → spendable on Arc; nanopayment batching makes sub-cent tolls honest |
| **4 — Venue eval (parked)** | Corridor execution needs it | — | StableFX RFQ fiat-FX inquiry deferred; Arc fiat-stable roster complements Mento, not a rotation venue yet |

Billing unit across all phases: the user funds a Protection Balance once
and pays for **decision artifacts** (Protection Reviews), not per-source
feeds — source prices are COGS inside the artifact. Doctrine:
`docs/product.md` § The product object.

**Codebase rule:** do not delete Arc infrastructure (`ArcAgent`, Curve/AeonDEX
strategies, `use-arc-balance`) — it has long-term value at Arc mainnet.

---

## Yield engine — open items

Strategy and shipped detail (vaults.fyi integration, GMX GM live on
mainnet, engagement-gated paid insights): `roadmap-log.md` § Yield Engine
Strategy. Still open:

- **Robinhood Earn diligence** — 7% insured USDG yield via Morpho
  (Lloyd's cover, non-custodial, Arbitrum Orbit L2). Regulatory posture
  and USDG availability in target markets must be settled before wiring.
- **Alchemy infra swap** — better RPC + token-balance API could retire the
  ethers multicall in first-load (reliability + bundle win). Separate infra
  track.
- **ZeroDev / Dune / Fhenix** — parked; revisit ZeroDev with the wallet/AA
  track, Dune/Fhenix when a specific need appears.
- **Open questions:** payment auth for vaults.fyi x402 calls (operator
  wallet vs existing rail); resell recommendations per-call vs bundle into
  a tier.

---

## Standing discipline — claims vs. implementation audit

**Why:** three separate instances of the same failure shape have surfaced
so far — docs/UI claiming more verifiability than the code guarantees:
(1) 0G Storage labeled "DA" in docs when no DA SDK integration exists
(fixed 2026-09-20, see `roadmap-log.md`); (2) `AnchorResult.status ===
'anchored'` presented in the UI as fully verified evidence when the 0G
Storage upload could have silently failed first, leaving `evidenceCid: ''`
on a real on-chain tx (fixed 2026-09-20); (3) "on-chain ERC-7715
enforcement" implied by old comments/docs when spending bounds are
enforced only in application code (self-caught and documented in
`guardian.md`, on-chain ERC-7710 redemption still deferred). Given that
**verifiability is the product's core differentiator** (per `product.md`
— "every high-impact recommendation leaves something a user can
inspect"), a claims-outrunning-implementation gap is not generic tech
debt; it directly undercuts the moat. This needs to become a standing
check, not a one-off fix each time a reviewer catches it.

**The check (run before any release/submission touching verifiability
surfaces, and periodically otherwise):** for every "verified" /
"anchored" / "enforced" / "live" claim in docs or UI copy, trace the
actual code path and ask — does it guarantee the claim, or can it degrade
silently to something weaker? Specifically:
- Does a UI badge/label ever render the same way for "fully backed" and
  "partially degraded" outcomes? (the evidenceUploaded gap's shape)
- Does a doc name a specific product/component (DA, TEE, on-chain
  enforcement) that the code doesn't actually call? (the 0G DA gap's shape)
- Does "mock fallback allowed" ever apply outside dev/CI in a real
  deploy path? (the environment-gating thread from this audit)

**Open follow-up, larger scope (not bundled with the discipline above):**
ERC-7710 on-chain enforcement (`guardian.md` § Target flow) is the
single biggest latent gap of this shape — the Guardian is a *trusted*
agent today, not a *constrained* one. Worth its own roadmap slot once
the current wave's verifiability fixes are settled.

---

## Post-9/10 — full-stack fintech infrastructure

DiversiFi's product today is savings protection (hold → protect → monitor).
A natural expansion completes the lifecycle: onramp → protect + grow →
offramp. Providers mapped to DiversiFi's chains and target markets:

| Layer | Target | Priority providers | Why |
|---|---|---|---|
| **Onramp** (fiat → stablecoins) | Kenya, Nigeria, Ghana | **Fonbnk** (Celo-native, M-Pesa), **Kotani Pay** (Celo-native), **Yellow Card** | Without onramp, users need existing crypto — biggest UX gap |
| **Onramp** (LatAm) | Mexico, Brazil, Colombia | **Bitso**, **TransFi**, **dLocal** | Maps to Buen Vivir / Global Diversification plans |
| **Onramp** (SE Asia) | Philippines, Singapore | **StraitsX**, **Coins.ph** | Maps to Gotong Royong plan; settles on the APAC rail |
| **Earn / Yield** (protocol) | Global | **Ethena** (sUSDe), **Ondo** (USDY — already a swap target), **Aave**, **Fluid**, **Morpho** | Turns idle protection into active growth |
| **Earn / Yield** (managed) | Global | **Yield.xyz**, **Veda Labs** | Alternative if a managed vault suits the UX better |
| **Offramp** (stablecoins → fiat) | Africa, LatAm, SE Asia | **Kotani Pay**, **MoneyGram** (Stellar), **Yellow Card** (Polygon USDC) | Exit to local currency; Kotani does mobile-money cash-out on Celo |
| **Card** | Global | **Rain**, **Wirex**, **Bridge** | Post-revenue; requires card-issuing partner + compliance |

No commitment to any specific provider — listed so the integration surface
is visible and decisions are intentional.

---

## Deferred (correct but wrong timing)

| Task | Why deferred |
|---|---|
| **Package split** (`@diversifi/shared` → `shared-ai`, `shared-swap`, `shared-guardian`, `shared-data`, `shared-core`) | 33K-line monolith will surface circular dependency nightmares. Revisit at 50K+ lines or a second team. |
| **API versioning** (`/api/v1/` prefix) | Zero external consumers; all API routes are internal Next.js routes. Add when the first SDK or mobile app exists. |
| **Turbopack migration** | Mixing bundler changes with component refactors makes debugging untraceable. Standalone task once the codebase is stable. |
| **Design tokens** (CSS custom properties) | Low ROI for a solo dev; revisit with a second designer or a white-label need. |
| **Test coverage expansion** | Integration tests for the Guardian loop and onboarding in the next cycle. |
