# Docs

Navigation index for `docs/`. Start at the top, drill down by need.

## Repository layout

| Area | Where |
|---|---|
| Next.js app | `apps/web/` (`components/`, `hooks/`, `pages/`, …) |
| Domain logic | `packages/shared/` |
| Agent APIs | `apps/web/pages/api/agent/` |
| Contracts | `contracts/`, `scripts/Deploy*.s.sol` (Foundry libs in root `lib/`) |
| Ops (Alibaba FC, etc.) | `ops/` |
| Contributor guide | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Agent conventions | [`../AGENTS.md`](../AGENTS.md) |

`contracts/test/` = Foundry (Solidity). `scripts/smoke/` = x402 Node smoke scripts. Root map: [`../README.md`](../README.md).

## The docs

| # | Doc | What's in it |
|---|-----|--------------|
| 1 | **[`setup.md`](./setup.md)** | Quick start, env vars, supported chains, x402 research-payment mode, test drive, troubleshooting |
| 2 | **[`product.md`](./product.md)** | What DiversiFi is, who it's for, protection plans, priorities — plus the adaptive/signal-based experience architecture |
| 3 | **[`design-language.md`](./design-language.md)** | Surface design principles — one job per screen, concentrated expressiveness, controls-as-motif, disclosure tiers, PR checklist |
| 4 | **[`architecture.md`](./architecture.md)** | System architecture, AI provider chain, swap orchestrator, Guardian loop + workflow diagram, 0G verifiability stack, data streams & their jobs |
| 5 | **[`integrations.md`](./integrations.md)** | API endpoints, AI providers, data sources, env var tables, external agent integration guide |
| 6 | **[`roadmap.md`](./roadmap.md)** | The forward-looking plan — grant tracks, product reframe, SME FX north star, yield engine, 0G Bridge plan |
| 7 | **[`strategy.md`](./strategy.md)** | North star — SME FX working capital, Ghanaian-importer wedge, market research, implementation plan |
| 8 | **[`guardian.md`](./guardian.md)** | Guardian spending bounds, threat model, enforcement plan + agent identity (ERC-8004 + Self Protocol) |
| 9 | **[`rails.md`](./rails.md)** | Regional savings & settlement lanes — APAC (HashKey), Caribbean, Arbitrum x402 settlement |
| 10 | **[`ops.md`](./ops.md)** | Deployment & ops (Alibaba Cloud proof, deploy scripts) |
| — | [`architecture-notes.md`](./architecture-notes.md) | Exploratory/historical engineering findings (Circle agent stack, dependency audit) — reference, not current architecture |
| — | [`roadmap-log.md`](./roadmap-log.md) | Historical log of what shipped per wave — advisory record, not the forward plan |
| — | [`mascot-raster-brief.md`](./mascot-raster-brief.md) | **Superseded** mascot raster brief (authoritative spec: `design-language.md` §9) |
| — | **This file** | Navigation index |

## By need

- **New contributor setting up locally** → [`setup.md`](./setup.md)
- **External agent integrating with the intelligence gateway** → [`integrations.md`](./integrations.md) § External Agent Integration Guide
- **Looking up an API endpoint, provider, env var, or data stream** → [`integrations.md`](./integrations.md)
- **How the data streams work together & stay honest** → [`architecture.md`](./architecture.md) § Data Streams & their Jobs
- **Understanding the Guardian's spending bounds & security** → [`guardian.md`](./guardian.md)
- **Agent identity (ERC-8004 + Self Protocol)** → [`guardian.md`](./guardian.md) § Agent Identity
- **Building or reviewing any user-facing surface** → [`design-language.md`](./design-language.md) (rules also in `AGENTS.md` § Surface design principles)
- **Regional rails (APAC / Caribbean / Arbitrum x402)** → [`rails.md`](./rails.md)
- **Roadmap, grant tracks, yield strategy, 0G plan** → [`roadmap.md`](./roadmap.md)
- **North star — SME FX strategy** → [`strategy.md`](./strategy.md)
- **Architecture & the data-stream map** → [`architecture.md`](./architecture.md)

## Deploy ops

- **Backend** → run `./scripts/deploy-to-hetzner.sh` from the project root. See top-of-script comments for env overrides (`DEPLOY_SKIP_BUILD`, `DEPLOY_SYNC_ENV`, `DEPLOY_SKIP_GATE`).
- **Contracts** → run `./scripts/deploy-all.sh <chain> [--verify]`. See script header for supported chains.
- **Frontend** → Vercel handles deploys on push to `main`. No manual step.
- **Cloud setup details** → [`ops.md`](./ops.md)

## Top-level

- **[`../README.md`](../README.md)** — product summary, quick start, repo map
- **[`../CONTRIBUTING.md`](../CONTRIBUTING.md)** — setup, commands, "where do I change X?"
- **[`../AGENTS.md`](../AGENTS.md)** — repo conventions, build/test commands, coding style for coding agents

## Local-only notes

`docs/internal/` is **git-ignored** (local-only scratch) — it isn't committed and won't appear for contributors. Committed history/exploratory material lives at the top level: [`architecture-notes.md`](./architecture-notes.md), [`roadmap-log.md`](./roadmap-log.md), and the superseded [`mascot-raster-brief.md`](./mascot-raster-brief.md).
