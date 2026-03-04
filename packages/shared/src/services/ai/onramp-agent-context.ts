/**
 * Onramp Agent Context
 * 
 * Provides AI agent with comprehensive knowledge about fiat on/off ramp options
 * to help users with crypto purchasing and selling questions.
 */

export interface OnrampProvider {
    name: string;
    type: 'primary' | 'fallback';
    strengths: string[];
    limitations: string[];
    supportedNetworks: string[];
    kycRequirements: {
        noKyc: boolean;
        noKycLimit?: string;
        fullKycLimit?: string;
    };
    paymentMethods: string[];
    processingTime: string;
    fees: string;
    regions: string[];
}

export const ONRAMP_PROVIDERS: Record<string, OnrampProvider> = {
    guardarian: {
        name: "Guardarian",
        type: "primary",
        strengths: [
            "No-KYC support up to €700",
            "Native integration with better UX",
            "Direct ARB token support on Arbitrum",
            "Multiple payment methods (cards, Apple Pay, Google Pay, bank transfers)",
            "Instant processing",
            "EU-licensed and regulated",
            "Non-custodial (funds go directly to user wallet)"
        ],
        limitations: [
            "€700 limit for no-KYC transactions",
            "Higher amounts require full KYC verification"
        ],
        supportedNetworks: ["Arbitrum", "Celo", "Ethereum", "Polygon", "Base"],
        kycRequirements: {
            noKyc: true,
            noKycLimit: "€700",
            fullKycLimit: "Higher amounts with verification"
        },
        paymentMethods: ["Credit/Debit Cards", "Apple Pay", "Google Pay", "Bank Transfer", "SEPA"],
        processingTime: "Instant",
        fees: "Competitive rates",
        regions: ["EU", "US", "Canada", "UK", "Brazil (PIX)", "Many others"]
    },
    mtpelerin: {
        name: "Mt Pelerin",
        type: "fallback",
        strengths: [
            "Swiss regulated and established",
            "Higher transaction limits",
            "Strong track record on Celo network",
            "Comprehensive compliance",
            "Multiple fiat currencies supported"
        ],
        limitations: [
            "Requires KYC for most transactions",
            "Less native integration (external redirect)",
            "Longer processing times"
        ],
        supportedNetworks: ["Celo", "Arbitrum", "Ethereum", "Polygon", "Base"],
        kycRequirements: {
            noKyc: false,
            fullKycLimit: "Higher limits with full verification"
        },
        paymentMethods: ["Credit/Debit Cards", "Bank Transfer", "SEPA"],
        processingTime: "Standard banking times",
        fees: "Standard rates",
        regions: ["EU", "Switzerland", "Many global markets"]
    }
};

export const NETWORK_OPTIMIZATION = {
    arbitrum: {
        primaryProvider: "guardarian",
        reasoning: "Guardarian excels on Arbitrum with direct ARB support and no-KYC flow",
        recommendation: "Use Guardarian for all amounts, especially beneficial for ARB ecosystem"
    },
    celo: {
        primaryProvider: "guardarian", // For small amounts
        fallbackProvider: "mtpelerin", // For large amounts
        reasoning: "Amount-based routing: Guardarian for no-KYC small amounts, Mt Pelerin for larger transactions",
        recommendation: "≤€700: Use Guardarian (no-KYC), >€700: Consider Mt Pelerin for higher limits"
    },
    other: {
        primaryProvider: "guardarian",
        reasoning: "Guardarian provides broad network support with no-KYC advantage",
        recommendation: "Default to Guardarian for most networks"
    }
};

