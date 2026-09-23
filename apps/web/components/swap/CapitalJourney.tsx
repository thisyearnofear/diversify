/**
 * CapitalJourney — "Where your savings have lived", the pair's memory.
 * One station coin per currency the wallet has received, in order of
 * first arrival, joined by connector segments. Held stations are full
 * opacity with solid connectors; departed ones sit at 40% with dashes.
 * Walletless users get nothing — never a sample.
 */
import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TokenIcon } from '../shared/TokenIcon';
import { MintMark } from './MintMark';
import { FlickScrollRow } from '../shared/FlickScrollRow';
import { corridorSideFor } from '@/lib/corridor-context';
import { provenanceFor } from '@diversifi/shared/src/constants/token-provenance';
import { springPop, STAGGER_STEP_S } from '@/lib/motion-tokens';
import type { CapitalHistory } from '@diversifi/shared/src/services/capital-history';

interface TokenBalanceLike {
    value?: number;
}

function flagFor(symbol: string): string | null {
    return (
        provenanceFor(symbol)?.origin.flag ??
        corridorSideFor(symbol)?.flag ??
        null
    );
}

export function CapitalJourney({
    history,
    tokenBalances,
    optimisticSymbol = null,
    onInspectJourney,
}: {
    history: CapitalHistory | null;
    tokenBalances: Record<string, TokenBalanceLike>;
    /** A just-settled destination, appended optimistically when the chain
     *  hasn't indexed it yet — de-duped once real data arrives. */
    optimisticSymbol?: string | null;
    onInspectJourney?: () => void;
}) {
    const reduced = useReducedMotion();
    const stations = useMemo(() => {
        const base = history?.stations ?? [];
        if (
            optimisticSymbol &&
            !base.some((s) => s.symbol === optimisticSymbol)
        ) {
            const now = new Date().toISOString();
            return [
                ...base,
                { symbol: optimisticSymbol, firstSeen: now, lastSeen: now },
            ];
        }
        return base;
    }, [history, optimisticSymbol]);

    if (stations.length < 2) return null;

    const held = (symbol: string) =>
        (tokenBalances[symbol]?.value ?? 0) > 0;
    const heldCount = stations.filter((s) => held(s.symbol)).length;
    const since = new Date(stations[0].firstSeen).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
    });
    const line = history?.complete
        ? `Since ${since} · ${stations.length} currencies · ${heldCount} still held`
        : `Recent history · ${stations.length} currencies · ${heldCount} still held`;

    return (
        <div
            role="button"
            tabIndex={0}
            data-testid="capital-journey"
            onClick={onInspectJourney}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onInspectJourney?.();
                }
            }}
            className="mt-3 w-full cursor-pointer rounded-xl px-1 py-2 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Where your savings have lived
            </p>
            <FlickScrollRow
                className="mt-1.5 items-center gap-0"
                chevrons={false}
                edgeSize={16}
            >
                {stations.map((s, i) => {
                    const isHeld = held(s.symbol);
                    const flag = flagFor(s.symbol);
                    return (
                        <React.Fragment key={s.symbol}>
                            {i > 0 && (
                                <motion.span
                                    aria-hidden
                                    data-held={isHeld && held(stations[i - 1].symbol)}
                                    initial={reduced ? false : { scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{
                                        duration: 0.3,
                                        delay: reduced ? 0 : i * STAGGER_STEP_S,
                                    }}
                                    className={`h-[1.5px] w-4 shrink-0 origin-left ${
                                        isHeld && held(stations[i - 1].symbol)
                                            ? 'bg-gray-400 dark:bg-white/25'
                                            : 'border-t-[1.5px] border-dashed border-gray-300 opacity-40 dark:border-gray-600'
                                    }`}
                                />
                            )}
                            <motion.span
                                data-testid={`journey-station-${s.symbol}`}
                                data-held={isHeld}
                                initial={
                                    reduced ? false : { scale: 0, opacity: 0 }
                                }
                                animate={{ scale: 1, opacity: isHeld ? 1 : 0.4 }}
                                transition={{
                                    ...springPop,
                                    delay: reduced ? 0 : i * STAGGER_STEP_S,
                                }}
                                className="relative inline-flex shrink-0"
                            >
                                <TokenIcon symbol={s.symbol} size={28} />
                                {flag && (
                                    <MintMark className="h-3.5 w-3.5 bg-white text-[8px] leading-none ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
                                        {flag}
                                    </MintMark>
                                )}
                            </motion.span>
                        </React.Fragment>
                    );
                })}
            </FlickScrollRow>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {line}
            </p>
        </div>
    );
}

export default CapitalJourney;
