# Core Principles
See [core-principles/taste.md](core-principles/taste.md)
# Workflow
See [workflow/taste.md](workflow/taste.md)
# Infrastructure
- Frontend is served by Vercel; backend (diversifi-api) runs on Hetzner server at /opt using pm2. Confidence: 0.85
- Access backend server via `ssh snel-bot` with key-based authentication. Confidence: 0.85
- Build locally with webpack (`pnpm next build --webpack`), then rsync with `--copy-links` to Hetzner. Never install/build on the server itself (space-constrained, npm disabled). Confidence: 0.85
- Never use `--delete` when rsyncing `.next/` to Hetzner; it removes BUILD_ID and other runtime files, breaking the production server. Confidence: 0.75
- Use `scripts/deploy-to-hetzner.sh` for backend deploys (builds locally, rsyncs to server); `scripts/deploy-hetzner.sh` (server-side build) is deprecated and was deleted in favor of the local-build + rsync approach (server is space-constrained). Confidence: 0.90

# Wallet
- Users primarily connect via Rabby wallet (injected provider), not Privy. Confidence: 0.70
- Use Reown (WalletConnect) project ID cd69f8e130afc51324873cdde47a1d61 for wallet connections. Confidence: 0.75

# AI Response Style
See [ai-response-style/taste.md](ai-response-style/taste.md)
# Frontend
- Use Framer Motion for animations in React components. Confidence: 0.70

# Deployment
- Before deploying, test external integration response times and optimize UX for latency (async patterns, caching, streaming, pre-fetching) rather than accepting slow synchronous responses. Confidence: 0.75

