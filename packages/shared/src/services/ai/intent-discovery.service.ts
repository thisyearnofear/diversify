/**
 * IntentDiscoveryService
 * 
 * Maps natural language queries to specific application actions.
 * Centralizes intent parsing logic for both Voice and Text inputs.
 * 
 * REFACTORED: Now includes confidence scoring and AI fallback for ambiguous inputs.
 */

export type AppTab = 'overview' | 'protect' | 'exchange' | 'earn' | 'info' | 'agent';

export type AppIntent =
    | { type: 'NAVIGATE'; tab: AppTab }
    | { type: 'SWAP_SHORTCUT'; fromToken?: string; toToken?: string; amount?: string }
    | { type: 'YIELD_EARN'; topic: 'discovery' | 'best' | 'info' | 'vault'; vaultId?: string }
    | { type: 'SEND_TO_PHONE'; phoneNumber: string; amount?: string; token?: string }
    | { type: 'ANALYZE_REQUEST'; goal?: string }
    | { type: 'ONBOARDING'; topic: 'what-is-this' | 'how-to-start' | 'is-safe' | 'wallet-help' | 'demo' }
    | { type: 'GOODDOLLAR'; topic: 'claim' | 'verify' | 'status' | 'info' }
    | { type: 'WDK_ACTION'; topic: 'switch' | 'info' | 'status' | 'settlement' }
    | { type: 'PROACTIVE_REBALANCE'; fromToken?: string; toToken?: string; amount?: string; reason?: string }
    | { type: 'QUERY'; context: 'market' | 'portfolio' | 'general' }
    | { type: 'UNKNOWN' };

export interface ScoredIntent {
    intent: AppIntent;
    confidence: number;           // 0.0 to 1.0
    source: 'regex' | 'ai';
    matchedPatterns: string[];    // which keywords/patterns hit
    originalText: string;
}

export const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.8,     // Trust the intent, execute immediately
    MEDIUM: 0.5,   // Accept if no ambiguity, but log low confidence
    LOW: 0.3,      // Below this — fall back to AI service
} as const;

export class IntentDiscoveryService {
    /**
     * Parse raw text to discover the primary user intent with confidence scoring
     */
    static async discoverWithScore(
        text: string,
        options?: { enableAIFallback?: boolean }
    ): Promise<ScoredIntent> {
        const regexResult = this.discoverScored(text);
        
        // If high confidence, return immediately
        if (regexResult.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
            return regexResult;
        }
        
        // If low confidence and AI fallback is enabled, try AI service
        if (options?.enableAIFallback !== false && 
            regexResult.confidence < CONFIDENCE_THRESHOLDS.LOW) {
            try {
                const aiResult = await this.tryAIDiscovery(text);
                return aiResult;
            } catch (error) {
                console.warn('[IntentDiscovery] AI fallback failed:', error);
                // Fall through to return regex result as best-effort
            }
        }
        
        // Return regex result (could be high, medium, or low confidence)
        return regexResult;
    }

    /**
     * Backward compatible discover method - delegates to scored version and strips confidence
     */
    static discover(text: string): AppIntent {
        return this.discoverScored(text).intent;
    }

