import { describe, expect, it } from 'vitest';
import { OneInchSwapStrategy } from '../oneinch-swap.strategy';
import { UniswapV3Strategy } from '../uniswap-v3.strategy';
import type { SwapParams } from '../base-swap.strategy';
import { NETWORKS } from '../../../../config';

/**
 * Regression coverage for the production failure where a wallet on
 * Ethereum mainnet (chainId 1) executed a swap carrying Celo token
 * addresses: 1inch answered UNKNOWN_TOKEN and the Uniswap fallback
 * died on "No RPC URL configured for chain ID 1". Both strategies
 * claimed chain 1 because the *protocols* support it — but the app has
 * no Ethereum token map or RPC, so supports() must be gated by the
 * app-level supported-chain contract.
 */

function sameChainParams(chainId: number): SwapParams {
    return {
        fromToken: 'USDm',
        toToken: 'CELO',
        amount: '1',
        fromChainId: chainId,
        toChainId: chainId,
        userAddress: '0x0000000000000000000000000000000000000001',
    };
}

describe('swap strategy chain gating', () => {
    describe('OneInchSwapStrategy', () => {
        const strategy = new OneInchSwapStrategy();

        it('rejects Ethereum mainnet despite 1inch protocol support', () => {
            expect(strategy.supports(sameChainParams(1))).toBe(false);
        });

        it('rejects other unconfigured chains 1inch supports', () => {
            for (const chainId of [56, 137, 43114, 10, 8453]) {
                expect(strategy.supports(sameChainParams(chainId))).toBe(false);
            }
        });

        it('rejects Celo — the 1inch API does not support chain 42220', () => {
            // Production regression: a USDT→KESm fallback hit
            // "Unsupported chain id: 42220" (404). The provider gate must
            // reflect the API's real chain list, not the app's.
            expect(
                strategy.supports(sameChainParams(NETWORKS.CELO_MAINNET.chainId)),
            ).toBe(false);
            expect(
                strategy.supports(sameChainParams(NETWORKS.ARBITRUM_ONE.chainId)),
            ).toBe(true);
        });

        it('rejects cross-chain params', () => {
            const params = sameChainParams(NETWORKS.CELO_MAINNET.chainId);
            params.toChainId = NETWORKS.ARBITRUM_ONE.chainId;
            expect(strategy.supports(params)).toBe(false);
        });
    });

    describe('UniswapV3Strategy', () => {
        const strategy = new UniswapV3Strategy();

        it('rejects Ethereum mainnet despite a configured router address', () => {
            expect(strategy.supports(sameChainParams(1))).toBe(false);
        });

        it('rejects other unconfigured chains with routers', () => {
            for (const chainId of [137, 10, 8453]) {
                expect(strategy.supports(sameChainParams(chainId))).toBe(false);
            }
        });

        it('still supports Celo and Arbitrum same-chain swaps', () => {
            expect(
                strategy.supports(sameChainParams(NETWORKS.CELO_MAINNET.chainId)),
            ).toBe(true);
            expect(
                strategy.supports(sameChainParams(NETWORKS.ARBITRUM_ONE.chainId)),
            ).toBe(true);
        });
    });
});
