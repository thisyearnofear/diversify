# Core Principles
See [core-principles/taste.md](core-principles/taste.md)
# Workflow
- Stage, commit, and push changes to main branch (avoid feature branches when possible). Confidence: 0.80
- Only update existing documentation files; do not create new docs unless explicitly requested. Confidence: 0.85
- Skip local builds for the frontend; stage, commit, push and let Vercel handle deployment. Confidence: 0.75
- Use `gh auth switch` to manage GitHub authentication when push fails. Confidence: 0.70

# Infrastructure
- Frontend is served by Vercel; backend (diversifi-api) runs on Hetzner server at /opt using pm2. Confidence: 0.85
- Access backend server via `ssh snel-bot` with key-based authentication. Confidence: 0.85
- Build locally with webpack (`pnpm next build --webpack`), then rsync with `--copy-links` to Hetzner. Never install/build on the server itself (space-constrained, npm disabled). Confidence: 0.85
- Never use `--delete` when rsyncing `.next/` to Hetzner; it removes BUILD_ID and other runtime files, breaking the production server. Confidence: 0.75

# Wallet
- Users primarily connect via Rabby wallet (injected provider), not Privy. Confidence: 0.70
- Use Reown (WalletConnect) project ID cd69f8e130afc51324873cdde47a1d61 for wallet connections. Confidence: 0.75

# AI Response Style
See [ai-response-style/taste.md](ai-response-style/taste.md)
# Frontend
- Use Framer Motion for animations in React components. Confidence: 0.70

# Deployment
- Before deploying, test external integration response times and optimize UX for latency (async patterns, caching, streaming, pre-fetching) rather than accepting slow synchronous responses. Confidence: 0.75

