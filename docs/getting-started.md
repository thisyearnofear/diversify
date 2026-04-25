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
| `GEMINI_API_KEY` | **Primary** AI provider (Gemini Flash / Pro). Required for Google prize track. |
| `VENICE_API_KEY` | Secondary AI fallback |
| `GOOGLE_AI_API_KEY` | Google AI services (embeddings etc.) |
| `SYNTHDATA_API_KEY` | SynthData analytics |
| `FRED_API_KEY` | Federal Reserve economic data (inflation rates) |
| `COINGECKO_API_KEY` | Exchange rates |
| `NEXT_PUBLIC_ENABLE_ARC` | Enable Arc testnet features in the UI |
| `ENABLE_AUTONOMOUS_MODE` | Enable the Arc/x402 research flow |
| `ARC_RPC_URL` | Arc RPC endpoint for payment verification |
| `DATA_HUB_RECIPIENT_ADDRESS` | Recipient for Arc research payments |

## Supported Chains

| Chain | Purpose | Testnet Faucet |
|-------|---------|----------------|
| **Celo** | Stablecoin swaps (cUSD, cEUR, cREAL, KESm, COPm, PHPm) | [Celo Faucet](https://celo.org/developers/faucet) |
| **Arbitrum** | Yield/RWA (USDC, USDY) | [Arbitrum Faucet](https://faucet.arbitrum.io/) |
| **Arc Testnet** | Agent orchestration hub (USDC gas) | Circle Arc Faucet |
| **Robinhood Chain** | Emerging market tokens | Robinhood Faucet |

## Hackathon Research Mode

If you are building the Arc Nano Payments submission, keep the existing app and add the research-payment loop on top:

1. Set `NEXT_PUBLIC_ENABLE_ARC=true`
2. Set `ENABLE_AUTONOMOUS_MODE=true`
3. Configure `ARC_RPC_URL` and `DATA_HUB_RECIPIENT_ADDRESS`
4. Create a Circle developer account and connect the same email used in the hackathon registration
5. Use the Arc faucet for test funds and verify the research flow end to end

This mode should reuse the advisor, action cards, and x402 gateway. Do not add a separate payment stack unless it replaces current logic.

### Hackathon Verification Commands

```bash
pnpm test-x402
pnpm test-x402-comprehensive
pnpm test-x402-frequency
```

For judge-facing evidence, use:

- `GET /api/agent/x402-metrics` for transaction frequency and pricing caps
- Circle Developer Console + Arc Explorer for end-to-end settlement proof

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
