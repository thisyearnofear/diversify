import { describe, it, expect } from 'vitest';
import { buildSettlementPlan } from '../settlement';
import { runNetting, createIntent, computeNetObligations } from '../matching-engine';
import type { MidRateFn } from '../intent';

// Same exact test rate as matching-engine.test.ts
const testRate: MidRateFn = (base, quote) => {
    const usdPerUnit: Record<string, number> = {
        BBD: 0.5, JMD: 1 / 158, USD: 1, cUSD: 1, USDC: 1,
    };
    return (usdPerUnit[base] ?? 1) / (usdPerUnit[quote] ?? 1);
};

describe('buildSettlementPlan — Caribbean settlement on Celo', () => {
    it('produces a ledger anchor per match with FX_MATCH action', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 20000, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 1580000, 'BBD');
        const result = runNetting([a, b], testRate, 'cUSD', 1000);

        const plan = buildSettlementPlan(result);
        expect(plan.matchAnchors).toHaveLength(1);
        const anchor = plan.matchAnchors[0];
        expect(anchor.action).toBe('FX_MATCH');
        expect(anchor.user).toBe('0xTT');
        expect(anchor.targetToken).toBe('cUSD');
        expect(anchor.servingModel).toBe('fx-netting/v1');
        expect(anchor.chainId).toBe(42220); // Celo
        expect(anchor.reasoning).toContain('BBD');
        expect(anchor.reasoning).toContain('JMD');
        expect(anchor.reasoning).toContain('no USD bridge');
    });

    it('produces transfers for net obligations when settlement rate diverges', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 20000, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 1580000, 'BBD');
        const result = runNetting([a, b], testRate, 'cUSD', 1000);

        // Re-compute net obligations with a divergent settlement rate (JMD weakened)
        const settleRate: MidRateFn = (base, quote) => {
            const u: Record<string, number> = { BBD: 0.5, JMD: 1 / 158.5, cUSD: 1 };
            return (u[base] ?? 1) / (u[quote] ?? 1);
        };
        const divergentResult = {
            ...result,
            netObligations: computeNetObligations(result.matches, 'cUSD', settleRate),
        };

        const plan = buildSettlementPlan(divergentResult);
        expect(plan.transfers).toHaveLength(1);
        expect(plan.transfers[0].chainId).toBe(42220);
        expect(plan.transfers[0].settlementCurrency).toBe('cUSD');
        expect(plan.transfers[0].fromParticipant).toBe('0xTT');
        expect(plan.transfers[0].netAmount).toBeGreaterThan(0);
    });

    it('produces residual routes for unmatched intents', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 10000, 'JMD');
        const result = runNetting([a], testRate, 'cUSD', 1000);

        const plan = buildSettlementPlan(result);
        expect(plan.residuals).toHaveLength(1);
        expect(plan.residuals[0].intent.intentId).toBe('i1');
        expect(plan.residuals[0].recommendation).toContain('Unmatched');
    });

    it('summary aggregates counts and totals', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 20000, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 1580000, 'BBD');
        const result = runNetting([a, b], testRate, 'cUSD', 1000);

        const plan = buildSettlementPlan(result);
        expect(plan.summary.matchCount).toBe(1);
        expect(plan.summary.transferCount).toBe(0); // perfect match = 0
        expect(plan.summary.residualCount).toBe(0);
        expect(plan.summary.totalMatchedUsd).toBeCloseTo(10000, 0);
        expect(plan.summary.totalSavingsUsd).toBeCloseTo(700, 0);
    });
});
