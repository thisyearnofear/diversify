import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService, ArcAgent } from '@diversifi/shared';

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

    const { userId } = req.query;

    // Check Arc Agent configuration
    const privateKey = process.env.ARC_AGENT_PRIVATE_KEY;
    const circleWalletId = process.env.CIRCLE_WALLET_ID;
    const circleApiKey = process.env.CIRCLE_API_KEY;
    const circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET;
    const circleBaseUrl = process.env.CIRCLE_BASE_URL;
    const isTestnet = process.env.ARC_AGENT_TESTNET === 'true';
    const spendingLimit = parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0');

    const hasPrivateKey = !!privateKey;
    const hasCircleWallet = !!circleWalletId && !!circleApiKey && !!circleEntitySecret;
    // Agent is enabled if server keys exist OR if we are using user-scoped wallets (which rely on Circle API credentials)
    const arcEnabled = hasPrivateKey || hasCircleWallet || (!!circleApiKey && !!circleEntitySecret);

    // Get AI service status (includes Venice, Gemini, ElevenLabs)
    const aiStatus = await AIService.getStatus();

    let userAgentStatus = null;
    let walletAddress = process.env.CIRCLE_WALLET_ADDRESS;
    let walletType = hasPrivateKey ? 'privateKey' : hasCircleWallet ? 'circle' : 'none';

    // If userId provided, fetch specific agent status
    if (userId && typeof userId === 'string' && circleApiKey && circleEntitySecret) {
        try {
            // Initialize user-scoped agent purely for status check
            const agent = new ArcAgent({
                userId,
                isTestnet,
                circleApiKey,
                circleEntitySecret,
                circleBaseUrl,
                spendingLimit
            });
            
            const networkStatus = await agent.getNetworkStatus();
            if (networkStatus) {
                userAgentStatus = {
                    balance: networkStatus.usdcBalance,
                    address: networkStatus.agentAddress,
                    spent: agent.getSpendingStatus().spent,
                    remaining: agent.getSpendingStatus().remaining
                };
                walletAddress = networkStatus.agentAddress;
                walletType = 'agent-fuel';
            }
        } catch (error) {
            console.warn(`[Status API] Failed to fetch agent status for user ${userId}:`, error);
        }
    }

    const maskedAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : undefined;

    const veniceStatus = aiStatus.venice ?? { available: false, initialized: false };
    const geminiStatus = aiStatus.gemini ?? { available: false, initialized: false };
    const elevenLabsStatus = aiStatus.elevenLabs ?? { available: false, initialized: false };

    return res.status(200).json({
        // Arc Agent status
        enabled: arcEnabled,
        isTestnet,
        spendingLimit,
        walletType,
        walletAddress: maskedAddress,
        userAgent: userAgentStatus, // Specific user details if requested
        
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
        }
    });
}
