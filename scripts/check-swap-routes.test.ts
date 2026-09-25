/**
 * check-swap-routes market-closed handling — FX market closure (weekends,
 * holidays) is expected venue behaviour, not a routing regression, so
 * Mento-expected pairs print MARKET-CLOSED instead of FAIL/WRONG PROVIDER.
 */

import { describe, it, expect, vi } from 'vitest';

// The script instantiates the orchestrator (all strategies) at import —
// stub it plus quoteMento so the predicate test stays a unit test.
vi.mock('../packages/shared/src/services/swap/swap-orchestrator.service', () => ({
    SwapOrchestratorService: {},
}));
vi.mock('../packages/shared/src/services/swap/mento-sdk.service', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../packages/shared/src/services/swap/mento-sdk.service')>();
    return { ...actual, quoteMento: vi.fn() };
});

const { isExpectedMarketClosure } = await import('./check-swap-routes');
import type { PairCheck } from './check-swap-routes';

const mentoPair: PairCheck = {
    fromToken: 'USDm',
    toToken: 'KESm',
    amount: '10',
    expectRoute: true,
    expectProvider: 'Mento',
};
const uniswapPair: PairCheck = {
    fromToken: 'CELO',
    toToken: 'USDm',
    amount: '10',
    expectRoute: true,
    expectProvider: 'Uniswap V3',
};

describe('isExpectedMarketClosure', () => {
    it('a Mento-expected pair failing errorClass market_closed counts as expected', () => {
        expect(
            isExpectedMarketClosure(mentoPair, 'market_closed', 'anything'),
        ).toBe(true);
    });

    it('raw Mento market-closed messages count even without the class', () => {
        expect(
            isExpectedMarketClosure(
                mentoPair,
                'error',
                'FX market is currently closed. Swap quotes are unavailable until the market reopens.',
            ),
        ).toBe(true);
        expect(
            isExpectedMarketClosure(mentoPair, undefined, 'execution reverted: No Valid Median'),
        ).toBe(true);
    });

    it('a Mento pair failing for another reason is still a real failure', () => {
        expect(
            isExpectedMarketClosure(mentoPair, 'no-route', 'No Uniswap V3 pool found'),
        ).toBe(false);
    });

    it('market closure never excuses a non-Mento pair', () => {
        expect(
            isExpectedMarketClosure(uniswapPair, 'market_closed', 'FX market is closed'),
        ).toBe(false);
    });
});
