import type { NextApiRequest, NextApiResponse } from 'next';
import { getGuardianState, pruneAlertCooldowns, updateGuardianState, enqueueRecommendation } from './_guardian-state';

/**
 * Cooldown window for proactive monitoring alerts. Mirrors the previous
 * localStorage window so behaviour is unchanged for existing users; the
 * only difference is the store is per-user on the server now.
 */
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
/** Entries older than 4× the cooldown are pruned on every write. */
const ALERT_COOLDOWN_PRUNE_WINDOW_MS = ALERT_COOLDOWN_MS * 4;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userAddress } = req.method === 'GET' ? req.query : req.body || {};

  if (!userAddress || typeof userAddress !== 'string') {
    return res.status(400).json({ error: 'Missing userAddress' });
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
