# Technical Architecture

## Core System

DiversiFi is built as a Next.js application with multi-chain wallet integration and AI-powered analytics. The system operates across Celo, Arbitrum, and other EVM-compatible networks.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **Wallet**: WalletConnect integration for multi-chain support
- **UI Components**: Custom component library with mobile-first design

### Backend Services
- **AI Integration**: Google Gemini 3.0 for portfolio analysis
- **API Routes**: Next.js API routes for data processing
- **State Management**: React Context and custom hooks
- **Data Fetching**: SWR for server state management

### Blockchain Integration
- **Multi-Chain**: Support for Celo, Arbitrum, and cross-chain operations
- **Token Management**: Dynamic token lists per network
- **Swap Execution**: Integration with 1inch, Mento, and LiFi protocols
- **Wallet Operations**: Secure transaction signing and broadcasting

## Key Components

### AI Recommendation Engine
- Real-time portfolio analysis using Gemini AI
- Cross-chain opportunity detection
- Culturally-aware strategy recommendations
- Quantified savings calculations with risk assessment

### Multi-Chain Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Celo Network  │    │  Arbitrum       │
│ - cUSD, cEUR    │    │ - USDC, USDY    │
│ - Mento swaps   │    │ - 1inch swaps   │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┘
              Cross-chain bridges
```

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