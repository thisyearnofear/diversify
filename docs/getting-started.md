# Getting Started

## Quick Start

```bash
pnpm install
cp .env.example .env.local   # Add API keys (see below)
pnpm dev                      # Starts on port 3042
```

Users can sign in via email, social login, or existing wallet (Privy). No wallet required to explore the demo.

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app (social login + smart accounts) |
| `PRIVY_APP_SECRET` | Privy server SDK (session signer execution) |

That's the minimum to run the app. Every other env var (AI providers, data feeds, Arc/x402, Circle, deployment) is documented in [`integrations.md`](./integrations.md) — pick what you need and the linked doc has the table, the purpose, and the source.

## Supported Chains

| Chain | Role | Testnet Faucet |
|-------|---------|----------------|
| **Celo** | Savings + identity + savings ledger of record (`0x3BCf…369C` on mainnet) | [Celo Faucet](https://celo.org/developers/faucet) |
| **Arbitrum** | Yield + execution + yield ledger of record (`0x3BCf…369C` on mainnet) | [Arbitrum Faucet](https://faucet.arbitrum.io/) |
| **0G** | Evidence layer (Storage CIDs, Compute TEE proofs, DA snapshots, evidence anchor ledger `0x3BCf…369C` on mainnet) | [0G Galileo Faucet](https://chainscan-galileo.0g.ai) |
| **Arc Testnet** | x402 nanopayment settlement (USDC gas) | Circle Arc Faucet |
| **Robinhood Chain** | Emerging market tokens | Robinhood Faucet |

## Arc / x402 Research Mode

Enable the autonomous research-payment loop where the Guardian negotiates paid premium data via x402 nanopayments settled on Arc:

1. Set `NEXT_PUBLIC_ENABLE_ARC=true`
2. Set `ENABLE_AUTONOMOUS_MODE=true`
3. Configure `ARC_RPC_URL` and `DATA_HUB_RECIPIENT_ADDRESS`
4. Fund the agent EOA with Arc testnet USDC (see below)

### Verification

```bash
pnpm test-x402                   # Basic x402 gateway challenge/response
pnpm test-x402-comprehensive      # Full research-payment-settlement cycle
pnpm test-x402-frequency          # Payment frequency validation
```

### Funding the Agent Wallet

The agent wallet must hold testnet USDC on Arc to settle paid requests.

1. Get the address: `GET /api/agent/x402-metrics` → `arcSettlement.agentAddress`
2. Fund it via [Circle Arc Faucet](https://faucet.circle.com) → select **Arc Testnet** → paste address
3. Verify: `arcSettlement.agentUSDCBalance` reflects the balance

### Generating Test Volume

```bash
X402_BUYER_PRIVATE_KEY=<funded_arc_testnet_buyer> \
RUN_COUNT=17 \
X402_SOURCES=macro_analysis,portfolio_optimization,risk_assessment \
pnpm generate-x402-volume
```

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

### Frontend (Vercel)

```bash
pnpm build
# Deploy output to your hosting provider
```

### Agent Runtime (Hetzner)

The agent runtime runs as a standalone Node.js process with PM2:

1. Copy deploy scripts from `.example` files (never commit real credentials)
2. Set environment variables on the server
3. Run `./scripts/deploy-to-hetzner.sh` from the project root — it builds locally, rsyncs the standalone bundle to the server, restarts PM2, and gates on `/api/healthz` with automatic rollback

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
