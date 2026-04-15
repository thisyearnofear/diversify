# Getting Started

## Quick Start

```bash
pnpm install
cp .env.example .env.local
# Add API keys (see below)
pnpm dev
```

No wallet required — users can sign in via email, social login, or existing wallet.

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app (social login + smart accounts) |
| `PRIVY_APP_SECRET` | Privy server SDK (session signer execution) |

## Optional Environment Variables

| Variable | Purpose |
|----------|---------|
| `VAULT_PRIVATE_KEY` | Dev fallback when Privy smart account not configured |
| `GEMINI_API_KEY` | AI fallback (Venice AI is primary) |
| `GOOGLE_AI_API_KEY` | Google AI services |
| `VENICE_API_KEY` | Venice AI (primary agent intelligence) |
| `SYNTHDATA_API_KEY` | SynthData analytics |
| `FRED_API_KEY` | Federal Reserve economic data (inflation rates) |
| `COINGECKO_API_KEY` | Exchange rates |

## Supported Chains

| Chain | Purpose | Testnet Faucet |
|-------|---------|----------------|
| **Celo** | Stablecoin swaps (cUSD, cEUR, cREAL, KESm, COPm, PHPm) | [Celo Faucet](https://celo.org/developers/faucet) |
| **Arbitrum** | Yield/RWA (USDC, USDY) | [Arbitrum Faucet](https://faucet.arbitrum.io/) |
| **Arc Testnet** | Agent orchestration hub (USDC gas) | Circle Arc Faucet |
| **Robinhood Chain** | Emerging market tokens | Robinhood Faucet |

## Test Drive

1. Switch to Celo Sepolia in your wallet
2. Get testnet tokens from the faucet
3. Create a vault via `/api/vault/create`
4. Pick a protection plan and deposit testnet stablecoins
5. Monitor allocations and P&L in the dashboard

## Setup: Privy Smart Accounts

1. **Privy Dashboard** → Enable smart wallets → Select "Safe"
2. **Configure Celo chain** → Add bundler URL (Pimlico, Alchemy, etc.)
3. **Enable session signers** → Create spending policy for the agent
4. **Set env vars** → `PRIVY_APP_ID` + `PRIVY_APP_SECRET`

## Deployment

### Frontend (Vercel/Netlify/Cloudflare)

```bash
pnpm build
# Deploy output to your hosting provider
```

### Agent Runtime (Hetzner)

The agent runtime runs as a standalone Node.js process with PM2:

1. Copy deploy scripts from `.example` files (never commit real credentials)
2. Set environment variables on the server
3. Run `./deploy-hetzner.sh` to push and restart

### Contract Deployment (Foundry)

```bash
forge create src/contracts/Vault.sol:Vault \
  --rpc-url $CELO_SEPOLIA_RPC \
  --private-key $DEPLOYER_KEY \
  --constructor-args $INITIAL_OWNER
```

After deployment, update `config/contracts.ts` with new addresses and verify on explorers.

### Expected Costs

| Network | Deploy Cost | Typical Tx |
|---------|------------|------------|
| Celo Sepolia | ~0.01 CELO | ~0.001 CELO |
| Arbitrum Sepolia | ~0.001 ETH | ~0.0001 ETH |
| Arc Testnet | Free (faucet) | Free |

## Troubleshooting

- **Insufficient funds**: Ensure deployer wallet has testnet tokens
- **Nonce issues**: Reset wallet nonce or use `--nonce` flag
- **Transaction reverts**: Check constructor args and contract dependencies
- **Agent not executing**: Verify agent runtime is running (`pm2 status`)
