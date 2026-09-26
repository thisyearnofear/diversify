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
    /** 'swap' = one currency out and a different one in, same tx.
     *  'sent'/'received' = a bare one-sided transfer — labeled honestly
     *  downstream, never dressed up as a swap. Optional only so older
     *  literals keep compiling; deriveCapitalHistory always sets it. */
    kind?: 'swap' | 'sent' | 'received';
    /** The chain this leg settled on — optional for the same reason. */
    chainId?: number;
    /** Empty string on a 'received' leg (nothing went out). */
    from: string;
    /** Empty string on a 'sent' leg (nothing came in). */
    to: string;
    txHash: string;
    at: string;
    /** Amount out of the wallet — '' on 'received' legs. */
    amountIn: string;
    /** Amount into the wallet — '' on 'sent' legs. */
    amountOut: string;
}

export interface CapitalStation {
    symbol: string;
    firstSeen: string;
    lastSeen: string;
}

export interface CapitalHistory {
    address: string;
    /** First chain read — kept for back-compat; consumers should prefer
     *  `chains`, which names every chain actually read. */
    chainId: number;
    /** Chains this history was actually derived from — a chain whose
     *  fetch failed isn't listed, so the footer never claims coverage
     *  it didn't get. Optional for older literals. */
    chains?: number[];
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
    /** The chain these transfers were read from — defaults to Celo. */
    chainId?: number;
}): CapitalHistory {
    const {
        wallet,
        transfers,
        tokenByAddress,
        isCurrency,
        complete,
        now,
        chainId = 42220,
    } = args;
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
    // different currency in is a swap. One-sided currency moves are kept
    // too — labeled 'sent'/'received' so they read as transfers, not
    // swaps. Anything more ambiguous is skipped — never guessed.
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
        const at = ts[0].timestamp;
        if (out.size === 1 && inn.size === 1) {
            const [[fromSym, outSum]] = out;
            const [[toSym, inSum]] = inn;
            if (fromSym === toSym) continue;
            legs.push({
                kind: 'swap',
                chainId,
                from: fromSym,
                to: toSym,
                txHash,
                at,
                amountIn: formatUnits(outSum.sum.toString(), outSum.decimals),
                amountOut: formatUnits(inSum.sum.toString(), inSum.decimals),
            });
        } else if (out.size === 1 && inn.size === 0) {
            const [[fromSym, outSum]] = out;
            legs.push({
                kind: 'sent',
                chainId,
                from: fromSym,
                to: '',
                txHash,
                at,
                amountIn: formatUnits(outSum.sum.toString(), outSum.decimals),
                amountOut: '',
            });
        } else if (out.size === 0 && inn.size === 1) {
            const [[toSym, inSum]] = inn;
            legs.push({
                kind: 'received',
                chainId,
                from: '',
                to: toSym,
                txHash,
                at,
                amountIn: '',
                amountOut: formatUnits(inSum.sum.toString(), inSum.decimals),
            });
        }
        // Multi-token txs stay ambiguous — skipped, never guessed.
    }
    legs.sort((a, b) => b.at.localeCompare(a.at));

    return {
        address: wallet,
        chainId,
        chains: [chainId],
        stations,
        legs: legs.slice(0, MAX_LEGS),
        complete,
        asOf: now,
    };
}

/** Merge per-chain histories into one wallet journey: stations dedupe by
 *  symbol (earliest firstSeen wins), legs concat + re-sort newest first,
 *  `chains` names every chain actually read, and `complete` holds only
 *  when every source reached its first page. */
export function mergeCapitalHistories(parts: CapitalHistory[]): CapitalHistory {
    const stationMap = new Map<string, CapitalStation>();
    for (const p of parts) {
        for (const s of p.stations) {
            const cur = stationMap.get(s.symbol);
            if (!cur) {
                stationMap.set(s.symbol, { ...s });
            } else {
                if (s.firstSeen < cur.firstSeen) cur.firstSeen = s.firstSeen;
                if (s.lastSeen > cur.lastSeen) cur.lastSeen = s.lastSeen;
            }
        }
    }
    const stations = [...stationMap.values()].sort((a, b) =>
        a.firstSeen.localeCompare(b.firstSeen),
    );
    const legs = parts
        .flatMap((p) => p.legs)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, MAX_LEGS);
    return {
        address: parts[0]?.address ?? '',
        chainId: parts[0]?.chainId ?? 42220,
        chains: parts.map((p) => p.chainId),
        stations,
        legs,
        complete: parts.length > 0 && parts.every((p) => p.complete),
        asOf: parts[0]?.asOf ?? new Date().toISOString(),
    };
}
