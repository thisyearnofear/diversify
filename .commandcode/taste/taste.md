# Core Principles
See [core-principles/taste.md](core-principles/taste.md)
# Workflow
- Stage, commit, and push changes to main branch (avoid feature branches when possible). Confidence: 0.80
- Only update existing documentation files; do not create new docs unless explicitly requested. Confidence: 0.85
- Validate that the project builds before pushing changes. Confidence: 0.75
- Use `gh auth switch` to manage GitHub authentication when push fails. Confidence: 0.70

# Infrastructure
- Frontend is served by Vercel; backend (diversifi-api) runs on Hetzner server at /opt using pm2. Confidence: 0.85
- Access backend server via `ssh snel-bot` with key-based authentication. Confidence: 0.85
- Build locally with webpack (`pnpm next build --webpack`), then rsync with `--copy-links` to Hetzner. Never install/build on the server itself (space-constrained, npm disabled). Confidence: 0.85

# Wallet
- Users primarily connect via Rabby wallet (injected provider), not Privy. Confidence: 0.70
- Use Reown (WalletConnect) project ID cd69f8e130afc51324873cdde47a1d61 for wallet connections. Confidence: 0.75

# AI Response Style
- Keep AI advisor responses concise: max 3 sentences for simple questions, max 5 bullets for complex ones. Confidence: 0.85
- Never use filler phrases like "I'd be happy to help", "Consider", "You might want to", or "Let me explain" in AI responses. Confidence: 0.85
- Never lead with disclaimers; if wallet not connected, state the action item once at the end instead of opening with limitations. Confidence: 0.85
- End AI responses with one clear next action, not a pitch or CTA. Confidence: 0.85
- Use the user's actual context (region, chain, balances) in AI responses instead of giving generic advice. Confidence: 0.85

# Frontend
- Use Framer Motion for animations in React components. Confidence: 0.70

# Deployment
- Before deploying, test external integration response times and optimize UX for latency (async patterns, caching, streaming, pre-fetching) rather than accepting slow synchronous responses. Confidence: 0.75

