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
export declare const ONRAMP_PROVIDERS: Record<string, OnrampProvider>;
export declare const NETWORK_OPTIMIZATION: {
    arbitrum: {
        primaryProvider: string;
        reasoning: string;
        recommendation: string;
    };
    celo: {
        primaryProvider: string;
        fallbackProvider: string;
        reasoning: string;
        recommendation: string;
    };
    other: {
        primaryProvider: string;
        reasoning: string;
        recommendation: string;
    };
};
export declare function getOnrampSystemPrompt(): string;
export declare function getOnrampRecommendation(amount: number, network: string, userPreferences?: {
    preferNoKyc?: boolean;
    preferSpeed?: boolean;
    preferEstablished?: boolean;
}): {
    provider: string;
    reasoning: string;
    alternatives?: string[];
};
declare const _default: {
    ONRAMP_PROVIDERS: Record<string, OnrampProvider>;
    NETWORK_OPTIMIZATION: {
        arbitrum: {
            primaryProvider: string;
            reasoning: string;
            recommendation: string;
        };
        celo: {
            primaryProvider: string;
            fallbackProvider: string;
            reasoning: string;
            recommendation: string;
        };
        other: {
            primaryProvider: string;
            reasoning: string;
            recommendation: string;
        };
    };
    getOnrampSystemPrompt: typeof getOnrampSystemPrompt;
    getOnrampRecommendation: typeof getOnrampRecommendation;
};
export default _default;
//# sourceMappingURL=onramp-agent-context.d.ts.map