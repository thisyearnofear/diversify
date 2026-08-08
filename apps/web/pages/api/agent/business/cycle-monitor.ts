/**
 * POST /api/agent/business/cycle-monitor — standalone cycle-aware proposals tick.
 *
 * Also invoked inline from /api/agent/guardian-loop so one cron job covers both.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { constantTimeEqual } from '@diversifi/shared';
import { runCycleMonitor } from '@/lib/guardian/cycle-monitor-run';

const GUARDIAN_LOOP_SECRET = (() => {
  const secret = process.env.GUARDIAN_LOOP_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('GUARDIAN_LOOP_SECRET required in production');
  }
  return 'dev-guardian-loop';
})();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const authHeader = req.headers['x-guardian-secret'] || req.body?.secret;
  if (typeof authHeader !== 'string' || !constantTimeEqual(authHeader, GUARDIAN_LOOP_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectDB();
  } catch (err: unknown) {
    return res.status(503).json({
      error: err instanceof Error ? err.message : 'Database unavailable',
    });
  }

  const summary = await runCycleMonitor();

  return res.status(200).json({
    success: true,
    ...summary,
  });
}
