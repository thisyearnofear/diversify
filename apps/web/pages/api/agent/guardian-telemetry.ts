/**
 * GET /api/agent/guardian-telemetry
 *
 * Public, aggregate-only "how hard is the Guardian working" read used by the
 * proof-tier cadence displays. Carries NO user data:
 *
 *  - `guardian`: this ISO week's global counters (checks/executions/declines)
 *    plus the median of bounded, real-measured decision durations. Absent
 *    week → null (the UI must omit, never zero-fill).
 *  - `signalLens`: the optional TypeSafe Signal Lens shadow review counts,
 *    median duration, and lens-vs-baseline agreement over its rolling 30-day
 *    retention window — labeled `advisory_shadow` because these reviews never
 *    cause user actions.
 *
 * Each section degrades independently so one slow/broken store can't take the
 * whole read down (same posture as the x402 metrics RPC-hang fix).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { TypeSafeSignalReview } from '@/models/TypeSafeSignalReview';
import { getGlobalActivitySummary, type GuardianActivitySummary } from '@/lib/guardian-activity-counter';
import { median } from '@/lib/agent/guardian-telemetry-stats';
import { summarizeLensAgreement, type LensAgreementSummary } from '@/lib/agent/lens-agreement';

export interface SignalLensTelemetry {
  reviews: number;
  medianMs: number | null;
  timedSampleCount: number;
  /** Reviews are TTL'd after 30 days — counts cover that window only. */
  window: 'rolling_30d';
  note: 'advisory_shadow';
  /**
   * Lens ↔ baseline-extractor agreement over comparable shadow records.
   * Measures detector agreement, not correctness — consumers must label it
   * as a comparison, never as "the lens was right". No comparable pair yet
   * → null (UI omits, never zero-fills).
   */
  agreement: LensAgreementSummary | null;
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
    const [reviews, timedDocs, comparableDocs] = await Promise.all([
      TypeSafeSignalReview.countDocuments({ assessment: { $exists: true } }),
      TypeSafeSignalReview.find(
        { 'assessment.durationMs': { $gt: 0 } },
        { 'assessment.durationMs': 1, _id: 0 },
      ).lean(),
      TypeSafeSignalReview.find(
        { baseline: { $exists: true }, assessment: { $exists: true } },
        { 'baseline.signal': 1, 'baseline.confidence': 1, 'baseline.actionable': 1, 'assessment.category': 1, 'assessment.materiality': 1, _id: 0 },
      ).lean(),
    ]);
    const samples = timedDocs
      .map((doc: any) => Number(doc?.assessment?.durationMs))
      .filter((value: number) => Number.isFinite(value));
    const agreement = summarizeLensAgreement(
      comparableDocs.map((doc: any) => ({
        baseline: doc?.baseline ?? null,
        assessment: doc?.assessment ?? null,
      })),
    );
    signalLens = {
      reviews,
      medianMs: median(samples),
      timedSampleCount: samples.length,
      window: 'rolling_30d',
      note: 'advisory_shadow',
      agreement: agreement.compared > 0 ? agreement : null,
    };
  } catch (err: unknown) {
    console.warn('[guardian-telemetry] signal lens stats failed:', err instanceof Error ? err.message : err);
  }

  return res.status(200).json({ guardian, signalLens });
}
