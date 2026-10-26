# DiversiFi

**You set the rules. The Guardian operates within them. Every decision is explainable and verifiable.**

DiversiFi tells you what your currency is doing to your savings, proposes a
protected allocation inside the limits you set, and records the decision where
you can check it. The AI is the interface. The bounds are the trust model.

> Is my money losing purchasing power? · What can I do about it? · Why can I
> trust the thing doing it? — everything else in this repo exists to answer
> those three.

**Live app:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app) · Positioning: [`docs/product.md`](./docs/product.md) · Trust model: [`docs/guardian.md`](./docs/guardian.md)

---

## How a decision gets made

```
data → deterministic risk calculation → constrained strategy → AI explanation
     → your approval → on-chain execution
```

The model never authorizes a move. Risk arithmetic (`services/fx-drag/`),
allocation bands and asset eligibility (`config/jurisdictions.ts`,
`services/strategy/`) and spending caps (`VaultService.validateSwap`,
`guardian-loop.ts`) are code. The Guardian proposes inside those results; you
approve in your own wallet; the decision is recorded on the chain where the
money moves, with its reasoning anchored to 0G Storage as evidence.

Savings never leave your wallet — no deposit, no custodial account, no Safe.
Autonomy exists only as an ERC-7715 grant your own smart account enforces, and
chains that can't enforce it fall back to one-tap proposals and *journal the
decline*. What is enforced where — and what is still app-layer only — is stated
plainly in [`docs/guardian.md`](./docs/guardian.md).

## What it protects

Both directions of the same trade, one engine:

- **Savers in weakening-currency economies** — quantify what depreciation and
  inflation did to purchasing power, then hold it in local stablecoins,
  gold-backed assets, or yield.
- **Businesses and savers in strong-currency economies** — take emerging-market
  exposure deliberately, with FX cost quantified rather than hidden; and flatten
  the currency drag on a business that earns in one currency and must pay a
  supplier in another.

A chosen philosophy (Africapitalism, Buen Vivir, Islamic Finance, Confucian,
Gotong Royong) shapes the allocation. It is the retention layer, not the
headline.

## The app

