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

// African test rate: 1 USD ≈ 12.5 GHS ≈ 1600 NGN, so 1 GHS ≈ 128 NGN
const africaRate: MidRateFn = (base, quote) => {
    const usdPerUnit: Record<string, number> = {
        GHS: 0.08, NGN: 0.000625, USD: 1, cUSD: 1, USDC: 1,
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

describe('buildSettlementPlan — African settlement on Celo (region-aware)', () => {
    it('produces a ledger anchor with Africa region label and Celo chain', () => {
        // Ghanaian importer needs NGN; Nigerian exporter needs GHS — direct match.
        // 50000 GHS × 128 = 6,400,000 NGN → full match
        const ghana = createIntent('i1', '0xGH', 'GHS', 50000, 'NGN');
        const nigeria = createIntent('i2', '0xNG', 'NGN', 6400000, 'GHS');
        const result = runNetting([ghana, nigeria], africaRate, 'cUSD', 1000);

        const plan = buildSettlementPlan(result);
        expect(plan.matchAnchors).toHaveLength(1);
        const anchor = plan.matchAnchors[0];
        expect(anchor.action).toBe('FX_MATCH');
        expect(anchor.user).toBe('0xGH');
        expect(anchor.targetToken).toBe('cUSD');
        expect(anchor.servingModel).toBe('fx-netting/v1');
        // Africa region → Celo (42220), same as the Caribbean default
        expect(anchor.chainId).toBe(42220);
        // Reasoning should mention Africa, not "CARICOM"
        expect(anchor.reasoning).toContain('Africa');
        expect(anchor.reasoning).toContain('GHS');
        expect(anchor.reasoning).toContain('NGN');
        expect(anchor.reasoning).toContain('no USD bridge');
        // And should NOT contain the old hardcoded "CARICOM" label
        expect(anchor.reasoning).not.toContain('CARICOM');
    });

    it('a perfect GHS↔NGN match produces no net obligation', () => {
        const ghana = createIntent('i1', '0xGH', 'GHS', 50000, 'NGN');
        const nigeria = createIntent('i2', '0xNG', 'NGN', 6400000, 'GHS');
        const result = runNetting([ghana, nigeria], africaRate, 'cUSD', 1000);

        const plan = buildSettlementPlan(result);
        expect(plan.transfers).toHaveLength(0); // perfect match = no net transfer
        expect(plan.summary.matchCount).toBe(1);
        expect(plan.summary.transferCount).toBe(0);
    });

    it('summary aggregates African match totals correctly', () => {
        const ghana = createIntent('i1', '0xGH', 'GHS', 50000, 'NGN');
        const nigeria = createIntent('i2', '0xNG', 'NGN', 6400000, 'GHS');
        const result = runNetting([ghana, nigeria], africaRate, 'cUSD', 1000);

        const plan = buildSettlementPlan(result);
        // 50000 GHS × 0.08 USD/GHS = 4000 USD
        expect(plan.summary.totalMatchedUsd).toBeCloseTo(4000, 0);
        // 7% corridor savings = 280 USD
        expect(plan.summary.totalSavingsUsd).toBeCloseTo(280, 0);
    });

    it('surfaces unmatched African intents for fallback routing', () => {
        const ghana = createIntent('i1', '0xGH', 'GHS', 10000, 'NGN');
        const result = runNetting([ghana], africaRate, 'cUSD', 1000);

        const plan = buildSettlementPlan(result);
        expect(plan.residuals).toHaveLength(1);
        expect(plan.residuals[0].intent.intentId).toBe('i1');
        expect(plan.residuals[0].recommendation).toContain('Unmatched');
    });
});
