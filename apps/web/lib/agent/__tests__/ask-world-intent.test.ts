import { describe, it, expect } from 'vitest';
import { classifyAskWorldQuery } from '../ask-world-intent';

describe('classifyAskWorldQuery — matched question classes', () => {
    it('parses inflation_rank with upper comparators', () => {
        expect(
            classifyAskWorldQuery('which countries had inflation higher than 5%'),
        ).toEqual({ kind: 'inflation_rank', comparator: 'higher', thresholdPct: 5 });
        expect(
            classifyAskWorldQuery('countries with inflation above 10 percent?'),
        ).toEqual({ kind: 'inflation_rank', comparator: 'higher', thresholdPct: 10 });
        expect(
            classifyAskWorldQuery('list economies where inflation exceeds 20'),
        ).toEqual({ kind: 'inflation_rank', comparator: 'higher', thresholdPct: 20 });
    });

    it('parses inflation_rank with lower comparators', () => {
        expect(
            classifyAskWorldQuery('which countries have inflation below 3%'),
        ).toEqual({ kind: 'inflation_rank', comparator: 'lower', thresholdPct: 3 });
        expect(
            classifyAskWorldQuery('countries with inflation lower than 2 percent'),
        ).toEqual({ kind: 'inflation_rank', comparator: 'lower', thresholdPct: 2 });
    });

    it('rejects out-of-range thresholds', () => {
        expect(classifyAskWorldQuery('countries with inflation higher than 0%')).toBeNull();
        expect(classifyAskWorldQuery('countries with inflation higher than 500%')).toBeNull();
    });

    it('parses inflation_single from several phrasings', () => {
        expect(classifyAskWorldQuery("what's the inflation in japan")).toEqual({
            kind: 'inflation_single',
            countryName: 'japan',
        });
        expect(classifyAskWorldQuery('inflation rate nigeria')).toEqual({
            kind: 'inflation_single',
            countryName: 'nigeria',
        });
        expect(classifyAskWorldQuery('how high is inflation in the US')).toEqual({
            kind: 'inflation_single',
            countryName: 'us',
        });
    });

    it('does not treat a time horizon as an inflation threshold', () => {
        // "over 5 years" must not parse as threshold 5.
        expect(classifyAskWorldQuery('what was inflation over 5 years')).toBeNull();
    });

    it('parses depreciation_rank vs USD with horizons', () => {
        expect(
            classifyAskWorldQuery('which currency lost the most value vs usd over 5 years'),
        ).toEqual({ kind: 'depreciation_rank', horizon: 5 });
        expect(
            classifyAskWorldQuery('worst performing currency against the dollar in 3 years'),
        ).toEqual({ kind: 'depreciation_rank', horizon: 3 });
        expect(classifyAskWorldQuery('which currency lost the most?')).toEqual({
            kind: 'depreciation_rank',
            horizon: 1,
        });
    });

    it('parses depreciation_single with entity and horizon', () => {
        expect(classifyAskWorldQuery('how much has ngn lost over 5 years')).toEqual({
            kind: 'depreciation_single',
            currencyOrCountry: 'ngn',
            horizon: 5,
        });
        expect(classifyAskWorldQuery('how much value did the hryvnia lose in 3 years')).toEqual({
            kind: 'depreciation_single',
            currencyOrCountry: 'hryvnia',
            horizon: 3,
        });
    });

    it('classifies question-marked inputs (fast-path question gate does not apply here)', () => {
        expect(classifyAskWorldQuery('which countries had inflation higher than 10%?')?.kind).toBe(
            'inflation_rank',
        );
    });
});

describe('classifyAskWorldQuery — advisor fall-through', () => {
    it('blocks advice modals even when they name macro facts', () => {
        expect(classifyAskWorldQuery('should i move out of NGN?')).toBeNull();
        expect(
            classifyAskWorldQuery('which countries had inflation higher than 5%, should i act?'),
        ).toBeNull();
        expect(classifyAskWorldQuery('what should I do about argentine inflation')).toBeNull();
        expect(classifyAskWorldQuery('recommend a currency to hold')).toBeNull();
    });

    it('blocks first-person / portfolio framings', () => {
        expect(classifyAskWorldQuery('how is my naira exposure doing vs USD?')).toBeNull();
        expect(classifyAskWorldQuery('is my portfolio safe from inflation in egypt')).toBeNull();
    });

    it('blocks non-USD depreciation benchmarks (v1 scope)', () => {
        expect(
            classifyAskWorldQuery('which currency lost the most value vs euro over 5 years'),
        ).toBeNull();
        expect(classifyAskWorldQuery('which currency lost most against gold?')).toBeNull();
    });

    it('blocks compound sentences and long free-form messages', () => {
        expect(
            classifyAskWorldQuery('which countries had inflation higher than 5%; and who lost most?'),
        ).toBeNull();
        expect(
            classifyAskWorldQuery(
                'I read that the world bank updated forecasts, so given everything happening this quarter can you tell me which countries had inflation higher than 5 percent',
            ),
        ).toBeNull();
    });

    it('returns null when nothing matches the fact classes', () => {
        expect(classifyAskWorldQuery('hello')).toBeNull();
        expect(classifyAskWorldQuery('what is the weather')).toBeNull();
        expect(classifyAskWorldQuery('tell me less')).toBeNull();
        expect(classifyAskWorldQuery('which countries had inflation higher than')).toBeNull();
    });

    it('rejects unsupported numeric horizons', () => {
        expect(
            classifyAskWorldQuery('which currency lost the most value over 2 years'),
        ).toBeNull();
    });
});
