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
| **Celo Prezenti resubmission** | Write `docs/grant-proposal.md` — named team, milestones, amount, sustainability. All technical gaps from reviewer feedback are closed (Celo mainnet ledger, external-agent example, Self ID verified). | Next Frontier round |
| **HashKey mainnet deploy** | APAC rail code shipped; deployment pending HSK gas. Runbook: [`rails.md`](./rails.md) § APAC Rail. | HashKey Horizon |
| **Caribbean evidence** | User/partner evidence (LOI) for the FX netting track; rail parity, settlement execution, credit-layer embryo, and liquidity bootstrap are all shipped. | Future Caribbean |
| **SME FX — remaining phases** | Importer `FinancialStrategy` archetype, GHS on/off-ramp partner, rails design partner, graduation funnel. Phased plan: [`strategy.md`](./strategy.md). | North star |
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
| **Money Movement** | **Arc** | USDC-native gas, sub-second finality, nanopayment economics, built-in FX engine, Circle Gateway/CCTP | Verifiable AI, regional stablecoins, deep DEX liquidity |

### Payment-rail migration phases

0G Pay is a stopgap while Arc is testnet-only (USDC-as-gas, Circle Gateway
as the x402 standard, and Arc's stablecoin FX engine all argue for Arc
owning the payment rail once mainnet lands).

| Phase | Trigger | Payment rail | Notes |
|---|---|---|---|
| **1 — Buildathon** | Now | 0G Pay (interim default) | `SETTLEMENT_NETWORK=ZERO_G`; Arc testnet-only |
| **2 — Arc mainnet beta** | Arc mainnet lands | Arc | One-line config change; 0G Pay becomes fallback |
| **3 — Arc stable** | Post-beta | Arc canonical | Explore Arc FX engine (USDC/EURC) + CCTP bridge to Arbitrum |

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
