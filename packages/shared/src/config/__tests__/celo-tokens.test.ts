import { describe, it, expect } from 'vitest';
import {
    CELO_TOKEN_ADDRESSES,
    CELO_TOKEN_ADDRESS_BY_SYMBOL,
    getCeloTokenAddress,
    getCeloTokenMetadata,
    isKnownCeloToken,
} from '../celo-tokens';

const EXPECTED_SYMBOLS = ['CELO', 'cUSD', 'cEUR', 'cREAL', 'KESm', 'COPm', 'PHPm'] as const;

describe('CELO_TOKEN_ADDRESSES', () => {
    it('contains the seven known Celo tokens', () => {
        for (const symbol of EXPECTED_SYMBOLS) {
            expect(CELO_TOKEN_ADDRESSES[symbol]).toBeDefined();
        }
    });

    it('every address is a 0x-prefixed 40 hex chars', () => {
        for (const [symbol, meta] of Object.entries(CELO_TOKEN_ADDRESSES)) {
            expect(meta.address, symbol).toMatch(/^0x[0-9a-fA-F]{40}$/);
        }
    });

    it('every token uses 18 decimals (matches Celo convention)', () => {
        for (const [symbol, meta] of Object.entries(CELO_TOKEN_ADDRESSES)) {
            expect(meta.decimals, symbol).toBe(18);
        }
    });

    it('flags every stablecoin as stable and the native CELO as not', () => {
        expect(CELO_TOKEN_ADDRESSES.CELO.stablecoin).toBe(false);
        for (const symbol of EXPECTED_SYMBOLS) {
            if (symbol === 'CELO') continue;
            expect(CELO_TOKEN_ADDRESSES[symbol].stablecoin, symbol).toBe(true);
        }
    });
});

describe('CELO_TOKEN_ADDRESS_BY_SYMBOL', () => {
    it('mirrors the metadata map one-to-one', () => {
        for (const [symbol, meta] of Object.entries(CELO_TOKEN_ADDRESSES)) {
            expect(CELO_TOKEN_ADDRESS_BY_SYMBOL[symbol]).toBe(meta.address);
        }
    });
});

describe('getCeloTokenAddress', () => {
    it('returns the address for a known symbol', () => {
        expect(getCeloTokenAddress('cUSD')).toBe('0x765DE816845861e75A25fCA122bb6898B8B1282a');
        expect(getCeloTokenAddress('cEUR')).toBe('0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73');
    });

    it('returns null for an unknown symbol', () => {
        expect(getCeloTokenAddress('USDY')).toBeNull();
        expect(getCeloTokenAddress('not-a-real-symbol')).toBeNull();
    });

    it('returns null for null / undefined / empty input', () => {
        expect(getCeloTokenAddress(null)).toBeNull();
        expect(getCeloTokenAddress(undefined)).toBeNull();
        expect(getCeloTokenAddress('')).toBeNull();
    });
});

describe('getCeloTokenMetadata', () => {
    it('returns the full metadata for a known symbol', () => {
        const meta = getCeloTokenMetadata('cUSD');
        expect(meta).not.toBeNull();
        expect(meta!.region).toBe('US');
        expect(meta!.decimals).toBe(18);
    });

    it('returns null for an unknown symbol', () => {
        expect(getCeloTokenMetadata('UNKNOWN')).toBeNull();
    });
});

describe('isKnownCeloToken', () => {
    it('returns true for known symbols', () => {
        expect(isKnownCeloToken('cUSD')).toBe(true);
        expect(isKnownCeloToken('cEUR')).toBe(true);
        expect(isKnownCeloToken('CELO')).toBe(true);
    });

    it('returns false for unknown symbols (and does not crash on prototype-pollution attempts)', () => {
        expect(isKnownCeloToken('USDY')).toBe(false);
        expect(isKnownCeloToken('__proto__')).toBe(false);
        expect(isKnownCeloToken('toString')).toBe(false);
        expect(isKnownCeloToken('hasOwnProperty')).toBe(false);
    });

    it('returns false for null / undefined / empty input', () => {
        expect(isKnownCeloToken(null)).toBe(false);
        expect(isKnownCeloToken(undefined)).toBe(false);
        expect(isKnownCeloToken('')).toBe(false);
    });
});
