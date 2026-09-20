/**
 * GET /api/agent/guardian-telemetry
 *
 * Public, aggregate-only "how hard is the Guardian working" read used by the
 * proof-tier cadence displays. Carries NO user data:
 *
 *  - `guardian`: this ISO week's global counters (checks/executions/declines)
 *    plus the median of bounded, real-measured decision durations. Absent
 *    week → null (the UI must omit, never zero-fill).
 *  - `signalLens`: the optional TypeSafe Signal Lens shadow review counts and
 *    median duration over its rolling 30-day retention window — labeled
 *    `advisory_shadow` because these reviews never cause user actions.
 *
 * Each section degrades independently so one slow/broken store can't take the
 * whole read down (same posture as the x402 metrics RPC-hang fix).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { TypeSafeSignalReview } from '@/models/TypeSafeSignalReview';
import { getGlobalActivitySummary, type GuardianActivitySummary } from '@/lib/guardian-activity-counter';
import { median } from '@/lib/agent/guardian-telemetry-stats';

export interface SignalLensTelemetry {
  reviews: number;
  medianMs: number | null;
  timedSampleCount: number;
  /** Reviews are TTL'd after 30 days — counts cover that window only. */
  window: 'rolling_30d';
  note: 'advisory_shadow';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();
  } catch {
    return res.status(200).json({ guardian: null, signalLens: null });
  }

  let guardian: GuardianActivitySummary | null = null;
  try {
    guardian = await getGlobalActivitySummary();
  } catch (err: unknown) {
    console.warn('[guardian-telemetry] activity summary failed:', err instanceof Error ? err.message : err);
  }

  let signalLens: SignalLensTelemetry | null = null;
  try {
    const [reviews, timedDocs] = await Promise.all([
      TypeSafeSignalReview.countDocuments({ assessment: { $exists: true } }),
      TypeSafeSignalReview.find(
        { 'assessment.durationMs': { $gt: 0 } },
        { 'assessment.durationMs': 1, _id: 0 },
      ).lean(),
    ]);
    const samples = timedDocs
      .map((doc: any) => Number(doc?.assessment?.durationMs))
      .filter((value: number) => Number.isFinite(value));
    signalLens = {
      reviews,
      medianMs: median(samples),
      timedSampleCount: samples.length,
      window: 'rolling_30d',
      note: 'advisory_shadow',
    };
  } catch (err: unknown) {
    console.warn('[guardian-telemetry] signal lens stats failed:', err instanceof Error ? err.message : err);
  }

  return res.status(200).json({ guardian, signalLens });
}
