# Integration Guide

API integrations and third-party service setup.

## Environment Variables

```bash
# Required
GOOGLE_AI_API_KEY=          # Google AI Studio
NEXT_PUBLIC_REOWN_PROJECT_ID=  # WalletConnect

# Optional
VENICE_API_KEY=             # Venice AI
SYNTH_API_KEY=              # Market predictions
FRED_API_KEY=               # Federal Reserve data
COINGECKO_API_KEY=          # CoinGecko premium
```

## Wallet Integration

### Reown AppKit (WalletConnect)

```typescript
// config/features.ts
export const WALLET_FEATURES = {
  APPKIT_WEB: process.env.NEXT_PUBLIC_ENABLE_APPKIT_WALLET !== 'false',
  APPKIT_EMAIL: process.env.NEXT_PUBLIC_ENABLE_APPKIT_EMAIL !== 'false',
  APPKIT_SOCIALS: process.env.NEXT_PUBLIC_ENABLE_APPKIT_SOCIALS !== 'false',
  APPKIT_PROJECT_ID: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '',
};
```

**Provider Priority:**
1. **Farcaster** - Frame detection
2. **MiniPay** - Opera environment
3. **Injected** - MetaMask, Coinbase (auto-detected)
4. **AppKit** - Email/social/WalletConnect

**Auth Methods:**
- Email sign-in (verification code)
- Social: Google, X, Discord, Apple
- Browser wallets: MetaMask, Coinbase, Brave
- Mobile: WalletConnect QR

## Blockchain Integration

### Network Configuration

```typescript
// config/index.ts
export const NETWORKS = {
  CELO_MAINNET: { chainId: 42220, rpcUrl: 'https://forno.celo.org' },
  CELO_SEPOLIA: { chainId: 11142220, rpcUrl: 'https://forno.celo-sepolia.celo-testnet.org' },
  ARBITRUM_ONE: { chainId: 42161, rpcUrl: 'https://arb1.arbitrum.io/rpc' },
  ARC_TESTNET: { chainId: 5042002 },
  RH_TESTNET: { chainId: 46630 },
};
```

### Swap Protocols

#### Mento (Celo)
```typescript
// services/swap/mento-service.ts
export class MentoService {
  async getExchangeRate(fromToken: string, toToken: string): Promise<bigint>
  async swap(fromToken: string, toToken: string, amount: bigint): Promise<string>
}
```

#### 1inch (Arbitrum)
```typescript
// services/swap/one-inch-service.ts
export class OneInchService {
  async getQuote(params: QuoteParams): Promise<SwapQuote>
  async swap(tx: TransactionRequest): Promise<string>
}
```

#### LiFi (Cross-Chain)
```typescript
// services/bridge/lifi-service.ts
export class LiFiService {
  async getRoute(fromChain: number, toChain: number, token: string, amount: string): Promise<Route>
  async executeRoute(route: Route): Promise<string>
}
```

#### Robinhood AMM (Testnet)
```typescript
// services/swap/strategies/RobinhoodAMMStrategy.ts
// Chain ID: 46630
// Pairs: ACME/ETH, SPACELY/ETH, WAYNE/ETH, OSCORP/ETH, STARK/ETH
// Fee: 0.3%
```

## AI Integration

### Gemini AI
```typescript
// services/ai/gemini-service.ts
const analysis = await getGeminiAnalysis({
  portfolio: userPortfolio,
  strategy: selectedStrategy,
  riskTolerance: userRiskTolerance
});
```

### Venice AI
```typescript
// Primary inference provider
// No data retention, private
```

## Data Providers

### World Bank API
```typescript
// services/data/world-bank-service.ts
const gdpData = await worldBank.getGDPData('KEN'); // Kenya
const indicators = await worldBank.getGovernanceIndicators('NGA');
```

### FRED API
```bash
# Get key: https://fred.stlouisfed.org/docs/api/api_key.html
FRED_API_KEY=your_key
```

```typescript
// services/data/fred-service.ts
const inflation = await fred.getSeries('CPALTTIUSA');  // CPI
const rates = await fred.getSeries('FEDFUNDS');        # Federal Funds
```

### CoinGecko
```typescript
// services/data/coingecko-service.ts
const price = await coingecko.getPrice('celo', 'usd');
const marketData = await coingecko.getMarketData('ethereum');
```

## Circle Integration

### CCTP (Cross-Chain Transfer Protocol)
```typescript
// config/index.ts
export const CIRCLE_CONFIG = {
  CCTP: {
    DOMAINS: { ETHEREUM: 0, AVALANCHE: 1, OPTIMISM: 2, ARBITRUM: 3, BASE: 6, POLYGON: 7 },
    TOKEN_MESSENGER: { ... }
  }
};
```

### Programmable Wallets
```typescript
// Circle SDK integration for enterprise wallet infrastructure
```

## Adding New Chains

1. Add network to `config/index.ts` NETWORKS
2. Add token addresses to appropriate TOKENS export
3. Register swap strategy in `services/swap/swap-orchestrator.service.ts`
4. Add to SWAP_CONFIG.STRATEGY_SCORES

## Rate Limits

- Gemini: Standard API limits (cached responses)
- CoinGecko: 10-30 calls/minute (free tier)
- LiFi: Per-route limits
- Mento: Rate limited (use fallback RPCs)
