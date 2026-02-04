import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '../../../services/ai/ai-service';

/**
 * Chat API Endpoint
 * 
 * Enables conversational follow-up questions about portfolio analysis.
 * Uses AIService for multi-provider failover (Venice → Gemini).
 */

const SYSTEM_PROMPT = `You are the DiversiFi AI Assistant - a helpful, concise financial advisor for stablecoin portfolios.

CONTEXT: You help users understand their portfolio analysis results and answer follow-up questions about:
- Inflation protection strategies
- Stablecoin selection (regional stables, yield-bearing, gold-backed)
- Cross-chain bridging (Celo ↔ Arbitrum)
- Real World Asset tokens (USDY, PAXG, SYRUPUSDC)

RESPONSE GUIDELINES:
- Be concise (2-3 sentences unless more detail requested)
- Use specific numbers when available
- Explain trade-offs clearly
- If unsure, say so rather than guessing

AVAILABLE TOKENS:
- Celo (Mento stables): USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm, USDC
- Arbitrum (RWAs): USDY (5% Treasury yield), PAXG (gold-backed), SYRUPUSDC (4.5% DeFi yield), USDC, EURC`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add conversation history (limit to last 10 messages for context window)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const result = await AIService.chat({
      messages,
      temperature: 0.7,
      maxTokens: 500,
    });

    return res.status(200).json({
      response: result.content,
      provider: result.provider,
      type: 'text',
    });
  } catch (error: unknown) {
    console.error('[Chat API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Chat failed';
    return res.status(500).json({ error: errorMessage });
  }
}
