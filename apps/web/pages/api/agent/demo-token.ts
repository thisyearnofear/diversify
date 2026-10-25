/**
 * API: POST /api/agent/demo-token
 *
 * Mints the short-lived demo session token that lets the advisor skip the
 * visitor's real daily allowance (see lib/demo-token.ts). Called once per
 * sample-mode session by the client; the token travels in advisor request
 * bodies — no custom headers, so no CORS preflight surface.
 *
 * Rate-limited per IP so minting can't be automated into a token farm.
 * 503 in production when DEMO_TOKEN_SECRET is unset — demo requests then
 * fall back to normal IP-keyed gating rather than an unenforceable tier.
 *
 * Response: { token, expiresAt, allowance: { remaining, limit, resetsAt } }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp, rateLimit } from '../../../lib/rate-limit';
import { mintDemoToken, demoSubject } from '../../../lib/demo-token';
import { getAllowance } from '../../../models/AgentUsage';
import { DEMO_DAILY_QUESTIONS } from '../../../constants/credits';
import { nextUtcMidnightIso } from '../../../constants/credits';

const ISSUE_LIMIT_PER_HOUR = 10;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const limit = rateLimit(`demo-token:${ip}`, ISSUE_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({
      error: 'Too many demo sessions requested. Try again later.',
      retryAfterSec: limit.retryAfterSec,
    });
  }

  const mint = mintDemoToken(ip);
  if (!mint) {
    return res.status(503).json({ error: 'Demo sessions are not configured on this deployment.' });
  }

  let allowance = {
    remaining: DEMO_DAILY_QUESTIONS,
    limit: DEMO_DAILY_QUESTIONS,
    resetsAt: nextUtcMidnightIso(),
  };
  try {
    const status = await getAllowance(demoSubject(ip), 'demo');
    allowance = { remaining: status.remaining, limit: status.limit, resetsAt: status.resetsAt };
  } catch {
    // Store unavailable — report the honest base allowance; consumption in
    // the advisor will fail closed to IP gating anyway.
  }

  return res.status(200).json({ ...mint, allowance });
}
