# Fiat On-Ramp & Off-Ramp Research for DiversiFi

## Executive Summary

This research analyzes the best fiat on-ramp and off-ramp solutions for DiversiFi Oracle, focusing on **free integration options** that support **Celo** and **Arbitrum** chains. Given DiversiFi's multi-chain architecture (Celo, Arbitrum, Arc Network) and its focus on emerging market users, the ideal solution should offer global coverage, low fees, and seamless UX.

---

## 🎯 Project Requirements

### Current Architecture
- **Primary Chains**: Celo (emerging markets), Arbitrum (RWA/Yield), Arc Network (Agent operations)
- **Target Users**: Users without crypto looking to onboard; users wanting to cash out to fiat
- **Key Tokens**: USDC, EURC, local stablecoins (cUSD, cKES, cCOP, etc.)
- **Integration Context**: Next.js + React + wagmi/viem + existing Circle infrastructure

### Must-Have Criteria
1. ✅ **Free to integrate** (no upfront fees or monthly costs)
2. ✅ **Celo support** (primary for emerging markets)
3. ✅ **Arbitrum support** (RWA and yield strategies)
4. ✅ **USDC/EURC support** (Circle stablecoins)
5. ✅ **Global coverage** (emerging markets focus)
6. ✅ **Off-ramp capability** (crypto to fiat withdrawals)

### Nice-to-Have Criteria
- 🟡 Revenue sharing/affiliate program
- 🟡 Embedded widget/SDK for seamless UX
- 🟡 Low KYC friction
- 🟡 Local payment methods (Mobile Money, PIX, etc.)

---

## 🏆 Top Recommendations (Ranked)

### 1. **Coinbase Onramp** ⭐ BEST OVERALL

**Why it's ideal for DiversiFi:**
- ✅ **FREE integration** - No setup fees, no monthly costs
- ✅ **Native USDC focus** - Perfect alignment with Circle infrastructure
- ✅ **Celo & Arbitrum supported** - Both primary chains covered
- ✅ **Off-ramp available** - Full two-way flows
- ✅ **Trusted brand** - Highest conversion rates
- ✅ **Revenue sharing** - Earn fees from user transactions
- ✅ **Excellent documentation** - Developer-friendly

**Integration:**
```bash
npm install @coinbase/onchainkit
# or
npm install @coinbase/cbpay-js
```

**Key Features:**
- 250+ tokens supported
- 60+ fiat currencies
- Embeddable widget
- Handles KYC/Compliance
- Fraud management included

**Fees:** 0-2.5% (competitive)

**Best For:** Primary on-ramp for US/EU users; institutional credibility

---

### 2. **Transak** ⭐ BEST FOR EMERGING MARKETS

**Why it's ideal for DiversiFi:**
- ✅ **FREE integration** - No setup fees
- ✅ **Celo & Arbitrum supported** - Confirmed support
- ✅ **125+ countries** - Excellent emerging market coverage
- ✅ **175+ payment methods** - Mobile money, local banks
- ✅ **Off-ramp available** - Full two-way capability
- ✅ **White-label SDK** - Customizable UI
- ✅ **Revenue sharing** - 0.5-1% commission to partners

**Integration:**
```bash
npm install @transak/transak-sdk
```

**Key Features:**
- KYC handled by Transak
- Real-time transaction tracking
- Multiple language support
- NFT checkout also available

**Fees:** ~1% + network fees (varies by region)

**Best For:** Emerging markets (Africa, LatAm, Asia); local payment methods

---

### 3. **Ramp Network** ⭐ BEST FOR LOW FEES

**Why it's ideal for DiversiFi:**
- ✅ **FREE integration** - No setup costs
- ✅ **Celo & Arbitrum supported** - Both chains confirmed
- ✅ **150+ countries**
- ✅ **Non-custodial** - Direct to user wallet
- ✅ **Low fees:** 0.49-2.9%
- ✅ **Off-ramp available** - 130+ countries for selling
- ✅ **Fast KYC** - Quick user onboarding

**Integration:**
```javascript
// Simple embed
https://buy.ramp.network/?hostAppName=DiversiFi&hostLogoUrl=...&swapAsset=USDC_CELO
```

**Key Features:**
- Widget SDK
- URL-based integration (simplest option)
- SEPA, cards, Apple Pay, Google Pay
- €2.49 minimum fee (good for larger purchases)

**Fees:** 0.49-2.9% (bank transfers cheapest)

**Best For:** Cost-conscious users; EU market

---

### 4. **Kado** ⭐ BEST FOR CELO ECOSYSTEM

**Why it's ideal for DiversiFi:**
- ✅ **FREE integration**
- ✅ **Celo-native** - Deep Celo integration
- ✅ **Arbitrum supported**
- ✅ **Off-ramp available**
- ✅ **USDC focus** - Perfect for Circle integration
- ✅ **Revenue sharing**
- ✅ **Simple API**

**Integration:**
```javascript
// Direct API integration
https://app.kado.money/?apiKey=YOUR_KEY&network=CELO&asset=USDC
```

