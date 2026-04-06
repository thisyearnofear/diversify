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
  HYPERLIQUID: { chainId: 998, rpcUrl: 'https://api.hyperliquid.xyz' },
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

#### Hyperliquid Perps (Commodities)
```typescript
// services/swap/strategies/hyperliquid-perp.strategy.ts
// Virtual Chain ID: 998
// Supported commodity markets: GOLD, SILVER, OIL, COPPER
// Execution model: IOC-style perp orders
// Signing: EIP-712 typed data (domain: HyperliquidSignTransaction)
```

**Execution & Signing Responsibilities:**
- Strategy computes size/slippage and creates structured execution payload.
- Backend can execute directly when signer is injected (`setSigner(...)`).
- Otherwise UI/client receives typed-data signing instructions and submits signed action.
- Islamic Finance strategy excludes Hyperliquid commodity perps by design.

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

### SynthData (Probabilistic Intelligence)

`SYNTH_API_KEY` enables authenticated market-intelligence requests against `https://api.synthdata.co`.

**Endpoints used by the app:**
- `/insights/prediction-percentiles`
- `/insights/volatility`
- `/insights/option-pricing`
- `/insights/liquidation`

**Integration contract (app behavior):**
- Responses are normalized into stable internal DTOs before UI/agent consumption.
- Unified cache provides request coalescing + stale-while-revalidate.
- `volatile` TTL profile is used for Synth requests (~30 min class).
- Fallback responses are deterministic (no random values in production-facing outputs).

**Supported Synth fallback coverage map:**
- `BTC`, `ETH`, `NVDAX`, `TSLAX`, `SPYX`, `AAPLX`
- Unknown assets use default deterministic fallback values.

**Error taxonomy for observability:**
- `auth` (401/403/API key issues)
- `rate-limit` (429)
- `provider` (network/timeout/5xx)
- `schema` (unexpected payload shape)
- `unknown`

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

## Auth0 Token Vault (Agent Credential Delegation)

Auth0 Token Vault manages OAuth tokens for services the agent accesses **on behalf of the user**. This replaces app-owned API keys/webhooks with user-delegated, scoped, revocable credentials.

### Why Token Vault

The Zapier MCP service, Slack alerts, and Google Sheets logging currently rely on app-level credentials (webhook URLs, embed secrets). Token Vault upgrades this to per-user OAuth:

- User connects their own Slack/Sheets/Gmail via Auth0 Universal Login
- Token Vault stores, rotates, and refreshes OAuth tokens
- Agent requests a short-lived token at execution time — never stores it
- User revokes access anytime; agent immediately loses the token

### Environment Variables

```bash
# Server-side (Management API — keeps tokens secure)
AUTH0_DOMAIN=              # Auth0 tenant domain (e.g. diversifi.us.auth0.com)
AUTH0_CLIENT_ID=           # Auth0 M2M application client ID
AUTH0_CLIENT_SECRET=       # Auth0 M2M application client secret
AUTH0_AUDIENCE=            # Management API audience (https://<domain>/api/v2/)

# Client-side (connect buttons in UI)
NEXT_PUBLIC_AUTH0_DOMAIN=  # Same as AUTH0_DOMAIN
NEXT_PUBLIC_AUTH0_CLIENT_ID= # Auth0 SPA/Regular Web App client ID
```

Connection names are mapped internally: `google` → `google-oauth2`, `slack` → `slack`, `zapier` → `zapier`. Configure these as Social/Enterprise connections in the Auth0 dashboard.

### Supported Connections

| Service | OAuth Scopes | Agent Use Case |
|---------|-------------|----------------|
| Slack | `chat:write`, `channels:read` | Post rebalance receipts, inflation alerts to user's channel |
| Google Sheets | `spreadsheets`, `drive.file` | Log rebalance history, P&L, fee accounting to user's sheet |
| Gmail | `gmail.send` | Weekly protection summaries, urgent devaluation alerts |
| Zapier | Zapier OAuth | Trigger user-defined automations on agent events |

### Integration Pattern

```typescript
import { TokenVaultClient } from '../services/auth0-token-vault';

const vault = new TokenVaultClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});

// Retrieve user's IDP token via Management API (GET /api/v2/users/{id})
// Tokens come from user.identities[].access_token for the matching connection
const googleToken = await vault.getToken(userId, 'google'); // maps to 'google-oauth2'
if (googleToken) {
  await appendToSheet(googleToken, spreadsheetId, rebalanceRow);
}

// Check if a connection exists without fetching the token
const hasSlack = await vault.hasConnection(userId, 'slack');

// Build an Auth0 authorize URL for the connect button
const connectUrl = vault.getAuthorizationUrl('google', redirectUri, walletAddress);
```

Management API tokens are cached internally (with 60s buffer before expiry) to avoid redundant client_credentials calls.

### Async Authorization Flow

When the agent needs a service the user hasn't connected:

1. Agent detects missing token for the required service
2. Returns an `authorization_pending` status with an Auth0 authorization URL
3. Frontend shows prompt: _"Your advisor wants to send receipts to Slack. Connect?"_
4. User completes OAuth consent via Auth0 Universal Login
5. Token Vault stores the token; agent resumes on next execution cycle

### Relationship to Existing Auth

Token Vault handles **off-chain** service credentials (Slack, Sheets, etc.).
Privy + ERC-7715 session keys handle **on-chain** transaction permissions.
Both layers are user-initiated, scoped, and independently revocable.

## Rate Limits

- Gemini: Standard API limits (cached responses)
- CoinGecko: 10-30 calls/minute (free tier)
- LiFi: Per-route limits
- Mento: Rate limited (use fallback RPCs)
- SynthData: subject to API plan/rate limits (use cache + deterministic fallback)
