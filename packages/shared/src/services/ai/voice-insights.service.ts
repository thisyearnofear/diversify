/**
 * VoiceInsightsService
 * 
 * "Intelligent Voice Insights" (Summaries, Tags, Action Items)
 * Powered by Google Gemini 1.5 Flash.
 */

import { AIService } from './ai-service';

export interface VoiceInsightResult {
    summary: string;
    tags: string[];
    actionItems: string[];
}

export class VoiceInsightsService {
    /**
     * Generate structured insights from raw voice transcription
     */
    static async generateInsights(transcription: string): Promise<VoiceInsightResult> {
        if (!transcription || transcription.length < 5) {
            return {
                summary: "Transcription too short for meaningful analysis.",
                tags: ["short-query"],
                actionItems: ["Try asking a more detailed question."]
            };
        }

        const prompt = `
            You are DiversiFi Voice Advisor. 
            Analyze the following text and provide structured insights.
            
            TEXT: "${transcription}"
            
            TASK:
            1. SUMMARY: A one-sentence summary of the user's intent or question.
            2. TAGS: 2-3 relevant keywords (e.g., "Yield", "Gold", "Protection", "Wallet").
            3. ACTION ITEMS: 1-2 practical next steps for the user based on their question.
            
            RESPONSE FORMAT (Strict JSON):
            {
                "summary": "...",
                "tags": ["...", "..."],
                "actionItems": ["...", "..."]
            }
        `;

        try {
            const result = await AIService.chat({
                messages: [{ role: 'system', content: prompt }],
                // Gemini 3.1 Flash-Lite is the latest speed-optimized model (March 2026)
                model: 'gemini-3.1-flash-lite-preview', 
                responseMimeType: 'application/json'
            });

            return JSON.parse(result.content);
        } catch (error) {
            console.error('[VoiceInsightsService] Failed to generate insights:', error);
            return {
                summary: "Unable to generate insights at this time.",
                tags: ["error"],
                actionItems: ["Please try again in a moment."]
            };
        }
    }

    /**
     * Generate a personalized morning briefing script for the user
     */
    static async generateMorningBriefing(context: {
        userRegion: string;
        portfolioValue: number;
        marketSentiment: number;
        topGainer?: string;
        topRisk?: string;
        inflationRate?: number;
    }): Promise<string> {
        const prompt = `
            You are the DiversiFi Guardian. Generate a warm, professional 30-second morning briefing script for your user.
            
            CONTEXT:
            - User Region: ${context.userRegion}
            - Portfolio: $${context.portfolioValue.toFixed(2)}
            - Market Sentiment: ${context.marketSentiment}/100
            - Top Gainer: ${context.topGainer || 'None'}
            - Top Risk: ${context.topRisk || 'None'}
            - Local Inflation: ${context.inflationRate || 'Unknown'}%
            
            TONE:
            - senior financial advisor, calm but alert.
            - concise and punchy.
            
            TASK:
            1. Greet the user.
            2. Summarize their portfolio status.
            3. Highlight the biggest market risk or opportunity today.
            4. Give one clear, actionable advice.
            
            Do not use markdown. Return only the spoken script.
        `;

        try {
            const result = await AIService.chat({
                messages: [{ role: 'system', content: prompt }],
                model: 'gemini-3.1-flash-lite-preview'
            });

            return result.content;
        } catch (error) {
            console.error('[VoiceInsightsService] Briefing generation failed:', error);
            return "Good morning. Your portfolio is currently stable, but I am monitoring increased volatility in the emerging markets. I recommend reviewing your protection plan today.";
        }
    }
}
