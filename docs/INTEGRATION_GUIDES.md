# Integration Guides

## Farcaster Mini App Integration

### Overview
DiversiFi MiniPay is configured as a Farcaster mini app compliant with 2026 standards, providing seamless wallet connection and enhanced user experience.

### Key Features
- **Farcaster Webhook Endpoint**: `pages/api/farcaster-webhook.ts` handles frame actions and events
- **UI Components**: `FarcasterUserInfo.tsx` and `FarcasterWalletButton.tsx` for Farcaster-specific UI
- **Enhanced Wallet Hook**: `hooks/use-wallet.ts` with `connectFarcasterWallet()` function

### Configuration
**Farcaster Manifest**: `public/.well-known/farcaster.json`
```json
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

### Development Guide
Detect Farcaster environment:
```typescript
import { useWalletContext } from '../components/WalletProvider';

const { isFarcaster, farcasterContext } = useWalletContext();

if (isFarcaster && farcasterContext) {
  const { fid, username, displayName, pfp } = farcasterContext;
  // Use Farcaster user data
}
```

## Arc Agent Setup

### Prerequisites
- Node.js >= 18.0.0
- pnpm package manager
- Circle API keys (optional but recommended)

### Setup Process
1. **Environment Setup**:
   ```bash
   cp .env.example .env.local
   # Add your API keys
   NEXT_PUBLIC_CIRCLE_WALLET_ID=your_wallet_id
   NEXT_PUBLIC_CIRCLE_API_KEY=your_api_key
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Setup Arc Agent Wallet**:
   ```bash
   # Generate a new Arc agent wallet
   pnpm setup-arc-agent
   ```

4. **Fund Your Agent Wallet**:
   ```bash
   # Visit https://faucet.circle.com to get testnet USDC
   # Send testnet USDC to your agent wallet address
   ```

5. **Configure Spending Limits**:
   ```bash
   # Daily spending limit for the agent
   ARC_AGENT_DAILY_SPENDING_LIMIT=5.00  # $5 per day
   ```

6. **Test Your Setup**:
   ```bash
   pnpm test-x402-comprehensive
   ```

## Guardarian Integration

### Configuration
```typescript
// config/guardarian.ts
export const GUARDARIAN_CONFIG = {
  API_BASE_URL: process.env.GUARDARIAN_API_URL || 'https://api.guardarian.com',
  API_KEY: process.env.GUARDARIAN_API_KEY!,
  NO_KYC_LIMIT: 700, // EUR
  SUPPORTED_CHAINS: ['celo', 'ethereum', 'bsc', 'polygon', 'arbitrum'],
  SUPPORTED_FIAT: ['EUR', 'USD', 'GBP'],
  SUPPORTED_CRYPTO: ['USDC', 'USDT', 'WBTC', 'WETH', 'EUROC']
};
```

### Widget Integration
```jsx
// components/GuardarianWidget.tsx
import { useEffect, useRef } from 'react';

export default function GuardarianWidget({ 
  onSuccess, 
  onError,
  defaultAmount = 100,
  defaultCrypto = 'USDC',
  defaultFiat = 'EUR'
}) {
  const widgetRef = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://pay.guardarian.com/widget.js';
    script.async = true;
    
    script.onload = () => {
      // Initialize widget
      window.Guardarian.Widget.init({
        apiKey: process.env.GUARDARIAN_API_KEY,
        containerId: 'guardarian-widget-container',
        defaultValues: {
          amount: defaultAmount,
          crypto: defaultCrypto,
          fiat: defaultFiat
        },
        callbacks: {
          onSuccess,
          onError
        }
      });
    };

    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  return <div id="guardarian-widget-container" ref={widgetRef} />;
}
```

## Zapier Setup

### Prerequisites
- Zapier account
- DiversiFi webhook endpoint: `https://yourdomain.com/api/zapier-webhook`
- API key for authentication

### Setup Process
1. Go to [Zapier Platform](https://platform.zapier.com/)
2. Create new app named "DiversiFi Wealth Protection"
3. Configure authentication with API key

### Triggers
- **Portfolio Alert Trigger**: Triggers when portfolio reaches certain thresholds
- **Recommendation Ready Trigger**: Triggers when AI generates new recommendation

### Actions
- **Execute Swap Action**: Execute a token swap based on recommendation

### Webhook Endpoint Implementation
```typescript
// pages/api/zapier-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify Zapier signature
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
    default:
      return res.status(400).json({ error: 'Unknown event type' });
  }

  res.status(200).json({ success: true });
}
```

## Circle Integration

### Gateway Integration
- **Unified Balance**: Uses Circle Gateway to view and manage USDC balances across multiple chains
- **Deposit/Withdrawal Flows**: Handle deposits and withdrawals seamlessly
- **Spending Limits**: Manage spending limits and security policies

### Bridge Kit Integration
- **Cross-Chain Transfers**: Secure USDC transfers between chains
- **Fee Optimization**: Calculate and optimize bridge fees
- **Status Tracking**: Track transfer status and confirmations

### Programmable Wallets
- **Policy Configuration**: Set spending policies and limits
- **Transaction Approval**: Manage approval workflows
- **Security Monitoring**: Monitor for suspicious activities

## Security Best Practices

### Private Key Security
- Never commit private keys to version control
- Use environment variables only
- Rotate keys regularly
- Use hardware wallet if possible

### Spending Controls
- Set conservative daily spending limits
- Monitor spending regularly
- Set up alerts for unusual activity
- Use multisig for high-value agents

### API Key Management
- Use separate keys for development/production
- Monitor API usage regularly
- Set up billing alerts
- Restrict API key permissions where possible