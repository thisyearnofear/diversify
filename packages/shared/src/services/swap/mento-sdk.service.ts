/**
 * Mento SDK Service
 * The single integration point for Mento Protocol v3 — routes, quotes,
 * and swap calldata all go through @mento-protocol/mento-sdk here.
 * Swaps target the Mento Router (not the legacy Broker); multi-hop
 * routes execute in ONE transaction.
 */

import { Mento, getCachedRoutes, getContractAddress } from '@mento-protocol/mento-sdk';
import type { Route } from '@mento-protocol/mento-sdk';
import { NETWORKS, getTokenAddresses } from '../../config';
import { ChainDetectionService } from './chain-detection.service';

export interface MentoCallParams {
    to: string;
    data: string;
    value: string;
}

export interface MentoQuote {
    amountOut: bigint;
    hops: number;
    costPercent: number | null;
}

export interface MentoBuiltSwap {
    approval: MentoCallParams | null;
    swap: MentoCallParams;
    expectedAmountOut: bigint;
    amountOutMin: bigint;
    hops: number;
    spender: string;
    route: Route;
}

/**
 * Stable market-closed message — FPMM pools revert with "FX market is
 * currently closed" and oracle-priced regional pools (KESm, BRLm, NGNm…)
 * revert with "no valid median" when the FX feeds stop reporting. Both are
 * expected weekend/holiday behaviour, so callers get one stable string to
 * classify instead of matching revert text. No reopening time is promised.
 */
export const MENTO_MARKET_CLOSED_MESSAGE =
    'Mento FX market is closed — quotes resume when FX markets reopen.';

export function isMentoMarketClosedError(
    message: string | undefined | null
): boolean {
    if (!message) return false;
    const m = message.toLowerCase();
    return (
        m.includes('fx market is currently closed') ||
        m.includes('no valid median') ||
        m === MENTO_MARKET_CLOSED_MESSAGE.toLowerCase()
    );
}

function rethrowMarketClosed(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    if (isMentoMarketClosedError(message)) {
        throw new Error(MENTO_MARKET_CLOSED_MESSAGE);
    }
    throw error;
}

const mentoCache = new Map<number, Promise<Mento>>();

function rpcUrlFor(chainId: number): string {
    if (chainId === NETWORKS.CELO_MAINNET.chainId) return NETWORKS.CELO_MAINNET.rpcUrl;
    if (chainId === NETWORKS.CELO_SEPOLIA.chainId) return NETWORKS.CELO_SEPOLIA.rpcUrl;
    throw new Error(`Mento SDK is only configured for Celo chains, got ${chainId}`);
}

/**
 * Mento client, memoized per chain. The SDK's ESM build uses extensionless
 * imports, so callers in plain-ESM contexts must require() the CJS build —
 * everywhere else (Next, vitest, tsx) a normal import resolves.
 */
export function getMento(chainId: number): Promise<Mento> {
    if (!ChainDetectionService.isCelo(chainId)) {
        return Promise.reject(
            new Error(`Mento is only available on Celo chains, got ${chainId}`)
        );
    }
    let pending = mentoCache.get(chainId);
    if (!pending) {
        pending = Mento.create(chainId, rpcUrlFor(chainId));
        mentoCache.set(chainId, pending);
    }
    return pending;
}

/**
 * Token addresses the Mento v3 route graph covers on this chain —
 * from the SDK's cached route set (identical to the on-chain set for
 * Celo mainnet). Lowercased; always compare by address, never symbol
 * (route tokens report e.g. 'USD₮' for USDT).
 */
export function getMentoRoutableAddresses(chainId: number): Set<string> {
    const set = new Set<string>();
    for (const route of getCachedRoutes(chainId)) {
        for (const token of route.tokens) {
            set.add(token.address.toLowerCase());
        }
        for (const hop of route.path) {
            // Intermediate tokens only appear on the pool path, not on
            // route.tokens (the two endpoints).
            if (hop.token0) set.add(hop.token0.toLowerCase());
            if (hop.token1) set.add(hop.token1.toLowerCase());
        }
    }
    return set;
}

/**
 * True iff a cached Mento route connects exactly these two token
 * addresses (order-independent). Address-keyed — never match symbols.
 */
