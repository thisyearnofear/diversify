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
    | { type: 'QUERY'; context: 'market' | 'portfolio' | 'general' }
    | { type: 'UNKNOWN' };

export class IntentDiscoveryService {
    /**
     * Parse raw text to discover the primary user intent
     */
    static discover(text: string): AppIntent {
        const r = text.toLowerCase();

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
