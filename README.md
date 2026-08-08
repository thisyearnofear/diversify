# DiversiFi

Risk-aware, values-driven treasury management.

DiversiFi detects a visitor’s local currency depreciation against USD, EUR, and gold, then helps protect savings through stablecoin allocation, gold-backed tokens, and yield vaults. Every Guardian decision is recorded on-chain, with AI reasoning anchored to 0G. The philosophy/values system is the retention moat.

**Live app:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app) · Full pitch: [`docs/product.md`](./docs/product.md)

---

## Quick start

```bash
pnpm install
cp .env.example .env.local   # minimum: NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET
pnpm dev                     # http://localhost:3042
```

Requires Node ≥22.11 and pnpm. Setup details, env tables, and test drive: [`docs/README.md`](./docs/README.md). How to contribute: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## Repo map

| Area | Where |
|---|---|
| Next.js app | `apps/web/` (`components/`, `hooks/`, `pages/`, …) |
| Domain logic | `packages/shared/` |
| Agent APIs | `apps/web/pages/api/agent/` |
| Contracts | `contracts/` (+ `contracts/test/`), `scripts/Deploy*.s.sol` (Foundry libs in root `lib/`) |
| Docs index | [`docs/README.md`](./docs/README.md) |
| Agent / coding conventions | [`AGENTS.md`](./AGENTS.md) |
| Ops (Alibaba FC, etc.) | `ops/` |
| Examples | `examples/` |

Foundry tests live in `contracts/test/`. x402 smoke scripts live in `scripts/smoke/`.

---

## What makes it different

1. **Currency-risk awareness** — show depreciation in the visitor’s own money (GHS, KES, USD vs gold, …). Risk is universal; the response is values-driven. Ships today: risk detection, philosophy-aware allocation, on-chain protection. Not yet: direct fiat on-ramp; full SME FX drag product (concierge CLI: `npx tsx scripts/fx-drag-report.ts`).
2. **Philosophy / values system** — identity-based retention via cultural archetypes, not generic DeFi yield shopping.

The **Guardian** routes capital across Celo/Mento (local stables), Arbitrum (liquidity + RWA yield), and HashKey Chain (APAC savings), with on-chain proof of each decision.

---

## Further reading

| Topic | Doc |
|---|---|
| Architecture, AI providers, settlement | [`docs/architecture.md`](./docs/architecture.md) |
| APIs, env vars, external agents | [`docs/integrations.md`](./docs/integrations.md) |
| Roadmap & grant tracks | [`docs/roadmap.md`](./docs/roadmap.md) |
| APAC rail (HashKey) | [`docs/apac-rail.md`](./docs/apac-rail.md) |
| Caribbean rail | [`docs/caribbean-rail.md`](./docs/caribbean-rail.md) |
| SME FX north star | [`docs/sme-fx-strategy.md`](./docs/sme-fx-strategy.md) |
| Guardian enforcement | [`docs/guardian-enforcement-model.md`](./docs/guardian-enforcement-model.md) |
| Mainnet deployment proofs | [`docs/architecture.md`](./docs/architecture.md) · ledgers at `0x3BCf…369C` on Celo, Arbitrum, and 0G |

---

## Key features

- **Intelligence gateway** — x402-gated Mento depeg + inflation + yield intelligence for any agent
- **Chain-aware ledger** — decisions settle where the money moves; evidence CIDs on 0G
- **Guardian pulse / proactive pilot** — AI insights and one-tap rebalance intents
- **Verifiable AI tab** — in-app evidence CIDs, model IDs, chain receipts
- **Social-login onboarding** — Privy-first wallet abstraction
