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
| 2 | **[`product.md`](./product.md)** | What DiversiFi is, who it's for (both directions of the FX trade), protection plans, differentiators — adaptive-experience summary links to `internal/` |
| 3 | **[`design-language.md`](./design-language.md)** | Surface design principles — one job per screen, concentrated expressiveness, controls-as-motif, disclosure tiers, PR checklist |
| 4 | **[`architecture.md`](./architecture.md)** | System architecture, AI provider chain, swap orchestrator, Guardian loop, 0G verifiability stack, data streams & their jobs |
| 5 | **[`integrations.md`](./integrations.md)** | API endpoints, AI providers, data sources, env var tables, external agent integration guide |
| 6 | **[`roadmap.md`](./roadmap.md)** | The forward-looking plan only — active priorities, long-term chain architecture, deferred list |
| 7 | **[`strategy.md`](./strategy.md)** | North star — SME FX working capital, Ghanaian-importer wedge, market research, implementation plan |
| 8 | **[`guardian.md`](./guardian.md)** | Guardian spending bounds, threat model, enforcement plan + agent identity (ERC-8004 + Self Protocol) |
| 9 | **[`rails.md`](./rails.md)** | Regional savings & settlement lanes — APAC (HashKey), Caribbean, Arbitrum x402 settlement |
| 10 | **[`ops.md`](./ops.md)** | Deployment & ops (Alibaba Cloud proof, deploy scripts) |
| — | [`roadmap-log.md`](./roadmap-log.md) | Historical log of what shipped per wave + grant-track close-outs — the dated history sink |
| — | [`internal/architecture-notes.md`](./internal/architecture-notes.md) | Exploratory engineering findings (Circle agent stack, dependency audit) — reference, not current architecture |
| — | [`internal/adaptive-experience.md`](./internal/adaptive-experience.md) | Adaptive-experience design doc — signal schema, per-persona routing, phases (summary: `product.md` § Adaptive experience) |
| — | [`internal/guardian-reasoning-service.md`](./internal/guardian-reasoning-service.md) | Design draft for the unified Guardian reasoning service (shipped — see `guardian.md`) |
| — | [`internal/mascot-raster-brief.md`](./internal/mascot-raster-brief.md) | **Superseded** mascot raster brief (authoritative spec: `design-language.md` §9) |
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
- **Forward plan + track status** → [`roadmap.md`](./roadmap.md); **what shipped when** → [`roadmap-log.md`](./roadmap-log.md)
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

## Internal docs

`docs/internal/` holds exploratory, superseded, and design-draft material — committed, but not part of the active doc set. Historical shipped-work detail lives in [`roadmap-log.md`](./roadmap-log.md).
