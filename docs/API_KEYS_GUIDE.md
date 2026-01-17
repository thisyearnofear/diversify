# API Keys Guide for Premium Data Sources

This guide shows you exactly where to get API keys for premium financial data that your autonomous agent can purchase via x402 payments.

## 🎯 Priority API Keys (Get These First)

### 1. **Truflation** - Real-time Inflation Data
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

### 2. **Glassnode** - On-chain Analytics
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

## 🆓 Free API Keys (No Cost, High Value)

### 3. **DeFiLlama** - DeFi Yields (FREE!)
- **Website**: https://defillama.com/docs/api
- **Pricing**: FREE (no key needed for basic usage)
- **What you get**:
  - Real-time DeFi yields
  - TVL data across protocols
  - Pool information
- **Environment variable**: None needed
- **Worth it?**: ✅ YES - Free and excellent data

### 4. **Yearn Finance** - Vault Yields (FREE!)
- **Website**: https://api.yearn.finance/
- **Pricing**: FREE
- **What you get**:
  - Yearn vault APYs
  - Risk-adjusted yields
  - Strategy information
- **Environment variable**: None needed
- **Worth it?**: ✅ YES - Free professional yield data

## 💰 Optional Premium APIs

### 5. **Messari** - Market Intelligence
- **Website**: https://messari.io/api
- **Pricing**: $29-999/month
- **What you get**:
  - Professional market data
  - Fundamental analysis
  - Asset metrics
- **Environment variable**: `MESSARI_API_KEY`
- **Worth it?**: 🤔 MAYBE - Good but expensive

### 6. **Alpha Vantage** - Exchange Rates
- **Website**: https://www.alphavantage.co/support/#api-key
- **Pricing**: FREE tier available, $49.99/month for premium
- **What you get**:
  - Real-time forex data
  - Historical exchange rates
  - Economic indicators
- **Environment variable**: `ALPHA_VANTAGE_API_KEY`
- **Worth it?**: ✅ YES - Free tier is sufficient

### 7. **FRED (Federal Reserve)** - Economic Data
- **Website**: https://fred.stlouisfed.org/docs/api/api_key.html
- **Pricing**: FREE
- **What you get**:
  - Official US economic data
  - CPI, unemployment, GDP
  - Historical economic indicators
- **Environment variable**: `FRED_API_KEY`
- **Worth it?**: ✅ YES - Free government data

## 🚀 Quick Setup Instructions

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
MESSARI_API_KEY=your_messari_key_here  # Optional
```

### Step 3: Test Your Setup
```bash
pnpm validate-agent
pnpm test-x402-comprehensive
```

## 💡 Cost-Benefit Analysis

### Monthly Cost Breakdown:
- **Truflation**: $50-200/month
- **Glassnode**: $39/month (starter)
- **Alpha Vantage**: Free
- **FRED**: Free
- **DeFiLlama**: Free
- **Yearn**: Free

**Total minimum cost**: ~$89/month for premium data

### Value Proposition:
- Your agent can make **much better decisions** with real data
- Users get **professional-grade analysis** 
- **Transparent costs** - users see exactly what data they're paying for
- **Competitive advantage** over free tools

## 🌍 Alternative Data Sources by Region

### For Global Coverage:
- **CoinGecko Pro**: https://www.coingecko.com/en/api/pricing ($129/month)
- **CryptoCompare**: https://min-api.cryptocompare.com/ ($50-500/month)
- **Kaiko**: https://www.kaiko.com/ (Enterprise pricing)

### For Specific Regions:
- **Europe**: ECB Statistical Data Warehouse (Free)
- **Asia**: Bank of Japan API (Free)
- **Emerging Markets**: World Bank API (Free)

## 🔧 Implementation Notes

### API Rate Limits:
- **Truflation**: 1000 requests/month on basic plan
- **Glassnode**: 1000 requests/day on starter
- **Alpha Vantage**: 25 requests/day (free), 75/minute (premium)
- **DeFiLlama**: No official limits (be respectful)

### Caching Strategy:
- Cache inflation data for 1 hour
- Cache yield data for 15 minutes  
- Cache market data for 5 minutes
- This reduces API costs significantly

### Error Handling:
All APIs have fallback mock data, so your agent will work even if APIs are down.

## 🎯 Recommended Starting Point

**For MVP/Testing** ($0/month):
- Use free APIs only (Alpha Vantage, FRED, DeFiLlama, Yearn)
- Good enough for basic functionality

**For Production** ($89/month):
- Add Truflation + Glassnode
- Significant improvement in data quality
- Professional-grade insights

**For Enterprise** ($200+/month):
- Add Messari, CoinGecko Pro
- Maximum data coverage and accuracy

## 🚨 Security Notes

1. **Never commit API keys** to version control
2. **Use environment variables** only
3. **Set up spending alerts** for paid APIs
4. **Monitor usage** to avoid overage charges
5. **Rotate keys** periodically for security

## 📞 Support Contacts

If you have issues getting API keys:

- **Truflation**: support@truflation.com
- **Glassnode**: support@glassnode.com  
- **Alpha Vantage**: support@alphavantage.co
- **Messari**: support@messari.io

Most providers are responsive and can help with setup questions.