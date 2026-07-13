import type { NextApiRequest, NextApiResponse } from 'next';
import {
  dismissRecommendation,
  enqueueRecommendation,
  getGuardianState,
  pruneAlertCooldowns,
  updateGuardianState,
} from './_guardian-state';
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
 *
 * Trust boundary: the address is derived from wallet-signed headers —
 * body/query userAddress is ignored. Server-side writers (cron, firecrawl,
 * cycle-monitor) call enqueueRecommendation directly and must NOT use this
 * HTTP endpoint.
 *
 * Client responsibilities are deliberately narrow:
 *   GET           — read latest state
 *   POST dismiss  — atomically remove ONE specific proposal by capturedAt
 *   POST recordAlert — record that an alert fired (for cooldown tracking)
 *   POST latestRecommendation — enqueue a browser-originated proposal that
 *     will be stamped `manual_review` and is therefore NEVER auto-executable.
 *
 * The previous version accepted `latestRecommendation: null` to clear the
 * whole queue. That let any authenticated browser wipe a queue populated
 * by Firecrawl / cycle-monitor / heartbeat data — undermining the queue's
 * integrity even though it was not an execution vulnerability. The clear
 * branch is gone; user-facing dismiss now goes through `dismiss`.
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
    const { latestRecommendation, recordAlert, dismiss } = req.body || {};

    let state = await getGuardianState(userAddress);

    if (latestRecommendation !== undefined) {
      // Browser-originated recommendations are always manual-review — never
      // eligible for Guardian auto-execution. Only trusted server-side
      // writers (cron, firecrawl webhook, cycle-monitor) may enqueue
      // guardian_eligible recommendations, and they call enqueueRecommendation
      // directly, not through this HTTP endpoint. Reject `null` outright so
      // a browser can never wipe trusted server-side proposals.
      if (latestRecommendation === null) {
        return res.status(400).json({
          error: 'latestRecommendation must be an object — use POST { dismiss: { capturedAt } } to remove a single recommendation',
        });
      }
      const stamped = {
        ...latestRecommendation,
        executionEligibility: 'manual_review' as const,
      };
      state = await enqueueRecommendation(userAddress, stamped);
    }

    if (dismiss !== undefined) {
      if (typeof dismiss !== 'object' || dismiss === null) {
        return res.status(400).json({ error: 'dismiss must be an object with { capturedAt }' });
      }
      const { capturedAt } = dismiss;
      if (typeof capturedAt !== 'string' || capturedAt.length === 0) {
        return res.status(400).json({ error: 'dismiss.capturedAt must be a non-empty string' });
      }
      const removed = await dismissRecommendation(userAddress, capturedAt);
      if (!removed) {
        // The recommendation was already gone (dismissed twice or the
        // executor dequeued it first). Return the current state so the
        // client can reconcile without treating this as an error.
        state = await getGuardianState(userAddress);
        return res.status(200).json({ success: true, dismissed: false, state });
      }
      state = await getGuardianState(userAddress);
      return res.status(200).json({ success: true, dismissed: true, state });
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

    if (
      latestRecommendation === undefined &&
      recordAlert === undefined &&
      dismiss === undefined
    ) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    return res.status(200).json({ success: true, state });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
