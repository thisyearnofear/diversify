# Integrations & Security

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/vault/create` | POST/GET | Create or check vault |
| `/api/vault/deposit` | POST | Record deposit |
| `/api/vault/withdraw` | POST | Withdraw with fee settlement |
| `/api/vault/balance` | GET | Vault summary (holdings, P&L, fees) |
| `/api/vault/permission` | POST/GET/DELETE | ERC-7715 permission CRUD |
| `/api/vault/rebalance` | POST | Agent-triggered rebalance |
| `/api/vault/transactions` | GET | Transaction history |
| `/api/vault/fees` | GET | Fee summary |
| `/api/status` | GET | System health check |
| `/api/agent/execute-swap` | POST | Execute swap via OpenClaw |

## AI Providers

| Provider | Role | Fallback |
|----------|------|----------|
| **Venice AI** | Primary agent intelligence | Gemini |
| **Gemini** | AI fallback | Error response |
| **Google AI** | Embeddings, analysis | — |

### AI Endpoints & Caching

- All AI responses cached for 5 minutes to reduce API calls
- Rate limit: 60 req/min per provider
- Error taxonomy: timeout → retry once, rate limit → queue, auth error → alert

## Data Providers

| Provider | Data | Rate Limit |
|----------|------|------------|
| **World Bank** | Inflation rates | 10k req/month |
| **FRED** | Economic indicators | 120 req/min |
| **CoinGecko** | Exchange rates | 50k req/month |
| **DeFiLlama** | TVL, yields | 100 req/day |
| **GoodDollar** | UBI distribution | — |

## DEX & Routing

| Chain | DEX | Router |
|-------|-----|--------|
| **Celo** | Mento Protocol | Built-in stablecoin swaps |
| **Arbitrum** | Uniswap V3, 1inch | LiFi for cross-chain |
| **Hyperliquid** | Perps DEX | Direct API |
| **Robinhood Chain** | AMM | Built-in |

## Circle (CCTP & MPC)

- **CCTP Domains**: Arc → Arbitrum, Arbitrum → Celo (via bridge)
- **MPC Wallets**: Circle MPC for agent fuel tank + Hyperliquid API keys
- **EIP-3009**: USDC transfer with authorization for nanopayments

## Wallet Integration

Provider priority: Farcaster > MiniPay > Injected > AppKit

```typescript
// Network config example
{
  id: 'celo',
  name: 'Celo',
  nativeCurrency: { symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: 'https://forno.celo.org' },
  blockExplorers: { default: { url: 'https://celoscan.io' } }
}
```

## Security Hardening

### Scripts & Credentials
- Deploy scripts excluded from git (`.gitignore`)
- `.example` files provided with placeholder env vars
- Never commit real credentials or API keys

### MongoDB
- Removed `0.0.0.0/0` access rule
- Use IP whitelisting for production
- Enable encryption at rest

### SSH & Server
- Use SSH keys (no password auth)
- Restrict MongoDB Atlas to server IP only
- Enable firewall on Hetzner server
- Rotate API keys regularly

### Deployment Scripts Security
The following files are git-ignored and must be configured from `.example` templates:
- `deploy-hetzner.sh` — Server deployment script
- `start-runtime.sh` — Agent runtime startup
- `pm2.ecosystem.config.cjs` — PM2 process config with env vars
- `deploy-env-to-server.sh` — Environment sync
- `nginx.conf` — Reverse proxy config

## Rate Limits & Caching Strategy

| Provider | Limit | Cache Duration |
|----------|-------|----------------|
| Venice AI | 60 req/min | 5 min |
| Gemini | 60 req/min | 5 min |
| World Bank | 10k/month | 24 hrs |
| FRED | 120/min | 1 hr |
| CoinGecko | 50k/month | 1 min |
| DeFiLlama | 100/day | 6 hrs |

## Tech Stack Summary

| Category | Technology |
|----------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Smart Accounts | Privy + Safe (ERC-4337) |
| AI | Venice AI (primary), Gemini (fallback) |
| Swaps | Mento Protocol (Celo), 1inch/Uniswap (Arbitrum) |
| Bridging | Circle CCTP, LiFi |
| Hedging | Hyperliquid perps |
| Orchestration | OpenClaw |
| Data | World Bank, FRED, CoinGecko, DeFiLlama |
| Database | MongoDB |
| Hosting | Vercel/Netlify (frontend), Hetzner (agent runtime) |
