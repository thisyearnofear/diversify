# Arc Network Agent Setup Guide

This guide will help you set up the autonomous AI agent that uses x402 payments to access premium financial data sources.

## Overview

The Arc Agent is an autonomous AI that:
- Pays for its own API calls using x402 protocol
- Accesses premium financial data (inflation, exchange rates, economic indicators)
- Operates within configurable spending limits
- **Scaleable Wallets**: Supports standard Private Keys or Circle's enterprise-grade Programmable Wallets.
- Records analysis on Arc Network blockchain for transparency
- Uses USDC as gas token for efficient operations

## Quick Setup

### 1. Run the Setup Script

```bash
pnpm setup-arc-agent
```

This will:
- Generate a new wallet for your agent
- Update your `.env` file with the private key
- Display the agent's address for funding

### 2. Fund Your Agent Wallet

Send USDC to the generated agent address on Arc Network:

**Testnet:**
- Get testnet USDC from: https://faucet.circle.com
- Recommended amount: 10-50 USDC for testing

**Mainnet:**
- Send real USDC to the agent address
- Recommended amount: 50-200 USDC for production

### 3. Get API Keys

Add these API keys to your `.env` file:

```bash
# Required for exchange rate data
ALPHA_VANTAGE_API_KEY=your_key_here

# Required for inflation data  
FRED_API_KEY=your_key_here

# Optional for additional market data
COINGECKO_API_KEY=your_key_here
```

**Get API Keys:**
- [Alpha Vantage](https://www.alphavantage.co/support/#api-key) - Free tier available
- [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) - Free with registration
- [CoinGecko Pro](https://www.coingecko.com/en/api/pricing) - Paid service

Set your agent's daily spending limit and infrastructure choice in `.env`:

```bash
ARC_AGENT_DAILY_LIMIT=5.0  # 5 USDC per day
ARC_AGENT_TESTNET=true     # Use testnet for development

# OPTIONAL: Use Circle Programmable Wallets
NEXT_PUBLIC_CIRCLE_WALLET_ID=your_circle_wallet_id
NEXT_PUBLIC_CIRCLE_API_KEY=your_circle_api_key
```

## Manual Setup

If you prefer to set up manually:

### 1. Generate Agent Wallet

```javascript
import { generateAgentPrivateKey } from './utils/arc-agent-setup';

const { privateKey, address } = generateAgentPrivateKey();
console.log('Agent Address:', address);
console.log('Private Key:', privateKey); // Keep this secret!
```

### 2. Update Environment Variables

Add to your `.env` file:

```bash
# Arc Agent Configuration
ARC_AGENT_PRIVATE_KEY=0x1234567890abcdef...
ARC_AGENT_DAILY_LIMIT=5.0
ARC_AGENT_TESTNET=true

# API Keys
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
FRED_API_KEY=your_fred_key
COINGECKO_API_KEY=your_coingecko_key
```

### 3. Validate Setup

```javascript
import { validateAgentConfig } from './utils/arc-agent-setup';

const validation = validateAgentConfig();
if (!validation.isValid) {
  console.error('Setup errors:', validation.errors);
}
```

## How It Works

### x402 Payment Flow

1. **Initial Request**: Agent makes HTTP request to premium API
2. **402 Response**: API returns "Payment Required" with payment details
3. **USDC Payment**: Agent executes USDC transfer on Arc Network
4. **Retry Request**: Agent retries with payment proof
5. **Data Access**: API returns premium data

### Data Sources

The agent accesses multiple premium data sources:

**Inflation Data:**
- FRED Economic Data (Federal Reserve)
- Real-time CPI and inflation metrics

**Exchange Rates:**
- Alpha Vantage Premium
- CoinGecko Pro API
- Real-time forex and crypto rates

**Economic Indicators:**
- x402-enabled economic data services
- GDP, unemployment, interest rates

**DeFi Yields:**
- DeFiLlama API
- Real-time yield farming opportunities

### Cost Structure

Typical costs per analysis:
- Basic analysis: $0.02-0.05 USDC
- Deep analysis: $0.10-0.20 USDC
- Premium data sources: $0.01-0.08 USDC each

## Security Considerations

### Private Key Security

⚠️ **CRITICAL**: Your agent's private key controls autonomous spending

- Use environment variables only
- Consider using a dedicated agent wallet
- **Enterprise Tier**: Use Circle Programmable Wallets for server-side key management, social recovery, and vault-grade security.
- Set reasonable spending limits

### Spending Controls

The agent includes multiple safety mechanisms:

- **Daily Limits**: Configurable maximum daily spending
- **Balance Checks**: Verifies USDC balance before operations
- **Transaction Logging**: All payments logged for transparency
- **Fallback Behavior**: Graceful degradation if payments fail

### Network Security

- Uses Arc Network's secure RPC endpoints
- All transactions recorded on-chain
- USDC payments are atomic and verifiable

## Troubleshooting

### Common Issues

**"ARC_AGENT_PRIVATE_KEY is required"**
- Run `pnpm setup-arc-agent` to generate a wallet
- Ensure the private key is in your `.env` file

**"Insufficient USDC balance"**
- Fund your agent wallet with USDC on Arc Network
- Check balance at: https://testnet.arcscan.app

**"Failed to connect to Arc Network"**
- Verify RPC endpoint in environment variables
- Check network connectivity
- Ensure Arc Network is operational

**"x402 payment failed"**
- Verify USDC balance and allowances
- Check Arc Network transaction fees
- Ensure recipient address is valid

### Debug Mode

Enable detailed logging:

```bash
DEBUG=arc-agent:* pnpm dev
```

This will show:
- Network connection status
- Payment transactions
- API call details
- Error messages

## Production Deployment

### Environment Setup

For production deployment:

1. **Use Mainnet**: Set `ARC_AGENT_TESTNET=false`
2. **Secure Keys**: Use secure key management
3. **Monitor Spending**: Set up alerts for spending limits
4. **Scale Limits**: Increase daily limits as needed

### Monitoring

Monitor your agent's performance:

- **Spending**: Track daily USDC usage
- **Success Rate**: Monitor API call success rates
- **Data Quality**: Verify data source reliability
- **Network Status**: Monitor Arc Network health

### Scaling

For high-volume usage:

- Increase daily spending limits
- Add more premium data sources
- Implement caching strategies
- Use multiple agent wallets for redundancy

## Support

### Resources

- [Arc Network Documentation](https://docs.arc.network)
- [x402 Protocol Specification](https://docs.x402.org)
- [Circle USDC Documentation](https://developers.circle.com)

### Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your configuration with `validateAgentConfig()`
3. Check Arc Network status and your wallet balance
4. Review the console logs for detailed error messages

### Contributing

To improve the Arc Agent:

1. Add new premium data sources to `DATA_SOURCES`
2. Implement additional x402-enabled APIs
3. Enhance error handling and fallback mechanisms
4. Improve cost optimization strategies