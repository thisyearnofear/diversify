import type { NextApiRequest, NextApiResponse } from 'next';
import { getGuardianState, pruneAlertCooldowns, updateGuardianState, enqueueRecommendation } from './_guardian-state';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

/**
 * Cooldown window for proactive monitoring alerts. Mirrors the previous
 * localStorage window so behaviour is unchanged for existing users; the
 * only difference is the store is per-user on the server now.
 */
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
/** Entries older than 4× the cooldown are pruned on every write. */
const ALERT_COOLDOWN_PRUNE_WINDOW_MS = ALERT_COOLDOWN_MS * 4;

/**
 * Authenticated client read/write for Guardian state.
 * Address is derived from wallet-signed headers — body/query userAddress is ignored.
 * Server-side writers (cron, firecrawl, cycle-monitor) call enqueueRecommendation
 * directly and must not use this HTTP endpoint.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userAddress = requireWalletAuth(req);
  if (!userAddress) {
    return res.status(401).json({ error: 'Wallet signature required' });
  }

  if (req.method === 'GET') {
    const state = await getGuardianState(userAddress);
    return res.status(200).json({ success: true, state });
  }

  if (req.method === 'POST') {
    const { latestRecommendation, recordAlert } = req.body || {};

    let state = await getGuardianState(userAddress);

    if (latestRecommendation !== undefined && latestRecommendation !== null) {
      state = await enqueueRecommendation(userAddress, latestRecommendation);
    } else if (latestRecommendation === null) {
      state = await updateGuardianState(userAddress, {
        latestRecommendation: undefined,
        recommendationQueue: [],
      });
    }

    if (recordAlert !== undefined) {
      if (typeof recordAlert !== 'object' || recordAlert === null) {
        return res.status(400).json({ error: 'recordAlert must be an object with { alertId, firedAt? }' });
      }
      const { alertId, firedAt } = recordAlert;
      if (typeof alertId !== 'string' || alertId.length === 0) {
        return res.status(400).json({ error: 'recordAlert.alertId must be a non-empty string' });
      }

      const existing = state ?? (await getGuardianState(userAddress));
      const merged: Record<string, number> = {
        ...(existing?.alertCooldowns || {}),
        [alertId]: typeof firedAt === 'number' ? firedAt : Date.now(),
      };
      state = await updateGuardianState(userAddress, {
        alertCooldowns: pruneAlertCooldowns(merged, ALERT_COOLDOWN_PRUNE_WINDOW_MS),
      });
    }

    if (latestRecommendation === undefined && recordAlert === undefined) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    return res.status(200).json({ success: true, state });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
