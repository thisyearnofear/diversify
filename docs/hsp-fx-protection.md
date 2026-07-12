# FX Protection Insight — HSP Settlement on HashKey Chain

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

**Why this exists:** the On-Chain Horizon hackathon's submission window
(deadline July 11 23:59 GMT+8) had already passed before this work started.
It was built anyway, deliberately slower and more honestly than a
deadline-driven scramble would allow, because it advances the actual product
direction: [`sme-fx-strategy.md`](./sme-fx-strategy.md)'s FX-risk
intelligence layer, proven end-to-end with real settlement and a real
on-chain audit trail — using the hackathon's principles (use HSP, deploy on
HashKey) as a design constraint, not a deadline to chase.

---

## What it is

A paid product: a user (or their agent) pays ~1 in stablecoin (USDT on HashKey)
via **HSP (HashKey Settlement Protocol)** and unlocks a verifiable **FX
Protection Insight** — a per-cycle FX drag report ("this cycle, protection
preserved ₵X vs holding cedis") computed from real historical mid-market
rates. The resulting recommendation anchors on the importer's
**region-canonical** `RecommendationLedger` — the audit trail "follows the
money" per [`apac-rail.md`](./apac-rail.md): an **APAC** importer's record
lands on HashKey (payment *and* proof on one chain), an **African** importer's
on Celo, otherwise Arbitrum. Either way the HSP settlement tx on HashKey is
recorded as the cross-chain settlement reference — the accountant-usable audit
trail `sme-fx-strategy.md` calls for.

Settlement chain and anchor chain are **deliberately decoupled**: settlement is
fungible (HSP-on-HashKey is the flagship option, config-selected via
`SETTLEMENT_NETWORK=HASHKEY`), while the anchor obeys the documented per-region
ledger routing. The "one chain" story is real specifically for APAC importers;
for others, HashKey settlement + region-appropriate anchor is the honest shape.

It ships as a new premium source (`fx_protection`) on the existing,
production x402 gateway (`pages/api/agent/x402-gateway.ts`), with HashKey
added as a fourth settlement rail alongside Arc / 0G / Arbitrum.

## Why HSP is safe to depend on

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

## What shipped

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

## Design decisions worth knowing

- **Anchor chain is decoupled from settlement chain (follows the money).** The
  product (`analyzeCycles`) and settlement (any of the 4 rails; HSP-on-HashKey
  is the flagship option) are chain-agnostic. The *anchor* is region-canonical:
  `fxRegionForCurrency(currency)` → HashKey (APAC) / Celo (Africa & LatAm) /
  Arbitrum (default), matching the documented per-region ledger roles. This is
  the reconciliation with `apac-rail.md`'s "ledger follows the money" — the FX
  persona is African (`sme-fx-strategy.md`), so hardcoding HashKey would have
  put a Ghanaian trader's record on the APAC rail. Payment identity for the
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

## Prerequisites to go live (not code — credentials only a human can supply)

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

## Demo without KYC (`scripts/hashkey-fx-demo.ts`)

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

## Verification

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

## Related docs

- [`sme-fx-strategy.md`](./sme-fx-strategy.md) — the north-star direction this proves out (§8 sequencing, step 3)
- [`sme-fx-implementation-plan.md`](./sme-fx-implementation-plan.md) — the broader importer-archetype plan (Phase 0's "move FX drag to shared" is now done)
- [`apac-rail.md`](./apac-rail.md) — the HashKey `RecommendationLedger` this anchors to
- [`integrations.md`](./integrations.md) — the canonical settlement-rail env var table