Four instruments, one job each: **Shield** (protection plan + allocation ring),
**Home** (your currency's moment + holdings), **Exchange** (move savings),
**Guardian** (daily limit, latest decision, journal, proof). Simple mode shows
the first three; Full adds Guardian. Design contract:
[`docs/design-language.md`](./docs/design-language.md).

## Quick start

```bash
pnpm install
cp .env.example .env.local   # minimum: NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET
pnpm dev                     # http://localhost:3042
```

Requires Node ≥22.11 and pnpm. Full env table, test drive, deploy and capture
material: [`docs/reference.md`](./docs/reference.md). Docs index:
[`docs/README.md`](./docs/README.md). Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Repo map

| Area | Where |
|---|---|
| Next.js app | `apps/web/` (`components/`, `hooks/`, `pages/`, …) |
| Domain logic | `packages/shared/` |
| 0G evidence layer | `packages/shared-0g/` |
| Agent APIs | `apps/web/pages/api/agent/` |
| Contracts | `contracts/` (+ `contracts/test/`), `scripts/Deploy*.s.sol` (Foundry libs in root `lib/`) |
| Ops | `ops/` · x402 smoke scripts `scripts/smoke/` |

## Documentation

| Doc | Answer |
|---|---|
| [`docs/product.md`](./docs/product.md) | What DiversiFi is, for whom, and what's live vs. intended |
| [`docs/guardian.md`](./docs/guardian.md) | **The trust model** — what bounds execution, where it's enforced, agent identity, the claims audit |
| [`docs/architecture.md`](./docs/architecture.md) | System, chains and settlement rails, the 0G evidence stack |
| [`docs/plan.md`](./docs/plan.md) | What we're building now, in priority order |
| [`docs/reference.md`](./docs/reference.md) | Setup, env vars, endpoints, deploy, demo capture |
| [`docs/internal/demo-night-runbook.md`](./docs/internal/demo-night-runbook.md) | The timed 3-minute walletless demo, with preflight and fallbacks |
| [`docs/design-language.md`](./docs/design-language.md) | Surface contract for any user-facing work |
| [`docs/history/roadmap-log.md`](./docs/history/roadmap-log.md) | Dated record of what shipped |
| [`docs/archive/`](./docs/archive/) | Closed grant tracks and past submissions — reference, not roadmap |

## HackMeridian 2026-10 submission

**Prior-work disclosure.** DiversiFi is an existing product. **All Stellar
support was built during HackMeridian** — the Stellar network adapter, wallet
integration, exchange flow, receipt path, and this section. The underlying
risk/philosophy/ledger machinery predates the event; the hackathon scope is
Stellar-specific work only. Executed plan:
[`docs/archive/tracks/hackmeridian-2026-10-execution-plan.md`](./docs/archive/tracks/hackmeridian-2026-10-execution-plan.md).

**What the Stellar integration does.** Stellar testnet is a first-class
network mode: connect a Stellar wallet (Freighter, LOBSTR, xBull, Albedo, Hana or Rabet via the StellarWalletsKit picker) → the instrument surfaces real G-address
balances → a supported move is prepared as a strict-send **path payment**
(`XLM → testnet USDC`, min-destination computed from a live route) → the user
reviews exact terms and signs in their own wallet → the confirmed transaction
renders as a ledger-verified receipt with an explorer link. Stellar never
masquerades as an EVM chain — a dedicated adapter (`apps/web/lib/stellar/`)
isolates Horizon reads, validates prepared transactions (fee-bump/signed/legacy
XDR rejected), and recovers pending submissions durably.

| Piece | Where |
|---|---|
| Stellar adapter (Horizon isolation, strict validation, pending recovery) | `apps/web/lib/stellar/` |
| Wallet (StellarWalletsKit picker — Freighter/LOBSTR/xBull/Albedo/Hana/Rabet; direct-Freighter fallback) | `apps/web/lib/stellar/wallet.ts` |
| Exchange flow + receipt | `apps/web/components/swap/StellarExchange.tsx`, `PairStage.tsx` |
| Home/Shield honest Stellar surface | `apps/web/components/stellar/StellarModePanel.tsx` |
| Agent intent (`open_stellar` — navigation only, never signing) | `use-agent-chat.ts`, `guardian-interaction.ts` |
| Stellar voice-of-the-corridor verbs (speech previews/drafts — never commits) | `apps/web/lib/voice-verbs.ts` |

**On-chain evidence (all Stellar testnet):**

| Demonstration | Artifact |
|---|---|
| XLM → USDC strict-send path payment, wallet-signed | Exchange flow (`pnpm check-stellar-routes` re-queries the live route) |
| Soroban RecommendationLedger contract | [`contracts-stellar/`](./contracts-stellar) → `CDQUT55ICBFEC6JGMZDJEHA47ECWQOAYHLNFHO2ULFLDQVIDNMKL4WT6`, deploy tx [`b3115c87…`](https://stellar.expert/explorer/testnet/tx/b3115c873d7ef38c12e6e2cc4e963ab82626833274b28ac18a8139ce5d80de38), records seq 1 [`a0a2b75b…`](https://stellar.expert/explorer/testnet/tx/a0a2b75bd16a4b5e837949300c24b75316aa81b4363364b118bbd28bbb57a6ec) / seq 2 [`f8e41fa3…`](https://stellar.expert/explorer/testnet/tx/f8e41fa3b7759118a160b3dbe0a6667a08e3a773a5dfa25f954d565fe5d9ae07) |
| Smart account + on-chain spending policy (agent key can only move funds inside the cap) | account `CBH5NT2HEIQGBMTABOPRPRUJKDNHU3HFIY6STSN7QZSCX7WXSLCOAVC2`, policy install [`abc2fa2e…`](https://stellar.expert/explorer/testnet/tx/abc2fa2e206533f8926cab6131fb61c0d9a23f3fbf21d3ba424682ab6d162c2a), **within-limit spend accepted** [`a8ab4ab0…`](https://stellar.expert/explorer/testnet/tx/a8ab4ab0cdcdbf17412def66d3f65c9a28faf2ce79dbc552245ec9340ae5e00f), over-limit rejected on-chain (policy error #3221) — `scripts/stellar-smart-account-policy.mts` reproduces both legs |
| Claimable-balance corridor (bounded proposal claimable only by the counterparty) | create [`ffde38e3…`](https://stellar.expert/explorer/testnet/tx/ffde38e3238fb261de75136946e669f991dbfb2dac5c4257cea0363f94b49f05), claim [`0b8927b8…`](https://stellar.expert/explorer/testnet/tx/0b8927b83827f855e6b46a392017b8cce97cf50253737930879c66bc0a52ae07) — `scripts/stellar-claimable-balance.ts` |
| SEP-24 anchor discovery (read-only: which assets an anchor advertises; not a redemption claim) | `scripts/sep24-anchor-discovery.ts` — testanchor.stellar.org advertises USDC deposit + withdraw |

Demo: https://diversifiapp.vercel.app (wallet picker → Stellar testnet →
Exchange). Video walkthrough covers one success and one refusal (a spoken
commit being declined — voice never signs).

## Status, honestly

- Live: FX-drift and depreciation reporting, protection plans, one-tap
  proposals, the chain-aware `RecommendationLedger` (Celo, Arbitrum, 0G) and
  `AgenticID` #1, the x402 intelligence gateway.
- Config-gated, default off: fees (**no swap fee is collected today**),
  sanctions regions, perps, thesis surfaces.
- Opt-in and chain-limited: autonomous execution (Celo, Celo Sepolia, Arbitrum).
- Fail-closed: legacy research analysis returns HOLD without financial estimates;
  authenticated allocation repair uses saved targets and measured holdings;
  stablecoin deviations use dated independent prices. Broader source coverage
  and deployed on-chain venue/plan policy remain work in
  [`docs/plan.md`](./docs/plan.md).
- Build phase (Oct 27 – Nov 13) — Airwallex integration: wire global accounts + FX + virtual cards behind the Guardian spend bounds, and enforce per-agent capability credentials on-chain via ERC-7710 (see [`docs/plan.md` §11](./docs/plan.md)). This is the build-phase target described in the hackathon submission; the demo and idea-phase deliverable is the plan above.

