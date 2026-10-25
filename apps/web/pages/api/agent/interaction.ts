import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '@diversifi/shared/src/services/ai/ai-service';
import { isInteractionRequest, validateInteraction } from '@diversifi/shared/src/services/ai/guardian-interaction';
import { CURRENCY_BY_CODE } from '../../../constants/currency-risk';
import { getClientIp, rateLimit } from '../../../lib/rate-limit';
import { verifyDemoToken, demoSubject } from '../../../lib/demo-token';
import { consumeQuestion, resolveSubject } from '../../../models/AgentUsage';

const currencies = Object.keys(CURRENCY_BY_CODE);

/** Bounded UI interpretation only: no memory, ledger, quote or signer. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { text, currency, demoToken } = req.body ?? {};
  if (typeof text !== 'string' || text.length > 1200 || !isInteractionRequest(text)) {
    return res.status(400).json({ error: 'A screen request is required' });
  }
  const ip = getClientIp(req);
  const rate = rateLimit(`interaction:${ip}`, 12, 60_000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests' });
  }
  const view = currency == null ? null : validateInteraction({ kind: 'currency', view: currency }, { currencies });
  if (currency != null && view?.kind !== 'currency') return res.status(400).json({ error: 'Invalid currency context' });
  try {
    // A supplied wallet address is not proof of identity. This read-only
    // endpoint uses the IP bucket or an actually verified demo session.
    const subject = verifyDemoToken(demoToken, ip)
      ? { subject: demoSubject(ip), kind: 'demo' as const }
      : resolveSubject(undefined, ip);
    const allowance = await consumeQuestion(subject.subject, subject.kind);
    if (!allowance.allowed) return res.status(429).json({ error: 'daily_questions_exhausted', ...allowance });
    const intent = await AIService.interpretInteraction(text, {
      currencies,
      currency: view?.kind === 'currency' ? view.view : null,
    });
    return res.status(200).json({ intent, allowance });
  } catch {
    // Unlike a normal conversation, interpretation can always fall back to
    // the visible controls. Never bypass the paid-call gate on store failure.
    return res.status(503).json({ error: 'Screen interpretation is unavailable' });
  }
}
