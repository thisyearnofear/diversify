/**
 * IntentDiscoveryService
 *
 * Maps natural language queries to specific application actions.
 * Centralizes intent parsing logic for both Voice and Text inputs.
 */
export type AppIntent = {
    type: 'NAVIGATE';
    tab: 'overview' | 'protect' | 'swap' | 'info';
} | {
    type: 'SWAP_SHORTCUT';
    fromToken?: string;
    toToken?: string;
    amount?: string;
} | {
    type: 'SEND_TO_PHONE';
    phoneNumber: string;
    amount?: string;
    token?: string;
} | {
    type: 'ANALYZE_REQUEST';
    goal?: string;
} | {
    type: 'ONBOARDING';
    topic: 'what-is-this' | 'how-to-start' | 'is-safe' | 'wallet-help' | 'demo';
} | {
    type: 'QUERY';
    context: 'market' | 'portfolio' | 'general';
} | {
    type: 'UNKNOWN';
};
export declare class IntentDiscoveryService {
    /**
     * Parse raw text to discover the primary user intent
     */
    static discover(text: string): AppIntent;
    private static extractTokens;
}
//# sourceMappingURL=intent-discovery.service.d.ts.map