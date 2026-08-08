/**
 * Social Resolve API - Resolve social identifiers to wallet addresses
 * 
 * POST /api/agent/social-resolve - Resolve phone/email/twitter to address
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ArcAgent } from '@diversifi/shared';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { identifier, type } = req.body as {
      identifier: string;
      type: 'phone' | 'email' | 'twitter';
    };

    if (!identifier || !type) {
      return res.status(400).json({ error: 'Missing identifier or type' });
    }

    // Create a server-side agent for social resolution
    const agent = new ArcAgent({
      privateKey: process.env.SOCIAL_AGENT_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001',
      isTestnet: true,
      spendingLimit: 0,
    });
    agent.isProxy = true;

    // Resolve the identifier
    const result = await agent.resolveSocialIdentifier({ identifier, type });

    return res.status(200).json(result);

  } catch (error) {
    console.error('[Social Resolve API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Resolution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
