# Scripts Directory

This directory contains utility scripts for development, testing, and deployment.

## FX Drag Report (concierge analysis)

`npx tsx scripts/fx-drag-report.ts <cycles.json> [--ramp-bps 50] [--out report.md]`

Quantifies what FX movement, bank spread, and fees cost an import business
across its purchase cycles vs converting proceeds to USD-pegged value on
arrival. The Phase 0 validation instrument from `docs/sme-fx-strategy.md`.
Input format documented in the script header; sample:
`scripts/fx-drag/sample-cycles.kenya-textbooks.json`. Historical mid-market
rates are fetched once and cached in `scripts/fx-drag/.rate-cache.json`
(gitignored). Math lives in `scripts/fx-drag/calc.ts` with tests in
`scripts/__tests__/fx-drag-calc.test.ts`.

## Deploying

The canonical backend deploy is `./scripts/deploy-to-hetzner.sh` (local build + rsync to Hetzner with a healthz gate and automatic rollback). See the script's header for env overrides (`DEPLOY_SKIP_BUILD`, `DEPLOY_SYNC_ENV`, `DEPLOY_SKIP_GATE`).

Contract deploys: `./scripts/deploy-all.sh <chain> [--verify]`. See the script header for supported chains (Arbitrum One, Arbitrum Sepolia, Celo, or a custom RPC URL).

## Security Notice

⚠️ **Scripts with server-specific details are gitignored for security.** `.example` files are templates — copy and customize, never commit the customized version.

```bash
# Copy example files and customize with your server details
cp start-runtime.sh.example start-runtime.sh
cp pm2.ecosystem.config.cjs.example pm2.ecosystem.config.cjs
cp nginx-diversifi-api.conf.example nginx-diversifi-api.conf
cp deploy-env-to-server.sh.example deploy-env-to-server.sh

# Edit the files with your actual server details
# These customized files will NOT be committed to git
```

## Gitignored (server-specific)

- `start-runtime.sh` — runtime bootstrap (path, port, env)
- `pm2.ecosystem.config.cjs` — PM2 app definition
- `nginx-diversifi-api.conf` — Nginx reverse proxy
- `deploy-env-to-server.sh` — `.env` sync helper
- `setup-mongodb.sh` — MongoDB setup with auth

## Tracked

- `deploy-to-hetzner.sh` — **the active backend deploy** (local build → rsync → PM2 restart → healthz gate). No server-specific data, safe to commit.
- `deploy-all.sh`, `Deploy*.s.sol` — contract deployment
- `test-guardian-loop.sh`, `check-env-drift*.sh`, `check-secrets.sh`, `server-health-check.sh` — verification helpers
- `start-runtime.sh.example`, `pm2.ecosystem.config.cjs.example`, `nginx-diversifi-api.conf.example` — templates to copy
- `setup-firecrawl-monitors.ts` — Firecrawl watcher registration

## Hetzner runtime shape (intended)

- Source/build checkout in one directory
- Standalone runtime extracted into a separate runtime directory
- PM2 pointed at the runtime directory, not the source checkout

If a build does not emit `.next/standalone/server.js`, the deploy helper falls back to running PM2 from the fresh source build instead of leaving the runtime on an older extracted bundle.

## Removed (2026-06)

- `deploy-hetzner.sh` and `deploy-hetzner.sh.example` — superseded by `deploy-to-hetzner.sh` (the Hetzner server is space-constrained and cannot build locally).

