import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '@diversifi/shared';
import { getGuardianRunHealth } from '../../../lib/guardian-run-status';

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

    // Check Arc Agent configuration. Per-user custodial Circle wallets were
    // removed — the Protection Balance is the user's own Gateway balance and
    // Guardian runs under user-signed session permissions.
    const privateKey = process.env.ARC_AGENT_PRIVATE_KEY;
    const circleWalletId = process.env.CIRCLE_WALLET_ID;
    const circleApiKey = process.env.CIRCLE_API_KEY;
    const circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET;
    const isTestnet = process.env.ARC_AGENT_TESTNET === 'true';
    const spendingLimit = parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0');

    const hasPrivateKey = !!privateKey;
    const hasCircleWallet = !!circleWalletId && !!circleApiKey && !!circleEntitySecret;
    const arcEnabled = hasPrivateKey || hasCircleWallet;

    // Get AI service status (includes Venice, Gemini, ElevenLabs)
    const aiStatus = await AIService.getStatus();

    const walletAddress = process.env.CIRCLE_WALLET_ADDRESS;
    const walletType = hasPrivateKey ? 'privateKey' : hasCircleWallet ? 'circle' : 'none';

    const maskedAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : undefined;

    const veniceStatus = aiStatus.venice ?? { available: false, initialized: false };
    const geminiStatus = aiStatus.gemini ?? { available: false, initialized: false };
    const elevenLabsStatus = aiStatus.elevenLabs ?? { available: false, initialized: false };

    // Guardian cron liveness: last loop/heartbeat run, age, and whether the
    // run actually worked. A 5-min cron that silently died for an hour shows
    // up here as freshness: 'stale' even though nothing else is red.
    let guardian = null;
    try {
        guardian = await getGuardianRunHealth();
    } catch (error: any) {
        console.warn('[Status API] Guardian run-status read failed:', error?.message ?? error);
        guardian = null;
    }

    return res.status(200).json({
        // Arc Agent status
        enabled: arcEnabled,
        isTestnet,
        spendingLimit,
        walletType,
        walletAddress: maskedAddress,

        // AI capabilities with provider details
        capabilities: {
            analysis: veniceStatus.available || geminiStatus.available,
            analysisProviders: {
                venice: false,
                gemini: geminiStatus.available,
            },
            // Note: Venice AI does not support transcription yet (feature in progress)
            // ElevenLabs Scribe v2 is available as fallback
            transcription: !!(process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY),
            transcriptionProviders: {
                openai: !!process.env.OPENAI_API_KEY,
                elevenlabs: elevenLabsStatus.available,
            },
            // Venice TTS is not implemented (provider throws "not yet implemented").
            // Only ElevenLabs provides speech today.
            speech: elevenLabsStatus.available,
            speechProviders: {
                venice: false,
                elevenLabs: elevenLabsStatus.available,
            },
            webSearch: veniceStatus.available, // Venice-only feature
        },
        
        // Provider health details
        providers: aiStatus,
        
        // Feature flags
        features: {
            webEnrichedAnalysis: veniceStatus.available,
            multiProviderTTS: false, // Venice TTS not implemented yet
        },

        // Guardian cron health (null when the read failed — the status page
        // can still answer "is the app itself up" without Mongo).
        guardian,
    });
}
