# Docs

Index for `docs/`. Start at the top, drill down by need.

## Start here

1. **[`product.md`](./product.md)** — what DiversiFi is, who it's for, the protection plans, what we cut, current priorities. ~5 min read.
2. **[`architecture.md`](./architecture.md)** — system architecture, AI provider chain, swap orchestrator, Guardian loop, 0G verifiability stack, Arc x402 loop. ~15 min read.

## By need

- **New contributor setting up locally** → [`getting-started.md`](./getting-started.md) (env vars, quick start, deploy)
- **External agent integrating with the intelligence gateway** → [`integration-guide.md`](./integration-guide.md) (x402 flow, API reference, code example)
- **Looking up an API endpoint, provider, or env var** → [`integrations.md`](./integrations.md) (comprehensive reference; the canonical env var table)
- **Understanding the Guardian's spending bounds & what stops a compromised server** → [`guardian-enforcement-model.md`](./guardian-enforcement-model.md) (TL;DR + threat model + hybrid plan)
- **Agent identity (ERC-8004 + Self Protocol)** → [`agent-identity.md`](./agent-identity.md) (registration, signing, verification)
- **Roadmap & active grant tracks** → [`roadmap.md`](./roadmap.md) (product quality plan + 3 grant tracks: 0G Bridge, Celo Prezenti, Arbitrum Open House) + [`0g-bridge-plan.md`](./0g-bridge-plan.md) (authoritative 0G file-by-file plan)

## Deploy ops

- **Backend** → run `./scripts/deploy-to-hetzner.sh` from the project root. See top-of-script comments for env overrides (`DEPLOY_SKIP_BUILD`, `DEPLOY_SYNC_ENV`, `DEPLOY_SKIP_GATE`).
- **Contracts** → run `./scripts/deploy-all.sh <chain> [--verify]`. See script header for supported chains.
- **Frontend** → Vercel handles deploys on push to `main`. No manual step.

## Top-level

- **[`../README.md`](../README.md)** — marketing / deployment proofs / quick demo flow
- **[`../AGENTS.md`](../AGENTS.md)** — repo conventions, build/test commands, coding style for coding agents

## Internal / archived

- `internal/` — ops notes, one-off runbooks
- `internal/archive/` — historical plans kept for reference; not authoritative
