import type { NextApiRequest, NextApiResponse } from 'next';
import { VoiceInsightsService } from '@diversifi/shared';

/**
 * Intelligent Voice Insights API Endpoint
 * 
 * Provides Summaries, Tags, and Action Items for raw voice transcriptions.
 * Uses Google Gemini 1.5 Flash for rapid, high-quality insights.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { transcription } = req.body;

        if (!transcription || transcription.length < 5) {
            return res.status(400).json({ error: 'No valid transcription provided' });
        }

        // Generate rapid intelligence from voice input
        const insights = await VoiceInsightsService.generateInsights(transcription);

        res.status(200).json({ 
            success: true,
            insights, 
            provider: 'google-gemini-3.1-flash-lite'
        });
    } catch (error) {
        console.error('[Voice Insights API] Error:', error);
        res.status(500).json({ 
            success: false,
            error: (error as Error).message || 'Failed to generate voice insights' 
        });
    }
}
