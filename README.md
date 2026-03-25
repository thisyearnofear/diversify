# DiversiFi — AI Wealth Protection

AI-powered stablecoin diversification across Celo. Protect your purchasing power from inflation and currency volatility.

## What It Does

- **Regional Stablecoins** — Diversify across cUSD (US), cEUR (EU), KESm (Kenya), COPm (Colombia), PHPm (Philippines), cREAL (Brazil)
- **Inflation-Aware Rebalancing** — Agent monitors inflation rates per region and recommends swaps when conditions change
- **Financial Strategies** — Choose from 7 cultural philosophies (Africapitalism, Islamic Finance, Global Diversification, etc.)
- **Non-Custodial** — Your funds stay in your Safe smart account. Agent transacts only within your permission limits
- **Transparent Fees** — 1% annual management + 10% performance above high-water mark + 0.10% swap spread

## Architecture

```
User connects → Privy creates Safe smart account
User picks strategy → signs spending permission ($50/day, 7 days)
User deposits stablecoins → agent diversifies per strategy
User monitors → real-time receipts, allocations, P&L
User withdraws anytime → fees settled at withdrawal
```

### Key Components

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Smart Account** | Privy + Safe | User funds, session signer, policy enforcement |
| **Business Logic** | `vault.service.ts` | Permission checks, fee calculation, rebalance orchestration |
| **Execution** | `_executor.ts` | Bridges service → chain (Privy smart account or direct signing) |
| **Persistence** | MongoDB models | Vault, Transaction, Permission records |
| **Intelligence** | Strategy engine | Inflation analysis, allocation targets, rebalance recommendations |
| **Frontend** | React + hooks | `useVault`, `useSessionKey`, `AgentTierStatus` |

### Security Model

- **No private key on server** — Signing happens in Privy's secure enclave (production) or VAULT_PRIVATE_KEY (dev fallback)
- **Policy-enforced** — Privy session signer policies limit spending, allowed contracts, time bounds
- **Non-custodial** — User always controls their Safe smart account; agent can only swap within policy
- **Audited primitives** — Safe contracts, Privy SDK, OpenZeppelin — no custom Solidity

## Quick Start

```bash
pnpm install
cp .env.example .env.local
# Set required keys in .env.local
pnpm dev
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app (social login + smart accounts) |
| `PRIVY_APP_SECRET` | Privy server SDK (session signer execution) |
| `OPENCLAW_BOT_URL` | OpenClaw wrapper (receipt logging) |
| `OPENCLAW_SETUP_PASSWORD` | OpenClaw auth |

### Optional

| Variable | Purpose |
|----------|---------|
| `VAULT_PRIVATE_KEY` | Dev fallback when Privy smart account not configured |
| `GEMINI_API_KEY` | AI fallback (Venice AI is primary) |

## Setup: Privy Smart Accounts

1. **Privy Dashboard** → Enable smart wallets → Select "Safe"
2. **Configure Celo chain** → Add bundler URL (Pimlico, Alchemy, etc.)
3. **Enable session signers** → Create spending policy for the agent
4. **Set env vars** → `PRIVY_APP_ID` + `PRIVY_APP_SECRET`

## Supported Chains

- **Celo** — Mento Protocol DEX, regional stablecoins (cUSD, cEUR, cREAL, KESm, COPm, PHPm)

## Financial Strategies

| Strategy | Focus |
|----------|-------|
| Africapitalism | Keep wealth in African economies |
| Buen Vivir | Balance material wealth with community (LatAm) |
| Islamic Finance | Sharia-compliant, no interest-bearing assets |
| Global Diversification | Maximum geographic spread |
| Custom | Define your own allocation targets |

Each strategy shapes rebalancing recommendations and asset filtering.

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

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Smart Accounts | Privy + Safe (ERC-4337) |
| AI | Venice AI (primary), Gemini 3.0 (fallback) |
| Swaps | Mento Protocol (Celo stablecoins) |
| Data | World Bank inflation, exchange rates |
| Wallet | Privy social login, MetaMask, Farcaster |

## License

MIT
