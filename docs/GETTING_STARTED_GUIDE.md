# Getting Started Guide

## API Keys & Data Sources

### Priority API Keys (Get These First)

#### 1. **Truflation** - Real-time Inflation Data
- **Website**: https://truflation.com/
- **Pricing**: $50-200/month
- **Sign up**: https://truflation.com/contact
- **What you get**:
  - Real-time inflation tracking
  - Regional inflation breakdowns
  - Economic indicators
  - Much more accurate than government CPI data
- **Environment variable**: `TRUFLATION_API_KEY`
- **Worth it?**: ✅ YES - This is premium data that free sources can't match

#### 2. **Glassnode** - On-chain Analytics
- **Website**: https://glassnode.com/pricing
- **Pricing**: $39-799/month (start with Starter at $39)
- **Sign up**: https://glassnode.com/pricing
- **What you get**:
  - MVRV ratios
  - On-chain sentiment indicators
  - Institutional flow data
  - Market cycle analysis
- **Environment variable**: `GLASSNODE_API_KEY`
- **Worth it?**: ✅ YES - Professional crypto market intelligence

## Free API Keys (No Cost, High Value)

#### 3. **DeFiLlama** - DeFi Yields (FREE!)
- **Website**: https://defillama.com/docs/api
- **Pricing**: FREE (no key needed for basic usage)
- **What you get**:
  - Real-time DeFi yields
  - TVL data across protocols
  - Pool information
- **Environment variable**: None needed
- **Worth it?**: ✅ YES - Free and excellent data

#### 4. **Yearn Finance** - Vault Yields (FREE!)
- **Website**: https://api.yearn.finance/
- **Pricing**: FREE
- **What you get**:
  - Yearn vault APYs
  - Risk-adjusted yields
  - Strategy information
- **Environment variable**: None needed
- **Worth it?**: ✅ YES - Free professional yield data

#### 5. **World Bank API** - Macro-Economic Stability (FREE!)
- **Website**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-api
- **Pricing**: FREE (No key needed)
- **What you get**:
  - **GDP Growth**: Annual % growth for all supported countries.
  - **Worldwide Governance Indicators (WGI)**: Political Stability, Rule of Law, Government Effectiveness, and Control of Corruption.
  - **Regional Stability Scoring**: Automated 0-100 scores for every asset region.
- **Environment variable**: None needed
- **Worth it?**: ✅ YES - The foundation of our institutional-grade regional risk assessment.

#### 6. **DefiLlama Stablecoin API** - Global Momentum (FREE!)
- **Website**: https://stablecoins.llama.fi
- **Pricing**: FREE (No key needed)
- **What you get**:
  - **Total Stablecoin Market Cap**: Surfaced in the header "Pulse" to drive category FOMO.
  - **Stablecoin 24h Volume**: Institutional demand signals.
- **Usage**: Automatically used by the `MarketMomentumService`.

#### 7. **Alternative.me** - Market Sentiment (FREE!)
- **Website**: https://alternative.me/crypto/fear-and-greed-index/
- **Pricing**: FREE (No key needed)
- **What you get**:
  - **Fear & Greed Index**: Real-time market sentiment score.
- **Usage**: Used to context-aware AI recommendations (e.g., "Greedy" market suggests higher gold allocation).

## Optional Premium APIs

#### 8. **Messari** - Market Intelligence
- **Website**: https://messari.io/api
- **Pricing**: $29-999/month
- **What you get**:
  - Professional market data
  - Fundamental analysis
  - Asset metrics
- **Environment variable**: `MESSARI_API_KEY`
- **Worth it?**: 🤔 MAYBE - Good but expensive

#### 9. **Alpha Vantage** - Exchange Rates
- **Website**: https://www.alphavantage.co/support/#api-key
- **Pricing**: FREE tier available, $49.99/month for premium
- **What you get**:
  - Real-time forex data
  - Historical exchange rates
  - Economic indicators
- **Environment variable**: `ALPHA_VANTAGE_API_KEY`
- **Worth it?**: ✅ YES - Free tier is sufficient

#### 10. **FRED (Federal Reserve)** - Economic Data
- **Website**: https://fred.stlouisfed.org/docs/api/api_key.html
- **Pricing**: FREE
- **What you get**:
  - Official US economic data
  - CPI, unemployment, GDP
  - Historical economic indicators
- **Environment variable**: `FRED_API_KEY`
- **Worth it?**: ✅ YES - Free government data

## Quick Setup Instructions

