/**
 * /api/receipt/[chainId]/[txHash] — derivation tests with a mocked
 * chain view (no RPC): swap classification, multi-leg via-hub routes,
 * bare transfers, native legs, ERC-721 exclusion, and the handler's
 * status codes.
 */

import { describe, it, expect, vi } from 'vitest';
import { BigNumber, ethers } from 'ethers';
import handler, {
    deriveReceipt,
    getReceipt,
    type ReceiptChainView,
    type ReceiptSource,
} from '../../pages/api/receipt/[chainId]/[txHash]';

const WALLET = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const BROKER = '0x777a8255ca72412f0d706dc03c9d1987306b4cad';
const USDm = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const KESm = '0x456a3D042C0DbD3fb53D5489D98dE8FDDee5Be16';
const EURm = '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73';

const HASH = '0x' + 'ab'.repeat(32);
const IERC20 = new ethers.utils.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const META = new ethers.utils.Interface([
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
]);

let logSeq = 0;
function transfer(
    token: string,
    from: string,
    to: string,
    value: string,
    extraTopics: string[] = [],
) {
    const enc = IERC20.encodeEventLog(IERC20.getEvent('Transfer'), [
        from,
        to,
        BigNumber.from(value),
    ]);
    return {
        address: token,
        topics: [...enc.topics, ...extraTopics],
        data: enc.data,
        logIndex: logSeq++,
    };
}

const SYMBOLS: Record<string, { symbol: string; decimals: number }> = {
    [USDm.toLowerCase()]: { symbol: 'cUSD', decimals: 18 },
    [KESm.toLowerCase()]: { symbol: 'cKES', decimals: 18 },
    [EURm.toLowerCase()]: { symbol: 'cEUR', decimals: 18 },
};

/** A chain view that answers symbol()/decimals() from SYMBOLS. */
function mockView(over: Partial<ReceiptChainView> = {}): ReceiptChainView {
    return {
        getTransaction: vi.fn(async () => ({
            from: WALLET,
            to: BROKER,
            value: BigNumber.from(0),
        })),
        getTransactionReceipt: vi.fn(async () => ({
            status: 1,
            blockNumber: 12345,
            gasUsed: BigNumber.from('21000'),
            effectiveGasPrice: BigNumber.from('1000000000'),
            logs: [] as never[],
        })),
        getBlock: vi.fn(async () => ({ timestamp: 1700000000 })),
        call: vi.fn(async ({ to, data }: { to: string; data: string }) => {
            const meta = SYMBOLS[to.toLowerCase()];
            if (!meta) return '0x';
            if (data.startsWith('0x95d89b41'))
                return META.encodeFunctionResult('symbol', [meta.symbol]);
            if (data.startsWith('0x313ce567'))
                return META.encodeFunctionResult('decimals', [meta.decimals]);
            return '0x';
        }),
        ...over,
    };
}

function source(logs: ReceiptSource['logs'], txOver = {}): ReceiptSource {
    return {
        tx: { from: WALLET, to: BROKER, value: BigNumber.from(0), ...txOver },
        status: 1,
        blockNumber: 12345,
        blockTimestamp: 1700000000,
        gasUsed: BigNumber.from('150000'),
        effectiveGasPrice: BigNumber.from('500000000'), // 0.5 gwei
        logs,
    };
}

const resolve = async (token: string) => {
    const meta = SYMBOLS[token.toLowerCase()] ?? { symbol: 'TKN', decimals: 18 };
    return meta;
};