export function getOnrampSystemPrompt(): string {
    return `
# DiversiFi Fiat On/Off Ramp Knowledge

You are an AI assistant for DiversiFi with comprehensive knowledge about fiat-to-crypto onramp options. Help users understand and choose the best way to buy or sell cryptocurrency.

## Available Onramp Providers

### Guardarian (Primary Provider)
- **Best for**: No-KYC transactions up to €700, Arbitrum network, quick purchases
- **Strengths**: Instant processing, native integration, direct ARB support, multiple payment methods
- **Payment Methods**: Credit/debit cards, Apple Pay, Google Pay, bank transfers, SEPA
- **KYC**: Not required for amounts ≤€700
- **Networks**: Arbitrum, Celo, Ethereum, Polygon, Base
- **Regions**: EU, US, Canada, UK, Brazil (PIX), and many others

### Mt Pelerin (Fallback Provider)  
- **Best for**: Larger amounts requiring higher limits, established Swiss regulation
- **Strengths**: Swiss regulated, higher transaction limits, strong Celo track record
- **Payment Methods**: Credit/debit cards, bank transfers, SEPA
- **KYC**: Required for most transactions
- **Networks**: Celo, Arbitrum, Ethereum, Polygon, Base
- **Regions**: EU, Switzerland, global markets

## Network-Specific Recommendations

### On Arbitrum Network:
- **Recommended**: Guardarian (all amounts)
- **Why**: Direct ARB token support, optimized for Arbitrum ecosystem, no-KYC advantage

### On Celo Network:
- **Small amounts (≤€700)**: Guardarian (no-KYC benefit)
- **Large amounts (>€700)**: Mt Pelerin (higher limits, established Celo presence)

### Other Networks:
- **Default**: Guardarian (broad support, no-KYC advantage)

## User Guidance

When users ask about buying or selling crypto:

1. **Assess their needs**:
   - Transaction amount (affects KYC requirements)
   - Current network (affects provider optimization)
   - Payment method preference
   - Speed requirements
   - KYC tolerance

2. **Provide clear recommendations**:
   - Explain why a specific provider is recommended
   - Mention no-KYC limits and benefits
   - Note network-specific advantages
   - Suggest alternatives if needed

3. **Help with common questions**:
   - "How do I buy crypto without KYC?" → Guardarian up to €700
   - "What's the fastest way to buy ARB?" → Guardarian on Arbitrum
   - "I need to buy €1000 worth" → Consider Mt Pelerin for higher limits
   - "Which payment methods are supported?" → List options by provider

4. **Integration context**:
   - Both providers are integrated natively in DiversiFi
   - Smart routing automatically selects optimal provider
   - Users can manually choose providers if preferred
   - All transactions go directly to user's connected wallet

## Key Benefits to Highlight

- **No-KYC Option**: Guardarian allows up to €700 without verification
- **Network Optimization**: Smart routing based on user's connected network
- **Multiple Payment Methods**: Cards, mobile payments, bank transfers
- **Instant Processing**: Especially with Guardarian
- **Non-Custodial**: Funds go directly to user's wallet
- **Regulatory Compliance**: Both providers are properly licensed

Always be helpful, accurate, and guide users to the best option for their specific situation.
`;
}

export function getOnrampRecommendation(
    amount: number,
    network: string,
    userPreferences?: {
        preferNoKyc?: boolean;
        preferSpeed?: boolean;
        preferEstablished?: boolean;
    }
): {
    provider: string;
    reasoning: string;
    alternatives?: string[];
} {
    const isSmallAmount = amount <= 700;
    const networkLower = network.toLowerCase();

    // Arbitrum - always Guardarian
    if (networkLower.includes('arbitrum')) {
        return {
            provider: 'Guardarian',
            reasoning: 'Optimized for Arbitrum with direct ARB support and no-KYC up to €700',
            alternatives: ['Mt Pelerin (if you prefer Swiss regulation)']
        };
    }

    // Celo - amount-based routing
    if (networkLower.includes('celo')) {
        if (isSmallAmount || userPreferences?.preferNoKyc) {
            return {
                provider: 'Guardarian',
                reasoning: 'No-KYC advantage for amounts under €700, instant processing',
                alternatives: ['Mt Pelerin (established Celo presence, higher limits)']
            };
        } else {
            return {
                provider: 'Mt Pelerin',
                reasoning: 'Higher limits for larger amounts, strong Celo track record',
                alternatives: ['Guardarian (if you prefer no-KYC and can split the amount)']
            };
        }
    }

    // Other networks - default to Guardarian
    return {
        provider: 'Guardarian',
        reasoning: 'Broad network support with no-KYC advantage up to €700',
        alternatives: ['Mt Pelerin (if you need higher limits or prefer Swiss regulation)']
    };
}

export default {
    ONRAMP_PROVIDERS,
    NETWORK_OPTIMIZATION,
    getOnrampSystemPrompt,
    getOnrampRecommendation
};