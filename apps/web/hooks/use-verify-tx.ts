/**
 * useVerifiedTxs — chain-RPC verification for proof-feed rows.
 *
 * The proof feed reads ledger records; this hook independently confirms
 * each displayed receipt against the chain's RPC via
 * `GET /api/agent/zero-g-ledger?verify=<txHash>&chainId=<id>`. The
 * endpoint's `verified` flag requires the receipt to be addressed to the
 * configured ledger contract on that chain — so a row only earns the
 * chain-checked badge when the chain itself attests to it.
 *
 * Results are cached in a module-level map (a receipt's verification
 * status is immutable), keyed by `${chainId}:${txHash}`. Concurrency is
 * bounded so a full card of rows doesn't burst the API.
 *
 * Per the Core Principles:
 *   - DRY: every proof-feed surface (LiveProofCard, LiveProofTicker)
 *     shares this hook and its cache.
 *   - CLEAN: honest states only — `verified` means chain-checked;
 *     everything else renders no extra claim.
 *   - PERFORMANT: bounded concurrency, immutable-result cache, aborts on
 *     unmount.
 */

import { useEffect, useRef, useState } from 'react';

export type VerificationStatus = 'verified' | 'unverified' | 'checking';

export interface VerifiableTxRow {
    /** Stable row key — feed rows key on `${chainId}:${id}`. */
    key: string;
    /** Settlement/anchor tx hash. Rows without a real hash are skipped. */
    txHash?: string | null;
    /** Ledger chain the row belongs to. */
    chainId?: number | null;
}

const EMPTY_HASH_RE = /^0x0*$/;
const MAX_CONCURRENT = 4;

/** Verification results are immutable per (chainId, txHash). */
const verificationCache = new Map<string, VerificationStatus>();

function verifyKey(row: Pick<VerifiableTxRow, 'txHash' | 'chainId'>): string | null {
    if (!row.txHash || EMPTY_HASH_RE.test(row.txHash)) return null;
    if (row.chainId == null) return null;
    return `${row.chainId}:${row.txHash}`;
}

async function fetchVerification(key: string): Promise<VerificationStatus> {
    const separator = key.indexOf(':');
    const chainId = key.slice(0, separator);
    const txHash = key.slice(separator + 1);
    const resp = await fetch(
        `/api/agent/zero-g-ledger?verify=${encodeURIComponent(txHash)}&chainId=${chainId}`,
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    return json?.verified === true ? 'verified' : 'unverified';
}

export function useVerifiedTxs(rows: VerifiableTxRow[]): Record<string, VerificationStatus> {
    // Snapshot the pending key list once per render; effects key on it.
    const rowsKey = rows.map((r) => r.key).join('|');
    const keysRef = useRef<VerifiableTxRow[]>(rows);
    keysRef.current = rows;

    const [statuses, setStatuses] = useState<Record<string, VerificationStatus>>({});
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const pending = keysRef.current
            .map((row) => ({ row, key: verifyKey(row) }))
            .filter(
                (entry): entry is { row: VerifiableTxRow; key: string } =>
                    entry.key !== null &&
                    verificationCache.get(entry.key) === undefined &&
                    statuses[entry.key] === undefined,
            );

        if (pending.length === 0) return;

        // Seed 'checking' for everything we're about to request.
        setStatuses((prev) => {
            const next = { ...prev };
            for (const { row } of pending) next[row.key] = 'checking';
            return next;
        });

        const controller = new AbortController();
        abortRef.current = controller;

        let cancelled = false;
        let cursor = 0;

        const runNext = async (): Promise<void> => {
            if (cursor >= pending.length) return;
            const { row, key } = pending[cursor++];
            try {
                const status = await fetchVerification(key);
                if (controller.signal.aborted) return;
                verificationCache.set(key, status);
                if (!cancelled) {
                    setStatuses((prev) => ({ ...prev, [row.key]: status }));
                }
            } catch {
                // Network/API failure: no claim either way. Don't cache so a
                // later mount retries once the RPC is reachable.
                if (controller.signal.aborted) return;
                if (!cancelled) {
                    setStatuses((prev) => {
                        const next = { ...prev };
                        delete next[row.key];
                        return next;
                    });
                }
            }
            await runNext();
        };

        for (let i = 0; i < Math.min(MAX_CONCURRENT, pending.length); i++) {
            void runNext();
        }

        return () => {
            cancelled = true;
            controller.abort();
        };
        // rowsKey tracks identity; statuses intentionally omitted — we read
        // it only via the initializer closure above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowsKey]);

    // Overlay cached results (keyed by row key) so callers see them
    // immediately on re-mounts.
    const merged: Record<string, VerificationStatus> = { ...statuses };
    for (const row of rows) {
        const key = verifyKey(row);
        if (key && verificationCache.has(key) && merged[row.key] === undefined) {
            merged[row.key] = verificationCache.get(key)!;
        }
    }
    return merged;
}
