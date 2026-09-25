import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { MentoSwapStrategy } from '../mento-swap.strategy';
import type { SwapParams } from '../base-swap.strategy';
import { NETWORKS } from '../../../../config';

/**
 * supports() resolves against the REAL SDK cached route set (sync, no RPC)
 * — per the v3 migration the Mento Router handles multi-hop in one tx, so
 * pairs like KESm/BRLm and USDT/KESm that the legacy broker couldn't quote
 * directly are now supported.
 *
 * getEstimate/execute go through the async service functions — those are
 * mocked at the module boundary, along with the chain read provider.
 */

const mocks = vi.hoisted(() => ({
    quoteMento: vi.fn(),
    buildMentoSwap: vi.fn(),
    provider: {
        getGasPrice: vi.fn(async () => ethers.BigNumber.from('5000000000')),
        waitForTransaction: vi.fn(async () => ({
            status: 1,
            gasUsed: ethers.BigNumber.from('21000'),
        })),
    },
}));

vi.mock('../../mento-sdk.service', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../mento-sdk.service')>();
    return {
        ...actual,
        quoteMento: mocks.quoteMento,
        buildMentoSwap: mocks.buildMentoSwap,
    };
});

vi.mock('../../provider-factory.service', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../provider-factory.service')>();
    return {
        ...actual,
        ProviderFactoryService: {
            ...actual.ProviderFactoryService,
            getProvider: vi.fn(() => mocks.provider),
        },
    };
});

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

describe('MentoSwapStrategy.supports (real cached route set)', () => {
    const strategy = new MentoSwapStrategy();

    it('supports direct Mento pairs (USDm -> KESm, KESm -> BRLm)', () => {
        expect(strategy.supports(params({ fromToken: 'USDm', toToken: 'KESm' }))).toBe(true);
        expect(strategy.supports(params({ fromToken: 'KESm', toToken: 'BRLm' }))).toBe(true);
    });

    it('supports pools the legacy broker could not reach (CHFm -> USDm)', () => {
        expect(strategy.supports(params({ fromToken: 'CHFm', toToken: 'USDm' }))).toBe(true);
    });

    it('supports multi-hop Mento pairs (EURm -> NGNm, USDT -> KESm)', () => {
        expect(strategy.supports(params({ fromToken: 'EURm', toToken: 'NGNm' }))).toBe(true);
        expect(strategy.supports(params({ fromToken: 'USDT', toToken: 'KESm' }))).toBe(true);
    });

    it('rejects CELO pairs — CELO is not a Mento asset', () => {
        expect(strategy.supports(params({ fromToken: 'CELO', toToken: 'KESm' }))).toBe(false);
        expect(strategy.supports(params({ fromToken: 'USDm', toToken: 'CELO' }))).toBe(false);
    });

    it('rejects non-Celo chains and cross-chain params', () => {
        expect(
            strategy.supports(
                params({
                    fromChainId: NETWORKS.ARBITRUM_ONE.chainId,
                    toChainId: NETWORKS.ARBITRUM_ONE.chainId,
                }),
            ),
        ).toBe(false);
        expect(
            strategy.supports(params({ toChainId: NETWORKS.ARBITRUM_ONE.chainId })),
        ).toBe(false);
    });
});

describe('MentoSwapStrategy.getEstimate', () => {
    const strategy = new MentoSwapStrategy();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the SDK quote with route cost as priceImpact', async () => {
        mocks.quoteMento.mockResolvedValue({
            amountOut: 2_000_000_000_000_000_000n,
            hops: 1,
            costPercent: 0.4,
        });
        const est = await strategy.getEstimate(
            params({ fromToken: 'USDm', toToken: 'KESm', amount: '1' }),
        );
        expect(est.expectedOutput).toBe('2.0');
        expect(est.priceImpact).toBe(0.4);
    });
});

describe('MentoSwapStrategy.execute', () => {
    const strategy = new MentoSwapStrategy();
    const ROUTER = '0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6';

    function signer() {
        const sent: { to: string; data: string; type?: number }[] = [];
        const sign = {
            getAddress: vi.fn(async () => '0x0000000000000000000000000000000000000001'),
            sendTransaction: vi.fn(async (tx: { to: string; data: string; type?: number }) => {
                sent.push(tx);
                return { hash: `0xhash${sent.length}` };
            }),
        };
        return { sign, sent };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.provider.waitForTransaction.mockResolvedValue({
            status: 1,
            gasUsed: ethers.BigNumber.from('21000'),
        });
    });

    it('sends approval first, waits, then the swap — callbacks in order', async () => {
        mocks.buildMentoSwap.mockResolvedValue({
            approval: { to: '0x765DE816845861e75A25fCA122bb6898B8B1282a', data: '0x095ea7b3aa', value: '0' },
            swap: { to: ROUTER, data: '0x12b34c', value: '0' },
            expectedAmountOut: 2_000_000_000_000_000_000n,
            amountOutMin: 1_990_000_000_000_000_000n,
            hops: 1,
            spender: ROUTER,
            route: {},
        });

        const { sign, sent } = signer();
        const calls: string[] = [];
        const result = await strategy.execute(
            params({ fromToken: 'USDm', toToken: 'KESm', amount: '1', signer: sign as never }),
            {
                onApprovalSubmitted: () => calls.push('approval-submitted'),
                onApprovalConfirmed: () => calls.push('approval-confirmed'),
                onSwapSubmitted: () => calls.push('swap-submitted'),
            },
        );

        expect(result.success).toBe(true);
        expect(sent).toHaveLength(2);
        expect(sent[0].data.startsWith('0x095ea7b3')).toBe(true); // approve first
        expect(sent[1].to).toBe(ROUTER); // then the swap to the Router
        // Celo txs stay legacy type-0 with explicit gasPrice
        expect(sent[0].type).toBe(0);
        expect(sent[1].type).toBe(0);
        expect(calls).toEqual(['approval-submitted', 'approval-confirmed', 'swap-submitted']);
        expect(result.amountOut).toBe('2.0');
        expect(result.approvalTxHash).toBe('0xhash1');
    });

    it('skips approval when the SDK returns null — multi-hop is one tx', async () => {
        mocks.buildMentoSwap.mockResolvedValue({
            approval: null,
            swap: { to: ROUTER, data: '0x12b34c', value: '0' },
            expectedAmountOut: 1_000_000_000_000_000_000n,
            amountOutMin: 995_000_000_000_000_000n,
            hops: 2,
            spender: ROUTER,
            route: {},
        });

        const { sign, sent } = signer();
        const result = await strategy.execute(
            params({ fromToken: 'KESm', toToken: 'BRLm', amount: '1', signer: sign as never }),
            {},
        );
        expect(result.success).toBe(true);
        expect(sent).toHaveLength(1);
        expect(result.approvalTxHash).toBeUndefined();
    });
});
