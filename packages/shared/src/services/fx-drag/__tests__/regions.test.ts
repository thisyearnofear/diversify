import { describe, it, expect } from 'vitest';
import { fxRegionForCurrency } from '../regions';

describe('fxRegionForCurrency — anchor "follows the money"', () => {
    it('maps African importer currencies to the Africa rail (Celo)', () => {
        for (const c of ['GHS', 'KES', 'NGN', 'ZAR', 'EGP']) {
            expect(fxRegionForCurrency(c)).toBe('africa');
        }
    });

    it('maps APAC currencies to the Asia rail (HashKey)', () => {
        for (const c of ['PHP', 'VND', 'IDR', 'THB', 'INR', 'JPY', 'SGD']) {
            expect(fxRegionForCurrency(c)).toBe('asia');
        }
    });

    it('maps LatAm currencies to the LatAm rail', () => {
        for (const c of ['ARS', 'BRL', 'COP', 'MXN']) {
            expect(fxRegionForCurrency(c)).toBe('latam');
        }
    });

    it('is case/whitespace-insensitive and defaults reserve/unknown to other', () => {
        expect(fxRegionForCurrency(' ghs ')).toBe('africa');
        expect(fxRegionForCurrency('usd')).toBe('other');
        expect(fxRegionForCurrency('EUR')).toBe('other');
        expect(fxRegionForCurrency('')).toBe('other');
    });
});
