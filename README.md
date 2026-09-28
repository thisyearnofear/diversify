# DiversiFi

Risk-aware, values-driven treasury management.

DiversiFi detects a visitor’s local currency depreciation against USD, EUR, and gold, then helps protect savings through stablecoin allocation, gold-backed tokens, and yield vaults. The same machinery runs both directions: savers in volatile-currency economies protecting purchasing power, and businesses and savers in developed markets trading with — or diversifying into — emerging markets along cultural, values, or philosophy lines, with FX exposure quantified either way.

**Live app:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app) · Full pitch: [`docs/product.md`](./docs/product.md)

---

## Quick start

```bash
pnpm install
cp .env.example .env.local   # minimum: NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET
pnpm dev                     # http://localhost:3042
```

Requires Node ≥22.11 and pnpm. Setup details, env tables, and test drive: [`docs/setup.md`](./docs/setup.md). Docs index: [`docs/README.md`](./docs/README.md). How to contribute: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

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

1. **Currency risk in your own money** — depreciation shown in the visitor's currency (GHS, KES, USD vs gold, …), plus a per-cycle FX drag report for businesses paying suppliers across currencies (Shield's payment-cycle panel, no wallet needed).
2. **Philosophy / values system** — identity-based retention via cultural archetypes, not generic DeFi yield shopping.
3. **A Guardian you can verify** — it proposes moves across Celo/Mento (local stables), Arbitrum (liquidity + RWA yield) and HashKey Chain (APAC savings); you approve each one, and it acts alone only under an ERC-7715 permission your own smart account enforces. Savings never leave your wallet, and every decision is recorded on-chain with reasoning anchored to 0G.

## The app

Four tabs, one job each: **Shield** (choose a protection plan; its ring and payment-cycle panel), **Home** (your currency's moment and holdings), **Exchange** (move savings between currencies), **Guardian** (daily limit, latest decision, journal and proof). Simple mode shows the first three; Full adds Guardian. Design contract: [`docs/design-language.md`](./docs/design-language.md).

Also: an x402-gated intelligence gateway for external agents, and Privy social-login onboarding.

---

## Further reading

| Topic | Doc |
|---|---|
| Product, positioning, vocabulary | [`docs/product.md`](./docs/product.md) |
| Architecture, AI providers, settlement | [`docs/architecture.md`](./docs/architecture.md) |
| APIs, env vars, external agents | [`docs/integrations.md`](./docs/integrations.md) |
| Roadmap & grant tracks | [`docs/roadmap.md`](./docs/roadmap.md) |
| Chain rails (Arc, HashKey, Caribbean) | [`docs/rails.md`](./docs/rails.md) |
| SME FX north star | [`docs/strategy.md`](./docs/strategy.md) |
| Guardian enforcement | [`docs/guardian.md`](./docs/guardian.md) |
| Mainnet deployment proofs | [`docs/architecture.md`](./docs/architecture.md) · ledgers at `0x3BCf…369C` on Celo, Arbitrum, and 0G |
