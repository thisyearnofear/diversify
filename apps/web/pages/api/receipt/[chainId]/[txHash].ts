/**
 * GET /api/receipt/[chainId]/[txHash]
 *
 * A shareable receipt for a swap (or plain transfer), derived entirely
 * from the chain — no database, nothing remembered, nothing guessed.
 * Supports Celo (42220) and Arbitrum One (42161): the tx receipt's ERC-20
 * Transfer logs are classified by which side the sender stood on, native
 * value becomes a leg of the chain's native token, and the effective
 * rate is computed only when the tx nets to exactly one sent + one
 * received token. Anything else stays a leg list — never a fake pair.
 *
 * A mined tx can't change, so successful responses are immutable; misses
 * cache briefly because a just-broadcast tx may simply be unindexed yet.
 * Results sit in a 10-minute in-memory cache to be kind to the RPCs.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
    getNetworkConfig,
    getTokenAddresses,
} from '@diversifi/shared/src/config/index';

export const RECEIPT_CHAINS: Record<
    number,
    { chainId: number; nativeSymbol: string }
> = {
    42220: { chainId: 42220, nativeSymbol: 'CELO' },
    42161: { chainId: 42161, nativeSymbol: 'ETH' },
};

const TRANSFER_TOPIC = ethers.utils.id('Transfer(address,address,uint256)');
const ERC20_META_ABI = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
];
const RPC_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_TTL_MS = 20 * 1000;
const CACHE_MAX = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReceiptLeg {
    /** ERC-20 contract address, or null for the chain's native asset. */
    token: string | null;
    /** Canonical app symbol when the contract is a known token, else the
     *  on-chain symbol, else a short address — never invented. */
    symbol: string;
    /** Null when the contract's decimals() couldn't be read — the raw
     *  amount is still honest, so amountFormatted falls back to it. */
    decimals: number | null;
    /** Raw integer string in base units. */
    amount: string;
    amountFormatted: string;
    direction: 'sent' | 'received';
    counterparty: string;
    /** First log index this leg aggregated from — ordering on the page. */
    logIndex: number;
}

export interface DerivedReceipt {
    chainId: number;
    chainName: string;
    txHash: string;
    status: 'success' | 'reverted';
    blockNumber: number;
    /** Unix seconds. */
    timestamp: number;
    timestampIso: string;
    sender: string;
    legs: ReceiptLeg[];
    /** received/sent when the tx nets to exactly one of each. */
    effectiveRate: number | null;
    /** "1 USDm ≈ 5.61 BRLm" — null alongside effectiveRate. */
    rateText: string | null;
    gasFeeNative: string | null;
    nativeSymbol: string;
    explorerUrl: string;
}

export interface ReceiptLog {
    address: string;
    topics: string[];
    data: string;
    logIndex: number;
}

export interface ReceiptSource {
    tx: { from: string; to?: string | null; value: BigNumberish };
    status: number;
    blockNumber: number;
    blockTimestamp: number;
    gasUsed: BigNumberish;
    effectiveGasPrice: BigNumberish;
    logs: ReceiptLog[];
}

/** What getReceipt needs from a chain — satisfied by ethers' Provider,
 *  or a test double. */
export interface ReceiptChainView {
    getTransaction(txHash: string): Promise<{
        from: string;
        to?: string | null;
        value: BigNumberish;
    } | null>;
    getTransactionReceipt(txHash: string): Promise<{
        status?: number;
        blockNumber: number;
        gasUsed: BigNumberish;
        effectiveGasPrice: BigNumberish;
        logs: ReceiptLog[];
    } | null>;
    getBlock(blockNumber: number): Promise<{ timestamp: number }>;
    call(tx: { to: string; data: string }): Promise<string>;
}

export interface TokenMeta {
    symbol: string;
    decimals: number;
}

export type ReceiptResult =
    | { ok: true; receipt: DerivedReceipt }
    | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Pure derivation — exported for tests
// ---------------------------------------------------------------------------

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** BigNumber → trimmed decimal string (no exponent, no float drift). */
function formatAmount(value: BigNumber, decimals: number | null): string {
    if (decimals === null) return value.toString();
    const s = ethers.utils.formatUnits(value, decimals);
    // formatUnits keeps trailing zeros ("5.0") — trim them.
    if (!s.includes('.')) return s;
    return s.replace(/0+$/, '').replace(/\.$/, '');
}

