/**
 * GET /api/wallet/capital-history?address=0x…
 *
 * "Where your savings have lived" — the wallet's currency stations and
 * settled swap legs, derived from ERC-20 token transfers on Celo via the
 * public Blockscout API. Symbols on-chain do not match ours (USDm is
 * "CUSD" up there), so tokens are mapped by contract address only.
 *
 * Capped at 4 pages (200 transfers); `complete` is false when the first
 * page was never reached — the client then can't claim a start date.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { utils as ethersUtils } from 'ethers';
import { getTokenAddresses } from '@diversifi/shared/src/config/index';
import {
    deriveCapitalHistory,
    type BlockscoutTransfer,
} from '@diversifi/shared/src/services/capital-history';
import { corridorSideFor } from '@/lib/corridor-context';

const BLOCKSCOUT = 'https://celo.blockscout.com/api/v2';
const MAX_PAGES = 4;
const FETCH_TIMEOUT_MS = 8_000;

// In-memory cache: lowercased address → { data, expiry }. 10-min TTL,
// ~500 entries, oldest evicted first.
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;

// contract address (lowercase) → canonical symbol
const TOKEN_BY_ADDRESS: Record<string, string> = Object.fromEntries(
    Object.entries(getTokenAddresses(42220)).map(([symbol, address]) => [
        address.toLowerCase(),
        symbol,
    ]),
);

const isCurrency = (symbol: string) => corridorSideFor(symbol) !== null;

interface TransfersPage {
    items?: BlockscoutTransfer[];
    next_page_params?: Record<string, unknown> | null;
}

async function fetchPage(
    address: string,
    params: Record<string, unknown> | null,
): Promise<TransfersPage> {
    const url = new URL(`${BLOCKSCOUT}/addresses/${address}/token-transfers`);
    url.searchParams.set('type', 'ERC-20');
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, String(v));
        }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const resp = await fetch(url.toString(), { signal: controller.signal });
        if (!resp.ok) throw new Error(`Blockscout HTTP ${resp.status}`);
        return (await resp.json()) as TransfersPage;
    } finally {
        clearTimeout(timer);
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { address } = req.query;
    if (
        !address ||
        typeof address !== 'string' ||
        !ethersUtils.isAddress(address)
    ) {
        return res.status(400).json({ error: 'Invalid "address" parameter' });
    }

    // Only successful reads are CDN-cacheable — a 502 must not stick.
    const cacheable = () =>
        res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');

    const key = address.toLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expiry > Date.now()) {
        cacheable();
        return res.status(200).json(cached.data);
    }

    try {
        const transfers: BlockscoutTransfer[] = [];
        let nextParams: Record<string, unknown> | null = null;
        let complete = false;
        for (let page = 0; page < MAX_PAGES; page++) {
            const result = await fetchPage(address, nextParams);
            transfers.push(...(result.items ?? []));
            nextParams = result.next_page_params ?? null;
            if (nextParams === null) {
                complete = true;
                break;
            }
        }

        const data = deriveCapitalHistory({
            wallet: address,
            transfers,
            tokenByAddress: TOKEN_BY_ADDRESS,
            isCurrency,
            complete,
            now: new Date().toISOString(),
        });

        if (cache.size >= CACHE_MAX) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
        cacheable();
        return res.status(200).json(data);
    } catch (err) {
        // Absence is honest — the client renders nothing on a 502.
        return res.status(502).json({
            error: (err as Error | null)?.message ?? 'Upstream fetch failed',
        });
    }
}
