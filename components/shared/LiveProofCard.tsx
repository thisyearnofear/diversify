/**
 * LiveProofCard — Visible "this product is real" surface.
 *
 * Shows verifiable on-chain activity before the user connects a wallet.
 * Chain label and explorer URL come from the proof feed API — not hardcoded
 * to a single testnet name.
 *
 * Pure presentational component. The data hook is `useProofFeed` from
 * `@/hooks/use-proof-feed`; the data is read from a page-level
 * `ProofFeedProvider` if mounted, or fetched by the hook standalone.
 *
 * Per the Core Principles:
 *   - ENHANCEMENT FIRST: reuses the existing gradient-card pattern from
 *     the Protect hero card and the Overview "Protect Your Savings" card.
 *   - CLEAN: explicit props for every visible state. No implicit state.
 *   - MODULAR: no fetches, no side effects. Easy to test in isolation.
 *   - ORGANIZED: lives in components/shared/ so any tab can import it.
 *
 * Visual states (driven by the hook):
 *   - loading + no data: skeleton row
 *   - loaded: full card with stats
 *   - error + no cache: degraded card with explorer link only
 *   - error + cache: card with stats and a "cached 2 min ago" hint
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useProofFeed, type LedgerRecommendation } from '@/hooks/use-proof-feed';
import {
  getLedgerProofTitle,
  getLedgerFreshnessLabel,
  getMultiChainProofTitle,
  getMultiChainFreshnessLabel,
  getLedgerProofLabel,
  getProofTxUrl,
} from '@/constants/proof-feed';

const SHORT_ADDRESS_RE = /^(0x[0-9a-fA-F]{4})[0-9a-fA-F]+(0x[0-9a-fA-F]{4})$/;

function shortAddress(addr: string | null | undefined): string {
    if (!addr) return '';
    const m = SHORT_ADDRESS_RE.exec(addr);
    return m ? `${m[1]}…${m[2]}` : addr;
}

// Ledger actions are machine vocabulary; the ticker is read by people
// doing a legitimacy check, so translate rather than shout enum names.
const ACTION_LABELS: Record<string, string> = {
    ADVISORY_HEARTBEAT: 'Guardian check-in',
    REBALANCE: 'Rebalance',
    SWAP: 'Swap',
    HOLD: 'Hold steady',
};

function humanizeAction(action: string): string {
    const key = action.toUpperCase();
    return ACTION_LABELS[key] ?? action.replace(/_/g, ' ').toLowerCase();
}

function timeAgo(iso: string, nowMs: number = Date.now()): string {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const seconds = Math.max(0, Math.floor((nowMs - t) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${days} d ago`;
}

export interface LiveProofCardProps {
    variant?: 'full' | 'compact';
}

export function LiveProofCard({ variant = 'full' }: LiveProofCardProps) {
    const { data, isLoading, isStale, error } = useProofFeed();
    const prefersReducedMotion = useReducedMotion();

    const stats = data?.stats;
    const contractExplorer = data?.contractExplorer;
    const latest = data?.recent?.[0];
    const isCompact = variant === 'compact';

    // ── Skeleton ──
    if (isLoading && !data) {
        return (
            <div
                className={`rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20 p-4 ${prefersReducedMotion ? '' : 'animate-pulse'}`}
                role="status"
                aria-label="Loading on-chain statistics"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 bg-emerald-100 dark:bg-emerald-900/40 rounded w-2/3" />
                        <div className="h-2 bg-emerald-100/60 dark:bg-emerald-900/30 rounded w-1/3" />
                    </div>
                </div>
                <div className="h-3 bg-emerald-100/60 dark:bg-emerald-900/30 rounded w-1/2" />
            </div>
        );
    }

    // ── Degraded (no data, no cache, fetch failed) ──
    if (!data && error) {
        const fallbackExplorer = 'https://celoscan.io';
        return (
            <div className="rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <span>⚠️</span>
                    <span>Live receipts unavailable</span>
                </div>
                <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                    Protection records are still written on-chain. Try again in a moment.
                </p>
                <a
                    href={fallbackExplorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-bold text-amber-700 dark:text-amber-300 underline"
                >
                    Browse verified ledgers →
                </a>
            </div>
        );
    }

    // ── Loaded (or stale) ──
    if (isCompact) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20 p-4"
                data-testid="live-proof-card"
                data-variant="compact"
            >
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                        <span aria-hidden="true">🛡️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                            Protection is happening
                        </h3>
                        {stats && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                                {stats.totalRecommendations.toLocaleString()} Guardian decisions recorded on-chain
                                {latest ? ` · latest ${timeAgo(new Date(latest.timestamp * 1000).toISOString())}` : ''}
                            </p>
                        )}
                        {contractExplorer && (
                            <a
                                href={contractExplorer}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-xs font-bold text-emerald-700 dark:text-emerald-300 underline hover:no-underline"
                            >
                                See proof →
                            </a>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    const chainIds = stats?.chainIds ?? (stats?.chainId != null ? [stats.chainId] : []);
    const proofTitle =
        chainIds.length > 1 ? getMultiChainProofTitle(chainIds) : getLedgerProofTitle(stats?.chainId);
    const freshnessLabel =
        chainIds.length > 1
            ? getMultiChainFreshnessLabel(chainIds, isStale)
            : getLedgerFreshnessLabel(stats?.chainId, isStale);

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20 p-4"
            data-testid="live-proof-card"
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <span className="text-base" aria-hidden="true">🔗</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                            {proofTitle}
                        </h3>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            {freshnessLabel}
                        </p>
                    </div>
                </div>
                {stats && (
                    <div className="text-right" role="status" aria-label={`${stats.totalRecommendations.toLocaleString()} on-chain receipts recorded`}>
                        <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100 tabular-nums" aria-hidden="true">
                            {stats.totalRecommendations.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider" aria-hidden="true">
                            on-chain receipts
                        </div>
                    </div>
                )}
            </div>

            <details className="text-xs">
                <summary className="cursor-pointer font-bold text-emerald-700 dark:text-emerald-300 hover:underline">
                    Contract address
                </summary>
                <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="font-mono text-emerald-700 dark:text-emerald-300 break-all">
                        {shortAddress(stats?.contractAddress ?? contractExplorer)}
                    </div>
                    {contractExplorer && (
                        <a
                            href={contractExplorer}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 dark:text-emerald-300 font-bold underline hover:no-underline whitespace-nowrap"
                        >
                            View on-chain →
                        </a>
                    )}
                </div>
            </details>

            {isStale && data?.capturedAt && (
                <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-bold" role="status">
                    Showing last known data ({timeAgo(data.capturedAt)}).
                </p>
            )}
        </motion.div>
    );
}

/**
 * LiveProofTicker — A compact "what's been verified recently" list.
 * Shows the most recent N recommendations from the proof feed so the
 * unconnected user sees live activity without a wallet.
 */
