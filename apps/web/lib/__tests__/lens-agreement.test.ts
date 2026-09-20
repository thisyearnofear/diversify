import { describe, expect, it } from 'vitest';
import {
  classifyLensAgreement,
  summarizeLensAgreement,
} from '../agent/lens-agreement';

const detectsBaseline = { signal: 'rate_hike', confidence: 0.8, actionable: true };
const quietBaseline = { signal: 'none', confidence: 0.2, actionable: false };
const detectsLens = { category: 'rate_hike', materiality: 0.9 };
const quietLens = { category: 'none', materiality: 0.1 };

describe('classifyLensAgreement', () => {
  it('is null until both sides exist', () => {
    expect(classifyLensAgreement(null, detectsLens)).toBeNull();
    expect(classifyLensAgreement(detectsBaseline, undefined)).toBeNull();
  });

  it('buckets detector agreement against the propagation gate', () => {
    expect(classifyLensAgreement(detectsBaseline, detectsLens)).toBe('agree_signal');
    expect(classifyLensAgreement(quietBaseline, quietLens)).toBe('agree_none');
    expect(classifyLensAgreement(quietBaseline, detectsLens)).toBe('lens_only');
    expect(classifyLensAgreement(detectsBaseline, quietLens)).toBe('baseline_only');
  });

  it('uses the webhook gate (actionable && confidence >= 0.6) for the baseline side', () => {
    // High-confidence but not actionable → the system would NOT propagate,
    // so "no signal reached the user" is the honest baseline reading.
    expect(classifyLensAgreement(
      { signal: 'rate_cut', confidence: 0.9, actionable: false },
      quietLens,
    )).toBe('agree_none');
    expect(classifyLensAgreement(
      { signal: 'rate_cut', confidence: 0.59, actionable: true },
      quietLens,
    )).toBe('agree_none');
    expect(classifyLensAgreement(
      { signal: 'rate_cut', confidence: 0.6, actionable: true },
      quietLens,
    )).toBe('baseline_only');
  });

  it('requires both category and materiality for the lens side', () => {
    expect(classifyLensAgreement(quietBaseline, { category: 'none', materiality: 0.95 }))
      .toBe('agree_none');
    expect(classifyLensAgreement(quietBaseline, { category: 'depeg_risk', materiality: 0.4 }))
      .toBe('agree_none');
    expect(classifyLensAgreement(detectsBaseline, { category: 'depeg_risk', materiality: 0.4 }))
      .toBe('baseline_only');
    expect(classifyLensAgreement(detectsBaseline, { category: 'depeg_risk', materiality: 0.5 }))
      .toBe('agree_signal');
  });

  it('treats malformed numbers as no-detection, not as noise', () => {
    expect(classifyLensAgreement(
      { signal: 'rate_hike', confidence: '0.9', actionable: true },
      quietLens,
    )).toBe('agree_none');
    expect(classifyLensAgreement(
      detectsBaseline,
      { category: 'rate_hike', materiality: Number.NaN },
    )).toBe('baseline_only');
  });
});

describe('summarizeLensAgreement', () => {
  it('counts only comparable pairs and sub-counts same-category hits', () => {
    const summary = summarizeLensAgreement([
      { baseline: detectsBaseline, assessment: detectsLens },
      { baseline: { signal: 'rate_cut', confidence: 0.9, actionable: true }, assessment: { category: 'rate_hike', materiality: 0.8 } },
      { baseline: quietBaseline, assessment: quietLens },
      { baseline: quietBaseline, assessment: detectsLens },
      { baseline: detectsBaseline, assessment: null },
    ]);
    expect(summary).toEqual({
      compared: 4,
      agreeSignal: 2,
      agreeNone: 1,
      lensOnly: 1,
      baselineOnly: 0,
      sameCategory: 1,
    });
  });

  it('starts at zero compared for an empty store (consumers must omit)', () => {
    expect(summarizeLensAgreement([]).compared).toBe(0);
  });
});
