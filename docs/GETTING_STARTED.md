# Getting Started

Quick start guide for developers and users to get up and running with DiversiFi.

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Add required API keys:
# - GOOGLE_AI_API_KEY (https://aistudio.google.com/)
# - NEXT_PUBLIC_REOWN_PROJECT_ID (https://cloud.walletconnect.com/)

# Run dev server
pnpm dev
```

## Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- No wallet or crypto required - create one via:
  - Email verification
  - Google, X, Discord, or Apple
  - Existing wallet (MetaMask, Coinbase Wallet)

## Supported Chains

| Chain | Assets | Protocols |
|-------|--------|-----------|
| **Celo Mainnet** | USDm, EURm, BRLm, KESm, GHSm, ZARm, G$, USDC | Mento |
| **Celo Sepolia** | USDm, EURm (testnet) | Mento |
| **Arbitrum** | USDC, USDY, PAXG, SYRUPUSDC | 1inch, Uniswap |
| **Arc Testnet** | USDC, EURC | Circle |
| **Robinhood Chain** | ACME, SPACELY, WAYNE, OSCORP, STARK | Custom AMM |

## Cultural Financial Strategies

Choose from 7 philosophies that shape AI recommendations:

| Strategy | Region | Assets |
|----------|--------|--------|
| Africapitalism | Africa | KESm, GHSm, ZARm |
| Buen Vivir | LatAm | BRLm, COPm |
| Confucian | East Asia | Multi-generational |
| Gotong Royong | Southeast Asia | PHPm |
| Islamic Finance | Global | PAXG (gold), no interest |
| Global | Worldwide | Diversified |
| Custom | Your path | Mix and match |

## Test Drive Mode

Try DiversiFi without real funds on testnets:

### Celo Sepolia
- Real Mento stablecoins
- Get testnet CELO: https://faucet.celo.org/celo-sepolia
- Swap for USDm, EURm in-app

### Arc Testnet  
- Native USDC
- Get USDC: https://faucet.circle.com/

### Robinhood Chain (Chain ID: 46630)
- Custom AMM for fictional stocks
- Get testnet ETH: https://faucet.testnet.chain.robinhood.com
- Trade at `/trade`

## Using the Platform

### Swapping Tokens
1. Connect wallet
2. Select network (Celo/Arbitrum)
3. Pick token pair
4. Enter amount
5. Confirm transaction

### Stock Trading (Robinhood)
1. Navigate to `/trade`
2. Connect wallet to Robinhood Chain
3. Get testnet ETH from faucet
4. Buy/sell fictional stocks (ACME, SPACELY, etc.)

### AI Recommendations
- Portfolio analysis via Gemini 3.0
- Strategy-aware suggestions
- Inflation protection alerts

## Core Features

- **Multi-Chain Swaps**: Celo, Arbitrum, cross-chain via LiFi
- **Inflation Protection**: Real-time macro data, regional tracking
- **GoodDollar UBI**: Earn free G$ daily ($0.50+ daily activity)
- **Voice Interface**: Whisper + ElevenLabs TTS (coming soon)

## Troubleshooting

### Wallet Connection
- Ensure wallet extension is enabled
- Check verification code for email login
- Refresh page if modal doesn't open
- Verify you're on a supported network

### Swap Failures
- Verify sufficient balance
- Check gas fees
- Adjust slippage tolerance
- Try during off-peak hours

## Project Structure

```
diversifi/
├── components/          # UI components
├── config/             # Chain/token configs
├── hooks/              # React hooks
├── pages/              # Next.js pages + API
├── services/           # Business logic
├── lib/                # Third-party libs
└── scripts/            # Deployment scripts
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Read [INTEGRATION.md](./INTEGRATION.md) for API details
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for deploying contracts
