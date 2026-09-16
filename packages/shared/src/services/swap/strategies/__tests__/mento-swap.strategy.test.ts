import { describe, expect, it } from 'vitest';
import { MentoSwapStrategy } from '../mento-swap.strategy';
import type { SwapParams } from '../base-swap.strategy';
import { NETWORKS } from '../../../../config';

/**
 * MentoSwapStrategy.support() must mirror what the Celo mainnet broker can
 * actually exchange. On-chain verification (getExchangeProviders ->
 * getExchanges) shows every published exchange is a USDm<->regional pair:
 * USDm, BRLm, KESm, COPm, PHPm, GHSm, XOFm, ZARm, CADm, AUDm, NGNm.
 *
 * Regression coverage for the production USDT -> KESm failure: Mento
 * correctly declined (no USDT exchange exists), but the fallback chain
 * then burned gas on a reverting LiFi route. Also covers CELO -> BRLm,
 * which the old predicate claimed but could never execute — execute()
 * used to submit an approval before discovering the missing exchange.
 */

function params(overrides: Partial<SwapParams>): SwapParams {
    return {
        fromToken: 'USDm',
        toToken: 'BRLm',
        amount: '1',
        fromChainId: NETWORKS.CELO_MAINNET.chainId,
        toChainId: NETWORKS.CELO_MAINNET.chainId,
        userAddress: '0x0000000000000000000000000000000000000001',
        ...overrides,
    };
}

describe('MentoSwapStrategy.supports', () => {
    const strategy = new MentoSwapStrategy();

    it('supports broker pairs directly (USDm -> BRLm)', () => {
        expect(strategy.supports(params({}))).toBe(true);
    });

    it('supports regional pairs routed via USDm (BRLm -> KESm)', () => {
        expect(
            strategy.supports(params({ fromToken: 'BRLm', toToken: 'KESm' })),
        ).toBe(true);
    });

    it('rejects USDT -> KESm — the broker has no USDT exchange', () => {
        expect(
            strategy.supports(params({ fromToken: 'USDT', toToken: 'KESm' })),
        ).toBe(false);
        expect(
            strategy.supports(params({ fromToken: 'KESm', toToken: 'USDT' })),
        ).toBe(false);
    });

    it('rejects CELO pairs — CELO is not a broker asset', () => {
        expect(
            strategy.supports(params({ fromToken: 'CELO', toToken: 'BRLm' })),
        ).toBe(false);
        expect(
            strategy.supports(params({ fromToken: 'USDm', toToken: 'CELO' })),
        ).toBe(false);
    });

    it('rejects EURm and other non-broker Mento-branded tokens', () => {
        for (const token of ['EURm', 'GBPm', 'JPYm', 'CHFm', 'G$']) {
            expect(
                strategy.supports(params({ fromToken: token, toToken: 'USDm' })),
            ).toBe(false);
        }
    });

    it('rejects non-Celo chains', () => {
        expect(
            strategy.supports(
                params({
                    fromChainId: NETWORKS.ARBITRUM_ONE.chainId,
                    toChainId: NETWORKS.ARBITRUM_ONE.chainId,
                }),
            ),
        ).toBe(false);
    });

    it('rejects cross-chain params', () => {
        expect(
            strategy.supports(
                params({ toChainId: NETWORKS.ARBITRUM_ONE.chainId }),
            ),
        ).toBe(false);
    });
});
