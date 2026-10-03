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
| [`docs/design-language.md`](./docs/design-language.md) | Surface contract for any user-facing work |
| [`docs/history/roadmap-log.md`](./docs/history/roadmap-log.md) | Dated record of what shipped |
| [`docs/archive/`](./docs/archive/) | Closed grant tracks and past submissions — reference, not roadmap |

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
