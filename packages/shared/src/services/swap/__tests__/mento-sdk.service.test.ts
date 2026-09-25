import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    getMentoRoutableAddresses,
    isMentoPair,
    isMentoToken,
    buildMentoSwap,
    getMentoRouterAddress,
} from '../mento-sdk.service';
import { getTokenAddresses } from '../../../config';

/**
 * The routable-set functions run against the REAL SDK cache (sync, no RPC).
 * The async client (Mento.create) is stubbed — routes/quotes/tradability
 * are exercised by callers' integration paths, but buildSwapTransaction's
 * slippage conversion uses a REAL SwapService so the percent unit is
 * verified against SDK math, not a reimplementation.
 */

const CELO = 42220;
const USDM = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const KESM = '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0';
const CELO_TOKEN = '0x471ece3750da237f93b8e339c536989b8978a438';
const ROUTER = '0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6';

const state = vi.hoisted(() => ({ tradable: true }));

vi.mock('@mento-protocol/mento-sdk', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('@mento-protocol/mento-sdk')>();
    // Constants inlined — this factory is hoisted above module consts.
    const ROUTER_ADDR = '0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6';
    const USDM_ADDR = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
    // Real SwapService instance — calculateMinAmountOut is pure bigint math.
    const swapService = new actual.SwapService(
        null as never, 42220, null as never, null as never,
    );
    const fakeRoute = { id: 'route-1', tokens: [], path: [{}] };
    const fakeMento = {
        routes: { findRoute: vi.fn(async () => fakeRoute) },
        quotes: { getAmountOut: vi.fn(async () => 1_000n) },
        trading: { isRouteTradable: vi.fn(async () => state.tradable) },
        swap: {
            buildSwapTransaction: vi.fn(
                async (
                    _in: string, _out: string, _amountIn: bigint,
                    _recipient: string, _owner: string,
                    options: { slippageTolerance: number; deadline: bigint },
                    route: unknown,
                ) => {
                    const expectedAmountOut = 1_000n;
                    // Delegate to the REAL SDK conversion.
                    const amountOutMin = (
                        swapService as unknown as {
                            calculateMinAmountOut: (a: bigint, s: number) => bigint;
                        }
                    ).calculateMinAmountOut(expectedAmountOut, options.slippageTolerance);
                    return {
                        approval: { to: USDM_ADDR, data: '0x095ea7b3', value: '0' },
                        swap: {
                            params: { to: ROUTER_ADDR, data: '0x12b34c', value: '0' },
                            expectedAmountOut,
                            amountOutMin,
                            route,
                        },
                    };
                },
            ),
        },
        getContractAddress: vi.fn(() => ROUTER_ADDR),
    };
    return {
        ...actual,
        Mento: { create: vi.fn(async () => fakeMento) },
    };
});

beforeEach(() => {
    state.tradable = true;
});

describe('getMentoRoutableAddresses / isMentoPair (real SDK cache)', () => {
    const tokens = getTokenAddresses(CELO) as Record<string, string>;
    const bySymbol = (s: string) => tokens[s]!.toLowerCase();

    it('contains USDm and CHFm, not CELO', () => {
        const set = getMentoRoutableAddresses(CELO);
        expect(set.has(bySymbol('USDm'))).toBe(true);
        expect(set.has(bySymbol('CHFm'))).toBe(true);
        expect(set.has(CELO_TOKEN.toLowerCase())).toBe(false);
    });

    it('isMentoPair: true for USDm/KESm, KESm/BRLm, CHFm/USDm, EURm/NGNm', () => {
        expect(isMentoPair(CELO, tokens.USDm, tokens.KESm)).toBe(true);
        expect(isMentoPair(CELO, tokens.KESm, tokens.BRLm)).toBe(true);
        expect(isMentoPair(CELO, tokens.CHFm, tokens.USDm)).toBe(true);
        expect(isMentoPair(CELO, tokens.EURm, tokens.NGNm)).toBe(true);
    });

    it('isMentoPair: false for CELO/KESm and unknown addresses', () => {
        expect(isMentoPair(CELO, CELO_TOKEN, tokens.KESm)).toBe(false);
        expect(isMentoPair(CELO, USDM, '0x' + '00'.repeat(20))).toBe(false);
    });

    it('isMentoToken resolves by symbol through the config map', () => {
        expect(isMentoToken(CELO, 'USDm')).toBe(true);
        expect(isMentoToken(CELO, 'KESm')).toBe(true);
        expect(isMentoToken(CELO, 'CELO')).toBe(false);
    });
});

describe('buildMentoSwap', () => {
    it('passes slippagePercent through as the SDK percent unit — 0.5% of 1000 => 995', async () => {
        const built = await buildMentoSwap({
            chainId: CELO,
            tokenIn: USDM,
            tokenOut: KESM,
            amountIn: 100n,
            recipient: '0x0000000000000000000000000000000000000001',
            owner: '0x0000000000000000000000000000000000000001',
            slippagePercent: 0.5,
        });
        // Real SDK math: 1000 * (10000 - 50) / 10000 = 995
        expect(built.amountOutMin).toBe(995n);
        expect(built.swap.to).toBe(ROUTER);
        expect(built.spender).toBe(ROUTER);
        expect(built.approval?.to).toBe(USDM);
    });

    it('throws the paused error when the route circuit breaker is active', async () => {
        state.tradable = false;
        await expect(
            buildMentoSwap({
                chainId: CELO,
                tokenIn: USDM,
                tokenOut: KESM,
                amountIn: 100n,
                recipient: '0x0000000000000000000000000000000000000001',
                owner: '0x0000000000000000000000000000000000000001',
                slippagePercent: 1,
            }),
        ).rejects.toThrow('trading is currently paused');
    });
});

describe('getMentoRouterAddress', () => {
    it('returns the v3 Router on Celo mainnet', () => {
        expect(getMentoRouterAddress(CELO)).toBe(ROUTER);
    });
});