export function isMentoPair(chainId: number, tokenInAddr: string, tokenOutAddr: string): boolean {
    const a = tokenInAddr.toLowerCase();
    const b = tokenOutAddr.toLowerCase();
    return getCachedRoutes(chainId).some((route) => {
        const endpoints = route.tokens.map((t) => t.address.toLowerCase());
        return endpoints.includes(a) && endpoints.includes(b);
    });
}

/**
 * Symbol-level convenience: resolves through the app's token map.
 */
export function isMentoToken(chainId: number, symbol: string): boolean {
    const tokens = getTokenAddresses(chainId);
    const address = tokens[symbol as keyof typeof tokens];
    if (!address) return false;
    return getMentoRoutableAddresses(chainId).has(address.toLowerCase());
}

export async function findMentoRoute(
    chainId: number,
    tokenInAddr: string,
    tokenOutAddr: string
): Promise<Route> {
    const mento = await getMento(chainId);
    return mento.routes.findRoute(tokenInAddr, tokenOutAddr);
}

/**
 * Quote a swap. costPercent comes from the cached route's costData when
 * the matched route carries it (0.3 = 0.3% total route cost).
 */
export async function quoteMento(
    chainId: number,
    tokenInAddr: string,
    tokenOutAddr: string,
    amountIn: bigint
): Promise<MentoQuote> {
    const mento = await getMento(chainId);
    let route: Route;
    let amountOut: bigint;
    try {
        route = await mento.routes.findRoute(tokenInAddr, tokenOutAddr);
        amountOut = await mento.quotes.getAmountOut(tokenInAddr, tokenOutAddr, amountIn, route);
    } catch (error) {
        rethrowMarketClosed(error);
    }

    const a = tokenInAddr.toLowerCase();
    const b = tokenOutAddr.toLowerCase();
    const cached = getCachedRoutes(chainId).find((r) => {
        const endpoints = r.tokens.map((t) => t.address.toLowerCase());
        return endpoints.includes(a) && endpoints.includes(b) && r.path.length === route.path.length;
    });

    return {
        amountOut,
        hops: route.path.length,
        costPercent: cached?.costData?.totalCostPercent ?? null,
    };
}

/**
 * Build the approval (if the SDK finds the Router under-allowed) + swap
 * calldata. slippagePercent is a PERCENT (0.5 = 0.5%) — the same unit
 * TX_CONFIG and the SDK both use, so it passes straight through.
 * Throws when the route's circuit breaker is active.
 */
export async function buildMentoSwap(args: {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    recipient: string;
    owner: string;
    slippagePercent: number;
    deadlineSeconds?: number;
}): Promise<MentoBuiltSwap> {
    const {
        chainId,
        tokenIn,
        tokenOut,
        amountIn,
        recipient,
        owner,
        slippagePercent,
        deadlineSeconds = 1200,
    } = args;

    const mento = await getMento(chainId);
    try {
        const route = await mento.routes.findRoute(tokenIn, tokenOut);

        const tradable = await mento.trading.isRouteTradable(route);
        if (!tradable) {
            throw new Error(`Mento trading is currently paused for ${tokenIn}/${tokenOut}`);
        }

        const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
        const built = await mento.swap.buildSwapTransaction(
            tokenIn,
            tokenOut,
            amountIn,
            recipient,
            owner,
            { slippageTolerance: slippagePercent, deadline },
            route
        );

        const spender = mento.getContractAddress('Router');

        return {
            approval: built.approval
                ? { to: built.approval.to, data: built.approval.data, value: built.approval.value }
                : null,
            swap: {
                to: built.swap.params.to,
                data: built.swap.params.data,
                value: built.swap.params.value,
            },
            expectedAmountOut: built.swap.expectedAmountOut,
            amountOutMin: built.swap.amountOutMin,
            hops: route.path.length,
            spender,
            route,
        };
    } catch (error) {
        rethrowMarketClosed(error);
    }
}

/** The Mento v3 Router this chain's swaps approve and call. */
export function getMentoRouterAddress(chainId: number): string {
    return getContractAddress(chainId, 'Router');
}
