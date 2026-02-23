# DiversiFi Documentation

This `/docs` folder is the single entry-point for project documentation.

## Public docs (safe to share)
- [Product Guide](./PRODUCT_GUIDE.md)
- [User Guide](./USER_GUIDE.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Technical Architecture](./TECHNICAL_ARCHITECTURE.md)
- [Test Drive Guide](./TEST_DRIVE_GUIDE.md)
- [Testnet Faucets](./TESTNET_FAUCETS.md)

## Internal / security-sensitive docs
We intentionally **do not** publish infrastructure/runbook details (server provider, domains, ports, Nginx/PM2 config, log paths, etc.) in the public repository.

Place internal docs here locally (and keep them out of git):
- `docs/internal/DEPLOYMENT_RUNBOOK.md`
- `docs/internal/INCIDENT_RESPONSE.md`
- `docs/internal/SECRETS_AND_ROTATION.md`

If you need to share deployment instructions with collaborators, prefer a private repository, your password manager’s secure notes, or an internal wiki.
