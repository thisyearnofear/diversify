import type { NextApiRequest, NextApiResponse } from 'next';
import { ArcAgent } from '../../../services/arc-agent';

let agentInstance: ArcAgent | null = null;

function getAgent(): ArcAgent | null {
    if (agentInstance) return agentInstance;

    const privateKey = process.env.ARC_AGENT_PRIVATE_KEY;
    const isTestnet = process.env.ARC_AGENT_TESTNET === 'true';
    const spendingLimit = parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0');

    if (!privateKey) return null;

    agentInstance = new ArcAgent({
        privateKey,
        isTestnet,
        spendingLimit,
    });

    return agentInstance;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const agent = getAgent();
    if (!agent) {
        return res.status(503).json({ error: 'Agent not configured' });
    }

    try {
        const { portfolio, config, networkInfo } = req.body;

        const result = await agent.analyzePortfolioAutonomously(
            portfolio,
            config,
            networkInfo
        );

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('[Deep Analyze] Error:', error);
        return res.status(500).json({ 
            error: error.message,
            action: 'HOLD',
            reasoning: 'Deep analysis temporarily unavailable.',
            confidence: 0,
            riskLevel: 'LOW'
        });
    }
}
