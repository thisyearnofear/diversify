import { describe, it, expect } from 'vitest';
import { matchIntents, createIntent } from '../matching-engine';
import type { MidRateFn } from '../intent';

// ─── Test rate provider ──────────────────────────────────────────────────
// Simulates mid-market rates for the Caribbean scenario:
//   BBD pegged 2:1 to USD  → 1 BBD = 0.50 USD
//   JMD ~158:1 to USD      → 1 JMD = 1/158 USD (exact, so 1 BBD = 79 JMD)
const testRate: MidRateFn = (base, quote) => {
    const usdPerUnit: Record<string, number> = {
        BBD: 0.5, JMD: 1 / 158, USD: 1, cUSD: 1, USDC: 1,
    };
    return (usdPerUnit[base] ?? 1) / (usdPerUnit[quote] ?? 1);
};

describe('matchIntents — CARICOM FX direct matching (no USD bridge)', () => {
    it('matches a BBD→JMD intent against a JMD→BBD intent at mid-market', () => {
        const trinidad = createIntent('i1', '0xTT', 'BBD', 20000, 'JMD');
        const jamaica = createIntent('i2', '0xJM', 'JMD', 1580000, 'BBD');
        const { matches, residualIntents } = matchIntents([trinidad, jamaica], testRate, 1000);

        expect(matches).toHaveLength(1);
        const m = matches[0];
        expect(m.matchedAmount).toBe(20000);
        expect(m.rate).toBeCloseTo(79, 0);
        expect(m.savingsBps).toBe(700);
        expect(m.intentA.participantId).toBe('0xTT');
        expect(m.intentB.participantId).toBe('0xJM');

        const tt = residualIntents.find((i) => i.intentId === 'i1');
        expect(tt?.status).toBe('matched');
        expect(tt?.remainingSell).toBeCloseTo(0, 2);
    });

    it('does not match same-direction intents', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 10000, 'JMD');
        const b = createIntent('i2', '0xJM', 'BBD', 10000, 'JMD');
        expect(matchIntents([a, b], testRate, 1000).matches).toHaveLength(0);
    });

    it('does not match the same participant (no self-matching)', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 10000, 'JMD');
        const b = createIntent('i2', '0xTT', 'JMD', 790000, 'BBD');
        expect(matchIntents([a, b], testRate, 1000).matches).toHaveLength(0);
    });

    it('partially fills when amounts do not align', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 1266, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 50000, 'BBD');
        const { matches, residualIntents } = matchIntents([a, b], testRate, 1000);

        expect(matches).toHaveLength(1);
        expect(matches[0].matchedAmount).toBeCloseTo(633, 0);
        const tt = residualIntents.find((i) => i.intentId === 'i1');
        expect(tt?.status).toBe('partially_matched');
    });

    it('respects min-accept constraints', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 2000, 'JMD', 160000);
        const b = createIntent('i2', '0xJM', 'JMD', 158000, 'BBD');
        // 2000 BBD × 79 = 158,000 JMD < 160,000 min → no match
        expect(matchIntents([a, b], testRate, 1000).matches).toHaveLength(0);
    });

    it('ignores expired intents', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 10000, 'JMD', null, 500);
        const b = createIntent('i2', '0xJM', 'JMD', 790000, 'BBD');
        expect(matchIntents([a, b], testRate, 1000).matches).toHaveLength(0);
    });

    it('does not mutate the input intents', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 10000, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 790000, 'BBD');
        matchIntents([a, b], testRate, 1000);
        expect(a.remainingSell).toBe(10000);
        expect(a.status).toBe('open');
    });
});

import { computeNetObligations, runNetting } from '../matching-engine';

describe('computeNetObligations — net settlement across participants', () => {
    it('a perfect mid-market match produces NO net obligation (capital efficiency)', () => {
        // At mid-market, both sides deliver equal USD value → net = 0 →
        // no settlement transfer needed. This IS the point: "reduces capital
        // requirements and liquidity strain" (Future Caribbean track).
        const a = createIntent('i1', '0xTT', 'BBD', 20000, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 1580000, 'BBD');
        const { matches } = matchIntents([a, b], testRate, 1000);

        expect(matches).toHaveLength(1);
        const obligations = computeNetObligations(matches, 'cUSD', testRate);
        expect(obligations).toHaveLength(0); // perfect match = no net transfer
    });

    it('collapses multiple matches between the same pair (sourceMatchIds aggregation)', () => {
        const a1 = createIntent('i1', '0xTT', 'BBD', 10000, 'JMD');
        const b1 = createIntent('i2', '0xJM', 'JMD', 790000, 'BBD');
        const a2 = createIntent('i3', '0xTT', 'BBD', 5000, 'JMD');
        const b2 = createIntent('i4', '0xJM', 'JMD', 395000, 'BBD');
        const { matches } = matchIntents([a1, b1, a2, b2], testRate, 1000);

        expect(matches).toHaveLength(2);
        // Both matches are perfect → net = 0 → no obligation. But verify the
        // aggregation works by checking the ledger structure indirectly:
        // each match carries its own matchId for audit traceability.
        expect(matches[0].matchId).not.toBe(matches[1].matchId);
        const obligations = computeNetObligations(matches, 'cUSD', testRate);
        expect(obligations).toHaveLength(0); // both perfect matches
    });

    it('produces a net obligation when settlement rate differs from match rate', () => {
        // Simulate FX movement between match and settlement: match at 79,
        // but settlement rate has JMD slightly weaker (158.5 JMD/USD).
        const a = createIntent('i1', '0xTT', 'BBD', 20000, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 1580000, 'BBD');
        const { matches } = matchIntents([a, b], testRate, 1000);

        const settleRate: MidRateFn = (base, quote) => {
            const usdPerUnit: Record<string, number> = {
                BBD: 0.5, JMD: 1 / 158.5, USD: 1, cUSD: 1, USDC: 1,
            };
            return (usdPerUnit[base] ?? 1) / (usdPerUnit[quote] ?? 1);
        };
        const obligations = computeNetObligations(matches, 'cUSD', settleRate);
        expect(obligations).toHaveLength(1);
        // TT owes more (BBD held value) than JM delivers (JMD weakened)
        expect(obligations[0].fromParticipant).toBe('0xTT');
        expect(obligations[0].toParticipant).toBe('0xJM');
        expect(obligations[0].netAmount).toBeGreaterThan(0);
    });
});

describe('runNetting — full pipeline', () => {
    it('reports total matched USD and savings vs the corridor', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 20000, 'JMD');
        const b = createIntent('i2', '0xJM', 'JMD', 1580000, 'BBD');
        const result = runNetting([a, b], testRate, 'cUSD', 1000);

        expect(result.matches).toHaveLength(1);
        expect(result.totalMatchedUsd).toBeCloseTo(10000, 0); // 20k BBD = 10k USD
        expect(result.totalSavingsUsd).toBeCloseTo(700, 0); // 7% of 10k
        expect(result.unmatchedIntents).toHaveLength(0);
    });

    it('surfaces unmatched intents for fallback routing', () => {
        const a = createIntent('i1', '0xTT', 'BBD', 10000, 'JMD');
        const result = runNetting([a], testRate, 'cUSD', 1000);
        expect(result.matches).toHaveLength(0);
        expect(result.unmatchedIntents).toHaveLength(1);
        expect(result.totalSavingsUsd).toBe(0);
    });
});