    /**
     * Internal method to discover intent with scoring
     */
    private static discoverScored(text: string): ScoredIntent {
        const r = text.toLowerCase();
        const wordCount = r.trim().split(/\s+/).filter(Boolean).length;
        const isLongFormPrompt = wordCount >= 8 || r.includes('?') || r.includes(',');
        
        // Track all matching intents and their scores
        const matches: Array<{
            intent: AppIntent;
            baseConfidence: number;
            specificityBonus: number;
            matchedPatterns: string[];
        }> = [];

        // 0. GoodDollar (UBI) Actions
        if (r.includes("ubi") || r.includes("gooddollar") || r.includes("$g") || r.includes("free money")) {
            const patterns: string[] = [];
            let baseConfidence = 0.85;
            let specificityBonus = 0;
            
            if (r.includes("claim") || r.includes("get") || r.includes("receive")) {
                matches.push({
                    intent: { type: 'GOODDOLLAR', topic: 'claim' },
                    baseConfidence: 0.85,
                    specificityBonus: 0.10, // More specific action
                    matchedPatterns: [...patterns, 'claim/get/receive']
                });
            }
            if (r.includes("verify") || r.includes("face") || r.includes("whitelist") || r.includes("identity")) {
                matches.push({
                    intent: { type: 'GOODDOLLAR', topic: 'verify' },
                    baseConfidence: 0.85,
                    specificityBonus: 0.10,
                    matchedPatterns: [...patterns, 'verify/face/whitelist/identity']
                });
            }
            if (r.includes("balance") || r.includes("status") || r.includes("eligible") || r.includes("can i")) {
                matches.push({
                    intent: { type: 'GOODDOLLAR', topic: 'status' },
                    baseConfidence: 0.85,
                    specificityBonus: 0.10,
                    matchedPatterns: [...patterns, 'balance/status/eligible/can i']
                });
            }
            // Default info topic
            matches.push({
                intent: { type: 'GOODDOLLAR', topic: 'info' },
                baseConfidence: 0.80,
                specificityBonus: 0.0,
                matchedPatterns: [...patterns, 'default']
            });
        }

        // 0. LI.FI Earn Actions (Yield Discovery)
        if (r.includes("yield") || r.includes("earn") || r.includes("vault") || r.includes("apy") || r.includes("interest") || r.includes("passive income")) {
            const patterns: string[] = [];
            let baseConfidence = 0.75;
            let specificityBonus = 0;
            
            if (r.includes("best") || r.includes("highest") || r.includes("top") || r.includes("recommend")) {
                matches.push({
                    intent: { type: 'YIELD_EARN', topic: 'best' },
                    baseConfidence: 0.75,
                    specificityBonus: 0.05, // Somewhat specific
                    matchedPatterns: [...patterns, 'best/highest/top/recommend']
                });
            }
            if (r.includes("discovery") || r.includes("find") || r.includes("search") || r.includes("list")) {
                matches.push({
                    intent: { type: 'YIELD_EARN', topic: 'discovery' },
                    baseConfidence: 0.75,
                    specificityBonus: 0.05,
                    matchedPatterns: [...patterns, 'discovery/find/search/list']
                });
            }
            // Default info topic
            matches.push({
                intent: { type: 'YIELD_EARN', topic: 'info' },
                baseConfidence: 0.70,
                specificityBonus: 0.0,
                matchedPatterns: [...patterns, 'default']
            });
        }

        // 0. SocialConnect / Send to Phone (Real-World Utility)
        if (r.includes("send") || r.includes("pay") || r.includes("transfer")) {
            const phoneMatch = text.match(/\+?\d{9,15}/); // Simple phone number regex
            if (phoneMatch) {
                const amountMatch = text.match(/\d+(\.\d+)?/);
                const tokens = this.extractTokens(r);
                
                matches.push({
                    intent: {
                        type: 'SEND_TO_PHONE',
                        phoneNumber: phoneMatch[0]!,
                        amount: amountMatch?.[0],
                        token: tokens[0] ?? 'USDC' // Default to USDC if not specified
                    },
                    baseConfidence: 0.90, // High confidence due to phone number pattern
                    specificityBonus: 0.0, // Phone number is very specific
                    matchedPatterns: ['send/pay/transfer', 'phone number']
                });
            }
        }

        // 0. Onboarding & Discovery Questions (highest priority for new users)
        const onboardingPatterns: Array<{phrase: string; topic: 'what-is-this' | 'how-to-start' | 'is-safe' | 'wallet-help' | 'demo'}> = [
            { phrase: "what is", topic: 'what-is-this' },
            { phrase: "what's this", topic: 'what-is-this' },
            { phrase: "what does", topic: 'what-is-this' },
            { phrase: "explain", topic: 'what-is-this' },
            { phrase: "how do i start", topic: 'how-to-start' },
            { phrase: "how to start", topic: 'how-to-start' },
            { phrase: "get started", topic: 'how-to-start' },
            { phrase: "begin", topic: 'how-to-start' },
            { phrase: "is this safe", topic: 'is-safe' },
            { phrase: "is it safe", topic: 'is-safe' },
            { phrase: "security", topic: 'is-safe' },
            { phrase: "trust", topic: 'is-safe' },
            { phrase: "wallet", topic: 'wallet-help' },
            { phrase: "connect", topic: 'wallet-help' },
            { phrase: "create account", topic: 'wallet-help' },
            { phrase: "sign up", topic: 'wallet-help' },
            { phrase: "demo", topic: 'demo' },
            { phrase: "try it", topic: 'demo' },
            { phrase: "test", topic: 'demo' },
            { phrase: "practice", topic: 'demo' }
        ] as const;

        for (const pattern of onboardingPatterns) {
            if (r.includes(pattern.phrase)) {
                matches.push({
                    intent: { type: 'ONBOARDING', topic: pattern.topic },
                    baseConfidence: 0.85,
                    specificityBonus: 0.05, // Onboarding phrases are fairly specific
                    matchedPatterns: [pattern.phrase]
                });
            }
        }

        // 0. Tether WDK Actions (Advanced Settlement)
        if (r.includes("wdk") || r.includes("settlement agent") || r.includes("tether wallet") || r.includes("tether agent")) {
            const patterns: string[] = [];
            let baseConfidence = 0.80;
            let specificityBonus = 0;
            
            if (r.includes("switch") || r.includes("change") || r.includes("use")) {
                matches.push({
                    intent: { type: 'WDK_ACTION', topic: 'switch' },
                    baseConfidence: 0.80,
                    specificityBonus: 0.05,
                    matchedPatterns: [...patterns, 'switch/change/use']
                });
            }
            if (r.includes("status") || r.includes("online") || r.includes("receipt")) {
                matches.push({
                    intent: { type: 'WDK_ACTION', topic: 'status' },
                    baseConfidence: 0.80,
                    specificityBonus: 0.05,
                    matchedPatterns: [...patterns, 'status/online/receipt']
                });
            }
            // Default info topic
            matches.push({
                intent: { type: 'WDK_ACTION', topic: 'info' },
                baseConfidence: 0.75,
                specificityBonus: 0.0,
                matchedPatterns: [...patterns, 'default']
            });
        }

        // 1. Navigation Shortcuts
        if (r.includes("swap") || r.includes("exchange") || r.includes("convert")) {
            // Check for deeper swap shortcut (e.g. "Swap 100 USDm to Gold")
            const amountMatch = text.match(/\d+(\.\d+)?/);
            const tokens = this.extractTokens(r);
            
            if (tokens.length > 0 || amountMatch) {
                matches.push({
                    intent: {
                        type: 'SWAP_SHORTCUT',
                        fromToken: tokens[0],
                        toToken: tokens[1] || (r.includes("gold") ? "PAXG" : undefined),
                        amount: amountMatch?.[0]
                    },
                    baseConfidence: 0.80,
                    specificityBonus: (tokens.length > 0 ? 0.05 : 0) + (amountMatch ? 0.05 : 0), // Bonuses for tokens and amount
                    matchedPatterns: ['swap/exchange/convert', ...tokens, amountMatch?.[0] ?? '']
                });
            }
            matches.push({
                intent: { type: 'NAVIGATE', tab: 'exchange' },
                baseConfidence: 0.55, // Lower confidence for generic navigation
                specificityBonus: 0.0,
                matchedPatterns: ['swap/exchange/convert']
            });
        }

        if (
            !isLongFormPrompt &&
            (r.includes("go to protect") ||
             r.includes("open protect") ||
             r.includes("show protect") ||
             r === "protect")
        ) {
            matches.push({
                intent: { type: 'NAVIGATE', tab: 'protect' },
                baseConfidence: 0.90, // Very high confidence for exact match
                specificityBonus: 0.10, // Exact match bonus
                matchedPatterns: ['go to protect', 'open protect', 'show protect', 'protect']
            });
        }

        if (r.includes("analyze") ||
            r.includes("analysis") ||
            r.includes("score") ||
            r.includes("advice") ||
            r.includes("inflation trend") ||
            r.includes("currency devaluation") ||
            r.includes("protective action")
        ) {
            matches.push({
                intent: { type: 'ANALYZE_REQUEST', goal: text },
                baseConfidence: 0.65,
                specificityBonus: 0.0,
                matchedPatterns: ['analyze/analysis/score/advice/inflation trend/currency devaluation/protective action']
            });
        }

        if (r.includes("balance") || r.includes("portfolio") || r.includes("holding") || r.includes("asset") || r.includes("station")) {
            matches.push({
                intent: { type: 'NAVIGATE', tab: 'overview' },
                baseConfidence: 0.55,
                specificityBonus: 0.0,
                matchedPatterns: ['balance/portfolio/holding/asset/station']
            });
        }

        if (r.includes("info") || r.includes("learn") || r.includes("help") || r.includes("about")) {
            matches.push({
                intent: { type: 'NAVIGATE', tab: 'info' },
                baseConfidence: 0.50,
                specificityBonus: 0.0,
                matchedPatterns: ['info/learn/help/about']
            });
        }

        // 2. Query Contexts
        if (r.includes("price") || r.includes("momentum") || r.includes("market") || r.includes("gold")) {
            matches.push({
                intent: { type: 'QUERY', context: 'market' },
                baseConfidence: 0.50,
                specificityBonus: 0.0,
                matchedPatterns: ['price/momentum/market/gold']
            });
        }

        if (r.includes("my") || r.includes("i have") || r.includes("risk")) {
            matches.push({
                intent: { type: 'QUERY', context: 'portfolio' },
                baseConfidence: 0.50,
                specificityBonus: 0.0,
                matchedPatterns: ['my/i have/risk']
            });
        }

        // Default fallback
        matches.push({
            intent: { type: 'QUERY', context: 'general' },
            baseConfidence: 0.30,
            specificityBonus: 0.0,
            matchedPatterns: ['default fallback']
        });

        // Apply ambiguity penalty: if multiple intent groups match, reduce confidence
        if (matches.length > 1) {
            // Group by intent type to count how many different types matched
            const intentTypes = new Set(matches.map(m => 
                m.intent.type === 'NAVIGATE' ? m.intent.tab : 
                m.intent.type === 'GOODDOLLAR' ? m.intent.topic :
                m.intent.type === 'YIELD_EARN' ? m.intent.topic :
                m.intent.type === 'WDK_ACTION' ? m.intent.topic :
                m.intent.type === 'ONBOARDING' ? m.intent.topic :
                m.intent.type
            ));
            
            const ambiguityPenalty = 0.15 * (intentTypes.size - 1);
            
            for (const match of matches) {
                match.baseConfidence = Math.max(0, match.baseConfidence - ambiguityPenalty);
            }
        }

        // Find the best match
        let bestMatch = matches[0];
        for (const match of matches) {
            const totalConfidence = match.baseConfidence + match.specificityBonus;
            const bestTotalConfidence = bestMatch.baseConfidence + bestMatch.specificityBonus;
            
            if (totalConfidence > bestTotalConfidence) {
                bestMatch = match;
            }
        }

        // Calculate final confidence
        const finalConfidence = Math.min(1.0, bestMatch.baseConfidence + bestMatch.specificityBonus);

        return {
            intent: bestMatch.intent,
            confidence: finalConfidence,
            source: 'regex',
            matchedPatterns: bestMatch.matchedPatterns,
            originalText: text
        };
    }

