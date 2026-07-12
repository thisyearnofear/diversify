import { describe, it, expect } from 'vitest';
import { analyzeCycles, requiredDates, type DragInput } from '../calc';
import { buildServerlessRateProvider } from '../rates-serverless';

// Deterministic, offline: seed the rate provider so no network is touched.
const input: DragInput = {
    currency: 'GHS',
    cycles: [
        {
            label: 'cycle-1',
            revenues: [
                { date: '2025-01-10', amountLocal: 300_000 },
                { date: '2025-02-05', amountLocal: 300_000 },
            ],
            payment: { date: '2025-02-28', amountUsd: 40_000, achievedRate: 15.6, feesLocal: 4_000 },
        },
    ],
};

const seed = {
    '2025-01-10': { ghs: 14.8 },
    '2025-02-05': { ghs: 15.1 },
    '2025-02-28': { ghs: 15.3 },
};

describe('FX drag product math (seeded, offline)', () => {
    it('computes a decomposed drag summary the report can render', async () => {
        const dates = requiredDates(input);
        expect(dates).toEqual(['2025-01-10', '2025-02-05', '2025-02-28']);

        const provider = await buildServerlessRateProvider('GHS', dates, seed);
        const summary = analyzeCycles(input, provider.getRate);

        expect(summary.cycles).toHaveLength(1);
        const c = summary.cycles[0];
        // Actual cost = 40_000 * 15.6 + 4_000 fees.
        expect(c.actualLocalCost).toBeCloseTo(40_000 * 15.6 + 4_000, 2);
        // Spread = (achieved - midAtPayment) * usd = (15.6 - 15.3) * 40_000.
        expect(c.decomposition.spreadLocal).toBeCloseTo((15.6 - 15.3) * 40_000, 2);
        // timing + spread + fees === total drag (identity the decomposition must satisfy).
        expect(c.decomposition.timingLocal + c.decomposition.spreadLocal + c.decomposition.feesLocal)
            .toBeCloseTo(c.dragLocal, 6);
        // Cedi weakened over the window → positive timing drag.
        expect(c.decomposition.timingLocal).toBeGreaterThan(0);
        expect(summary.totalDragLocal).toBeCloseTo(c.dragLocal, 6);
    });

    it('is deterministic for the same seeded inputs', async () => {
        const dates = requiredDates(input);
        const p1 = await buildServerlessRateProvider('GHS', dates, seed);
        const p2 = await buildServerlessRateProvider('GHS', dates, seed);
        expect(analyzeCycles(input, p1.getRate)).toEqual(analyzeCycles(input, p2.getRate));
    });
});
