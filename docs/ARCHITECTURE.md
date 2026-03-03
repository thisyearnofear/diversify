# Architecture

Technical system design and technology stack for DiversiFi.

## System Overview

```
┌─────────────────────────┐         ┌─────────────────────────┐
│ Static Web Frontend     │         │ Long-running AI API    │
│ (CDN-hosted)            │ ──────► │ (extended timeouts)    │
└─────────────────────────┘         └─────────────────────────┘
```

**Why hybrid?**
- Static hosting: Fast global delivery, simple scaling
- Separate API: Handles AI operations beyond serverless limits

## Technology Stack

### Frontend
- **Next.js 15** - App Router, React 19
- **Tailwind CSS** - Custom design system
- **Reown AppKit** - WalletConnect (email, social, wallets)
- **Farcaster SDK** - Social integration

### Backend
- **AI**: Venice AI (primary), Gemini 3.0 (fallback)
- **State**: React Context + SWR
- **API**: Next.js API routes

### Blockchain
- **Celo**: Mento protocol swaps
- **Arbitrum**: 1inch aggregation, Uniswap V3
- **Cross-chain**: LiFi SDK
- **Wallets**: MetaMask, Coinbase, MiniPay, Circle

### Data Providers
- World Bank API - Macro indicators
- FRED - US economic data
- CoinGecko - Crypto pricing
- DeFiLlama - Yield data

## Multi-Chain Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Celo Network  │    │  Arbitrum       │    │  RH Testnet     │
│ - USDm, EURm    │    │ - USDC, USDY    │    │ - ACME, WAYNE   │
│ - Mento swaps   │    │ - 1inch swaps   │    │ - AMM (x*y=k)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                      │
         └───────────────────────┘                      │
              Cross-chain bridges          Dedicated /trade page
```

## Key Contracts

### Celo Mainnet (Chain ID: 42220)
| Contract | Address |
|----------|---------|
| Broker | `0x777a8255ca72412f0d706dc03c9d1987306b4cad` |
| USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| EURm | `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73` |

### Celo Sepolia (Chain ID: 11142220)
| Contract | Address |
|----------|---------|
| Broker | `0xD3Dff18E465bCa6241A244144765b4421Ac14D09` |
| USDm | `0x874069fa1eb16d44d622f2e0ca25eea172369bc1` |

### Robinhood Chain (Chain ID: 46630)
| Contract | Address |
|----------|---------|
| TestnetMarketMaker | `0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3` |
| ACME | `0x4390d881751a190C9B3539b052BA1FC7a0f517dc` |
| SPACELY | `0xe28F0fBc0777373fd80E932072033949ef73Fa5f` |

## Swap Strategies

| Chain | Strategy | Priority |
|-------|----------|----------|
| Celo Mainnet | MentoSwapStrategy | 100 |
| Celo Sepolia | MentoSwapStrategy | 100 |
| Arbitrum | OneInchSwapStrategy | 90 |
| Arbitrum | UniswapV3Strategy | 80 |
| Arc Testnet | CurveArcStrategy | 100 |

## Configuration Source of Truth

All network and token configs in `config/index.ts`:

```typescript
export const NETWORKS = {
  CELO_MAINNET: { chainId: 42220, ... },
  CELO_SEPOLIA: { chainId: 11142220, ... },
  ARBITRUM_ONE: { chainId: 42161, ... },
  ARC_TESTNET: { chainId: 5042002, ... },
  RH_TESTNET: { chainId: 46630, ... },
};
```

## Security Measures

- Client-side wallet integration (no private keys stored)
- Transaction validation and slippage protection
- Rate limiting on API endpoints
- Input sanitization

## Performance

- Code splitting for large components
- SWR for server state with caching
- Image optimization and lazy loading
- Bundle size monitoring

## Directory Structure

```
diversifi/
├── components/          # Reusable UI
├── config/             # Chain configs
├── hooks/              # Custom React hooks
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── trade.tsx       # Stock trading
├── services/           # Business logic
│   ├── ai/             # AI integration
│   ├── swap/           # Swap strategies
│   └── data/           # Data providers
├── lib/                # Third-party libs
└── scripts/            # Deployment
```
