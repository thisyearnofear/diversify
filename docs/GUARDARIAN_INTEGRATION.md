# Guardarian Integration Guide

## Overview

Guardarian has been integrated as the **primary fiat on/off ramp** for DiversiFi, offering a more native user experience with no-KYC support for small amounts. The integration includes **network-specific optimizations** for the best UX on both Celo and Arbitrum, and **full AI agent awareness** for intelligent user assistance.

## AI Agent Integration ✨

The DiversiFi AI agent is now **fully aware** of onramp options and can help users with:

### Onramp Questions the AI Can Answer:
- "How do I buy crypto without KYC?"
- "What's the best way to buy ARB on Arbitrum?"
- "I want to purchase $500 worth of crypto, what are my options?"
- "How can I sell my crypto for fiat?"
- "What payment methods are supported?"
- "I'm on Celo network, which onramp should I use?"
- "Can I buy crypto with Apple Pay?"
- "What are the limits for no-KYC purchases?"
- "Which is better, Guardarian or Mt Pelerin?"

### AI Agent Capabilities:
- **Smart Provider Recommendations**: Based on user's network, amount, and preferences
- **Contextual Guidance**: Explains why specific providers are recommended
- **Payment Method Advice**: Suggests optimal payment methods
- **Network-Specific Tips**: Tailored advice for Arbitrum vs Celo
- **No-KYC Guidance**: Clear explanations of limits and benefits
- **Voice Support**: Ask questions via voice input
- **Integrated Experience**: Onramp recommendations appear directly in agent responses

## Network-Specific UX Strategy

### Arbitrum Network
- **Primary**: Guardarian (recommended for ARB ecosystem)
- **AI Messaging**: "Guardarian recommended for Arbitrum - Optimized for ARB with no-KYC support"
- **Strengths**: Direct ARB support, no-KYC up to €700, native integration

### Celo Network  
- **Small Amounts (≤€700)**: Guardarian (no-KYC advantage)
- **Large Amounts (>€700)**: Mt Pelerin (established Celo track record)
- **AI Messaging**: Smart routing based on transaction amount with contextual explanations

## Key Benefits

- **AI-Powered Guidance**: Users get intelligent recommendations through natural conversation
- **Network-Aware Routing**: Auto-selects optimal provider based on network + amount
- **No-KYC Support**: Transactions up to €700 without verification
- **Native Integration**: More seamless UX compared to Mt Pelerin redirects
- **Multi-Network Support**: Both Celo and Arbitrum fully supported
- **Multiple Payment Methods**: Cards, Apple Pay, Google Pay, bank transfers
- **Instant Processing**: Faster than traditional KYC flows
- **Voice Interface**: Ask questions naturally via voice input

## Implementation

### AI Agent Integration

The AI agent automatically detects onramp-related questions and provides intelligent responses:

```typescript
// AI automatically detects these keywords and provides onramp guidance:
const onrampKeywords = [
  'buy crypto', 'sell crypto', 'fiat', 'onramp', 'off-ramp',
  'purchase', 'cash out', 'deposit', 'withdraw', 'credit card',
  'bank transfer', 'apple pay', 'google pay', 'kyc', 'no kyc',
  'guardarian', 'mt pelerin', 'how to buy', 'how to sell'
];
```

### Smart Network-Optimized Components (Recommended)

```typescript
import { SmartBuyCryptoButton, NetworkOptimizedOnramp } from '@/components/onramp';

// Auto-selects best provider based on network and amount
<SmartBuyCryptoButton />

// Shows network-specific recommendations to user
<NetworkOptimizedOnramp showNetworkInfo={true} />
```

### Manual Provider Selection

```typescript
import { UnifiedOnramp } from '@/components/onramp';

// Show provider choice for larger amounts
<UnifiedOnramp 
  mode="buy" 
  showProviderChoice={true}
  defaultAmount="1000" 
/>
```

### Direct Provider Access

```typescript
import { GuardarianOnramp, MtPelerinOnramp } from '@/components/onramp';

// Force specific provider
<GuardarianOnramp mode="buy" />
<MtPelerinOnramp mode="buy" />
```