    /**
     * Try to discover intent using AI service as fallback
     */
    private static async tryAIDiscovery(text: string): Promise<ScoredIntent> {
        // In a real implementation, we'd import and use the AIService
        // For now, we'll simulate what the AI would return
        
        // This would be something like:
        // const aiService = await import('./ai-service');
        // const result = await aiService.chat({
        //   messages: [{
        //     role: 'system',
        //     content: `You are an intent classifier for DiversiFi...` // Full prompt from plan
        //   }, {
        //     role: 'user',
        //     content: text
        //   }],
        //   responseFormat: { type: 'json_object' }
        // });
        // 
        // const aiIntent = JSON.parse(aiService.data);
        // 
        // return {
        //   intent: this.convertAIIntentToAppIntent(aiIntent),
        //   confidence: aiIntent.confidence || 0.0,
        //   source: 'ai',
        //   matchedPatterns: [], // AI doesn't give us matched patterns
        //   originalText: text
        // };
        
        // For now, return a mock AI result to show the structure
        // In practice, this would be replaced with the actual AI call above
        return {
            intent: { type: 'QUERY', context: 'general' }, // Default fallback
            confidence: 0.0, // Low confidence indicates AI wasn't sure
            source: 'ai',
            matchedPatterns: [],
            originalText: text
        };
    }

    /**
     * Extract token symbols from text
     */
    private static extractTokens(text: string): string[] {
        const commonTokens = ["usdm", "eurm", "paxg", "usdc", "usdt", "kesm", "brlm", "copm", "phpm"];
        return commonTokens.filter(t => text.includes(t)).map(t => t.toUpperCase());
    }

    /**
     * Convert AI service intent format to AppIntent
     * This would be implemented when we actually integrate with AI service
     */
    private static convertAIIntentToAppIntent(aiIntent: any): AppIntent {
        // Implementation would depend on the exact format returned by AI service
        // For now, return a default
        return { type: 'QUERY', context: 'general' };
    }
}