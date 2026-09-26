/**
 * /api/wallet/capital-history — pagination cap, validation, upstream
 * failure, per-chain degradation, and the in-memory cache. fetch is
 * mocked and routed by Blockscout host (celo.* vs arbitrum.*); the
 * handler is driven directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../pages/api/wallet/capital-history';

const USDm_ADDR = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const PAXG_ARB = '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429';

// Transfers must target the address under test — each test queries a
// fresh address so the module-level cache can't leak between them.
function xfer(to: string, over: Record<string, unknown> = {}) {
    return {
        transaction_hash: '0xtx1',
        timestamp: '2024-01-01T00:00:00.000000Z',
        from: { hash: '0x00000000000000000000000000000000000000bb' },
        to: { hash: to },
        token: { address_hash: USDm_ADDR },
        total: { value: '1000000', decimals: '6' },
        ...over,
    };
}

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function page(items: unknown[], next: Record<string, unknown> | null) {
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items, next_page_params: next }),
    });
}

type Handler = (url: string) => Promise<unknown>;

/** Route the fetch mock by host: `celo` handles celo.blockscout.com,
 *  `arb` handles arbitrum.blockscout.com. */
function mockChains(celo: Handler, arb: Handler = () => page([], null)) {
    fetchMock.mockImplementation((...args: unknown[]) => {
        const url = String(args[0] ?? '');
        return url.includes('arbitrum.blockscout.com') ? arb(url) : celo(url);
    });
}

function makeReq(query: Record<string, string>, method = 'GET') {
    return { method, query, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
}

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

// Distinct addresses per test so the module-level cache can't leak.
let addrSeq = 0;
function freshAddress() {
    addrSeq += 1;
    return `0x${String(addrSeq).padStart(40, '0')}`;
}

describe('capital-history route', () => {
    beforeEach(() => fetchMock.mockReset());

    it('rejects a bad address with 400', async () => {
        const res = makeRes();
        await handler(makeReq({ address: 'nope' }) as never, res as never);
        expect(res.statusCode).toBe(400);
    });

    it('rejects non-GET with 405', async () => {
        const res = makeRes();
        await handler(
            makeReq({ address: freshAddress() }, 'POST') as never,
            res as never,
        );
        expect(res.statusCode).toBe(405);
    });

    it('a single page means complete history on both chains', async () => {
        const address = freshAddress();
        mockChains(() => page([xfer(address)], null));
        const res = makeRes();
        await handler(
            makeReq({ address }) as never,
            res as never,
        );
        expect(res.statusCode).toBe(200);
        const body = res.body as {
            complete: boolean;
            stations: unknown[];
            chains: number[];
        };
        expect(body.complete).toBe(true);
        expect(body.stations).toHaveLength(1);
        expect(body.chains).toEqual([42220, 42161]);
    });

    it('caps at 4 pages per chain and marks the history incomplete', async () => {
        const address = freshAddress();
        mockChains(() => page([xfer(address)], { page: 'next' }));
        const res = makeRes();
        await handler(
            makeReq({ address }) as never,
            res as never,
        );
        const celoCalls = fetchMock.mock.calls.filter(([u]) =>
            String(u).includes('celo.blockscout.com'),
        );
        const arbCalls = fetchMock.mock.calls.filter(([u]) =>
            String(u).includes('arbitrum.blockscout.com'),
        );
        // Celo keeps paging to the cap; the default arb handler answers
        // one empty, complete page.
        expect(celoCalls).toHaveLength(4);
        expect(arbCalls).toHaveLength(1);
        const body = res.body as { complete: boolean };
        expect(body.complete).toBe(false);
    });

    it('returns 502 when every chain fails — never partial data', async () => {
        fetchMock.mockImplementation(() =>
            Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
        );
        const res = makeRes();
        await handler(
            makeReq({ address: freshAddress() }) as never,
            res as never,
        );
        expect(res.statusCode).toBe(502);
    });

    it('a chain that fails is simply not claimed', async () => {
        const address = freshAddress();
        mockChains(
            () => page([xfer(address)], null),
            () =>
                Promise.resolve({
                    ok: false,
                    status: 503,
                    json: () => Promise.resolve({}),
                }),
        );
        const res = makeRes();
        await handler(makeReq({ address }) as never, res as never);
        expect(res.statusCode).toBe(200);
        const body = res.body as { chains: number[]; stations: unknown[] };
        expect(body.chains).toEqual([42220]);
        expect(body.stations).toHaveLength(1);
    });

    it('an Arbitrum swap leg is labeled with its chain and kind', async () => {
        const address = freshAddress();
        const arbSwap = [
            {
                transaction_hash: '0xarbswap',
                timestamp: '2024-05-01T00:00:00.000000Z',
                from: { hash: address },
                to: { hash: '0x0000000000000000000000000000000000000abc' },
                token: { address_hash: USDC_ARB },
                total: { value: '5000000', decimals: '6' },
            },
            {
                transaction_hash: '0xarbswap',
                timestamp: '2024-05-01T00:00:00.000000Z',
                from: { hash: '0x0000000000000000000000000000000000000abc' },
                to: { hash: address },
                token: { address_hash: PAXG_ARB },
                total: { value: '2000000000000000', decimals: '18' },
            },
        ];
        mockChains(
            () => page([], null),
            () => page(arbSwap, null),
        );
        const res = makeRes();
        await handler(makeReq({ address }) as never, res as never);
        expect(res.statusCode).toBe(200);
        const body = res.body as {
            chains: number[];
            legs: {
                kind: string;
                chainId: number;
                from: string;
                to: string;
                txHash: string;
            }[];
        };
        expect(body.legs).toHaveLength(1);
        expect(body.legs[0]).toMatchObject({
            kind: 'swap',
            chainId: 42161,
            from: 'USDC',
            to: 'PAXG',
            txHash: '0xarbswap',
        });
    });

    it('a bare send on Celo is a transfer leg, not a swap', async () => {
        const address = freshAddress();
        mockChains(() =>
            page(
                [
                    xfer('0x00000000000000000000000000000000000000cc', {
                        from: { hash: address },
                    }),
                ],
                null,
            ),
        );
        const res = makeRes();
        await handler(makeReq({ address }) as never, res as never);
        const body = res.body as { legs: { kind: string; from: string }[] };
        expect(body.legs).toHaveLength(1);
        expect(body.legs[0]).toMatchObject({ kind: 'sent', from: 'USDm' });
    });

    it('serves a repeat request from cache without refetching', async () => {
        const address = freshAddress();
        mockChains(() => page([xfer(address)], null));
        const res1 = makeRes();
        await handler(makeReq({ address }) as never, res1 as never);
        const callsAfterFirst = fetchMock.mock.calls.length;
        expect(callsAfterFirst).toBeGreaterThan(0);
        const res2 = makeRes();
        await handler(makeReq({ address }) as never, res2 as never);
        expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
        expect(res2.body).toEqual(res1.body);
    });
});
