# Technical Architecture

## Core System

DiversiFi is built as a Next.js application with multi-chain wallet integration and AI-powered analytics. The system operates across Celo, Arbitrum, and other EVM-compatible networks.

## Deployment Architecture

### Hybrid Deployment Model

```
┌─────────────────────────┐         ┌─────────────────────────┐
│ Static Web Frontend     │         │ Long-running API Service │
│ (CDN-hosted)            │ ──────► │ (extended timeouts)      │
└─────────────────────────┘         └─────────────────────────┘
```

**Why hybrid?**
- Static hosting provides fast global delivery and simple scaling.
- A separate API service handles long-running AI operations beyond typical serverless time limits.

Provider-specific details (domains, ports, reverse-proxy config, log paths, etc.) are intentionally omitted from this public doc. Maintainers should reference internal runbooks (not committed).

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **Wallet**: WalletConnect integration for multi-chain support
- **UI Components**: Custom component library with mobile-first design

### Backend Services
- **AI API Server**: Next.js standalone on Hetzner (90s timeouts)
- **AI Integration**: Venice AI (primary), Google Gemini 3.0 (fallback)
- **API Routes**: Next.js API routes for data processing
- **State Management**: React Context and custom hooks
- **Data Fetching**: SWR for server state management

### Blockchain Integration
- **Multi-Chain**: Support for Celo, Arbitrum, Robinhood Chain, and cross-chain operations
- **Token Management**: Dynamic token lists per network
- **Swap Execution**: Integration with 1inch, Mento, LiFi, and Robinhood AMM protocols
- **Wallet Operations**: Secure transaction signing and broadcasting

## Key Components

### AI Recommendation Engine
- Real-time portfolio analysis using Gemini AI
- Cross-chain opportunity detection
- Culturally-aware strategy recommendations
- Quantified savings calculations with risk assessment

### Multi-Chain Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Celo Network  │    │  Arbitrum       │    │  RH Testnet     │
│ - cUSD, cEUR    │    │ - USDC, USDY    │    │ - ACME, WAYNE   │
│ - Mento swaps   │    │ - 1inch swaps   │    │ - AMM (x*y=k)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                      │
         └───────────────────────┘                      │
              Cross-chain bridges          Dedicated /trade page
```

### Robinhood Chain Testnet (Chain ID: 46630)
Arbitrum Orbit L2 with a custom-deployed TestnetMarketMaker AMM for fictional stock tokens.

**Deployed Contracts:**
| Contract | Address |
|----------|---------|
| TestnetMarketMaker (AMM) | `0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3` |
| ACME | `0x4390d881751a190C9B3539b052BA1FC7a0f517dc` |
| SPACELY | `0xe28F0fBc0777373fd80E932072033949ef73Fa5f` |
| WAYNE | `0xD91C15F9017c4Caa56825487ede1A701a94cE2a4` |
| OSCORP | `0xeacC2abf8C05bAc6870C16bEa5c4E3db7d8EA41d` |
| STARK | `0x1d3264F941Dc8d9b038245987078D249Df748c8D` |
| WETH | `0x95fa0c32181d073FA9b07F0eC3961C845d00bE21` |

**Swap Strategy:** `RobinhoodAMMStrategy` in `services/swap/strategies/robinhood-amm.strategy.ts` — routes ETH↔stock swaps through the AMM.
**UI:** Dedicated trading page at `/trade` with buy/sell toggle, live AMM rates, and portfolio view.

### Cultural Strategy Framework
- 7 authentic financial philosophies integration
- Region-specific asset recommendations
- Culturally-aware risk assessment
- Localized user experience

## Integration Services

### Data Providers
- **World Bank API**: Macro-economic indicators
- **FRED**: Federal Reserve economic data
- **CoinGecko**: Cryptocurrency pricing data
- **DeFiLlama**: DeFi yield information

### Third-Party Services
- **Circle**: Gateway and Bridge Kit for USDC operations
- **Guardarian**: Fiat on-ramp integration
- **Zapier**: Automation workflows
- **Farcaster**: Social integration and frames

## Security & Architecture

### Security Measures
- Client-side wallet integration (no private keys stored)
- Transaction validation and slippage protection
- Rate limiting on API endpoints
- Input sanitization and validation

### Performance Optimization
- Code splitting for large components
- Image optimization and lazy loading
- Efficient state management with SWR
- Caching strategies for API responses

### Mobile-First Design
- Responsive components for all screen sizes
- Touch-optimized interfaces
- Progressive Web App capabilities
- Offline functionality where possible

## Development Structure

### Directory Layout
```
diversifi/
├── components/          # Reusable UI components
├── config/             # Chain and token configurations
├── hooks/              # Custom React hooks
├── pages/              # Next.js pages and API routes
├── services/           # Business logic services
├── styles/             # Global styles
└── utils/              # Utility functions
```

### Environment Configuration
- API key management via environment variables
- Network configuration per environment
- Feature flag system for development
- Secure credential handling

## Deployment & Operations

### Build Process
- Optimized production builds with tree-shaking
- Static asset optimization
- Bundle size monitoring
- Performance budget enforcement

### Monitoring
- Error tracking and logging
- Performance metrics collection
- User behavior analytics
- System health monitoring