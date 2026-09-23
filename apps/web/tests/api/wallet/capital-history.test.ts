/**
 * /api/wallet/capital-history — pagination cap, validation, upstream
 * failure, and the in-memory cache. fetch is mocked; the handler is
 * driven directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../pages/api/wallet/capital-history';

const USDm_ADDR = '0x765DE816845861e75A25fCA122bb6898B8B1282a';

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

    it('a single page means complete history', async () => {
        const address = freshAddress();
        fetchMock.mockReturnValueOnce(page([xfer(address)], null));
        const res = makeRes();
        await handler(
            makeReq({ address }) as never,
            res as never,
        );
        expect(res.statusCode).toBe(200);
        const body = res.body as { complete: boolean; stations: unknown[] };
        expect(body.complete).toBe(true);
        expect(body.stations).toHaveLength(1);
    });

    it('caps at 4 pages and marks the history incomplete', async () => {
        const address = freshAddress();
        fetchMock.mockImplementation(() =>
            page([xfer(address)], { page: 'next' }),
        );
        const res = makeRes();
        await handler(
            makeReq({ address }) as never,
            res as never,
        );
        expect(fetchMock).toHaveBeenCalledTimes(4);
        const body = res.body as { complete: boolean };
        expect(body.complete).toBe(false);
    });

    it('returns 502 on upstream failure — never partial data', async () => {
        fetchMock.mockRejectedValueOnce(new Error('boom'));
        const res = makeRes();
        await handler(
            makeReq({ address: freshAddress() }) as never,
            res as never,
        );
        expect(res.statusCode).toBe(502);
    });

    it('serves a repeat request from cache without refetching', async () => {
        const address = freshAddress();
        fetchMock.mockReturnValueOnce(page([xfer(address)], null));
        const res1 = makeRes();
        await handler(makeReq({ address }) as never, res1 as never);
        const res2 = makeRes();
        await handler(makeReq({ address }) as never, res2 as never);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(res2.body).toEqual(res1.body);
    });
});
