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
| **Arbitrum / Arc / 0G (env-gated)** | x402 nanopayment settlement rail for paid intelligence (`SETTLEMENT_NETWORK` = `ARBITRUM`, `ZERO_G`, or `ARC`; `SETTLEMENT_ENV` = `testnet` or `mainnet`) | **Arbitrum:** fund `VAULT_PRIVATE_KEY` with Sepolia USDC (testnet) or Circle USDC (mainnet). Arc/0G: Circle Arc Faucet (testnet) or rail-specific mainnet funding. |
| **Robinhood Chain** | Emerging market tokens | Robinhood Faucet |

## x402 / Settlement Research Mode

Enable the autonomous research-payment loop where the Guardian negotiates paid premium data via x402 nanopayments on the configured settlement rail:

1. Set `NEXT_PUBLIC_ENABLE_ARC=true` (keeps the legacy env name; gate is rail-agnostic)
2. Set `ENABLE_AUTONOMOUS_MODE=true`
3. Configure `SETTLEMENT_NETWORK` (`ARBITRUM`, `ZERO_G`, or `ARC`) and `SETTLEMENT_ENV` (`testnet` or `mainnet`)
4. Configure the rail's RPC + USDC address (e.g. `ARBITRUM_ONE_RPC_URL` + `ARBITRUM_MAINNET_USDC`, or their ZERO_G/ARC equivalents)
5. Fund the agent EOA with USDC on the active rail (see below)

> **Buildathon recommendation:** Use `SETTLEMENT_NETWORK=ARBITRUM` and
> `SETTLEMENT_ENV=mainnet` for the Arbitrum Open House. Arbitrum has a verified,
> live Circle USDC contract on chainId 42161, so real mainnet payments are ready
> as soon as the agent wallet is funded. Arc mainnet is not live yet and 0G mainnet
> lacks a verified USDC contract, so those rails should stay on testnet for now.

### Verification

```bash
pnpm test-x402                   # Basic x402 gateway challenge/response
pnpm test-x402-comprehensive      # Full research-payment-settlement cycle
pnpm test-x402-frequency          # Payment frequency validation
```

### Funding the Agent Wallet

The agent wallet (`VAULT_PRIVATE_KEY`) must hold USDC on the active settlement rail to settle paid requests.

1. Get the address: `GET /api/agent/x402-metrics` → `settlement.agentAddress` (legacy alias: `arcSettlement.agentAddress`)
2. Fund it:
   - **Arbitrum mainnet:** send Circle USDC on Arbitrum to the agent address. Gas is paid in ETH.
   - **Arbitrum Sepolia:** get USDC from the [Circle testnet faucet](https://faucet.circle.com).
   - **ZERO_G / ARC testnet:** use the Circle Arc Faucet → select **Arc Testnet**, or the 0G Galileo faucet for the ZERO_G rail.
3. Verify: `settlement.agentUSDCBalance` reflects the balance

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
|---|---|---|
| Arbitrum / Arc / 0G (env-gated) | Free (faucet) testnet; real USDC + gas on mainnet | Free (faucet) testnet; gas on mainnet (Arbitrum ETH, Arc/0G native gas) |
| Celo Sepolia | ~0.01 CELO | ~0.001 CELO |
| Arbitrum Sepolia | ~0.001 ETH | ~0.0001 ETH |

## Troubleshooting

- **Insufficient funds**: Ensure deployer wallet has testnet tokens
- **Nonce issues**: Reset wallet nonce or use `--nonce` flag
- **Transaction reverts**: Check constructor args and contract dependencies
- **Agent not executing**: Verify agent runtime is running (`pm2 status`)