/** Human rate, ≤6 significant digits, no exponent. */
function formatRate(rate: number): string {
    if (!Number.isFinite(rate) || rate <= 0) return '0';
    const s = rate.toPrecision(6);
    const n = Number(s);
    return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export async function deriveReceipt(opts: {
    chainId: number;
    txHash: string;
    source: ReceiptSource;
    resolveToken(token: string): Promise<TokenMeta>;
}): Promise<DerivedReceipt | null> {
    const { chainId, txHash, source, resolveToken } = opts;
    const network = getNetworkConfig(chainId);
    const nativeSymbol = RECEIPT_CHAINS[chainId].nativeSymbol;
    const sender = source.tx.from.toLowerCase();

    interface Acc {
        token: string;
        direction: 'sent' | 'received';
        counterparty: string;
        sum: BigNumber;
        logIndex: number;
    }
    const acc = new Map<string, Acc>();

    for (const log of source.logs) {
        if (log.topics[0] !== TRANSFER_TOPIC) continue;
        // ERC-721 Transfer indexes the tokenId as a fourth topic — a
        // collectable moving isn't a currency leg.
        if (log.topics.length !== 3) continue;
        const from = ('0x' + log.topics[1].slice(26)).toLowerCase();
        const to = ('0x' + log.topics[2].slice(26)).toLowerCase();
        // Self-transfers net to nothing — counting both sides would fake
        // a swap.
        if (from === to) continue;
        const direction =
            from === sender ? 'sent' : to === sender ? 'received' : null;
        if (!direction) continue;
        const counterparty = direction === 'sent' ? to : from;
        const value = BigNumber.from(log.data === '0x' ? 0 : log.data);
        const key = `${log.address.toLowerCase()}|${direction}|${counterparty}`;
        const cur = acc.get(key);
        if (cur) {
            cur.sum = cur.sum.add(value);
            if (log.logIndex < cur.logIndex) cur.logIndex = log.logIndex;
        } else {
            acc.set(key, {
                token: log.address,
                direction,
                counterparty,
                sum: value,
                logIndex: log.logIndex,
            });
        }
    }

    const legs: ReceiptLeg[] = [];

    // Native value the sender pushed with the call — a leg of the chain's
    // own token, ordered ahead of the logs it funded. (Native received
    // via internal calls isn't visible in a receipt — never guessed.)
    const nativeValue = BigNumber.from(source.tx.value);
    if (nativeValue.gt(0)) {
        legs.push({
            token: null,
            symbol: nativeSymbol,
            decimals: 18,
            amount: nativeValue.toString(),
            amountFormatted: formatAmount(nativeValue, 18),
            direction: 'sent',
            counterparty: source.tx.to ?? 'contract creation',
            logIndex: -1,
        });
    }

    const metas = new Map<string, TokenMeta | null>();
    await Promise.all(
        [...new Set([...acc.values()].map((l) => l.token.toLowerCase()))].map(
            async (token) => {
                try {
                    metas.set(token, await resolveToken(token));
                } catch {
                    metas.set(token, null);
                }
            },
        ),
    );

    for (const l of acc.values()) {
        const meta = metas.get(l.token.toLowerCase()) ?? null;
        legs.push({
            token: l.token,
            symbol: meta?.symbol ?? shortAddr(l.token),
            decimals: meta?.decimals ?? null,
            amount: l.sum.toString(),
            amountFormatted: formatAmount(l.sum, meta?.decimals ?? null),
            direction: l.direction,
            counterparty: ethers.utils.getAddress(l.counterparty),
            logIndex: l.logIndex,
        });
    }

    if (legs.length === 0) return null;

    legs.sort((a, b) => a.logIndex - b.logIndex);

    const sentLegs = legs.filter((l) => l.direction === 'sent');
    const receivedLegs = legs.filter((l) => l.direction === 'received');
    let effectiveRate: number | null = null;
    let rateText: string | null = null;
    if (
        sentLegs.length === 1 &&
        receivedLegs.length === 1 &&
        sentLegs[0].decimals !== null &&
        receivedLegs[0].decimals !== null &&
        sentLegs[0].symbol !== receivedLegs[0].symbol
    ) {
        const sent = Number(
            ethers.utils.formatUnits(sentLegs[0].amount, sentLegs[0].decimals),
        );
        const received = Number(
            ethers.utils.formatUnits(
                receivedLegs[0].amount,
                receivedLegs[0].decimals,
            ),
        );
        if (sent > 0 && received > 0) {
            effectiveRate = Number((received / sent).toPrecision(6));
            rateText = `1 ${sentLegs[0].symbol} ≈ ${formatRate(received / sent)} ${receivedLegs[0].symbol}`;
        }
    }

    const gasUsed = BigNumber.from(source.gasUsed);
    const gasPrice = BigNumber.from(source.effectiveGasPrice);
    const fee = gasUsed.mul(gasPrice);

    return {
        chainId,
        chainName: network.name,
        txHash,
        status: source.status === 1 ? 'success' : 'reverted',
        blockNumber: source.blockNumber,
        timestamp: source.blockTimestamp,
        timestampIso: new Date(source.blockTimestamp * 1000).toISOString(),
        sender: ethers.utils.getAddress(sender),
        legs,
        effectiveRate,
        rateText,
        gasFeeNative: formatAmount(fee, 18),
        nativeSymbol,
        explorerUrl: `${network.explorerUrl}/tx/${txHash}`,
    };
}

// ---------------------------------------------------------------------------
// Chain access — provider + token metadata, both cached
// ---------------------------------------------------------------------------

const providers = new Map<number, ethers.providers.JsonRpcProvider>();
function providerFor(chainId: number): ethers.providers.JsonRpcProvider {
    let p = providers.get(chainId);
    if (!p) {
        p = new ethers.providers.JsonRpcProvider(
            getNetworkConfig(chainId).rpcUrl,
        );
        providers.set(chainId, p);
    }
    return p;
}

// contract address → canonical symbol, per chain (on-chain symbols don't
// match app vocabulary — USDm reports "CUSD"; map by address).
const KNOWN_TOKENS: Record<number, Record<string, string>> =
    Object.fromEntries(
        Object.keys(RECEIPT_CHAINS).map((c) => [
            c,
            Object.fromEntries(
                Object.entries(getTokenAddresses(Number(c))).map(
                    ([symbol, address]) => [address.toLowerCase(), symbol],
                ),
            ),
        ]),
    );

const tokenMetaCache = new Map<string, TokenMeta>();
const metaIface = new ethers.utils.Interface(ERC20_META_ABI);

/** Canonical symbol first (app vocabulary), then on-chain symbol(); a
 *  token whose metadata can't be read still gets an honest short-address
 *  label downstream. */
async function resolveTokenMeta(
    view: ReceiptChainView,
    chainId: number,
    token: string,
): Promise<TokenMeta> {
    const lower = token.toLowerCase();
    const key = `${chainId}:${lower}`;
    const cached = tokenMetaCache.get(key);
    if (cached) return cached;

    const known = KNOWN_TOKENS[chainId]?.[lower];
    let onChainSymbol: string | null = null;
    let decimals: number | null = null;
    try {
        const raw = await view.call({
            to: token,
            data: metaIface.encodeFunctionData('symbol'),
        });
        onChainSymbol = metaIface.decodeFunctionResult('symbol', raw)[0];
    } catch {
        // bytes32-symbol contracts and non-standard tokens land here
    }
    try {
        const raw = await view.call({
            to: token,
            data: metaIface.encodeFunctionData('decimals'),
        });
        decimals = Number(
            metaIface.decodeFunctionResult('decimals', raw)[0],
        );
    } catch {
        // see above — decimals stays null and the raw amount is shown
    }

    const meta: TokenMeta = {
        symbol: known ?? onChainSymbol ?? shortAddr(token),
        decimals: decimals ?? 18,
    };
    tokenMetaCache.set(key, meta);
    return meta;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        p,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out`)), ms),
        ),
    ]);
}

/** Fetch + derive. Returns a reason string on failure so the handler can
 *  answer with a precise, honest 404. */
export async function getReceipt(
    chainId: number,
    txHash: string,
    view?: ReceiptChainView,
): Promise<ReceiptResult> {
    const provider = view ?? providerFor(chainId);
    const [tx, txReceipt] = (await withTimeout(
        Promise.all([
            provider.getTransaction(txHash),
            provider.getTransactionReceipt(txHash),
        ]),
        RPC_TIMEOUT_MS,
        'RPC lookup',
    )) as [
        Awaited<ReturnType<ReceiptChainView['getTransaction']>>,
        Awaited<ReturnType<ReceiptChainView['getTransactionReceipt']>>,
    ];

    if (!tx) return { ok: false, reason: 'Transaction not found' };
    if (!txReceipt)
        return { ok: false, reason: 'Transaction not yet mined' };
    if (txReceipt.status !== undefined && txReceipt.status !== 1) {
        return { ok: false, reason: 'Transaction reverted on-chain' };
    }

    const block = await withTimeout(
        provider.getBlock(txReceipt.blockNumber),
        RPC_TIMEOUT_MS,
        'Block lookup',
    );

    const receipt = await deriveReceipt({
        chainId,
        txHash,
        source: {
            tx: { from: tx.from, to: tx.to ?? null, value: tx.value },
            status: txReceipt.status ?? 1,
            blockNumber: txReceipt.blockNumber,
            blockTimestamp: block.timestamp,
            gasUsed: txReceipt.gasUsed,
            effectiveGasPrice: txReceipt.effectiveGasPrice,
            logs: txReceipt.logs,
        },
        resolveToken: (token) => resolveTokenMeta(provider, chainId, token),
    });

    if (!receipt) {
        return {
            ok: false,
            reason: 'No transfers involving the sender in this transaction',
        };
    }
    return { ok: true, receipt };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// In-memory: `${chainId}:${hash}` → result. Confirmed txs are immutable,
// so a hit is always safe; misses cache for only 20s because a pending
// tx may land on the next lookup.
const resultCache = new Map<string, { data: ReceiptResult; expiry: number }>();

function cacheSet(key: string, data: ReceiptResult, ttl: number) {
    if (resultCache.size >= CACHE_MAX) {
        const oldest = resultCache.keys().next().value;
        if (oldest !== undefined) resultCache.delete(oldest);
    }
    resultCache.set(key, { data, expiry: Date.now() + ttl });
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { chainId: rawChain, txHash } = req.query;
    const chainId = Number(
        Array.isArray(rawChain) ? rawChain[0] : rawChain,
    );
    const hash = (Array.isArray(txHash) ? txHash[0] : txHash) ?? '';

    if (!Number.isInteger(chainId) || !RECEIPT_CHAINS[chainId]) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(400).json({
            error: 'Unsupported "chainId" — receipts read Celo (42220) and Arbitrum (42161)',
        });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        res.setHeader('Cache-Control', 'no-store');
        return res
            .status(400)
            .json({ error: 'Invalid "txHash" parameter' });
    }

    const key = `${chainId}:${hash.toLowerCase()}`;
    const cached = resultCache.get(key);
    if (cached && cached.expiry > Date.now()) {
        if (cached.data.ok) {
            res.setHeader(
                'Cache-Control',
                'public, s-maxage=31536000, immutable',
            );
            return res.status(200).json(cached.data.receipt);
        }
        res.setHeader('Cache-Control', 'public, s-maxage=20');
        return res.status(404).json({ error: cached.data.reason });
    }

    try {
        const result = await getReceipt(chainId, hash);
        if (result.ok) {
            // Mined and successful — the receipt can never change.
            res.setHeader(
                'Cache-Control',
                'public, s-maxage=31536000, immutable',
            );
            cacheSet(key, result, CACHE_TTL_MS);
            return res.status(200).json(result.receipt);
        }
        res.setHeader('Cache-Control', 'public, s-maxage=20');
        cacheSet(key, result, NEGATIVE_TTL_MS);
        return res.status(404).json({ error: result.reason });
    } catch (err) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(502).json({
            error: (err as Error | null)?.message ?? 'RPC lookup failed',
        });
    }
}
