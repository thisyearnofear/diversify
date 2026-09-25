import { describe, expect, it, vi } from 'vitest';
import type { SwapParams, SwapResult, SwapCallbacks } from '../strategies/base-swap.strategy';

/**
 * Regression coverage for the production USDT -> KESm failure on Celo:
 * LiFi submitted a transaction that reverted on-chain (gas spent), then
 * the orchestrator fell through to 1inch (unsupported on Celo) and
 * Uniswap (no pool) — i.e. the user could have been asked to sign MORE
 * transactions after an on-chain failure. Fallback is only safe before
 * anything is submitted; after that, surface the failure.
 *
 * All strategy modules are mocked — SwapOrchestratorService instantiates
 * them statically and several constructors touch browser globals.
 */

const executeCalls: string[] = [];

function makeStrategy(
    name: string,
    opts: {
        supports?: boolean | ((p: SwapParams) => boolean);
        execute?: (p: SwapParams, callbacks?: SwapCallbacks) => Promise<SwapResult>;
        estimate?: (p: SwapParams) => Promise<never>;
    } = {},
) {
    return class {
        getName() {
            return name;
        }
        supports(p: SwapParams) {
            return typeof opts.supports === 'function'
                ? opts.supports(p)
                : (opts.supports ?? false);
        }
        async execute(p: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
            executeCalls.push(name);
            return (
                opts.execute?.(p, callbacks) ?? {
                    success: false,
                    error: `${name} unavailable`,
                }
            );
        }
        async getEstimate(p: SwapParams) {
            if (opts.estimate) return opts.estimate(p);
            throw new Error(`${name} estimate unavailable`);
        }
        async validate() {
            return true;
        }
    };
}

// The two strategies relevant to the failure chain. LiFi supports the
// pair; its execute simulates a submitted-then-reverted swap. OneInch
// also claims support — it must never be reached once LiFi has put a
// transaction on-chain.
vi.mock('../strategies/lifi-swap.strategy', () => ({
    LiFiSwapStrategy: makeStrategy('LiFiSwapStrategy', {
        supports: (p) => p.fromToken !== 'CELO' && p.toToken !== 'CELO',
        execute: async (p, callbacks) => {
            // Only the USDT pair reaches on-chain submission — everything
            // else fails at quote stage so fallback remains available.
            if (p.fromToken === 'USDT') {
                callbacks?.onSwapSubmitted?.('0xreverted');
                return { success: false, error: 'Transaction was reverted.' };
            }
            return { success: false, error: 'No swap routes found' };
        },
    }),
}));

vi.mock('../strategies/oneinch-swap.strategy', () => ({
    OneInchSwapStrategy: makeStrategy('OneInchSwapStrategy', {
        // 1inch has no Celo coverage — it can never rescue a CELO pair.
        supports: (p) => p.fromToken !== 'CELO' && p.toToken !== 'CELO',
        // Only rescues USDm pairs — the market-closed test (EURm) needs a
        // venue where every strategy fails.
        execute: async (p) =>
            p.fromToken === 'USDm'
                ? { success: true, txHash: '0xoneinch' }
                : { success: false, error: 'No route found for this pair' },
        // A generic no-route estimate — the market-closed tests prove the
        // closed venue outranks this weaker signal.
        estimate: async () => {
            throw new Error('No route found for this pair');
        },
    }),
}));

// Mento claims the EURm pair — its failures are the market-closed signal.
vi.mock('../strategies/mento-swap.strategy', () => ({
    MentoSwapStrategy: makeStrategy('MentoSwapStrategy', {
        supports: (p) => p.fromToken === 'EURm',
        execute: async () => ({
            success: false,
            error: 'Mento FX market is closed — quotes resume when FX markets reopen.',
        }),
        estimate: async () => {
            throw new Error('Mento FX market is closed — quotes resume when FX markets reopen.');
        },
    }),
}));
vi.mock('../strategies/emerging-markets.strategy', () => ({
    EmergingMarketsStrategy: makeStrategy('EmergingMarketsStrategy'),
}));
vi.mock('../strategies/curve-arc.strategy', () => ({
    CurveArcStrategy: makeStrategy('CurveArcStrategy'),
}));
vi.mock('../strategies/arc-testnet.strategy', () => ({
    ArcTestnetStrategy: makeStrategy('ArcTestnetStrategy'),
}));
vi.mock('../strategies/hyperliquid-perp.strategy', () => ({
    HyperliquidPerpStrategy: makeStrategy('HyperliquidPerpStrategy'),
}));
vi.mock('../strategies/uniswap-v3.strategy', () => ({
    UniswapV3Strategy: makeStrategy('UniswapV3Strategy', {
        supports: true,
        execute: async (p) =>
            p.fromToken === 'CELO'
                ? {
                      success: false,
                      error: 'Not enough liquidity for CELO/KESm on Uniswap V3 at this size (price impact 22.1%)',
                  }
                : { success: false, error: 'No Uniswap V3 pool found' },
    }),
}));
vi.mock('../strategies/gmx-gm-deposit.strategy', () => ({
    GmxGmDepositStrategy: makeStrategy('GmxGmDepositStrategy'),
}));
vi.mock('../strategies/lifi-earn.strategy', () => ({
    LiFiEarnStrategy: makeStrategy('LiFiEarnStrategy'),
}));
vi.mock('../strategies/lifi-bridge.strategy', () => ({
    LiFiBridgeStrategy: makeStrategy('LiFiBridgeStrategy'),
}));
const { SwapOrchestratorService } = await import('../swap-orchestrator.service');