**Key Features:**
- Optimized for Celo
- Low fees
- Fast settlement
- Good for US-based users

**Fees:** Competitive, varies by method

**Best For:** Celo-first strategy; US users

---

### 5. **MoonPay** - PREMIUM OPTION

**Why consider:**
- ✅ **160+ countries**
- ✅ **Celo & Arbitrum supported**
- ✅ **Off-ramp available**
- ✅ **Premium UX**
- ❌ Higher fees (1-4.5%)
- ❌ May have setup requirements

**Best For:** Users prioritizing UX over cost; established apps with volume

---

### 6. **Onramper** - AGGREGATOR OPTION

**Why consider:**
- ✅ **FREE integration**
- ✅ **Aggregates 30+ ramps** - Best coverage
- ✅ **175+ payment methods**
- ✅ **Smart routing** - Best rates automatically
- ✅ **Single integration** - Multiple providers
- ❌ Variable UX (depends on underlying provider)

**Integration:**
```bash
npm install @onramper/widget
```

**Best For:** Maximum global coverage; automatic optimization

---

## 📊 Comparison Matrix

| Provider | Free Integration | Celo | Arbitrum | Off-Ramp | Fees | Emerging Markets | Revenue Share |
|----------|-----------------|------|----------|----------|------|------------------|---------------|
| **Coinbase Onramp** | ✅ | ✅ | ✅ | ✅ | 0-2.5% | 🟡 | ✅ |
| **Transak** | ✅ | ✅ | ✅ | ✅ | ~1% | ✅✅ | ✅ |
| **Ramp Network** | ✅ | ✅ | ✅ | ✅ | 0.49-2.9% | 🟡 | ✅ |
| **Kado** | ✅ | ✅ | ✅ | ✅ | Low | 🟡 | ✅ |
| **MoonPay** | 🟡 | ✅ | ✅ | ✅ | 1-4.5% | ✅ | ✅ |
| **Onramper** | ✅ | ✅* | ✅* | ✅ | Varies | ✅✅ | 🟡 |
| **Banxa** | 🟡 | ✅ | ✅ | ✅ | 1-3% | ✅ | ✅ |

*Via aggregated providers

---

## 🛠 Implementation Recommendations

### Phase 1: Primary Integration (Immediate)

**Recommended: Coinbase Onramp + Transak**

```typescript
// Strategy: Dual-provider approach
// - Coinbase Onramp: Primary for US/EU (trust + USDC focus)
// - Transak: Fallback for emerging markets (local payment methods)

interface OnRampConfig {
  primary: 'coinbase' | 'transak';
  fallback: 'transak' | 'ramp';
}

const getOnRampProvider = (userRegion: Region): OnRampConfig => {
  const emergingMarkets = ['KE', 'NG', 'PH', 'BR', 'MX', 'IN', 'ID'];
  
  if (emergingMarkets.includes(userRegion.countryCode)) {
    return { primary: 'transak', fallback: 'ramp' };
  }
  return { primary: 'coinbase', fallback: 'transak' };
};
```

### Phase 2: Optimization (Later)

Add **Onramper** as an aggregator for automatic best-rate routing.

---

## 💻 Code Implementation Example

### Coinbase Onramp Integration

```typescript
// components/onramp/CoinbaseOnramp.tsx
import { initOnRamp } from '@coinbase/cbpay-js';
import { useEffect, useRef } from 'react';

interface CoinbaseOnrampProps {
  address: string;
  chainId: number;
  amount?: string;
}

export function CoinbaseOnramp({ address, chainId, amount = '50' }: CoinbaseOnrampProps) {
  const onrampInstance = useRef<any>(null);

  useEffect(() => {
    initOnRamp({
      appId: process.env.NEXT_PUBLIC_COINBASE_APP_ID,
      widgetParameters: {
        destinationWallets: [{
          address,
          blockchains: chainId === 42220 ? ['celo'] : ['arbitrum'],
          assets: ['USDC', 'EURC'],
        }],
        presetFiatAmount: parseInt(amount),
        fiatCurrency: 'USD',
      },
      onSuccess: () => console.log('Purchase successful'),
      onExit: () => console.log('Widget closed'),
    }, (instance) => {
      onrampInstance.current = instance;
    });

    return () => onrampInstance.current?.destroy();
  }, [address, chainId, amount]);

  return (
    <button 
      onClick={() => onrampInstance.current?.open()}
      className="btn-primary"
    >
      Buy Crypto with Card
    </button>
  );
}
```

### Transak Integration

```typescript
// components/onramp/TransakOnramp.tsx
import transakSDK from '@transak/transak-sdk';

interface TransakOnrampProps {
  address: string;
  chainId: number;
}

export function TransakOnramp({ address, chainId }: TransakOnrampProps) {
  const openTransak = () => {
    const transak = new transakSDK({
      apiKey: process.env.NEXT_PUBLIC_TRANSAK_API_KEY,
      environment: 'PRODUCTION',
      widgetHeight: '600px',
      widgetWidth: '450px',
      defaultCryptoCurrency: 'USDC',
      walletAddress: address,
      // Celo = 42220, Arbitrum = 42161
      network: chainId === 42220 ? 'celo' : 'arbitrum',
      cryptoCurrencyList: 'USDC,EURC,cUSD',
      fiatCurrency: '', // Auto-detect
      email: '', // Optional
      redirectURL: window.location.origin,
      hostURL: window.location.origin,
    });

    transak.init();
  };

  return (
    <button onClick={openTransak} className="btn-secondary">
      Buy with Local Payment
    </button>
  );
}
```

