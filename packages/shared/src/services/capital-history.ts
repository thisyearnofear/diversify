/**
 * capital-history — "where your savings have lived", derived purely from
 * an address's ERC-20 transfers on Celo (Blockscout API shape).
 *
 * Stations are the currencies the wallet has received, in order of first
 * arrival. Legs are settled swaps: a tx where the wallet sent exactly one
 * currency token and received exactly one different currency token.
 * Anything more ambiguous (multi-token txs, plain sends) is skipped —
 * never guessed.
 *
 * NOTE: on-chain token symbols do NOT match our canonical symbols (USDm
 * reports "CUSD" on-chain). Callers must map by contract address —
 * `tokenByAddress` is keyed by lowercased address.
 */

export interface BlockscoutTransfer {
    transaction_hash: string;
    timestamp: string;
    from: { hash: string };
    to: { hash: string };
    token: { address_hash: string };
    total: { value: string; decimals: string | null };
}

export interface CapitalLeg {
    from: string;
    to: string;
    txHash: string;
    at: string;
    amountIn: string;
    amountOut: string;
}

export interface CapitalStation {
    symbol: string;
    firstSeen: string;
    lastSeen: string;
}

export interface CapitalHistory {
    address: string;
    chainId: 42220;
    stations: CapitalStation[];
    legs: CapitalLeg[];
    /** False when the transfer window was capped before the first page —
     *  the caller can't claim a "since" date it didn't reach. */
    complete: boolean;
    asOf: string;
}

const MAX_LEGS = 20;

/** Raw integer string → exact decimal string, no floats. */
function formatUnits(value: string, decimals: number): string {
    const v = BigInt(value);
    if (decimals <= 0) return v.toString();
    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = (v % base)
        .toString()
        .padStart(decimals, '0')
        .replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
}

export function deriveCapitalHistory(args: {
    wallet: string;
    transfers: BlockscoutTransfer[];
    tokenByAddress: Record<string, string>;
    isCurrency(symbol: string): boolean;
    complete: boolean;
    now: string;
}): CapitalHistory {
    const { wallet, transfers, tokenByAddress, isCurrency, complete, now } =
        args;
    const w = wallet.toLowerCase();

    // Keep only transfers of tokens we can identify as currencies.
    const relevant = transfers
        .map((t) => ({
            ...t,
            symbol: tokenByAddress[t.token.address_hash.toLowerCase()],
        }))
        .filter(
            (t): t is typeof t & { symbol: string } =>
                Boolean(t.symbol) && isCurrency(t.symbol),
        );

    // Stations: every currency the wallet has received, mints included.
    const stationMap = new Map<string, { firstSeen: string; lastSeen: string }>();
    for (const t of relevant) {
        if (t.to.hash.toLowerCase() !== w) continue;
        const s = stationMap.get(t.symbol);
        if (!s) {
            stationMap.set(t.symbol, {
                firstSeen: t.timestamp,
                lastSeen: t.timestamp,
            });
        } else {
            if (t.timestamp < s.firstSeen) s.firstSeen = t.timestamp;
            if (t.timestamp > s.lastSeen) s.lastSeen = t.timestamp;
        }
    }
    const stations = [...stationMap.entries()]
        .map(([symbol, s]) => ({ symbol, ...s }))
        .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));

    // Legs: within one tx, exactly one currency out and exactly one
    // different currency in. Anything else is skipped.
    const byTx = new Map<string, typeof relevant>();
    for (const t of relevant) {
        const arr = byTx.get(t.transaction_hash) ?? [];
        arr.push(t);
        byTx.set(t.transaction_hash, arr);
    }
    const legs: CapitalLeg[] = [];
    for (const [txHash, ts] of byTx) {
        const out = new Map<string, { sum: bigint; decimals: number }>();
        const inn = new Map<string, { sum: bigint; decimals: number }>();
        for (const t of ts) {
            const decimals = Number(t.total.decimals ?? 18);
            const side =
                t.from.hash.toLowerCase() === w
                    ? out
                    : t.to.hash.toLowerCase() === w
                      ? inn
                      : null;
            if (!side) continue;
            const cur = side.get(t.symbol) ?? { sum: 0n, decimals };
            cur.sum += BigInt(t.total.value);
            side.set(t.symbol, cur);
        }
        if (out.size !== 1 || inn.size !== 1) continue;
        const [[fromSym, outSum]] = out;
        const [[toSym, inSum]] = inn;
        if (fromSym === toSym) continue;
        legs.push({
            from: fromSym,
            to: toSym,
            txHash,
            at: ts[0].timestamp,
            amountIn: formatUnits(outSum.sum.toString(), outSum.decimals),
            amountOut: formatUnits(inSum.sum.toString(), inSum.decimals),
        });
    }
    legs.sort((a, b) => b.at.localeCompare(a.at));

    return {
        address: wallet,
        chainId: 42220,
        stations,
        legs: legs.slice(0, MAX_LEGS),
        complete,
        asOf: now,
    };
}
