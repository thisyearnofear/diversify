# Docs

Index for `docs/`. Start at the top, drill down by need.

## Start here

1. **[`product.md`](./product.md)** — what DiversiFi is, who it's for, the protection plans, what we cut, current priorities. ~5 min read.
2. **[`architecture.md`](./architecture.md)** — system architecture, AI provider chain, swap orchestrator, Guardian loop, 0G verifiability stack, Arc x402 loop. ~15 min read.

## By need

- **New contributor setting up locally** → [`getting-started.md`](./getting-started.md) (env vars, quick start, deploy)
- **Looking up an API endpoint, provider, or env var** → [`integrations.md`](./integrations.md) (comprehensive reference)
- **Understanding the Guardian's spending bounds & what stops a compromised server** → [`guardian-enforcement-model.md`](./guardian-enforcement-model.md) (TL;DR + threat model + hybrid plan)
- **Auditing recent hardening work** → [`phase-4-audit.md`](./phase-4-audit.md) (per-phase verdicts + residuals)
- **Roadmap / buildathon planning** → [`roadmap.md`](./roadmap.md) (summary) + [`0g-bridge-plan.md`](./0g-bridge-plan.md) (authoritative file-by-file plan)
- **Deploy ops** → run `./scripts/deploy-to-hetzner.sh` (canonical); see top-of-script comments for env overrides and the healthz-gate rollback path. The legacy Netlify-era runbook was removed in 2026-06 (search git history if needed).

## Top-level

- **[`../README.md`](../README.md)** — marketing / judge verification / quick demo flow
- **[`../AGENTS.md`](../AGENTS.md)** — repo conventions, build/test commands, coding style for coding agents

## Internal / archived

- `internal/` — ops notes, env diffs, one-off runbooks (not for judges)
- `internal/archive/` — historical plans kept for reference; not authoritative
