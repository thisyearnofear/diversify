import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '../../../services/ai/ai-service';

/**
 * Text-to-Speech API Endpoint
 * 
 * Unified TTS with multi-provider failover:
 * - Primary: Venice (faster, no data retention)
 * - Fallback: ElevenLabs (higher quality)
 * 
 * Principles:
 * - REDUNDANCY: Automatic failover between providers
 * - CLEAN: Single endpoint, multiple providers abstracted
 * - PERFORMANT: Caching at service layer
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text, voice, speed, preferredProvider } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'No text provided' });
    }

    try {
        // Use unified AI service with automatic failover
        const result = await AIService.speech({
            text,
            voice,
            speed,
        }, preferredProvider || 'auto');

        // Log which provider was used (for monitoring)
        console.log(`[TTS] Generated speech using ${result.provider}: ${text.slice(0, 50)}...`);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-TTS-Provider', result.provider);
        res.send(result.audio);
        
    } catch (error) {
        console.error('[TTS API] All providers failed:', error);
        res.status(500).json({ 
            error: 'All TTS providers unavailable',
            details: (error as Error).message 
        });
    }
}
