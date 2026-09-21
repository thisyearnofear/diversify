import { describe, it, expect } from 'vitest';
import {
    pctLabel,
    resolveInflationCountry,
    resolveDepreciationCode,
    resolveInflationAnswer,
    buildDepreciationAnswer,
    worldAnswerToText,
    type InflationFeed,
} from '../ask-world-facts';
import type { WorldFactsResponse } from '@/pages/api/agent/world-facts';

const imfFeed = (rows: InflationFeed['countries'], source = 'imf'): InflationFeed => ({
    countries: rows.map((r) => ({ source, ...r })) as InflationFeed['countries'],
    source,
    lastUpdated: '2026-09-20T00:00:00.000Z',
});

const worldFacts = (over: Partial<WorldFactsResponse>): WorldFactsResponse => ({
    kind: 'depreciation',
    horizon: 5,
    mode: 'reference',
    sources: 'Curated reference dataset',
    dataAsOf: '2025-07-01',
    entries: [],
    omittedCount: 0,
    ...over,
});

describe('pctLabel', () => {
    it('never renders a signed −0%', () => {
        expect(pctLabel(-0.02)).toBe('0%');
        expect(pctLabel(0)).toBe('0%');
    });
    it('uses a real minus glyph and trims .0', () => {
        expect(pctLabel(-23.0)).toBe('−23%');
        expect(pctLabel(-23.14)).toBe('−23.1%');
        expect(pctLabel(14.2)).toBe('14.2%');
    });
});

describe('resolveInflationCountry', () => {
    const rows = [
        { country: 'United States', countryCode: 'USA', value: 3, year: 2026 },
        { country: 'Nigeria', countryCode: 'NGA', value: 24, year: 2026 },
        { country: 'Viet Nam', countryCode: 'VNM', value: 4, year: 2026 },
        { country: 'World', countryCode: 'WEOWORLD', value: 5, year: 2026, isGlobal: true },
    ] as any[];

    it('matches display names loosely', () => {
        expect(resolveInflationCountry('nigeria', rows)?.countryCode).toBe('NGA');
        expect(resolveInflationCountry('vietnam', rows)?.countryCode).toBe('VNM');
    });
    it('applies aliases', () => {
        expect(resolveInflationCountry('the us', rows)?.countryCode).toBe('USA');
        expect(resolveInflationCountry('uk', rows)).toBeNull();
    });
    it('never resolves the global row', () => {
        expect(resolveInflationCountry('world', rows)).toBeNull();
    });
    it('rejects unknown entities', () => {
        expect(resolveInflationCountry('liechtenstein', rows)).toBeNull();
    });
});

describe('resolveDepreciationCode', () => {
    it('accepts dataset currency codes', () => {
        expect(resolveDepreciationCode('ngn')).toBe('NGN');
        expect(resolveDepreciationCode('NGN')).toBe('NGN');
    });
    it('accepts unambiguous currency names', () => {
        expect(resolveDepreciationCode('naira')).toBe('NGN');
        expect(resolveDepreciationCode('hryvnia')).toBe('UAH');
    });
    it('accepts country names', () => {
        expect(resolveDepreciationCode('argentina')).toBe('ARS');
        expect(resolveDepreciationCode('turkey')).toBe('TRY');
    });
    it('refuses ambiguous or unknown names (advisor can disambiguate)', () => {
        expect(resolveDepreciationCode('the peso')).toBeNull();
        expect(resolveDepreciationCode('yen')).toBeNull();
        expect(resolveDepreciationCode('zzz')).toBeNull();
    });
});

describe('resolveInflationAnswer — rank', () => {
    const feed = imfFeed([
        { country: 'Nigeria', countryCode: 'NGA', value: 24.1, year: 2026 },
        { country: 'Argentina', countryCode: 'ARG', value: 12.0, year: 2026 },
        { country: 'United States', countryCode: 'USA', value: 2.7, year: 2026 },
        { country: 'World', countryCode: 'WEOWORLD', value: 5.5, year: 2026, isGlobal: true },
        { country: 'Egypt', countryCode: 'EGY', value: null, year: 2026 },
    ]);

    it('filters, sorts descending, drops the global row, counts omissions', () => {
        const answer = resolveInflationAnswer(
            { kind: 'inflation_rank', comparator: 'higher', thresholdPct: 5 },
            feed,
            Date.now() - 40,
        );
        if (!answer || 'entityUnresolved' in answer) throw new Error('expected answer');
        expect(answer.entries.map((e) => e.country)).toEqual(['Nigeria', 'Argentina']);
        expect(answer.entries[0].flag).toBe('🇳🇬');
        expect(answer.omittedCount).toBe(1);
        expect(answer.badge.mode).toBe('live');
        expect(answer.badge.latencyMs).toBeGreaterThanOrEqual(40);
    });

    it('lower comparator sorts ascending', () => {
        const answer = resolveInflationAnswer(
            { kind: 'inflation_rank', comparator: 'lower', thresholdPct: 5 },
            feed,
            Date.now(),
        );
        if (!answer || 'entityUnresolved' in answer) throw new Error('expected answer');
        expect(answer.entries.map((e) => e.country)).toEqual(['United States']);
    });

    it('accepts ISO2 codes from the static fallback shape', () => {
        const fallback = imfFeed(
            [{ country: 'NG', countryCode: 'NG', value: 24, year: 2024 }],
            'fallback',
        );
        const answer = resolveInflationAnswer(
            { kind: 'inflation_rank', comparator: 'higher', thresholdPct: 10 },
            fallback,
            Date.now(),
        );
        if (!answer || 'entityUnresolved' in answer) throw new Error('expected answer');
        expect(answer.entries[0].flag).toBe('🇳🇬');
        expect(answer.badge.mode).toBe('reference');
    });
});

