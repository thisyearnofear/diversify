/**
 * POST /api/agent/best-yield — personalized best-yield recommendations.
 *
 * Server-side so the paid vaults.fyi call + the insight-tier gate run correctly
 * (the tier is DEFAULT-DENY: without engagement, no paid call). Returns the
 * advisor's ranked recommendations (vaults.fyi personalized + GMX GM pools +
 * free LI.FI), plus the resolved tier so the UI can show an unlock prompt.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getYieldRecommendations } from '@diversifi/shared/src/services/ai/yield-advisor.service';
import { resolveInsightTier, TIER_POLICIES } from '@diversifi/shared/src/services/insight-tier';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userAddress, strategy, savedUsd, streakDays, paidInsightsUsedToday } = req.body ?? {};
  if (typeof userAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    return res.status(400).json({ error: 'valid userAddress is required' });
  }

  const engagement = {
    savedUsd: Number.isFinite(savedUsd) ? Number(savedUsd) : undefined,
    streakDays: Number.isFinite(streakDays) ? Number(streakDays) : undefined,
    paidInsightsUsedToday: Number.isFinite(paidInsightsUsedToday) ? Number(paidInsightsUsedToday) : 0,
  };
  const tier = resolveInsightTier(engagement);

  try {
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
