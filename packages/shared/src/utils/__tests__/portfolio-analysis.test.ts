import { describe, it, expect } from 'vitest';
import { analyzePortfolio } from '../portfolio-analysis';
import type { ChainBalance } from '../../types/portfolio';
import type { RegionalInflationData } from '../../types/inflation';
import { REGIONS } from '../../config/index';

const inflationData: Record<string, RegionalInflationData> = Object.fromEntries(
    ['USA', 'Europe', 'Asia', 'Africa', 'LatAm', 'Global', 'Commodities'].map((r) => [
        r,
        { region: r, countries: [], avgRate: 3, stablecoins: [] },
    ]),
);

function balance(symbol: string, value: number, region: string) {
    return {
        symbol,
        name: symbol,
        balance: String(value),
        formattedBalance: String(value),
        value,
        region: region as never,
        chainId: 42220,
        chainName: 'Celo',
    };
}

describe('analyzePortfolio — token casing', () => {
    it('keeps canonical mixed-case symbols and resolves Mento regions', () => {
        const chain: ChainBalance = {
            chainId: 42220,
            chainName: 'Celo',
            totalValue: 1000,
            tokenCount: 3,
            isLoading: false,
            error: null,
            balances: [
                balance('KESm', 600, REGIONS.AFRICA),
                balance('USDm', 300, REGIONS.USA),
                balance('PAXG', 100, REGIONS.COMMODITIES),
            ],
        };
        const analysis = analyzePortfolio(
            { chains: [chain], totalValue: 1000 },
            inflationData,
            'geographic_diversification',
        );

        const regions = analysis.regionalExposure.map((r) => r.region).sort();
        expect(regions).toEqual([REGIONS.AFRICA, REGIONS.COMMODITIES, REGIONS.USA].sort());
        expect(regions).not.toContain(REGIONS.GLOBAL);

        const symbols = analysis.tokens.map((t) => t.symbol);
        expect(symbols).toContain('KESm');
        expect(symbols).toContain('USDm');
        expect(symbols).not.toContain('KESM');
        expect(symbols).not.toContain('USDM');

        const africa = analysis.regionalExposure.find((r) => r.region === REGIONS.AFRICA);
        expect(africa?.tokens).toContain('KESm');
        expect(africa?.percentage).toBeCloseTo(60);
    });
});