### Combined On-Ramp Component

```typescript
// components/onramp/FiatOnramp.tsx
import { useWalletContext } from '../wallet/WalletProvider';
import { useUserRegion } from '@/hooks/use-user-region';
import { CoinbaseOnramp } from './CoinbaseOnramp';
import { TransakOnramp } from './TransakOnramp';
import { RampOnramp } from './RampOnramp';

export function FiatOnramp() {
  const { address, chainId } = useWalletContext();
  const { region } = useUserRegion();

  if (!address || !chainId) {
    return <ConnectWalletPrompt />;
  }

  // Determine best provider based on region
  const isEmergingMarket = ['KE', 'NG', 'PH', 'BR', 'MX', 'IN', 'ID'].includes(region.countryCode);

  return (
    <div className="onramp-container">
      <h3>Add Funds to Your Wallet</h3>
      
      {isEmergingMarket ? (
        <>
          <TransakOnramp address={address} chainId={chainId} />
          <p className="text-sm text-gray-500 mt-2">
            Supports M-Pesa, local banks, and mobile money
          </p>
        </>
      ) : (
        <>
          <CoinbaseOnramp address={address} chainId={chainId} />
          <div className="divider">or</div>
          <TransakOnramp address={address} chainId={chainId} />
        </>
      )}
      
      <div className="mt-4 text-xs text-gray-400">
        <p>🔒 Secure payments processed by regulated providers</p>
        <p>💰 Funds sent directly to your wallet</p>
      </div>
    </div>
  );
}
```

---

## 💰 Revenue Opportunities

### Affiliate/Revenue Share Programs

| Provider | Revenue Share | Requirements |
|----------|--------------|--------------|
| **Coinbase** | Up to 50% of fees | Application required |
| **Transak** | 0.5-1% of volume | Automatic for integrations |
| **Ramp** | 0.5% of volume | Partner program |
| **Kado** | Custom % | Contact for terms |
| **Onramper** | Varies by provider | Automatic |

**Estimated Revenue (example):**
- 1,000 users/month × $100 avg purchase × 1% commission = **$1,000/month**
- 10,000 users/month × $100 avg purchase × 1% commission = **$10,000/month**

---

## 🔐 Security & Compliance

All recommended providers:
- ✅ Are regulated (FinCEN, FCA, EU VASP)
- ✅ Handle KYC/AML compliance
- ✅ Use PCI-DSS compliant payment processing
- ✅ Offer fraud protection
- ✅ Provide chargeback management

**DiversiFi responsibilities:**
- Display clear terms to users
- Implement proper error handling
- Store no payment data (handled by providers)
- Monitor for suspicious activity

---

## 📈 Success Metrics

Track these KPIs post-integration:

| Metric | Target |
|--------|--------|
| On-ramp conversion rate | >15% |
| Off-ramp usage | >5% of on-ramp volume |
| Average transaction size | $50-200 |
| User acquisition cost | <$5 per user |
| Revenue per user | >$1 per transaction |

---

## 🚀 Next Steps

### Immediate Actions
1. **Apply for Coinbase Onramp** - Start at [Coinbase Developer](https://www.coinbase.com/developer-platform)
2. **Register for Transak** - Sign up at [Transak](https://transak.com/)
3. **Get API keys** - Both are free to register

### Integration Priority
1. **Week 1-2**: Coinbase Onramp integration (US/EU focus)
2. **Week 3-4**: Transak integration (emerging markets)
3. **Week 5-6**: Off-ramp implementation
4. **Week 7-8**: Analytics and optimization

### Testing Strategy
- Test on testnets first
- Verify KYC flows
- Check all supported countries
- Validate revenue tracking

---

## 📚 Additional Resources

- [Coinbase Onramp Docs](https://docs.cdp.coinbase.com/onramp/docs/welcome/)
- [Transak Integration Guide](https://docs.transak.com/)
- [Ramp Network Docs](https://docs.ramp.network/)
- [Kado Documentation](https://docs.kado.money/)

---

## Conclusion

**Recommended Stack:**
1. **Primary**: Coinbase Onramp (trust, USDC alignment, revenue share)
2. **Secondary**: Transak (emerging markets, local payment methods)
3. **Future**: Onramper (automatic optimization)

This combination provides:
- ✅ 100% free integration
- ✅ Full Celo + Arbitrum coverage
- ✅ Global reach including emerging markets
- ✅ Revenue generation opportunity
- ✅ Best-in-class UX

---

*Research conducted: January 2026*
*Next review: April 2026*
