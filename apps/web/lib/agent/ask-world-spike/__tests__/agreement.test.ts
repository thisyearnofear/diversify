import { describe, it, expect } from 'vitest';
import { classifySpikeAgreement, summarizeSpikeAgreement } from '../agreement';

describe('classifySpikeAgreement', () => {
    it('is uncomparable without a Jev side or without a regex verdict', () => {
        expect(classifySpikeAgreement(null, null)).toBeNull();
        expect(classifySpikeAgreement(undefined, { intent: 'inflation_rank', accepted: true })).toBeNull();
    });

    it('maps the four buckets', () => {
        expect(classifySpikeAgreement(null, { intent: 'other', accepted: false })).toBe('agree_none');
        expect(classifySpikeAgreement(null, { intent: 'inflation_rank', accepted: true })).toBe('jev_only');
        expect(classifySpikeAgreement('inflation_rank', { intent: 'other', accepted: false })).toBe('baseline_only');
        expect(classifySpikeAgreement('inflation_rank', { intent: 'inflation_rank', accepted: true })).toBe('agree_intent');
    });

    it('never counts a high-confidence "other" as a detection', () => {
        expect(classifySpikeAgreement(null, { intent: 'other', accepted: true })).toBe('agree_none');
    });

    it('summarizes with same-intent counts inside agree_intent', () => {
        const summary = summarizeSpikeAgreement([
            { regexKind: null, jev: { intent: 'other', accepted: false } },
            { regexKind: null, jev: { intent: 'depreciation_rank', accepted: true } },
            { regexKind: 'inflation_rank', jev: { intent: 'inflation_rank', accepted: true } },
            { regexKind: 'inflation_rank', jev: { intent: 'inflation_single', accepted: true } },
        ]);
        expect(summary.compared).toBe(4);
        expect(summary.agreeNone).toBe(1);
        expect(summary.jevOnly).toBe(1);
        expect(summary.agreeIntent).toBe(2);
        expect(summary.sameIntent).toBe(1);
        expect(summary.baselineOnly).toBe(0);
    });
});