export function LiveProofTicker({ limit = 3 }: { limit?: number }) {
    const { data, isLoading } = useProofFeed();
    const prefersReducedMotion = useReducedMotion();
    const recent: LedgerRecommendation[] = (data?.recent ?? []).slice(0, limit);

    if (isLoading && !data) {
        return (
            <div
                className={`rounded-xl border border-gray-100 dark:border-gray-800 p-3 space-y-2 ${prefersReducedMotion ? '' : 'animate-pulse'}`}
                role="status"
                aria-label="Loading recent activity"
            >
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
                <div className="h-2 bg-gray-100/60 dark:bg-gray-800/60 rounded w-2/3" />
            </div>
        );
    }

    if (recent.length === 0) {
        return null;
    }

    return (
        <div
            className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white/40 dark:bg-gray-900/40 p-3"
            data-testid="live-proof-ticker"
        >
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-2">
                Recent on-chain activity
            </h4>
            <ul className="space-y-1.5" aria-live="polite" aria-atomic="true">
                {recent.map((rec) => {
                    const txUrl = getProofTxUrl(
                        data?.contractExplorers,
                        data?.explorerBase,
                        rec.chainId,
                        rec.settlementTxHash,
                    );
                    const row = (
                        <>
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {rec.chainId != null && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 shrink-0">
                                    {getLedgerProofLabel(rec.chainId)}
                                </span>
                            )}
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                #{rec.id}
                            </span>
                            <span className="font-bold">
                                {humanizeAction(rec.action)}
                            </span>
                            {rec.targetToken && (
                                <span className="text-emerald-700 dark:text-emerald-300">
                                    → {rec.targetToken}
                                </span>
                            )}
                            <span
                                className="ml-auto text-emerald-600/60 dark:text-emerald-400/60 font-bold tabular-nums"
                                title={`Guardian confidence in this decision: ${Math.round(rec.confidence * 100)}%`}
                            >
                                {Math.round(rec.confidence * 100)}% conf.
                            </span>
                            {txUrl && <span aria-hidden="true" className="text-emerald-600/60 dark:text-emerald-400/60">↗</span>}
                        </>
                    );
                    return (
                        <li key={`${rec.chainId ?? 0}-${rec.id}`} className="text-[11px] text-emerald-900 dark:text-emerald-100">
                            {txUrl ? (
                                <a
                                    href={txUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View this receipt on the block explorer"
                                    className="flex items-center gap-2 hover:underline"
                                >
                                    {row}
                                </a>
                            ) : (
                                <span className="flex items-center gap-2">{row}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
