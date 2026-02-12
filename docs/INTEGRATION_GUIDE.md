# Integration Guide

## API Integrations

### Google Gemini AI
DiversiFi integrates with Google's Gemini AI for portfolio analysis and recommendations.

#### Setup
1. Obtain API key from [Google AI Studio](https://aistudio.google.com/)
2. Add to environment variables as `GOOGLE_AI_API_KEY`
3. Configure in `config/ai.ts`

#### Usage
```typescript
import { getGeminiAnalysis } from '../services/ai-service';

const analysis = await getGeminiAnalysis({
  portfolio: userPortfolio,
  strategy: selectedStrategy,
  riskTolerance: userRiskTolerance
});
```

#### Rate Limits
- Standard Gemini API rate limits apply
- Caching implemented for repeated requests
- Fallback logic for API failures

### Reown AppKit Integration
Multi-wallet support with email/social login for seamless onboarding and Web2-like UX.

#### Configuration
```typescript
// config/features.ts
export const WALLET_FEATURES = {
  APPKIT_WEB: process.env.NEXT_PUBLIC_ENABLE_APPKIT_WALLET !== 'false',
  APPKIT_EMAIL: process.env.NEXT_PUBLIC_ENABLE_APPKIT_EMAIL !== 'false',
  APPKIT_SOCIALS: process.env.NEXT_PUBLIC_ENABLE_APPKIT_SOCIALS !== 'false',
  APPKIT_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_APPKIT_ANALYTICS !== 'false',
  APPKIT_PROJECT_ID: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '',
};
```

#### Wallet Provider Priority Order
1. **Farcaster** - If accessed within Farcaster frame
2. **MiniPay** - If detected in Opera MiniPay environment
3. **Injected Wallets** - MetaMask, Coinbase Wallet (auto-detected, takes priority)
4. **AppKit Modal** - Email/social login, WalletConnect (fallback if no injected wallet)

#### Supported Authentication Methods
- **Email Sign-In**: Verification code sent to email
- **Social Sign-In**: Google, X (Twitter), Discord, Apple
- **Browser Wallets**: MetaMask, Coinbase Wallet, Brave Wallet
- **Mobile Wallets**: WalletConnect QR code support
- **MiniPay**: Opera MiniPay integration
- **Farcaster**: Frame-based authentication

## Blockchain Integrations

### Multi-Chain Support

#### Network Configuration
```typescript
// config/chains.ts
export const SUPPORTED_CHAINS = {
  CELO: {
    id: 42220,
    name: 'Celo',
    rpc: 'https://forno.celo.org',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    blockExplorer: 'https://explorer.celo.org'
  },
  ARBITRUM: {
    id: 42161,
    name: 'Arbitrum',
    rpc: 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://arbiscan.io'
  }
};
```

#### Token Lists
Dynamic token lists based on connected network:
- Celo: cUSD, cEUR, cREAL, G$, USDC
- Arbitrum: USDC, USDY, USDT
- Cross-chain: Bridged assets via LiFi

### Swap Protocols

#### 1inch Integration (Arbitrum)
```typescript
// services/swap/one-inch-service.ts
export class OneInchService {
  async getQuote(fromToken: string, toToken: string, amount: string) {
    // Implementation for 1inch aggregation
  }
}
```

#### Mento Integration (Celo)
```typescript
// services/swap/mento-service.ts
export class MentoService {
  async getExchangeRate(fromToken: string, toToken: string) {
    // Implementation for Celo Mento protocol
  }
}
```

#### LiFi Integration (Cross-Chain)
```typescript
// services/bridge/lifi-service.ts
export class LiFiService {
  async getBridgeRoute(fromChain: string, toChain: string, token: string) {
    // Implementation for cross-chain bridging
  }
}
```

## Data Provider Integrations

### World Bank API
For macro-economic indicators and regional stability scoring.

#### Implementation
```typescript
// services/data/world-bank-service.ts
export class WorldBankService {
  async getGDPData(countryCode: string) {
    // GDP growth data
  }
  
  async getGovernanceIndicators(countryCode: string) {
    // Worldwide Governance Indicators
  }
}
```

### FRED API (Federal Reserve Economic Data)
For US economic indicators and inflation data.

#### Setup
- Free API key from [FRED](https://fred.stlouisfed.org/docs/api/api_key.html)
- Add as `FRED_API_KEY` environment variable

### CoinGecko Integration
For cryptocurrency pricing and market data.

#### Usage
```typescript
// services/data/coingecko-service.ts
export class CoinGeckoService {
  async getTokenPrice(tokenId: string) {
    // Get current token price
  }
  
  async getHistoricalData(tokenId: string, days: number) {
    // Get historical price data
  }
}
```

## Third-Party Service Integrations

### Circle Integration
For USDC operations and cross-chain transfers.

#### Gateway Service
```typescript
// services/circle/gateway-service.ts
export class CircleGatewayService {
  async getUnifiedBalance(walletAddress: string) {
    // Unified USDC balance across chains
  }
}
```

#### Bridge Kit
```typescript
// services/circle/bridge-service.ts
export class CircleBridgeService {
  async initiateTransfer(sourceChain: string, destChain: string, amount: string) {
    // Cross-chain USDC transfer
  }
}
```

### Guardarian Integration
For fiat on-ramp services.

#### Widget Implementation
```typescript
// components/onramp/GuardarianWidget.tsx
export default function GuardarianWidget({
  onSuccess,
  onError,
  defaultAmount = 100,
  defaultCrypto = 'USDC',
  defaultFiat = 'EUR'
}) {
  // Guardarian widget integration
}
```

### Zapier Integration
For automation workflows and external service connections.

#### Webhook Endpoint
```typescript
// pages/api/zapier-webhook.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isValid = verifyZapierSignature(req);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, payload } = req.body;
  
  switch (event) {
    case 'portfolio_alert':
      await handlePortfolioAlert(payload);
      break;
    case 'recommendation_ready':
      await handleRecommendationReady(payload);
      break;
    case 'execute_swap':
      await handleExecuteSwap(payload);
      break;
  }
}
```

## Cultural Strategy Framework

### Strategy Implementation
Each cultural strategy is implemented as a separate module with specific parameters:

```typescript
// types/strategy.ts
export interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  regionalFocus: string[];
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  culturalValues: string[];
  recommendedAssets: string[];
}

// config/strategies.ts
export const STRATEGIES: Record<string, StrategyConfig> = {
  afri_capitalism: {
    id: 'afri_capitalism',
    name: 'Africapitalism',
    description: 'Wealth that builds Africa',
    regionalFocus: ['KE', 'NG', 'ZA', 'GH'],
    riskProfile: 'moderate',
    culturalValues: ['community', 'pan_african', 'local_investment'],
    recommendedAssets: ['KESm', 'NGNm', 'ZARm', 'GHSm']
  }
  // Additional strategies...
};
```

## GoodDollar Integration

### Streak Rewards System
Gamified savings streak system that unlocks GoodDollar UBI access directly within the DiversiFi app.

#### Core Service
The `GoodDollarService` handles direct interactions with GoodDollar smart contracts on the Celo network.

```typescript
// services/gooddollar-service.ts
export class GoodDollarService {
  async claimUBI(): Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }> {
    // Direct contract call to UBI_SCHEME.claim()
  }
  
  async checkClaimEligibility(): Promise<{ canClaim: boolean; amount: string }> {
    // Checks entitlement and whitelist status
  }
}
```

#### Smart Contract References (Celo)
- **G$ Token**: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`
- **UBIScheme**: `0xD7aC544F8A570C4d8764c3AAbCF6870CBD960D0D` (Daily UBI claiming)
- **Identity**: `0xC8CD22E58C419706C887aC39aDb919f20E9E8Cc5` (Whitelist verification)

#### Persistence Strategy
Streak data follows a tiered persistence model (Principle: **RESILIENT**):
1. **Primary**: MongoDB via `/api/streaks/[address]` for cross-device synchronization.
2. **Fallback**: `localStorage` (`diversifi_streak_v1`) if the API is unreachable.

#### Unlock Criteria
- **Eligibility**: Any swap of **$1.00 USD+** unlocks the daily G$ claim.
- **Streak Logic**: 1 grace period per week is allowed to maintain streak continuity.
- **Milestones**: Automatic achievement tracking for 7, 30, 100, and 365-day streaks.

## Farcaster Integration

### Mini App Configuration
DiversiFi configured as Farcaster mini app for seamless social integration.

#### Manifest File
```json
// public/.well-known/farcaster.json
{
  "frame": {
    "version": "1",
    "name": "DiversiFi",
    "webhookUrl": "/api/farcaster-webhook",
    "description": "DiversiFi - Decentralized Finance for Everyone on Farcaster",
    "features": {
      "walletConnection": true,
      "tokenSwaps": true,
      "portfolioManagement": true,
      "multiChainSupport": true,
      "inflationProtection": true
    },
    "supportedChains": ["celo", "ethereum", "polygon", "arbitrum"]
  }
}
```

### Webhook Handler
```typescript
// pages/api/farcaster-webhook.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle Farcaster frame actions and events
}
```

## Development Integration Patterns

### Service Architecture
Follow the service pattern for all external integrations:

```typescript
// services/base-service.ts
export abstract class BaseService {
  protected async makeRequest(url: string, options?: RequestInit) {
    // Common request handling with error management
  }
  
  protected async handleRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    // Rate limit handling
  }
}
```

### Error Handling
Consistent error handling across all integrations:

```typescript
// types/errors.ts
export class IntegrationError extends Error {
  constructor(
    public readonly service: string,
    public readonly originalError: any
  ) {
    super(`Integration error in ${service}: ${originalError.message}`);
  }
}
```

### Testing Integration
Mock implementations for testing:

```typescript
// __mocks__/integration-mock.ts
export const mockIntegration = {
  getQuote: jest.fn(),
  executeSwap: jest.fn(),
  getBalance: jest.fn()
};
```

## Security Considerations

### API Key Management
- Store API keys in environment variables only
- Never expose keys in client-side code
- Use different keys for development and production
- Implement key rotation procedures

### Data Privacy
- Minimize data collection and storage
- Encrypt sensitive user data
- Implement proper consent mechanisms
- Comply with regional privacy regulations

### Transaction Security
- Validate all transaction parameters
- Implement slippage protection
- Use secure wallet connection protocols
- Warn users about risky operations