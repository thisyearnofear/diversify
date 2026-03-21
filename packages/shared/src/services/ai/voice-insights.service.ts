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
            You are DiversiFi Voice Oracle. 
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
}