## Smart Routing Logic

### Arbitrum (Chain ID: 42161)
- **All Amounts**: Guardarian (optimized for ARB ecosystem)
- **AI Messaging**: "Guardarian recommended for Arbitrum - Direct ARB support with no-KYC up to €700"

### Celo (Chain ID: 42220)  
- **≤€700**: Guardarian ("No-KYC advantage for amounts under €700")
- **>€700**: Mt Pelerin ("Higher limits with established Celo presence")
- **AI Reasoning**: Leverage no-KYC for small amounts, established provider for large amounts

### Other Networks
- **Default**: Guardarian (broad network support)
- **AI Messaging**: "Guardarian provides broad network support with no-KYC advantage"

## AI Agent Features

### Intelligent Question Detection
- Automatically recognizes onramp-related questions
- Routes to specialized onramp knowledge base
- Provides contextual recommendations based on user's situation

### Personalized Recommendations
- Considers user's current network
- Factors in transaction amount
- Accounts for KYC preferences
- Suggests optimal payment methods

### Educational Responses
- Explains why providers are recommended
- Clarifies no-KYC limits and benefits
- Provides step-by-step guidance
- Offers alternatives when appropriate

### Voice Integration
- Users can ask onramp questions via voice
- Natural language processing for conversational queries
- Spoken responses available (when TTS is enabled)

## UX Enhancements

### AI-Powered Onboarding
- New users get intelligent guidance on first crypto purchase
- Contextual help based on their connected wallet and network
- Progressive disclosure of advanced features

### Smart Notifications
- AI suggests optimal times to buy based on portfolio analysis
- Proactive recommendations when users need to add funds
- Network-specific tips and optimizations

### Conversational Interface
- Natural language queries: "How do I buy $200 worth of ARB?"
- Follow-up questions: "What about larger amounts?"
- Contextual memory within conversation sessions

## Configuration

### AI Agent Setup
- Onramp knowledge automatically loaded with agent initialization
- No additional configuration required
- Works with existing Gemini API integration

### Guardarian Setup
1. Sign up at [guardarian.com/integrate-us](https://guardarian.com/integrate-us)
2. Get Partner ID from dashboard
3. Configure widget parameters as needed

### Current Implementation
- Uses public widget endpoints (no API key required initially)
- Supports Arbitrum, Celo, Ethereum, Polygon, Base
- Auto-detects user's connected network
- Network-specific crypto defaults (ARB on Arbitrum, CELO on Celo)
- AI agent provides intelligent guidance for all scenarios

## Migration Notes

- Existing `MtPelerinOnramp` components remain functional
- New `Smart*` components provide network-optimized UX
- `NetworkOptimizedOnramp` shows users why a provider is recommended
- AI agent provides seamless onboarding for new users
- Gradual migration approach - no breaking changes
- Mt Pelerin serves as intelligent fallback

## Testing

Use the test script to verify AI agent onramp functionality:

```bash
node tests/test-onramp-agent.js
```

Test questions include:
- Basic onramp queries
- Network-specific questions
- Amount-based recommendations
- Payment method inquiries
- KYC-related questions

## Compliance

- Guardarian handles all KYC/AML requirements
- EU-licensed and regulated  
- Non-custodial (funds go directly to user wallet)
- No storage of user assets or private information
- Supports both Celo and Arbitrum networks compliantly
- AI agent provides accurate compliance information

## Performance Considerations

- Network detection happens client-side (no API calls)
- Provider selection cached per session
- Lazy loading of provider widgets
- Minimal bundle size impact
- AI responses cached for common questions
- Efficient keyword detection for onramp queries

## Next Steps

1. **Partner Account**: Set up official Guardarian partner account
2. **Custom Branding**: Apply DiversiFi theming to widget
3. **Analytics**: Track conversion rates by network and provider
4. **AI Enhancement**: Expand agent knowledge with user feedback
5. **Voice Optimization**: Improve voice recognition for onramp queries
6. **Regional Testing**: Verify support in target markets
7. **A/B Testing**: Compare AI-guided vs. manual onramp selection