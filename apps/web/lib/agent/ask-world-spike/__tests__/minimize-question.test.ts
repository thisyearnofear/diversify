/**
 * Skeleton minimization — the lossiness guarantee is the privacy contract.
 * Anything the whitelist can't express must return null (nothing sent),
 * and what IS sent must be one of four canonical template shapes.
 */

import { describe, it, expect } from 'vitest';
import { toQuestionSkeleton, parseQuestionSkeleton } from '../minimize-question';

describe('toQuestionSkeleton', () => {
    it('emits canonical skeletons for the four question classes', () => {
        expect(toQuestionSkeleton('which countries had inflation higher than 5 percent'))
            .toBe('inflation_rank?threshold=5&dir=higher');
        expect(toQuestionSkeleton('what is the inflation in nigeria'))
            .toBe('inflation_single?country=nigeria');
        expect(toQuestionSkeleton('which currency lost the most value vs usd over 5 years'))
            .toBe('depreciation_rank?horizon=5');
        expect(toQuestionSkeleton('how much has the naira lost over 5 years'))
            .toBe('depreciation_single?currency=naira&horizon=5');
    });

    it('reads "lower than" as the lower direction and word-numbers as values', () => {
        expect(toQuestionSkeleton('countries with inflation lower than three percent'))
            .toBe('inflation_rank?threshold=3&dir=lower');
    });

    it('treats "<n> years" as a horizon, never a threshold', () => {
        expect(toQuestionSkeleton('what was the inflation in japan over 5 years'))
            .toBe('inflation_single?country=japan');
    });

    it('refuses horizons it cannot express', () => {
        expect(toQuestionSkeleton('which currency lost value over 2 years')).toBeNull();
    });

    it('sends nothing when any informative word falls outside the whitelist', () => {
        // advice modals, personal nouns, portfolio vocabulary — all block.
        expect(toQuestionSkeleton('should i move out of the naira')).toBeNull();
        expect(toQuestionSkeleton('which countries had inflation higher than my mortgage rate')).toBeNull();
        expect(toQuestionSkeleton('what is the inflation in loremipsumstan')).toBeNull();
        expect(toQuestionSkeleton('buy bitcoin')).toBeNull();
    });

    it('sends nothing for non-questions and oversized inputs', () => {
        expect(toQuestionSkeleton('')).toBeNull();
        expect(toQuestionSkeleton('   ')).toBeNull();
        expect(toQuestionSkeleton(`inflation ${'which countries '.repeat(10)}`)).toBeNull();
    });

    it('defaults the depreciation horizon to 1 year when unstated', () => {
        expect(toQuestionSkeleton('which currency lost the most value'))
            .toBe('depreciation_rank?horizon=1');
    });

    it('produces only the four server-accepted template shapes', () => {
        const skeletons = [
            toQuestionSkeleton('which countries had inflation higher than 10 percent'),
            toQuestionSkeleton('inflation in turkey'),
            toQuestionSkeleton('what currency lost most over three years'),
            toQuestionSkeleton('how much did the hryvnia lose'),
        ];
        const shape = new RegExp([
            '^inflation_single\\?country=[a-z]{1,20}$',
            '^inflation_rank\\?threshold=\\d{1,3}(?:\\.\\d)?&dir=(?:higher|lower)$',
            '^depreciation_single\\?currency=[a-z]{1,20}&horizon=[135]$',
            '^depreciation_rank\\?horizon=[135]$',
        ].join('|'));
        for (const skeleton of skeletons) {
            expect(skeleton).not.toBeNull();
            expect(skeleton).toMatch(shape);
        }
    });
});

describe('parseQuestionSkeleton', () => {
    it('round-trips the four canonical skeletons', () => {
        expect(parseQuestionSkeleton('inflation_rank?threshold=5&dir=higher')).toEqual({
            kind: 'inflation_rank',
            comparator: 'higher',
            thresholdPct: 5,
        });
        expect(parseQuestionSkeleton('inflation_single?country=nigeria')).toEqual({
            kind: 'inflation_single',
            countryName: 'nigeria',
        });
        expect(parseQuestionSkeleton('depreciation_rank?horizon=5')).toEqual({
            kind: 'depreciation_rank',
            horizon: 5,
        });
        expect(parseQuestionSkeleton('depreciation_single?currency=naira&horizon=1')).toEqual({
            kind: 'depreciation_single',
            currencyOrCountry: 'naira',
            horizon: 1,
        });
    });

    it('rejects non-canonical shapes', () => {
        expect(parseQuestionSkeleton('inflation_rank?threshold=5')).toBeNull();
        expect(parseQuestionSkeleton('buy bitcoin')).toBeNull();
        expect(parseQuestionSkeleton('')).toBeNull();
    });
});
