/**
 * GET /api/agent/guardian-events?userAddress=0x...
 *
 * Server-Sent Events stream for the Guardian proof feed. The client
 * opens an `EventSource` on this URL once the user has a connected
 * wallet, and receives typed events whenever the server writes to
 * GuardianState for that user.
 *
 * Why SSE and not WebSockets:
 *  - One-way (server → client) — no client messages needed.
 *  - Survives Vercel edge / Hetzner proxy in chunked-encoding mode.
 *  - Built into the browser (`new EventSource(url)`), no library.
 *  - Auto-reconnects with Last-Event-ID, so a dropped connection
 *    resumes without us writing reconnect logic.
 *
 * Why the 25s heartbeat:
 *  - Most reverse proxies close idle connections after 30-60s. The
 *    heartbeat keeps the connection warm so we don't lose the
 *    subscription to a silent proxy close.
 *
 * The bus is a SINGLE-NODE singleton (see _guardian-event-bus.ts).
 * Multi-instance deployments need a cross-process bus.
 *
 * The first event sent on connect is `event: hello` so the client
 * can confirm the stream is live before the next real event.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { guardianEventBus, type GuardianStreamEvent } from './_guardian-event-bus';

const HEARTBEAT_MS = 25_000;

function isValidAddress(addr: unknown): addr is string {
    return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userAddress } = req.query;
    if (!isValidAddress(userAddress)) {
        return res.status(400).json({ error: 'Missing or invalid userAddress' });
    }

    // Standard SSE response headers. The `X-Accel-Buffering: no` is
    // important for nginx-style proxies that buffer upstream responses
    // by default — without it, the first event may not reach the
    // client for many seconds.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: GuardianStreamEvent) => {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Send a hello event so the client knows the stream is live.
    send({ type: 'hello', address: userAddress, capturedAt: new Date().toISOString() });

    // Subscribe to the user's topic.
    const unsubscribe = guardianEventBus.subscribe(userAddress, (event) => {
        try {
            send(event);
        } catch {
            // The connection is gone. The 'close' handler below will
            // run and clean up.
        }
    });

    // Heartbeat: a no-op comment line keeps the connection alive
    // through intermediaries that close on idle.
    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
            clearInterval(heartbeat);
        }
    }, HEARTBEAT_MS);

    const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
}
