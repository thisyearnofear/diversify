/**
 * GET /api/wallet/capital-history?address=0x…
 *
 * "Where your savings have lived" — the wallet's currency stations and
 * settled legs, derived from ERC-20 token transfers via the public
 * Blockscout API on Celo and Arbitrum One (same api/v2 shape). Symbols
 * on-chain do not match ours (USDm is "CUSD" up there), so tokens are
 * mapped by contract address only.
 *
 * Each chain is fetched independently: a chain that answers joins the
 * merged history and is named in `chains`; a chain that fails is simply
 * not claimed. Only a total miss (no chain answered) is a 502.
 *
 * Capped at 4 pages (200 transfers) per chain; `complete` is false when
 * the first page was never reached — the client then can't claim a
 * start date.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { utils as ethersUtils } from 'ethers';
import { getTokenAddresses } from '@diversifi/shared/src/config/index';
import {
    deriveCapitalHistory,
    mergeCapitalHistories,
    type BlockscoutTransfer,
    type CapitalHistory,
} from '@diversifi/shared/src/services/capital-history';
import { corridorSideFor } from '@/lib/corridor-context';

const MAX_PAGES = 4;
const FETCH_TIMEOUT_MS = 8_000;

const SOURCES = [
    { chainId: 42220, api: 'https://celo.blockscout.com/api/v2' },
    { chainId: 42161, api: 'https://arbitrum.blockscout.com/api/v2' },
] as const;

// In-memory cache: lowercased address → { data, expiry }. 10-min TTL,
// ~500 entries, oldest evicted first.
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;

// contract address (lowercase) → canonical symbol, per chain
const TOKEN_BY_CHAIN: Record<number, Record<string, string>> =
    Object.fromEntries(
        SOURCES.map(({ chainId }) => [
            chainId,
            Object.fromEntries(
                Object.entries(getTokenAddresses(chainId)).map(
                    ([symbol, address]) => [address.toLowerCase(), symbol],
                ),
            ),
        ]),
    );

const isCurrency = (symbol: string) => corridorSideFor(symbol) !== null;

interface TransfersPage {
    items?: BlockscoutTransfer[];
    next_page_params?: Record<string, unknown> | null;
}

async function fetchPage(
    apiBase: string,
    address: string,
    params: Record<string, unknown> | null,
): Promise<TransfersPage> {
    const url = new URL(`${apiBase}/addresses/${address}/token-transfers`);
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

/** One chain's pages → a per-chain history, or null when the chain
 *  didn't answer at all. */
async function readChain(
    source: (typeof SOURCES)[number],
    address: string,
): Promise<CapitalHistory | null> {
    const transfers: BlockscoutTransfer[] = [];
    let nextParams: Record<string, unknown> | null = null;
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page++) {
        const result = await fetchPage(source.api, address, nextParams);
        transfers.push(...(result.items ?? []));
        nextParams = result.next_page_params ?? null;
        if (nextParams === null) {
            complete = true;
            break;
        }
    }
    return deriveCapitalHistory({
        wallet: address,
        transfers,
        tokenByAddress: TOKEN_BY_CHAIN[source.chainId],
        isCurrency,
        complete,
        now: new Date().toISOString(),
        chainId: source.chainId,
    });
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
        const parts = await Promise.all(
            SOURCES.map((s) =>
                readChain(s, address).catch(() => null),
            ),
        );
        const read = parts.filter((p): p is CapitalHistory => p !== null);
        if (read.length === 0) {
            // Absence is honest — the client renders nothing on a 502.
            return res.status(502).json({
                error: 'Upstream fetch failed on every chain',
            });
        }
        const data = mergeCapitalHistories(read);
        data.address = address;
        data.asOf = new Date().toISOString();

        if (cache.size >= CACHE_MAX) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
        cacheable();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(502).json({
            error: (err as Error | null)?.message ?? 'Upstream fetch failed',
        });
    }
}