### Step 1: Get the Essential Keys
```bash
# Start with these two for maximum impact
1. Sign up for Truflation ($50/month)
2. Sign up for Glassnode Starter ($39/month)
3. Get Alpha Vantage free key
4. Get FRED free key
```

### Step 2: Add to Your .env File
```bash
# Premium APIs (paid)
TRUFLATION_API_KEY=your_truflation_key_here
GLASSNODE_API_KEY=your_glassnode_key_here

# Free APIs
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
FRED_API_KEY=your_fred_key_here

# Circle Infrastructure (Optional)
NEXT_PUBLIC_CIRCLE_WALLET_ID=your_id_here
NEXT_PUBLIC_CIRCLE_API_KEY=your_key_here
```

### Step 3: Test Your Setup
```bash
pnpm validate-agent
pnpm test-x402-comprehensive
```

## Freemium X402 Model

### Get Started in 5 Minutes (Zero Cost!)

#### Step 1: Get Free API Keys (2 minutes)
```bash
# Only 2 free API keys needed!
1. Alpha Vantage: https://www.alphavantage.co/support/#api-key (FREE)
2. FRED: https://fred.stlouisfed.org/docs/api/api_key.html (FREE)

# These APIs need NO keys (completely free):
✅ DeFiLlama - DeFi yield data
✅ Yearn Finance - Vault yields
✅ World Bank - Inflation data
✅ CoinGecko - Crypto prices (free tier)
```

#### Step 2: Setup Your Agent (1 minute)
```bash
# Generate agent wallet (development only)
pnpm setup-arc-agent

# Add your free API keys to .env
ALPHA_VANTAGE_API_KEY=your_free_key_here
FRED_API_KEY=your_free_key_here
```

#### Step 3: Fund Agent Wallet (1 minute)
```bash
# Get free testnet USDC
1. Visit: https://faucet.circle.com
2. Send 10-50 USDC to your agent address
3. Agent can now process payments
```

#### Step 4: Test the System (1 minute)
```bash
# Test free tier
pnpm test-x402-comprehensive

# Should see:
✅ Free tier working
✅ Premium tier requires payment
✅ Usage tracking active
```

### Revenue Model

#### Free Tier (No Payment)
- **25 requests/day** per API source
- Basic data with no analysis
- Perfect for trying the system

#### Premium Tier (Micro-Payments)
- **1-5¢ per request** for AI analysis
- Enhanced insights and predictions
- Real-time vs delayed data
- Risk scoring and optimization

### Example User Flow

```
Day 1: New User
├── Requests 1-25: Alpha Vantage data → FREE
├── Request 26: "Pay 2¢ for AI trend analysis?"
├── User pays 2¢ → Gets professional insights
└── Total spent: 2¢

Day 2: Regular User
├── Requests 1-25: Free again (daily reset)
├── Requests 26-30: Pays 2¢ each = 10¢
├── Macro analysis: Pays 3¢
└── Total spent: 13¢ for professional analysis
```

### Why This Works

1. **Zero Barrier to Entry**: Users try everything free first
2. **Clear Value**: Pay for AI analysis, not raw data
3. **Micro-Payments**: 2¢ feels like nothing but adds up
4. **Immediate Revenue**: No monthly subscriptions needed
5. **Scalable**: Free APIs handle thousands of users

### Available Services

#### Free APIs with Premium Analysis:
- `alpha_vantage_enhanced` - **1¢** - Forex trend analysis
- `world_bank_analytics` - **1.5¢** - Inflation insights
- `defillama_realtime` - **1¢** - Real-time yield data
- `yearn_optimizer` - **2¢** - Yield optimization
- `coingecko_analytics` - **1.5¢** - Market analysis
- `fred_insights` - **1¢** - Economic insights

#### Premium Aggregated Services:
- `macro_analysis` - **3¢** - Comprehensive macro analysis
- `portfolio_optimization` - **5¢** - Portfolio optimization
- `risk_assessment` - **2¢** - Multi-source risk analysis

## Important Limitations

### Autonomous Agent
- **Development Only**: The autonomous agent feature is currently only available in development environments
- **Testnet Only**: All autonomous operations run on Arc Network testnet (Chain ID 5042002)
- **Not Production Ready**: The autonomous agent is not available in production environments
- **Enable with**: `NEXT_PUBLIC_ENABLE_ARC=true` and `ENABLE_AUTONOMOUS_MODE=true` (development only)

### x402 Protocol
- **Experimental**: The x402 micropayment protocol is experimental
- **Testnet Only**: All x402 payments occur on testnet
- **Not Live**: x402 payments are not operational in production
- **Enable with**: Same flags as autonomous mode