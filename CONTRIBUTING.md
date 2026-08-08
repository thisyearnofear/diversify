# Contributing to DiversiFi

Thanks for taking a look. This is a pnpm monorepo:

- **`apps/web`** — Next.js app (UI + API routes)
- **`packages/`** — shared domain logic
- **`contracts/`** — Foundry contracts (libs in root `lib/`)

## Prerequisites

- Node.js ≥22.11
- [pnpm](https://pnpm.io) (see `packageManager` in `package.json`)
- Optional: [Foundry](https://book.getfoundry.sh/) for Solidity work

## Setup

```bash
pnpm install
cp .env.example .env.local   # monorepo root — Next loads this via apps/web next.config
pnpm dev                     # http://localhost:3042
```

**Minimum env** to boot the app:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app (social login + smart accounts) |
| `PRIVY_APP_SECRET` | Privy server SDK |

Everything else (AI providers, feeds, ledgers, x402) is optional per feature — see [`docs/integrations.md`](./docs/integrations.md) and [`docs/README.md`](./docs/README.md) § Getting Started.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js on port 3042 (`@diversifi/web`) |
| `pnpm test` | Vitest suite |
| `pnpm lint` | Workspace ESLint |
| `pnpm build` | Shared packages + Next build |
| `pnpm test-x402` | x402 gateway smoke (`tests/`) |
| `forge test` | Solidity tests in `test/` (Foundry) |

## Where do I change X?

| You want to… | Start here |
|---|---|
| UI / tabs / onboarding | `apps/web/components/`, `apps/web/hooks/`, `apps/web/pages/` |
| Guardian loop, advisor, AI | `apps/web/pages/api/agent/`, `packages/shared/src/services/ai/` |
| Wallet providers / streak rewards | `packages/shared/src/modules/wallet/`, `packages/shared/src/modules/rewards/` |
| Ledger / chain routing | `packages/shared` recommendation-ledger services, `contracts/` |
| FX netting / drag | `packages/shared/src/services/fx-netting/`, `scripts/fx-drag-report.ts` |
| Deploy / register / ops scripts | `scripts/` (index in [`scripts/README.md`](./scripts/README.md)), `ops/` |
| Product / architecture docs | [`docs/README.md`](./docs/README.md) |

Coding conventions for agents and humans: [`AGENTS.md`](./AGENTS.md).

## Test layout

- **`test/`** — Foundry (Solidity) contract tests
- **`tests/`** — Node x402 smoke scripts (`pnpm test-x402*`)
- Co-located `__tests__/` / `*.test.ts` — Vitest unit tests next to source

## PRs

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, …)
- Prefer extending shared services over new one-off logic
- If you touch agent / ledger / x402 paths, run the relevant specialized scripts before asking for review