describe('resolveInflationAnswer — single', () => {
    const feed = imfFeed([
        { country: 'Japan', countryCode: 'JPN', value: 3.2, year: 2026 },
    ]);

    it('answers one country with headline + flag', () => {
        const answer = resolveInflationAnswer(
            { kind: 'inflation_single', countryName: 'japan' },
            feed,
            Date.now(),
        );
        if (!answer || 'entityUnresolved' in answer) throw new Error('expected answer');
        expect(answer.entries).toHaveLength(1);
        expect(answer.entries[0].flag).toBe('🇯🇵');
        expect(answer.headline[0]).toContain('Japan runs 3.2% inflation');
    });

    it('signals fall-through for unresolvable entities', () => {
        expect(
            resolveInflationAnswer(
                { kind: 'inflation_single', countryName: 'liechtenstein' },
                feed,
                Date.now(),
            ),
        ).toEqual({ entityUnresolved: true });
    });
});

describe('buildDepreciationAnswer', () => {
    const payload = worldFacts({
        mode: 'live',
        sources: 'fawazahmed0 open FX dataset',
        dataAsOf: '2026-09-19',
        entries: [
            { code: 'ARS', countryName: 'Argentina', iso2: 'AR', value: -27, isLive: true },
            { code: 'NGN', countryName: 'Nigeria', iso2: 'NG', value: -46.6, isLive: true },
            { code: 'MXN', countryName: 'Mexico', iso2: 'MX', value: 2, isLive: true },
            { code: 'USD', countryName: 'United States', iso2: 'US', value: 0, isLive: true },
        ],
        omittedCount: 3,
    });

    it('ranks losses most-negative first and excludes appreciation/zero', () => {
        const answer = buildDepreciationAnswer(
            { kind: 'depreciation_rank', horizon: 1 },
            payload,
            Date.now(),
        );
        expect(answer).not.toBeNull();
        expect(answer!.entries.map((e) => e.code)).toEqual(['NGN', 'ARS']);
        expect(answer!.entries[0].valueLabel).toBe('−46.6%');
        expect(answer!.entries[0].flag).toBe('🇳🇬');
        expect(answer!.omittedCount).toBe(3);
        expect(answer!.badge.mode).toBe('live');
    });

    it('reference answers label themselves not-live in the text twin', () => {
        const answer = buildDepreciationAnswer(
            { kind: 'depreciation_rank', horizon: 5 },
            worldFacts({ entries: payload.entries.map((e) => ({ ...e, isLive: false })) }),
            Date.now(),
        );
        expect(answer!.badge.mode).toBe('reference');
        const text = worldAnswerToText(answer!);
        expect(text).toContain('Reference data');
        expect(text).toContain('not live');
        expect(text).not.toContain('live data');
    });

    it('single-currency payload becomes a one-row answer', () => {
        const answer = buildDepreciationAnswer(
            { kind: 'depreciation_single', currencyOrCountry: 'ngn', horizon: 5 },
            worldFacts({
                entries: [{ code: 'NGN', countryName: 'Nigeria', iso2: 'NG', value: -70, isLive: false }],
            }),
            Date.now(),
        );
        expect(answer!.kind).toBe('depreciation_single');
        expect(answer!.entries).toHaveLength(1);
        expect(answer!.entries[0].valueLabel).toBe('−70%');
    });

    it('empty payload yields null (caller decides fall-through)', () => {
        expect(
            buildDepreciationAnswer(
                { kind: 'depreciation_single', currencyOrCountry: 'ngn', horizon: 1 },
                worldFacts({ entries: [] }),
                Date.now(),
            ),
        ).toBeNull();
    });
});

describe('worldAnswerToText', () => {
    it('includes headline, rows, and the live badge copy', () => {
        const answer = buildDepreciationAnswer(
            { kind: 'depreciation_rank', horizon: 1 },
            worldFacts({
                mode: 'live',
                entries: [
                    { code: 'NGN', countryName: 'Nigeria', iso2: 'NG', value: -46.6, isLive: true },
                ],
            }),
            Date.now() - 12,
        )!;
        const text = worldAnswerToText(answer);
        expect(text).toContain('🇳🇬 NGN: −46.6%');
        expect(text).toContain('Answered from live data in');
        expect(text).toContain('as of 2025-07-01');
    });
});
