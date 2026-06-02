import { describe, expect, it } from 'vitest';
import type { TokenBalance } from '@/hooks/use-multichain-balances';
import {
    isTrackedAsset,
    classifyAssets,
    getPeerBracket,
} from '../asset-classification';
// Note: TokenBalance type only — no need to re-import the config probe here.

const makeToken = (overrides: Partial<TokenBalance>): TokenBalance => ({
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '100',
    formattedBalance: '100.00',
    value: 100,
    region: 'USA' as any,
    chainId: 42220,
    chainName: 'Celo',
    ...overrides,
});

describe('isTrackedAsset', () => {
    it('returns true for Mento regional stables', () => {
        expect(isTrackedAsset('USDm')).toBe(true);
        expect(isTrackedAsset('EURm')).toBe(true);
        expect(isTrackedAsset('BRLm')).toBe(true);
        expect(isTrackedAsset('KESm')).toBe(true);
    });

    it('returns true for global stables and RWAs', () => {
        expect(isTrackedAsset('USDC')).toBe(true);
        expect(isTrackedAsset('USDT')).toBe(true);
        expect(isTrackedAsset('PAXG')).toBe(true);
        expect(isTrackedAsset('USDY')).toBe(true);
        expect(isTrackedAsset('G$')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isTrackedAsset('usdc')).toBe(true);
        expect(isTrackedAsset('UsdM')).toBe(true);
    });

    it('returns false for native volatile tokens', () => {
        expect(isTrackedAsset('CELO')).toBe(false);
        expect(isTrackedAsset('ETH')).toBe(true); // ETH IS in TOKEN_METADATA as a quote token
        expect(isTrackedAsset('WETH')).toBe(false);
        expect(isTrackedAsset('WBTC')).toBe(false);
    });

    it('returns false for unknown tokens', () => {
        expect(isTrackedAsset('RANDOM')).toBe(false);
        expect(isTrackedAsset('SCAMCOIN')).toBe(false);
    });
});

describe('classifyAssets', () => {
    it('splits mixed tokens into tracked and other with correct sums', () => {
        const tokens: TokenBalance[] = [
            makeToken({ symbol: 'USDC', value: 500 }),
            makeToken({ symbol: 'USDm', value: 300 }),
            makeToken({ symbol: 'CELO', value: 1000 }),
            makeToken({ symbol: 'USDT', value: 200 }),
        ];
        const result = classifyAssets(tokens);

        expect(result.tracked).toHaveLength(3);
        expect(result.other).toHaveLength(1);
        expect(result.other[0].symbol).toBe('CELO');
        expect(result.trackedValue).toBe(1000);
        expect(result.otherValue).toBe(1000);
        expect(result.totalValue).toBe(2000);
    });

    it('handles an all-tracked portfolio', () => {
        const tokens: TokenBalance[] = [
            makeToken({ symbol: 'USDC', value: 100 }),
            makeToken({ symbol: 'PAXG', value: 50 }),
        ];
        const result = classifyAssets(tokens);

        expect(result.tracked).toHaveLength(2);
        expect(result.other).toHaveLength(0);
        expect(result.trackedValue).toBe(150);
        expect(result.otherValue).toBe(0);
        expect(result.totalValue).toBe(150);
    });

    it('handles an all-other portfolio (the CELO-only edge case)', () => {
        const tokens: TokenBalance[] = [
            makeToken({ symbol: 'CELO', value: 5000 }),
            makeToken({ symbol: 'WETH', value: 240 }),
        ];
        const result = classifyAssets(tokens);

        expect(result.tracked).toHaveLength(0);
        expect(result.other).toHaveLength(2);
        expect(result.trackedValue).toBe(0);
        expect(result.otherValue).toBe(5240);
        expect(result.totalValue).toBe(5240);
    });

    it('handles an empty list', () => {
        const result = classifyAssets([]);

        expect(result.tracked).toHaveLength(0);
        expect(result.other).toHaveLength(0);
        expect(result.totalValue).toBe(0);
    });
});

describe('getPeerBracket', () => {
    it('returns the top 10% bracket for very high stable ratios', () => {
        const b = getPeerBracket(0.9);
        expect(b).not.toBeNull();
        expect(b!.label).toContain('top 10%');
        expect(b!.percentile).toBe(90);
    });

    it('returns the top 30% bracket for ratios between 0.5 and 0.75', () => {
        const b = getPeerBracket(0.6);
        expect(b).not.toBeNull();
        expect(b!.label).toContain('top 30%');
        expect(b!.percentile).toBe(70);
    });

    it('returns the above-average bracket for ratios between 0.25 and 0.5', () => {
        const b = getPeerBracket(0.35);
        expect(b).not.toBeNull();
        expect(b!.label).toBe('above average');
    });

    it('returns the bottom bracket for ratios below 0.25', () => {
        const b = getPeerBracket(0.1);
        expect(b).not.toBeNull();
        expect(b!.label).toContain('most users are ahead of you');
    });

    it('returns the bottom bracket for 0% ratio (no stables at all)', () => {
        const b = getPeerBracket(0);
        expect(b).not.toBeNull();
        expect(b!.label).toContain('most users are ahead of you');
    });

    it('handles boundary values correctly', () => {
        expect(getPeerBracket(0.75)!.label).toContain('top 10%');
        expect(getPeerBracket(0.5)!.label).toContain('top 30%');
        expect(getPeerBracket(0.25)!.label).toBe('above average');
    });

    it('returns null for invalid ratios', () => {
        expect(getPeerBracket(NaN)).toBeNull();
        expect(getPeerBracket(-0.1)).toBeNull();
    });
});
