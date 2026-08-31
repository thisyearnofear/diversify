import { describe, it, expect } from 'vitest';
import {
    canonicalChainForRegion,
    settlementCurrencyForChain,
    matchRegionOf,
    DEFAULT_SETTLEMENT_CHAIN_ID,
} from '../settlement-rails';
import { computeNetObligations } from '../matching-engine';
import { fxRegionForCurrency } from '../../fx-drag/regions';
import type { FxIntent, FxMatch } from '../intent';

describe('settlement-rails — region-canonical routing', () => {
    it('routes Africa/Caribbean/LatAm to Celo and APAC to HashKey', () => {
        expect(canonicalChainForRegion('africa')).toBe(42220);
        expect(canonicalChainForRegion('caribbean')).toBe(42220);
        expect(canonicalChainForRegion('latam')).toBe(42220);
        expect(canonicalChainForRegion('asia')).toBe(177);
    });

    it('maps each settlement chain to its verified settlement currency', () => {
        expect(settlementCurrencyForChain(42220)).toBe('cUSD');
        expect(settlementCurrencyForChain(177)).toBe('USDT');
        expect(settlementCurrencyForChain(42161)).toBe('USDC');
    });

    it('keeps the Celo default for unmapped regions', () => {
        expect(DEFAULT_SETTLEMENT_CHAIN_ID).toBe(42220);
        expect(fxRegionForCurrency('JMD')).toBe('caribbean');
        expect(fxRegionForCurrency('JPY')).toBe('asia');
    });
});

// ─── Per-region netting fixtures ─────────────────────────────────────────

const midRate = (base: string, quote: string): number => {
    // JMD↔BBD 79.5:1 (BBD pegged to USD); USD-pegged settlement = 1:1 to USD.
    const usdPer: Record<string, number> = { USD: 1, JMD: 1 / 79.5, BBD: 0.5 };
    return (usdPer[quote] ?? 1) / (usdPer[base] ?? 1);
};

function intent(
    id: string,
    participant: string,
    sellCurrency: string,
    sellAmount: number,
    buyCurrency: string,
): FxIntent {
    return {
        intentId: id,
        participantId: participant,
        sellCurrency,
        sellAmount,
        buyCurrency,
        buyAmountMin: 0,
        remainingSell: sellAmount,
        status: 'open',
        deadline: 0,
        createdAt: 0,
        matchIds: [],
    } as FxIntent;
}

function matchFrom(a: FxIntent, b: FxIntent, amount: number): FxMatch {
    return {
        matchId: `m_${a.intentId}_${b.intentId}`,
        intentA: a,
        intentB: b,
        matchedAmount: amount,
        rate: 0.5, // JMD→BBD-ish; irrelevant to the chain grouping under test
        savingsBps: 700,
        notionalUsd: 1000,
    } as FxMatch;
}

describe('computeNetObligations — per-region settlement rails', () => {
    it('nets a Caribbean pair in cUSD on Celo', () => {
        const a = intent('a1', '0xaaa', 'JMD', 79500, 'BBD');
        const b = intent('b1', '0xbbb', 'BBD', 500, 'JMD');
        const m = matchFrom(a, b, 400); // A delivers 400 JMD ≈ 5.03 USD; B 200 BBD = 100 USD → B owes A
        const obs = computeNetObligations([m], 'cUSD', midRate);
        expect(obs).toHaveLength(1);
        expect(obs[0].settlementCurrency).toBe('cUSD');
        expect(obs[0].chainId).toBe(42220);
    });

    it('nets an APAC pair in USDT on HashKey — never cUSD on Celo', () => {
        // Two APAC matches between the same pair, opposite directions → net.
        const a = intent('a2', '0xccc', 'JPY', 1000, 'KRW');
        const b = intent('b2', '0xddd', 'KRW', 1000, 'JPY');
        const m1 = matchFrom(a, b, 600);
        const m2 = matchFrom(b, a, 400);
        const obs = computeNetObligations([m1, m2], 'cUSD', () => 1);
        expect(obs).toHaveLength(1);
        expect(obs[0].settlementCurrency).toBe('USDT');
        expect(obs[0].chainId).toBe(177);
        expect(obs[0].netAmount).toBeGreaterThan(0);
    });

    it('never nets flows across different settlement chains together', () => {
        // Same participant pair, one Caribbean match + one APAC match →
        // two obligations on two chains, two currencies.
        const carib = matchFrom(
            intent('a3', '0xeee', 'JMD', 79500, 'BBD'),
            intent('b3', '0xfff', 'BBD', 500, 'JMD'),
            400,
        );
        const apac = matchFrom(
            intent('a4', '0xeee', 'JPY', 1000, 'KRW'),
            intent('b4', '0xfff', 'KRW', 1000, 'JPY'),
            400,
        );
        const obs = computeNetObligations([carib, apac], 'cUSD', () => 1);
        expect(obs).toHaveLength(2);
        const chains = obs.map((o) => o.chainId).sort((x, y) => x - y);
        expect(chains).toEqual([177, 42220]);
        expect(obs.map((o) => o.settlementCurrency).sort()).toEqual(['USDT', 'cUSD']);
    });

    it('labels cross-region matches by the sell currency region', () => {
        const a = intent('a5', '0x111', 'JMD', 100, 'KRW');
        const b = intent('b5', '0x222', 'KRW', 100, 'JMD');
        const m = matchFrom(a, b, 50);
        const { region, label } = matchRegionOf(m);
        expect(region).toBe('caribbean');
        expect(label).toContain('cross-region');
    });
});
