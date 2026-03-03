# Scripts Directory

This directory contains utility scripts for development, testing, and deployment.

## Security Notice

⚠️ **Deployment scripts with server-specific details are gitignored for security.**

Files ending in `.example` are templates that should be copied and customized:

```bash
# Copy example files and customize with your server details
cp deploy-hetzner.sh.example deploy-hetzner.sh
cp nginx-diversifi-api.conf.example nginx-diversifi-api.conf
cp deploy-env-to-server.sh.example deploy-env-to-server.sh

# Edit the files with your actual server details
# These customized files will NOT be committed to git
```

## Deployment Scripts (Gitignored)

These files contain server-specific details and should NOT be committed:

- `deploy-hetzner.sh` - Server deployment script
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