describe('deriveReceipt', () => {
    it('classifies a swap and computes the effective rate', async () => {
        const r = await deriveReceipt({
            chainId: 42220,
            txHash: HASH,
            source: source([
                transfer(USDm, WALLET, BROKER, '5000000000000000000'),
                transfer(KESm, BROKER, WALLET, '645000000000000000000'),
            ]),
            resolveToken: resolve,
        });
        expect(r).not.toBeNull();
        expect(r!.status).toBe('success');
        expect(r!.sender).toBe(ethers.utils.getAddress(WALLET));
        expect(r!.legs).toHaveLength(2);
        expect(r!.legs[0]).toMatchObject({
            direction: 'sent',
            symbol: 'cUSD',
            amountFormatted: '5',
            counterparty: ethers.utils.getAddress(BROKER),
        });
        expect(r!.legs[1].direction).toBe('received');
        expect(r!.effectiveRate).toBeCloseTo(129, 0); // 645 ÷ 5
        expect(r!.rateText).toMatch(/^1 cUSD ≈ 129 cKES$/);
        expect(r!.gasFeeNative).toBe('0.000075');
        expect(r!.explorerUrl).toBe(`https://celo.blockscout.com/tx/${HASH}`);
    });

    it('orders via-hub legs in log order, no rate when it nets >1 each', async () => {
        const r = await deriveReceipt({
            chainId: 42220,
            txHash: HASH,
            source: source([
                transfer(KESm, WALLET, BROKER, '100000000000000000000'),
                transfer(USDm, BROKER, WALLET, '500000000000000000'),
                transfer(USDm, WALLET, BROKER, '500000000000000000'),
                transfer(EURm, BROKER, WALLET, '450000000000000000'),
            ]),
            resolveToken: resolve,
        });
        expect(r!.legs.map((l) => l.direction)).toEqual([
            'sent',
            'received',
            'sent',
            'received',
        ]);
        expect(r!.legs.map((l) => l.symbol)).toEqual([
            'cKES',
            'cUSD',
            'cUSD',
            'cEUR',
        ]);
        expect(r!.effectiveRate).toBeNull();
    });

    it('a bare send is one sent leg with no rate', async () => {
        const r = await deriveReceipt({
            chainId: 42220,
            txHash: HASH,
            source: source([transfer(USDm, WALLET, OTHER, '2500000000000000000')]),
            resolveToken: resolve,
        });
        expect(r!.legs).toHaveLength(1);
        expect(r!.legs[0]).toMatchObject({
            direction: 'sent',
            symbol: 'cUSD',
            amountFormatted: '2.5',
        });
        expect(r!.effectiveRate).toBeNull();
    });

    it('includes native value as the chain native token leg', async () => {
        const r = await deriveReceipt({
            chainId: 42161,
            txHash: HASH,
            source: source([], { value: BigNumber.from('500000000000000000') }),
            resolveToken: resolve,
        });
        expect(r!.legs).toHaveLength(1);
        expect(r!.legs[0]).toMatchObject({
            token: null,
            symbol: 'ETH',
            decimals: 18,
            direction: 'sent',
            amountFormatted: '0.5',
        });
    });

    it('skips self-transfers and ERC-721 logs', async () => {
        const r = await deriveReceipt({
            chainId: 42220,
            txHash: HASH,
            source: source([
                transfer(USDm, WALLET, WALLET, '1000'),
                // ERC-721 Transfer has a 4th indexed topic
                transfer(
                    '0x9999999999999999999999999999999999999999',
                    WALLET,
                    OTHER,
                    '0',
                    [ethers.utils.hexZeroPad('0x1', 32)],
                ),
            ]),
            resolveToken: resolve,
        });
        expect(r).toBeNull();
    });

    it('returns null when no transfer involves the sender', async () => {
        const r = await deriveReceipt({
            chainId: 42220,
            txHash: HASH,
            source: source([transfer(USDm, OTHER, BROKER, '1000')]),
            resolveToken: resolve,
        });
        expect(r).toBeNull();
    });

    it('aggregates split transfers of one token+direction+counterparty', async () => {
        const r = await deriveReceipt({
            chainId: 42220,
            txHash: HASH,
            source: source([
                transfer(USDm, WALLET, BROKER, '3000000000000000000'),
                transfer(USDm, WALLET, BROKER, '2000000000000000000'),
                transfer(KESm, BROKER, WALLET, '645000000000000000000'),
            ]),
            resolveToken: resolve,
        });
        expect(r!.legs).toHaveLength(2);
        expect(r!.legs[0].amountFormatted).toBe('5');
        expect(r!.effectiveRate).toBeCloseTo(129, 0);
    });
});

describe('getReceipt (mocked chain view)', () => {
    it('returns not-found when the tx is missing', async () => {
        const res = await getReceipt(
            42220,
            HASH,
            mockView({ getTransaction: vi.fn(async () => null) }),
        );
        expect(res).toEqual({ ok: false, reason: 'Transaction not found' });
    });

    it('returns unmined when the receipt is missing', async () => {
        const res = await getReceipt(
            42220,
            HASH,
            mockView({ getTransactionReceipt: vi.fn(async () => null) }),
        );
        expect(res).toEqual({
            ok: false,
            reason: 'Transaction not yet mined',
        });
    });

    it('a reverted tx is not a receipt', async () => {
        const res = await getReceipt(
            42220,
            HASH,
            mockView({
                getTransactionReceipt: vi.fn(async () => ({
                    status: 0,
                    blockNumber: 1,
                    gasUsed: BigNumber.from('21000'),
                    effectiveGasPrice: BigNumber.from('1000000000'),
                    logs: [],
                })),
            }),
        );
        expect(res.ok).toBe(false);
    });

    it('derives a full receipt from the chain view', async () => {
        const res = await getReceipt(
            42220,
            HASH,
            mockView({
                getTransactionReceipt: vi.fn(async () => ({
                    status: 1,
                    blockNumber: 777,
                    gasUsed: BigNumber.from('200000'),
                    effectiveGasPrice: BigNumber.from('1000000000'),
                    logs: [
                        transfer(USDm, WALLET, BROKER, '5000000000000000000'),
                        transfer(KESm, BROKER, WALLET, '645000000000000000000'),
                    ],
                })),
            }),
        );
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.receipt.chainName).toBe('Celo');
            expect(res.receipt.legs).toHaveLength(2);
            expect(res.receipt.blockNumber).toBe(777);
            expect(res.receipt.timestampIso).toBe(
                new Date(1700000000 * 1000).toISOString(),
            );
            expect(res.receipt.effectiveRate).toBeCloseTo(129, 0);
        }
    });
});

describe('receipt route validation', () => {
    function makeRes() {
        const res = {
            statusCode: 200,
            body: undefined as unknown,
            headers: {} as Record<string, string>,
            setHeader(k: string, v: string) {
                res.headers[k] = v;
            },
            status(code: number) {
                res.statusCode = code;
                return res;
            },
            json(b: unknown) {
                res.body = b;
                return res;
            },
        };
        return res;
    }
    const makeReq = (query: Record<string, string>, method = 'GET') => ({
        method,
        query,
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
    });

    it('rejects non-GET with 405', async () => {
        const res = makeRes();
        await handler(
            makeReq({ chainId: '42220', txHash: HASH }, 'POST') as never,
            res as never,
        );
        expect(res.statusCode).toBe(405);
    });

    it('rejects an unsupported chain with 400', async () => {
        const res = makeRes();
        await handler(
            makeReq({ chainId: '1', txHash: HASH }) as never,
            res as never,
        );
        expect(res.statusCode).toBe(400);
    });

    it('rejects a malformed hash with 400', async () => {
        const res = makeRes();
        await handler(
            makeReq({ chainId: '42220', txHash: '0xdeadbeef' }) as never,
            res as never,
        );
        expect(res.statusCode).toBe(400);
    });
});
