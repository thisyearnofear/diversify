import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check server-side only environment variables
    const privateKey = process.env.ARC_AGENT_PRIVATE_KEY;
    const circleWalletId = process.env.CIRCLE_WALLET_ID;
    const circleApiKey = process.env.CIRCLE_API_KEY;
    const circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET;
    const isTestnet = process.env.ARC_AGENT_TESTNET === 'true';
    const spendingLimit = parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0');

    const hasPrivateKey = !!privateKey;
    const hasCircleWallet = !!circleWalletId && !!circleApiKey && !!circleEntitySecret;
    const enabled = hasPrivateKey || hasCircleWallet;

    // Mask the wallet address for display
    const walletAddress = process.env.CIRCLE_WALLET_ADDRESS;
    const maskedAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : undefined;

    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

    return res.status(200).json({
        enabled,
        isTestnet,
        spendingLimit,
        walletType: hasPrivateKey ? 'privateKey' : hasCircleWallet ? 'circle' : 'none',
        walletAddress: maskedAddress,
        capabilities: {
            analysis: hasGemini,
            transcription: hasOpenAI,
            speech: hasElevenLabs
        }
    });
}
