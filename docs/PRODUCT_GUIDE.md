# Product Guide

DiversiFi is an AI-powered wealth protection platform helping users hedge against inflation and currency volatility through culturally-aware strategies.

## Core Features

### Multi-Chain Stablecoin Swaps
- **Celo**: Swap cUSD, cEUR, cREAL via Mento protocol
- **Arbitrum**: Swap USDC, USDY via 1inch aggregation
- **Cross-chain**: Bridge between chains via LiFi SDK

### Cultural Financial Strategies
Choose from 7 authentic philosophies that shape AI recommendations:
| Strategy | Core Value | Example |
|----------|-----------|---------|
| Africapitalism | Community wealth | KESm, GHSm, ZARm |
| Buen Vivir | Regional harmony | BRLm, COPm |
| Confucian | Family legacy | Multi-generational holdings |
| Gotong Royong | Mutual aid | PHPm remittance optimization |
| Islamic Finance | Sharia compliance | Gold (PAXG), no interest |
| Global | Diversification | Spread across 5+ regions |
| Custom | Your path | Mix and match |

### Inflation Protection
- Real-time macro data (World Bank, FRED)
- Regional inflation tracking
- Currency devaluation alerts
- Diversification recommendations

### GoodDollar UBI Integration
- Earn free G$ tokens daily by maintaining savings streaks
- $0.50+ daily activity unlocks claim access
- Claim directly on GoodDollar wallet

### AI Recommendations
- Gemini 3.0 Flash for portfolio analysis
- Strategy-aware suggestions
- Quantified savings calculations

## Supported Assets

**Global**: USDC, USDT, USDY, PAXG
**Celo**: cUSD, cEUR, cREAL, G$
**Africa**: KESm, GHSm, ZARm, NGNm
**LatAm**: BRLm, COPm, MXNm, ARSm
**Asia**: PHPm, IDRm, THBm, VNDm

## Quick Start

```bash
pnpm install
cp .env.example .env.local
# Add GOOGLE_AI_API_KEY and NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
pnpm dev
```

Connect wallet, select a strategy, and start swapping.