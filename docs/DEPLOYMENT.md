# Deployment

Contract deployment and testnet setup guide.

## Testnet Faucets

### Celo Sepolia
- **Official**: https://faucet.celo.org/celo-sepolia
- **Google Cloud**: https://cloud.google.com/application/web3/faucet/celo/sepolia
- **Limit**: Once per 24 hours
- **Need**: ~5 CELO for testing

### Arc Testnet
- **Circle Faucet**: https://faucet.circle.com/
- **Token**: USDC
- **Limit**: 20 USDC every 2 hours

### Robinhood Chain (Chain ID: 46630)
- **Faucet**: https://faucet.testnet.chain.robinhood.com
- **Token**: Testnet ETH

## Deploying Contracts

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Set private key
export PRIVATE_KEY=your_private_key
```

### Celo Sepolia Deployment

```bash
# Dry run
forge script scripts/DeployCeloEmergingMarkets.s.sol:DeployCeloEmergingMarkets \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org

# Deploy
forge script scripts/DeployCeloEmergingMarkets.s.sol:DeployCeloEmergingMarkets \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org \
  --broadcast \
  --slow
```

### Post-Deployment

1. Save contract addresses from output
2. Update `config/emerging-markets.ts`:

```typescript
export const EMERGING_MARKETS_CONFIG = {
  chainId: 11142220,
  network: "Celo Sepolia",
  rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
  explorerUrl: "https://celo-sepolia.blockscout.com",
  
  ammAddress: "0x...",    // TestnetMarketMaker
  wethAddress: "0x...",   // WETH9
  
  tokens: {
    // Tokens keep original names on-chain but display as fictional in UI
    SAFCOM: "0x...",    // UI: WAKANDA
    DANGOTE: "0x...",   // UI: DAKAR
    SHOPRITE: "0x...",  // UI: SHADOW
    // ... etc
  },
};
```

3. Verify on explorer: https://celo-sepolia.blockscout.com/

### Price API Setup

To fetch real emerging market stock prices, add API keys to `.env.local`:

```bash
# Optional - improves price reliability
NEXT_PUBLIC_ALPHA_VANTAGE_KEY=your_key_here
NEXT_PUBLIC_FINNHUB_KEY=your_key_here
```

**Free tier limits:**
- Alpha Vantage: 25 calls/day (sufficient for 9 stocks)
- Finnhub: 60 calls/minute
- Yahoo Finance: No key required (unofficial API)

Prices are cached for 15 minutes (5 minutes during market hours).

### Verify Contracts

```bash
forge verify-contract <ADDRESS> <CONTRACT_NAME> \
  --chain-id 11142220 \
  --watch
```

## Production Deployment

### Frontend Build

```bash
# Build for production
pnpm build

# Output: .next/ directory (static or standalone)
```

### Environment

```bash
# Production .env
GOOGLE_AI_API_KEY=
NEXT_PUBLIC_REOWN_PROJECT_ID=
VENICE_API_KEY=
```

### Hosting

Static hosting recommended:
- **Netlify**: `pnpm exec next-on-netlify`
- **Vercel**: Automatic via Next.js
- **Cloudflare Pages**: `pnpm pages:build`

### AI API Service

For long-running AI operations:

```bash
# Build standalone
pnpm build
pnpm start

# Or deploy as Docker container
docker build -t diversifi-api .
docker run -p 3000:3000 diversifi-api
```

## Troubleshooting

### "Insufficient funds"
Get more tokens from faucet.

### "Nonce too low"
```bash
cast nonce <ADDRESS> --rpc-url <RPC_URL>
```

### "Transaction reverted"
Check gas price:
```bash
cast gas-price --rpc-url <RPC_URL>
```

### Deployment hangs
Use `--slow` flag or `--legacy` for older transaction format.

## Expected Costs

| Network | Gas (native) | Notes |
|---------|---------------|-------|
| Celo Sepolia | ~5 CELO | Testnet, faucet available |
| Arc Testnet | ~20 USDC | Faucet available |
| Robinhood | ~0.01 ETH | Faucet available |
| Celo Mainnet | ~0.5 CELO | ~$0.30 |
| Arbitrum | ~0.001 ETH | ~$2-3 |

## Monitoring

### Explorers
- **Celo**: https://celo.blockscout.com/
- **Celo Sepolia**: https://celo-sepolia.blockscout.com/
- **Arbitrum**: https://arbiscan.io/
- **Robinhood**: https://explorer.testnet.chain.robinhood.com/

### Health Checks
- RPC endpoint availability
- API response times
- Gas price alerts
