import type { NextApiRequest, NextApiResponse } from 'next';
import { runAdvisorAnalysis, runAdvisorConversation, runAdvisorConversationStream } from '@/lib/agent/advisor-core';
import { consumeQuestion, resolveSubject } from '../../../models/AgentUsage';

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
    const { mode = 'conversation', stream } = req.body || {};

    const { message } = req.body || {};
    if (mode !== 'analysis' && (!message || typeof message !== 'string')) {
      return res.status(400).json({ error: 'Message is required for conversation mode' });
    }

    // ── Daily question allowance (server-enforced) ──────────────────────
    // Subject = the wallet address in the request when well-formed, else the
    // client IP. Demo-mode requests (flagged by the client, or the mock
    // 0xDemo… address) skip counting entirely.
    const isDemoRequest =
      req.body?.demo === true ||
      req.headers['x-demo-mode'] === '1' ||
      (typeof req.body?.address === 'string' && /^0xdemo/i.test(req.body.address));

    if (!isDemoRequest) {
      try {
        const { subject, kind } = resolveSubject(req.body?.address, clientIp);
        const gate = await consumeQuestion(subject, kind);
        if (!gate.allowed) {
          return res.status(429).json({
            error: 'daily_questions_exhausted',
            message: 'Daily questions used up — earn more below',
            remaining: 0,
            limit: gate.limit,
            resetsAt: gate.resetsAt,
          });
        }
      } catch (gateError) {
        // Allowance store unavailable — fail open so a Mongo outage can't
        // silence the advisor; the per-minute limiter above still bounds
        // spend.
        console.warn('[Advisor API] allowance check failed open:', (gateError as Error).message);
      }
    }

    if (mode === 'analysis') {
      const result = await runAdvisorAnalysis(req.body || {});
      return res.status(200).json(result);
    }

    // ── Streaming path (SSE) ──────────────────────────────────────────────
    if (stream === true) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      try {
        for await (const event of runAdvisorConversationStream(req.body)) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Stream failed';
        res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`);
      } finally {
        res.end();
      }
      return;
    }

    // ── Non-streaming path (backward compatible) ──────────────────────────
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
