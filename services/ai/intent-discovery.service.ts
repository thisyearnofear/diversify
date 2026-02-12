/**
 * IntentDiscoveryService
 * 
 * Maps natural language queries to specific application actions.
 * Centralizes intent parsing logic for both Voice and Text inputs.
 */

export type AppIntent =
    | { type: 'NAVIGATE'; tab: 'overview' | 'protect' | 'swap' | 'info' }
    | { type: 'SWAP_SHORTCUT'; fromToken?: string; toToken?: string; amount?: string }
    | { type: 'ANALYZE_REQUEST'; goal?: string }
    | { type: 'ONBOARDING'; topic: 'what-is-this' | 'how-to-start' | 'is-safe' | 'wallet-help' | 'demo' }
    | { type: 'QUERY'; context: 'market' | 'portfolio' | 'general' }
    | { type: 'UNKNOWN' };

export class IntentDiscoveryService {
    /**
     * Parse raw text to discover the primary user intent
     */
    static discover(text: string): AppIntent {
        const r = text.toLowerCase();

        // 0. Onboarding & Discovery Questions (highest priority for new users)
        if (r.includes("what is") || r.includes("what's this") || r.includes("what does") || r.includes("explain")) {
            return { type: 'ONBOARDING', topic: 'what-is-this' };
        }

        if (r.includes("how do i start") || r.includes("how to start") || r.includes("get started") || r.includes("begin")) {
            return { type: 'ONBOARDING', topic: 'how-to-start' };
        }

        if (r.includes("is this safe") || r.includes("is it safe") || r.includes("security") || r.includes("trust")) {
            return { type: 'ONBOARDING', topic: 'is-safe' };
        }

        if (r.includes("wallet") || r.includes("connect") || r.includes("create account") || r.includes("sign up")) {
            return { type: 'ONBOARDING', topic: 'wallet-help' };
        }

        if (r.includes("demo") || r.includes("try it") || r.includes("test") || r.includes("practice")) {
            return { type: 'ONBOARDING', topic: 'demo' };
        }

        // 1. Navigation Shortcuts
        if (r.includes("swap") || r.includes("exchange") || r.includes("convert")) {
            // Check for deeper swap shortcut (e.g. "Swap 100 USDm to Gold")
            const amountMatch = text.match(/\d+(\.\d+)?/);
            const tokens = this.extractTokens(r);

            if (tokens.length > 0 || amountMatch) {
                return {
                    type: 'SWAP_SHORTCUT',
                    fromToken: tokens[0],
                    toToken: tokens[1] || (r.includes("gold") ? "PAXG" : undefined),
                    amount: amountMatch?.[0]
                };
            }
            return { type: 'NAVIGATE', tab: 'swap' };
        }

        if (r.includes("protect") || r.includes("analyze") || r.includes("score") || r.includes("advice")) {
            return { type: 'NAVIGATE', tab: 'protect' };
        }

        if (r.includes("balance") || r.includes("portfolio") || r.includes("holding") || r.includes("asset") || r.includes("station")) {
            return { type: 'NAVIGATE', tab: 'overview' };
        }

        if (r.includes("info") || r.includes("learn") || r.includes("help") || r.includes("about")) {
            return { type: 'NAVIGATE', tab: 'info' };
        }

        // 2. Query Contexts
        if (r.includes("price") || r.includes("momentum") || r.includes("market") || r.includes("gold")) {
            return { type: 'QUERY', context: 'market' };
        }

        if (r.includes("my") || r.includes("i have") || r.includes("risk")) {
            return { type: 'QUERY', context: 'portfolio' };
        }

        return { type: 'QUERY', context: 'general' };
    }

    private static extractTokens(text: string): string[] {
        const commonTokens = ["usdm", "eurm", "paxg", "usdc", "usdt", "kesm", "brlm", "copm", "phpm"];
        return commonTokens.filter(t => text.includes(t)).map(t => t.toUpperCase());
    }
}
