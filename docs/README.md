# Docs

Index for `docs/`. Start at the top, drill down by need.

## Start here

1. **[`product.md`](./product.md)** — what DiversiFi is, who it's for, the protection plans, what we cut, current priorities. ~5 min read.
2. **[`architecture.md`](./architecture.md)** — system architecture, AI provider chain, swap orchestrator, Guardian loop, 0G verifiability stack, Arc x402 loop. ~15 min read.

## By need

- **New contributor setting up locally** → [`getting-started.md`](./getting-started.md) (env vars, quick start, deploy)
- **Looking up an API endpoint, provider, or env var** → [`integrations.md`](./integrations.md) (comprehensive reference; the canonical env var table)
- **Understanding the Guardian's spending bounds & what stops a compromised server** → [`guardian-enforcement-model.md`](./guardian-enforcement-model.md) (TL;DR + threat model + hybrid plan)
- **Auditing recent hardening work** → [`phase-4-audit.md`](./phase-4-audit.md) (summary, score, residuals, final tally). Per-phase detail and cross-cutting findings live in [`internal/archive/phase-4-audit-detailed.md`](./internal/archive/phase-4-audit-detailed.md).
- **Roadmap / buildathon planning** → [`roadmap.md`](./roadmap.md) (summary) + [`0g-bridge-plan.md`](./0g-bridge-plan.md) (authoritative file-by-file plan)

## Deploy ops

- **Backend** → run `./scripts/deploy-to-hetzner.sh` from the project root. See top-of-script comments for env overrides (`DEPLOY_SKIP_BUILD`, `DEPLOY_SYNC_ENV`, `DEPLOY_SKIP_GATE`).
- **Contracts** → run `./scripts/deploy-all.sh <chain> [--verify]`. See script header for supported chains.
- **Frontend** → Vercel handles deploys on push to `main`. No manual step.

## Top-level

- **[`../README.md`](../README.md)** — marketing / judge verification / quick demo flow
- **[`../AGENTS.md`](../AGENTS.md)** — repo conventions, build/test commands, coding style for coding agents

## Internal / archived

- `internal/` — ops notes, one-off runbooks (not for judges)
- `internal/archive/` — historical plans and detailed audits kept for reference; not authoritative
