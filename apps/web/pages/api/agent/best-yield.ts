/**
 * POST /api/agent/best-yield — personalized best-yield recommendations.
 *
 * Engagement is derived SERVER-SIDE from the address's real on-chain balance
 * (engagement.service) — never from the request body — so a caller can't lie
 * their way past the tier gate to force paid vaults.fyi spend. Layered with a
 * per-IP rate limit here and a process-global daily budget breaker in
 * vaults-fyi.service. Returns the advisor's ranked recommendations (vaults.fyi
 * personalized + GMX GM pools + free LI.FI) plus the resolved tier for the UI.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getYieldRecommendations } from '@diversifi/shared/src/services/ai/yield-advisor.service';
import { resolveInsightTier, TIER_POLICIES } from '@diversifi/shared/src/services/insight-tier';
import { deriveServerEngagement } from '@diversifi/shared/src/services/engagement.service';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

// Per-IP throttle. Engagement is now derived server-side (can't be spoofed), but
// the endpoint is still unauthenticated: this bounds request RATE per caller
// while the process-global daily budget breaker (vaults-fyi.service) caps SPEND.
const RATE_LIMIT = 15; // requests
const RATE_WINDOW_MS = 60_000; // per minute

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`best-yield:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

  const { userAddress, strategy } = req.body ?? {};
  if (typeof userAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    return res.status(400).json({ error: 'valid userAddress is required' });
  }

  try {
    // Engagement is derived from on-chain state, NOT the request body — the
    // client cannot inflate savedUsd to unlock paid calls. Fails closed to free.
    const engagement = await deriveServerEngagement(userAddress);
    const tier = resolveInsightTier(engagement);

    const recommendations = await getYieldRecommendations(
      userAddress,
      undefined,
      typeof strategy === 'string' ? strategy : undefined,
      5,
      undefined,
      engagement,
    );
    res.setHeader('Cache-Control', 'private, max-age=120');
    return res.status(200).json({
      recommendations,
      tier,
      tierLabel: TIER_POLICIES[tier].label,
      paidUnlocked: TIER_POLICIES[tier].paidInsightsPerDay > 0,
    });
  } catch (err) {
    console.error('[api/agent/best-yield] failed:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Could not load yield recommendations' });
  }
}
