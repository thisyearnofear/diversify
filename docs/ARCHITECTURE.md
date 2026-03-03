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
- Yahoo Finance - Emerging market stock prices (unofficial)
- Alpha Vantage - Stock price fallback
- Finnhub - Real-time stock prices

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

┌─────────────────────────────────────────────────────────────────┐
│                    Celo Sepolia Testnet                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Emerging Markets Exchange                               │   │
│  │  - Real stocks: SAFCOM, DANGOTE, PETROBRAS (track)      │   │
│  │  - Fictional: WAKANDA, ARASAKA, MISHIMA (trade)         │   │
│  │  - Price feeds: Yahoo Finance, Alpha Vantage            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Paper Trading Strategy

Both Robinhood and Celo Sepolia use a **two-tier system**:

1. **Real Assets** → Track-only with live price feeds
2. **Fictional Companies** → Tradeable tokens on AMM

This allows users to learn about real emerging market stocks while practicing trades with fictional, culturally-relevant companies.

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
| TestnetMarketMaker | `0x983b3a94C8266310192135d60D77B871549B9CfF` |
| WETH9 | `0x95fa0c32181d073FA9b07F0eC3961C845d00bE21` |

**Emerging Markets Tokens** (mapped to fictional names in UI):
| Symbol | Address | Fictional Name | Region |
|--------|---------|----------------|--------|
| SAFCOM | `0xe968d89E...` | WAKANDA | Africa |
| DANGOTE | `0x47A55970...` | DAKAR | Africa |
| SHOPRITE | `0x32BEfC5B...` | SHADOW | Africa |
| PETROBRAS | `0x05334A4C...` | KUBERA | Asia |
| MELI | `0x1D939e6F...` | SANTA | LatAm |
| CEMEX | `0xBD6a279E...` | SHADALOO | Asia |
| RELIANCE | `0x020c58Ec...` | MISHIMA | Asia |
| GRAB | `0xB1Dc9Bf3...` | ARASAKA | Asia |
| JOLLIBEE | `0x303B0964...` | SURA | Asia |

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
| Celo Sepolia | EmergingMarketsStrategy | 95 |
| Arbitrum | OneInchSwapStrategy | 90 |
| Arbitrum | UniswapV3Strategy | 80 |
| Arc Testnet | CurveArcStrategy | 100 |
| RH Testnet | RobinhoodAMMStrategy | 100 |

### Emerging Markets Strategy

Handles CELO↔fictional company token swaps on Celo Sepolia:
- `WAKANDA`, `DAKAR`, `SHADOW` (Africa)
- `KUBERA`, `SANTA`, `SHADALOO` (LatAm/Asia)
- `MISHIMA`, `ARASAKA`, `SURA` (Asia)

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
