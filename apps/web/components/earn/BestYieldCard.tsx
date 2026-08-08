import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../shared/TabComponents';
import {
  deriveYieldFocusKey,
  useBestYield,
  type BestYieldRecommendation,
} from '../../hooks/use-best-yield';
import { useSwap } from '../../hooks/use-swap';
import { useNavigation, FOCUS_HIGHLIGHT_MS } from '@/context/app/NavigationContext';
import { trackFunnelEvent } from '@/lib/analytics';

const ARBITRUM = 42161;

/** Inline "deposit USDC into this GM pool" control for a GMX recommendation. */
function GmDepositControl() {
  const { swap, chainId, step, isLoading, error, txHash } = useSwap();
  const [amount, setAmount] = useState('');
  const onArbitrum = chainId === ARBITRUM;

  const onDeposit = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await swap({ fromToken: 'USDC', toToken: 'GM', amount: amount });
  };

  if (txHash && step !== 'error') {
    return <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2">✅ Deposit submitted — GMX mints your GM tokens shortly.</p>;
  }

  return (
    <div className="mt-2">
      {!onArbitrum ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">Switch to Arbitrum to deposit into this GM pool.</p>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="USDC amount"
            aria-label="USDC amount to deposit"
            className="flex-1 min-w-0 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5"
          />
          <button
            type="button"
            onClick={onDeposit}
            disabled={isLoading || !amount}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-600 text-white disabled:opacity-50"
          >
            {isLoading ? 'Depositing…' : 'Deposit'}
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  'vaults.fyi': { label: 'Personalized', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  gmx: { label: 'GMX pool', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  free: { label: 'Live', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
};

function sourceOf(rec: BestYieldRecommendation): { label: string; cls: string } {
  // Top-level `source` is preferred; fall back to legacy `metadata?.source`
  // for rows emitted before the producer-promotion commit landed.
  const s = rec.source ?? rec.metadata?.source;
  return s === 'vaults.fyi' ? SOURCE_BADGE['vaults.fyi'] : s === 'gmx' ? SOURCE_BADGE.gmx : SOURCE_BADGE.free;
}

interface BestYieldCardProps {
  userAddress: string | null;
  className?: string;
}

/**
 * "Best yield for you" — the personalized layer (vaults.fyi + GMX + free LI.FI)
 * on top of the free YieldDiscoverySection. Free-tier users see the free yields
 * plus an unlock prompt for the personalized layer. The tier is resolved
 * server-side from on-chain balance, so this card just sends the address.
 */
export function BestYieldCard({ userAddress, className = '' }: BestYieldCardProps) {
  const { data, isLoading, error } = useBestYield(userAddress);
  const { focusedYieldKey, setFocusedYieldKey, navigateToSwap } = useNavigation();
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [activeChainIds, setActiveChainIds] = useState<Set<number>>(() => new Set());
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // Hook order invariant: ALL hooks must run unconditionally above the
  // early returns (`if (!userAddress) return null`). React's rule of
  // hooks — calling fewer/more hooks across renders crashes with
  // "rendered more hooks than during the previous render". Slice the
  // rec list into a useMemo so downstream memos can read it without
  // re-shuffling on every render.
  const recs = useMemo<BestYieldRecommendation[]>(
    () => (data ? data.recommendations.slice(0, 4) : []),
    [data],
  );

  // Chip set: derived from rows currently shown (≤5 rows, so the chip
  // list is naturally short). Showing chips for chains with ZERO rows
  // is dead UI.
  const availableChains = useMemo<Array<[number, string]>>(() => {
    const seen = new Map<number, string>();
    for (const r of recs) {
      if (r.chainId != null && r.chain && !seen.has(r.chainId)) {
        seen.set(r.chainId, r.chain);
      }
    }
    return Array.from(seen.entries());
  }, [recs]);

  // Filter invariant: when drawer's focusedYieldKey fires (including
  // cross-chain Guardian auto-alerts routed through use-proactive-agent),
  // clear local filter state so the target row mounts and the
  // scroll/highlight works. Without this a focused row whose chain is
  // currently filtered-out never renders and the highlight silently
  // fails.
  useEffect(() => {
    if (focusedYieldKey) {
      setActiveChainIds(new Set());
    }
  }, [focusedYieldKey]);

  // Prune active chip state when the underlying dataset swaps a chain
  // OUT (e.g. a refresh replaced Arbitrum with Optimism). Without this
  // a stale chainId would sit in `activeChainIds` and zero rows could
  // match.
  useEffect(() => {
    setActiveChainIds((prev) => {
      if (prev.size === 0) return prev;
      const availableIds = new Set(availableChains.map(([id]) => id));
      const next = new Set<number>();
      let changed = false;
      for (const id of prev) {
        if (availableIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [availableChains]);

  // Filter applied for the rendered list. Empty active set = "show all".
  const visibleRecs = useMemo<BestYieldRecommendation[]>(() => {
    if (activeChainIds.size === 0) return recs;
    return recs.filter((r) => r.chainId != null && activeChainIds.has(r.chainId));
  }, [recs, activeChainIds]);

  // The drawer's open_yield_review handler may focus on a specific row.
  // Scroll it into view and pulse-highlight so the user can verify the
  // reviewer is looking at the right opportunity rather than the cheapest
  // one in the list.
  useEffect(() => {
    if (!focusedYieldKey) return;
    const node = rowRefs.current[focusedYieldKey];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedKey(focusedYieldKey);
    const handle = setTimeout(() => {
      setHighlightedKey(null);
      setFocusedYieldKey(null);
    }, FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(handle);
  }, [focusedYieldKey, setFocusedYieldKey]);

  // toggleChain is a regular callback (no hook). Defined here but used
  // only in the JSX block below; safe to recreate per render.
  const toggleChain = (chainId: number, chainName: string) => {
    setActiveChainIds((prev) => {
      const next = new Set(prev);
      const willBeActive = !next.has(chainId);
      if (willBeActive) next.add(chainId);
      else next.delete(chainId);
      trackFunnelEvent('yield_chain_filter_toggled', {
        chain: chainName,
        active: String(willBeActive),
      });
      return next;
    });
  };

  if (!userAddress) return null;
  if (isLoading && !data) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-3" />
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      </Card>
    );
  }
  if (error || !data || data.recommendations.length === 0) return null;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-gray-900 dark:text-white">Best yield for you</h3>
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{data.tierLabel}</span>
      </div>

      {availableChains.length > 1 && (
        <div
          role="toolbar"
          aria-label="Filter by chain"
          className="flex overflow-x-auto gap-2 mb-3 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {availableChains.map(([chainId, chainName]) => {
            const isActive = activeChainIds.has(chainId);
            return (
              <button
                key={chainId}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleChain(chainId, chainName)}
                className={`shrink-0 min-h-[44px] px-4 rounded-full text-xs font-bold transition-colors border ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {chainName}
              </button>
            );
          })}
        </div>
      )}

      <ul className="space-y-2" aria-label="Best yield opportunities">
        {visibleRecs.map((rec) => {
          const badge = sourceOf(rec);
          // APY: prefer top-level typed field; fall back to legacy
          // `metadata.apy` for rows emitted before the producer was
          // updated. Same fallback pattern, no `as` cast.
          const apy = typeof rec.apy === 'number'
            ? rec.apy
            : typeof rec.metadata?.apy === 'number'
              ? rec.metadata.apy
              : null;
          // deriveYieldFocusKey is the same helper the drawer uses, so
          // the two sides cannot drift out of sync.
          const rowKey = deriveYieldFocusKey(rec);
          const isHighlighted = highlightedKey === rowKey;
          return (
            <li
              key={rec.id}
              ref={(node) => {
                rowRefs.current[rowKey] = node;
              }}
              className={`flex items-start gap-3 rounded-xl p-3 transition-colors${
                isHighlighted
                  ? ' bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-300 dark:ring-amber-600'
                  : ' bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{rec.title}</p>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{rec.description}</p>
                {rec.metadata?.source === 'gmx' && rec.metadata?.venue === 'gm-pool' && <GmDepositControl />}
                {/* TODO: when `rec.source` is `gmx`, also render the
                    GmDepositControl without relying on metadata.venue.
                    The legacy `metadata.venue` check stays until every
                    yield source emits a top-level `venue`/`actions` field. */}
                {rec.chainId != null && (
                  <button
                    type="button"
                    aria-label={`Review ${rec.title} in swap`}
                    onClick={() => {
                      // Token-resolution safety: never pre-fill a token
                      // string here — BestYieldCard rows may carry
                      // protocol-specific tokens (e.g. gmUSDC) that the
                      // Mento/LI.FI indexed swap surface can't resolve
                      // (thinker CRITICAL flag). Pre-selecting only the
                      // destination chain lets the user pick a compatible
                      // settlement token in the chain context. Source
                      // chain defaults to the wallet's current chain.
                      navigateToSwap({
                        toChainId: rec.chainId,
                        reason: `Yield on ${rec.chain ?? 'target chain'}: ${rec.title}`,
                      });
                    }}
                    className="mt-2 w-full min-h-[44px] px-3 rounded-lg text-[11px] font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Review in Swap →
                  </button>
                )}
              </div>
              {apy != null && (
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{apy.toFixed(1)}%</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">APY</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!data.paidUnlocked && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 p-2">
          🔓 Save $100 or keep a 7-day streak to unlock <strong>personalized</strong> best-yield picks across 1,000+ vaults.
        </p>
      )}
    </Card>
  );
}
