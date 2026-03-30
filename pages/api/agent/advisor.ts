import type { NextApiRequest, NextApiResponse } from 'next';
import { runAdvisorAnalysis, runAdvisorConversation } from './_advisor-core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mode = 'conversation' } = req.body || {};

    if (mode === 'analysis') {
      const result = await runAdvisorAnalysis(req.body || {});
      return res.status(200).json(result);
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required for conversation mode' });
    }

    const result = await runAdvisorConversation(req.body);
    return res.status(200).json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Advisor request failed';
    console.error('[Advisor API] Error:', error);

    if (errorMessage.includes('All AI providers failed')) {
      return res.status(503).json({
        error: 'AI service temporarily unavailable. Please try again in a moment.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      });
    }

    return res.status(500).json({
      error: 'Advisor request failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
}
