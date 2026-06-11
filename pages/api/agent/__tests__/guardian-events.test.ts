/**
 * Tests for the GET /api/agent/guardian-events SSE handler.
 *
 * The handler's full streaming behaviour is hard to test in a unit
 * environment (it depends on the Next.js runtime keeping the
 * connection open). What we CAN test in isolation is the
 * request-validation path: only GET with a valid 0x-prefixed
 * 40-hex-char address is accepted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_guardian-event-bus', () => ({
    guardianEventBus: {
        subscribe: vi.fn(() => () => {}),
        publish: vi.fn(),
    },
}));

import handler from '../guardian-events';

type ApiMock = {
    method?: string;
    query?: Record<string, string | string[]>;
    on?: (event: string, cb: () => void) => void;
};

type ResMock = {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, string>;
    setHeader: (k: string, v: string) => void;
    flushHeaders: () => void;
    write: (s: string) => boolean;
    status: (code: number) => ResMock;
    json: (b: unknown) => ResMock;
    on: (event: string, cb: () => void) => void;
};

function makeRes(): ResMock {
    const headers: Record<string, string> = {};
    return {
        headers,
        setHeader: (k, v) => {
            headers[k] = v;
        },
        flushHeaders: () => {},
        write: () => true,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(b) {
            this.body = b;
            return this;
        },
        on: () => {},
    };
}

describe('GET /api/agent/guardian-events', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects non-GET methods with 405', async () => {
        const req: ApiMock = { method: 'POST' };
        const res = makeRes();
        await handler(req as never, res as never);
        expect(res.statusCode).toBe(405);
    });

    it('rejects a missing userAddress with 400', async () => {
        const req: ApiMock = { method: 'GET', query: {} };
        const res = makeRes();
        await handler(req as never, res as never);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a non-address userAddress with 400', async () => {
        const req: ApiMock = { method: 'GET', query: { userAddress: 'not-an-address' } };
        const res = makeRes();
        await handler(req as never, res as never);
        expect(res.statusCode).toBe(400);
    });

    it('accepts a valid 0x-prefixed 40-hex address and sets SSE headers', async () => {
        const req: ApiMock = {
            method: 'GET',
            query: { userAddress: '0x' + '11'.repeat(20) },
            on: () => {},
        };
        const res = makeRes();
        await handler(req as never, res as never);
        expect(res.statusCode).toBeUndefined(); // streamed, no status set
        expect(res.headers['Content-Type']).toBe('text/event-stream');
        expect(res.headers['Cache-Control']).toBe('no-cache, no-transform');
        expect(res.headers['X-Accel-Buffering']).toBe('no');
    });
});
