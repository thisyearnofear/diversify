# Scripts Directory

This directory contains utility scripts for development, testing, and deployment.

## Security Notice

⚠️ **Deployment scripts with server-specific details are gitignored for security.**

Files ending in `.example` are templates that should be copied and customized:

```bash
# Copy example files and customize with your server details
cp deploy-hetzner.sh.example deploy-hetzner.sh
cp start-runtime.sh.example start-runtime.sh
cp pm2.ecosystem.config.cjs.example pm2.ecosystem.config.cjs
cp nginx-diversifi-api.conf.example nginx-diversifi-api.conf
cp deploy-env-to-server.sh.example deploy-env-to-server.sh

# Edit the files with your actual server details
# These customized files will NOT be committed to git
```

## Deployment Scripts (Gitignored)

These files contain server-specific details and should NOT be committed:

- `deploy-hetzner.sh` - Server deployment script copied from the example template
- `start-runtime.sh` - Runtime bootstrap script copied from the example template
- `pm2.ecosystem.config.cjs` - PM2 app definition copied from the example template
- `deploy-env-to-server.sh` - Environment variable deployment
- `nginx-diversifi-api.conf` - Nginx configuration
- `setup-mongodb.sh` - MongoDB setup script

## Safe to Commit

All other scripts are safe to commit as they don't contain sensitive information:

- Development utilities
- Test scripts
- Generic setup helpers
- Analysis tools

## Why This Approach?

Keeping deployment scripts out of version control prevents:

- Exposing server hostnames and IP addresses
- Revealing internal port numbers
- Disclosing infrastructure topology
- Making it easier for attackers to target your infrastructure

Instead, we provide `.example` templates that can be customized per environment.

The `deploy-hetzner.sh.example` template is the canonical tracked version.
It includes runtime checks and removes `.next/cache` after successful builds so
Hetzner does not accumulate unnecessary Next build cache over time.

Use `start-runtime.sh.example` and `pm2.ecosystem.config.cjs.example` as the
canonical tracked templates for bootstrapping the Hetzner runtime without
committing server-specific paths or secrets.

The intended Hetzner shape is:
- source/build checkout in one directory
- standalone runtime extracted into a separate runtime directory
- PM2 pointed at the runtime directory, not the source checkout

If a build does not emit `.next/standalone/server.js`, the deploy helper should
fall back to running PM2 from the fresh source build instead of leaving the
runtime on an older extracted bundle.
