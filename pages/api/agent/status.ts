import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '../../../services/ai/ai-service';

/**
 * Agent Status API Endpoint
 * 
 * Returns health status of all AI providers and agent capabilities.
 * Used by frontend to show available features and provider status.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check Arc Agent configuration
    const privateKey = process.env.ARC_AGENT_PRIVATE_KEY;
    const circleWalletId = process.env.CIRCLE_WALLET_ID;
    const circleApiKey = process.env.CIRCLE_API_KEY;
    const circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET;
    const isTestnet = process.env.ARC_AGENT_TESTNET === 'true';
    const spendingLimit = parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0');

    const hasPrivateKey = !!privateKey;
    const hasCircleWallet = !!circleWalletId && !!circleApiKey && !!circleEntitySecret;
    const arcEnabled = hasPrivateKey || hasCircleWallet;

    // Mask the wallet address for display
    const walletAddress = process.env.CIRCLE_WALLET_ADDRESS;
    const maskedAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : undefined;

    // Get AI service status (includes Venice, Gemini, ElevenLabs)
    const aiStatus = await AIService.getStatus();

    return res.status(200).json({
        // Arc Agent status
        enabled: arcEnabled,
        isTestnet,
        spendingLimit,
        walletType: hasPrivateKey ? 'privateKey' : hasCircleWallet ? 'circle' : 'none',
        walletAddress: maskedAddress,
        
        // AI capabilities with provider details
        capabilities: {
            analysis: aiStatus.venice.available || aiStatus.gemini.available,
            analysisProviders: {
                venice: aiStatus.venice.available,
                gemini: aiStatus.gemini.available,
            },
            // Note: Venice AI does not support transcription yet (feature in progress)
            // ElevenLabs Scribe v2 is available as fallback
            transcription: !!(process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY),
            transcriptionProviders: {
                openai: !!process.env.OPENAI_API_KEY,
                elevenlabs: aiStatus.elevenLabs.available,
            },
            speech: aiStatus.venice.available || aiStatus.elevenLabs.available,
            speechProviders: {
                venice: aiStatus.venice.available,
                elevenLabs: aiStatus.elevenLabs.available,
            },
            webSearch: aiStatus.venice.available, // Venice-only feature
        },
        
        // Provider health details
        providers: aiStatus,
        
        // Feature flags
        features: {
            webEnrichedAnalysis: aiStatus.venice.available,
            multiProviderTTS: aiStatus.venice.available && aiStatus.elevenLabs.available,
        }
    });
}
