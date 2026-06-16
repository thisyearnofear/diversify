import type { NextApiRequest, NextApiResponse } from 'next';
import { runAdvisorAnalysis, runAdvisorConversation } from './_advisor-core';

// In-memory per-IP rate limiter. The advisor calls paid LLM providers, so an
// unauthenticated, unthrottled endpoint is an open spend faucet. Mirrors the
// limiter pattern in /api/vault/rebalance.
const RATE_LIMIT_PER_MIN = parseInt(process.env.ADVISOR_RATE_LIMIT_PER_MIN || '20', 10);
const advisorRateMap = new Map<string, number>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit per IP per minute.
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  const minuteBucket = Math.floor(Date.now() / 60000);
  const windowKey = `${clientIp}:${minuteBucket}`;
  const nextCount = (advisorRateMap.get(windowKey) || 0) + 1;
  advisorRateMap.set(windowKey, nextCount);
  for (const key of advisorRateMap.keys()) {
    if (!key.endsWith(`:${minuteBucket}`)) advisorRateMap.delete(key);
  }
  if (nextCount > RATE_LIMIT_PER_MIN) {
    return res.status(429).json({ error: `Rate limit exceeded. Max ${RATE_LIMIT_PER_MIN} requests/min.` });
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
