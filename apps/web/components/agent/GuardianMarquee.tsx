/**
 * GuardianMarquee — the Agent tab's Tier-1 marquee.
 *
 * The tab's one expressive object: the Guardian itself — mascot in its
 * lifecycle mood, daily budget as an interactive ring (spent vs remaining),
 * recent saves and the latest evidence-backed call as spokes.
 *
 * Pure presentational: AgentTierStatus already owns the vault/session-key
 * hooks, so the marquee receives derived state as props — no extra fetches.
 */
import React, { useMemo, useState } from 'react';
import { Card } from '../shared/TabComponents';
import AllocationRing, { type RingSlice } from '@/components/shared/AllocationRing';
import { GuardianMascot } from '@/components/shared/GuardianMascot';
import { trackFunnelEvent } from '@/lib/analytics';
import type { GuardianTierState } from '@diversifi/shared/src/services/vault/guardian-tier-state';
import { GUARDIAN_USER_COPY } from '@diversifi/shared/src/services/vault/guardian-tier-state';
import type { GuardianSessionInfo } from '../../hooks/use-session-key';

interface Props {
  guardianState: GuardianTierState;
  hasValidPermission: boolean;
  sessionInfo: GuardianSessionInfo | null;
  dailyLimit: number;
  /** Open the journal/setup surface — the marquee's CTA expands the tier card. */
  onOpenJournal?: () => void;
  onSetup?: () => void;
}

const MOOD_BY_STATE: Record<GuardianTierState, 'happy' | 'neutral' | 'thinking' | 'protective' | 'alert'> = {
  monitoring: 'protective',
  funded: 'happy',
  authorized: 'thinking',
  idle: 'neutral',
};

const STATE_CHIP =
  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

function timeAgo(ts: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function GuardianMarquee({
  guardianState,
  hasValidPermission,
  sessionInfo,
  dailyLimit,
  onOpenJournal,
  onSetup,
}: Props) {
  const copy = GUARDIAN_USER_COPY[guardianState];
  const active = guardianState === 'monitoring';

  // Budget ring — the dark data (spent vs remaining today) as the dial.
  const showBudget = hasValidPermission && !!sessionInfo && dailyLimit > 0;
  const spentPct = showBudget
    ? Math.min(100, ((sessionInfo?.spentTodayUSD ?? 0) / dailyLimit) * 100)
    : 0;

  const slices: RingSlice[] = useMemo(
    () =>
      showBudget
        ? [
            { id: 'remaining', label: 'Remaining today', percent: 100 - spentPct, color: '#10b981' },
            { id: 'spent', label: 'Spent today', percent: spentPct, color: '#f59e0b' },
          ]
        : [],
    [showBudget, spentPct],
  );

  const [selectedBudget, setSelectedBudget] = useState<'spent' | 'remaining' | null>(null);
  const handleSelect = (id: string) => {
    const next = selectedBudget === id ? null : (id as 'spent' | 'remaining');
    setSelectedBudget(next);
    if (next) {
      trackFunnelEvent('marquee_select', { slice: next, source: 'agent_budget' });
    }
  };

  const recent = sessionInfo?.recentExecutions?.slice(0, 3) ?? [];
  const evidence = sessionInfo?.latestRecommendation;
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Card className="border border-gray-200/70 dark:border-white/[0.06]">
      {/* The Guardian itself — mood tracks the lifecycle state */}
      <div className="flex items-start gap-4 mb-3">
        <GuardianMascot
          size={88}
          mood={MOOD_BY_STATE[guardianState]}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              {copy.headline}
            </h3>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATE_CHIP}`}
            >
              {guardianState}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
            {copy.description}
          </p>
        </div>
      </div>

      {/* Budget dial — tap a slice to see what Auto-Saver did with the day */}
      {showBudget && sessionInfo && (
        <>
          <div className="flex justify-center">
            <AllocationRing
              slices={slices}
              selectedId={selectedBudget}
              onSelect={handleSelect}
              size={170}
              thickness={22}
            >
              {selectedBudget === 'spent' ? (
                <>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    {fmt(sessionInfo.spentTodayUSD)}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    spent today
                  </span>
                </>
              ) : selectedBudget === 'remaining' ? (
                <>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmt(sessionInfo.remainingTodayUSD)}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    remaining today
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                    {fmt(sessionInfo.remainingTodayUSD)}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    of ${dailyLimit}/day · tap a slice
                  </span>
                </>
              )}
            </AllocationRing>
          </div>

          {selectedBudget && (
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 text-center">
              {selectedBudget === 'spent'
                ? `Auto-Saver moved ${fmt(sessionInfo.spentTodayUSD)} across ${sessionInfo.executionCount} save${sessionInfo.executionCount === 1 ? '' : 's'} today.`
                : `${fmt(sessionInfo.remainingTodayUSD)} of headroom left before the $${dailyLimit} daily limit resets.`}
            </p>
          )}
        </>
      )}

      {/* Spokes — recent saves and the latest evidence-backed call */}
      {recent.length > 0 && (
        <div className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.05]">
          {recent.map((exec) => (
            <div key={exec.txHash || `${exec.timestamp}-${exec.action}`} className="flex items-center gap-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-semibold text-gray-900 dark:text-white truncate">
                {exec.tokenIn} → {exec.tokenOut}
                <span className="text-gray-500 dark:text-gray-400 font-medium"> · ${exec.amountUSD}</span>
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{timeAgo(exec.timestamp)}</span>
              {exec.explorerUrl && (
                <a
                  href={exec.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0"
                >
                  proof
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {evidence && (evidence.oneLiner || evidence.reasoning) && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 border-t border-gray-100 dark:border-white/[0.06] pt-2">
          Latest call: {evidence.oneLiner || evidence.reasoning}
          {evidence.researchEvidence?.bundle && (
            <>
              {' '}
              <span className="font-bold text-gray-700 dark:text-gray-200">
                ({Math.round(evidence.researchEvidence.bundle.confidence * 100)}% confidence,{' '}
                {evidence.researchEvidence.bundle.sourceCount} sources)
              </span>
            </>
          )}
        </p>
      )}

      {/* The one CTA */}
      <button
        type="button"
        onClick={active ? onOpenJournal : onSetup}
        className="mt-3 min-h-[44px] w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
      >
        {active ? 'Open the Guardian journal' : copy.cta}
      </button>
    </Card>
  );
}