const params: SwapParams = {
    fromToken: 'USDT',
    toToken: 'KESm',
    amount: '0.1',
    fromChainId: 42220,
    toChainId: 42220,
    userAddress: '0x0000000000000000000000000000000000000001',
};

describe('SwapOrchestratorService.executeSwap fallback safety', () => {
    it('does not try further strategies after a transaction was submitted on-chain', async () => {
        executeCalls.length = 0;

        const result = await SwapOrchestratorService.executeSwap(params);

        expect(result.success).toBe(false);
        // LiFi ran and its tx reverted; OneInch/Uniswap must NOT be tried
        expect(executeCalls).toEqual(['LiFiSwapStrategy']);
        expect(result.error).not.toContain('contact support');
    });

    it('still falls back when a strategy fails before submitting anything', async () => {
        executeCalls.length = 0;

        // USDm pair: LiFi fails at quote stage (no tx submitted), so the
        // orchestrator must keep walking — OneInch's mocked execute
        // succeeds and returns its tx hash.
        const cleanParams = { ...params, fromToken: 'USDm', toToken: 'BRLm' };
        const result = await SwapOrchestratorService.executeSwap(cleanParams);

        expect(result.success).toBe(true);
        expect(result.txHash).toBe('0xoneinch');
        expect(executeCalls).toContain('LiFiSwapStrategy');
        expect(executeCalls).toContain('OneInchSwapStrategy');
    });

    it('classifies a "Not enough liquidity" failure as no-route so the ticket offers recovery', async () => {
        executeCalls.length = 0;

        const result = await SwapOrchestratorService.executeSwap({
            ...params,
            fromToken: 'CELO',
            toToken: 'KESm',
        });

        expect(result.success).toBe(false);
        expect(result.errorClass).toBe('no-route');
        // no-route keeps the strategy-specific reason rather than the
        // generic "contact support" fallback.
        expect(result.error).toContain('Not enough liquidity');
    });

    it('surfaces market_closed verbatim when every strategy fails and Mento reported a closed venue', async () => {
        executeCalls.length = 0;

        const result = await SwapOrchestratorService.executeSwap({
            ...params,
            fromToken: 'EURm',
            toToken: 'USDm',
        });

        expect(result.success).toBe(false);
        // Mento reported market-closed; the other strategies' generic
        // no-route errors must not bury it.
        expect(result.errorClass).toBe('market_closed');
        expect(result.error).toContain('FX market is closed');
    });
});

describe('SwapOrchestratorService.getEstimate market-closed precedence', () => {
    it('a market_closed failure outranks generic no-route from other strategies', async () => {
        // EURm -> USDm: Mento estimate throws market-closed, OneInch throws
        // a generic no-route — the closed venue is the honest answer.
        await expect(
            SwapOrchestratorService.getEstimate({
                ...params,
                fromToken: 'EURm',
                toToken: 'USDm',
            })
        ).rejects.toMatchObject({
            message: expect.stringContaining('FX market is closed'),
            errorClass: 'market_closed',
        });
    });

    it('without a market-closed signal the generic classification still applies', async () => {
        // USDT pair: Mento doesn't support it, every estimate fails
        // generically — no market-closed anywhere to surface.
        await expect(
            SwapOrchestratorService.getEstimate({
                ...params,
                fromToken: 'USDT',
                toToken: 'KESm',
            })
        ).rejects.toMatchObject({ errorClass: 'error' });
    });
});

describe('SwapOrchestratorService route reporting', () => {
    it('routes CELO -> KESm on Celo via Uniswap V3 (CELO token preference outranks LiFi)', () => {
        const provider = SwapOrchestratorService.getRouteProvider({
            ...params,
            fromToken: 'CELO',
            toToken: 'KESm',
        });
        expect(provider).toBe('Uniswap V3');
    });

    it('counts an approval for a CELO-source Uniswap route — CELO is an ERC-20 on Celo', async () => {
        const confirmations = await SwapOrchestratorService.estimateConfirmations({
            ...params,
            fromToken: 'CELO',
            toToken: 'USDm',
        });
        // 1 swap + 1 approval
        expect(confirmations).toBe(2);
    });
});
