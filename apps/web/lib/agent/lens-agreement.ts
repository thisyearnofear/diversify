/**
 * Signal Lens ↔ baseline agreement analytics.
 *
 * The lens is advisory-only shadow telemetry; this is the comparison that
 * decides whether it ever earns a place in a user-facing surface. Both sides
 * are judged on ONE question: "would this change reach a user as a macro
 * signal?" The baseline side uses the webhook's real propagation gate
 * (actionable && confidence >= 0.6), not a looser reading of the extractor —
 * agreement with the decision the system actually makes is the only
 * agreement that matters.
 *
 * Nothing here is truth-graded: "agree" means two detectors matched, not that
 * either was right. Consumers must label it accordingly.
 */

export const BASELINE_PROPAGATION_CONFIDENCE = 0.6;
/** The lens' own bar for "there is a specific, material development here". */
export const LENS_MATERIALITY_THRESHOLD = 0.5;

export interface LensAgreementBaseline {
  signal?: unknown;
  confidence?: unknown;
  actionable?: unknown;
}

export interface LensAgreementAssessment {
  category?: unknown;
  materiality?: unknown;
}

export type LensAgreementBucket =
  | 'agree_signal'
  | 'agree_none'
  | 'lens_only'
  | 'baseline_only';

export interface LensAgreementSummary {
  compared: number;
  agreeSignal: number;
  agreeNone: number;
  lensOnly: number;
  baselineOnly: number;
  /** agree_signal cases where both named the same signal category. */
  sameCategory: number;
}

function baselineDetects(baseline: LensAgreementBaseline): boolean {
  return (
    baseline.actionable === true
    && typeof baseline.confidence === 'number'
    && Number.isFinite(baseline.confidence)
    && baseline.confidence >= BASELINE_PROPAGATION_CONFIDENCE
  );
}

function lensDetects(assessment: LensAgreementAssessment): boolean {
  return (
    typeof assessment.category === 'string'
    && assessment.category !== 'none'
    && typeof assessment.materiality === 'number'
    && Number.isFinite(assessment.materiality)
    && assessment.materiality >= LENS_MATERIALITY_THRESHOLD
  );
}

/** Returns null when the record isn't comparable (missing either side). */
export function classifyLensAgreement(
  baseline: LensAgreementBaseline | null | undefined,
  assessment: LensAgreementAssessment | null | undefined,
): LensAgreementBucket | null {
  if (!baseline || !assessment) return null;
  if (!baselineDetects(baseline) && !lensDetects(assessment)) return 'agree_none';
  if (baselineDetects(baseline) && lensDetects(assessment)) return 'agree_signal';
  return lensDetects(assessment) ? 'lens_only' : 'baseline_only';
}

export function summarizeLensAgreement(
  entries: ReadonlyArray<{
    baseline?: LensAgreementBaseline | null;
    assessment?: LensAgreementAssessment | null;
  }>,
): LensAgreementSummary {
  const summary: LensAgreementSummary = {
    compared: 0,
    agreeSignal: 0,
    agreeNone: 0,
    lensOnly: 0,
    baselineOnly: 0,
    sameCategory: 0,
  };
  for (const entry of entries) {
    const bucket = classifyLensAgreement(entry.baseline, entry.assessment);
    if (!bucket) continue;
    summary.compared += 1;
    if (bucket === 'agree_signal') summary.agreeSignal += 1;
    if (bucket === 'agree_none') summary.agreeNone += 1;
    if (bucket === 'lens_only') summary.lensOnly += 1;
    if (bucket === 'baseline_only') summary.baselineOnly += 1;
    if (
      bucket === 'agree_signal'
      && typeof entry.baseline?.signal === 'string'
      && typeof entry.assessment?.category === 'string'
      && entry.baseline.signal === entry.assessment.category
    ) {
      summary.sameCategory += 1;
    }
  }
  return summary;
}
