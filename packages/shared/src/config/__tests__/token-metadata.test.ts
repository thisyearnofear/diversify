import { describe, it, expect } from 'vitest';
import {
    TOKEN_METADATA,
    tokenMetadataFor,
    getTokenRegion,
    getTokenApy,
    isTokenInflationHedge,
    REGIONS,
} from '../index';

describe('TOKEN_METADATA', () => {
    it('has keys that are unique case-insensitively', () => {
        const seen = new Set<string>();
        for (const key of Object.keys(TOKEN_METADATA)) {
            const lower = key.toLowerCase();
            expect(seen.has(lower), `duplicate key ignoring case: ${key}`).toBe(false);
            seen.add(lower);
        }
    });
});

describe('tokenMetadataFor', () => {
    it('resolves canonical mixed-case symbols', () => {
        expect(tokenMetadataFor('KESm')?.name).toBe('Mento Kenyan Shilling');
    });

    it('resolves any casing of the same symbol', () => {
        expect(tokenMetadataFor('kesm')?.name).toBe('Mento Kenyan Shilling');
        expect(tokenMetadataFor('KESM')?.name).toBe('Mento Kenyan Shilling');
    });

    it('returns undefined for unknown symbols', () => {
        expect(tokenMetadataFor('NOPE')).toBeUndefined();
    });
});

describe('getTokenRegion', () => {
    it('resolves Mento stables to their region regardless of casing', () => {
        expect(getTokenRegion('KESm')).toBe(REGIONS.AFRICA);
        expect(getTokenRegion('kesm')).toBe(REGIONS.AFRICA);
        expect(getTokenRegion('KESM')).toBe(REGIONS.AFRICA);
    });

    it('resolves USDC to Global in any casing', () => {
        expect(getTokenRegion('USDC')).toBe(REGIONS.GLOBAL);
        expect(getTokenRegion('usdc')).toBe(REGIONS.GLOBAL);
    });

    it('falls back to Global for unknown symbols', () => {
        expect(getTokenRegion('UNKNOWN')).toBe(REGIONS.GLOBAL);
    });
});

describe('getTokenApy / isTokenInflationHedge', () => {
    it('resolve metadata case-insensitively', () => {
        expect(getTokenApy('usdy')).toBe(5.0);
        expect(getTokenApy('USDY')).toBe(5.0);
        expect(isTokenInflationHedge('paxg')).toBe(true);
        expect(isTokenInflationHedge('PAXG')).toBe(true);
    });

    it('keep their fallbacks for unknown symbols', () => {
        expect(getTokenApy('UNKNOWN')).toBe(0);
        expect(isTokenInflationHedge('UNKNOWN')).toBe(false);
    });
});
