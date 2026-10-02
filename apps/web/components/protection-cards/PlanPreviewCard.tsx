/**
 * PlanPreviewCard — compact read-only allocation preview for the
 * onboarding phase-3 stage. Currency-localized: amounts use the
 * visitor's own currency (same language as the phase-2 counterfactual).
 *
 * Density rules for this surface: the visitor needs the *flavor* of the
 * plan, not a settlement ledger — so no per-token amounts (they just
 * recite percent × shield), no per-token bars, and no archetype name
 * (the strip card above already names it). What remains: one shield
 * line and a row of allocation chips.
 */
import React, { useEffect, useState } from 'react';
import { resolvePlan, type Exposure, type PlanPreview } from './plan-preview';
import { ARCHETYPES } from './tokens';
import { TokenIcon } from '../shared/TokenIcon';
import { displayToken } from '@/lib/plan-legs';
import { InspectorSheet } from '../shared/InspectorSheet';

export interface PlanPreviewCardProps {
  preview: PlanPreview;
  className?: string;
  /** Currency prefix for the amounts (e.g. "$", "NGN ", "KES "). Defaults to USD. */
  currencyPrefix?: string;
}

const EXPOSURE_NAMES: Partial<Record<Exposure, string>> = {
  KES: 'Kenyan shilling',
  USD: 'US dollar',
  BRL: 'Brazilian real',
  COP: 'Colombian peso',
  PHP: 'Philippine peso',
};

export function PlanPreviewCard({ preview, className = '', currencyPrefix = '$' }: PlanPreviewCardProps) {
  const archetype = ARCHETYPES[preview.archetypeId];
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setSelectedToken(null);
    setShowAll(false);
  }, [preview.archetypeId]);
  const legs = resolvePlan({ strategy: preview.archetypeId }).legs;
  const labelFor = (token: string) => {
    const leg = legs.find((item) => item.token === token);
    return leg ? `${(leg.exposure && EXPOSURE_NAMES[leg.exposure]) ?? leg.label ?? displayToken(token)} · ${leg.region}` : displayToken(token);
  };
  const selectedLeg = legs.find((leg) => leg.token === selectedToken);

  // Top-N aggregation: this moment needs the *flavor* of the plan, not
  // the ledger. Six chips wrap into an unreadable stack and the 10%
  // tail carries no decision value — show the leading four, name the
  // count of the rest. (The full split is one tap away, in-app.)
  const MAX_CHIPS = 4;
  const visible = showAll ? preview.slices : preview.slices.slice(0, MAX_CHIPS);
  const hiddenCount = preview.slices.length - visible.length;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-left bg-white dark:bg-slate-900 shadow-sm ${className}`}
      style={{ borderColor: `${archetype.accent}59` }}
    >
      {preview.slices.length > 0 ? (
        <>
          <div hidden={Boolean(selectedToken)}>
          <p className="text-sm text-ink mb-1">
            Example: allocate <strong>{preview.shieldPercent}%</strong> of{' '}
            <strong className="text-gray-900 dark:text-white">
              {currencyPrefix}{fmt(preview.savingsAmount)}
            </strong>
          </p>
          <p className="text-xs text-ink-muted mb-2">Shares within that allocation</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {visible.map((slice) => (
              <button
                type="button"
                key={slice.token}
                onClick={() => setSelectedToken(slice.token)}
                aria-label={`Inspect ${labelFor(slice.token)}, ${slice.percent}% of the allocation`}
                className="min-h-tap inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold text-ink bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                style={{ borderColor: `${archetype.accent}4d` }}
              >
                <TokenIcon symbol={displayToken(slice.token)} size={16} />
                {labelFor(slice.token)}
                <span className="tabular-nums" style={{ color: archetype.accent }}>
                  {slice.percent}%
                </span>
              </button>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="min-h-tap inline-flex items-center px-2.5 py-1 text-sm font-semibold text-ink-muted"
              >
                +{hiddenCount} more
              </button>
            )}
          </div>
          </div>
          <InspectorSheet
            selectedId={selectedToken}
            onClose={() => setSelectedToken(null)}
            title={`Why ${selectedToken ? labelFor(selectedToken) : 'this allocation'}?`}
            presentation="stage"
          >
            <div className="space-y-2 text-sm text-ink-muted">
              <p>{selectedLeg?.why}</p>
              <p>
                {selectedLeg?.exposure === 'XAU'
                  ? 'Gold prices can fall. Issuer and liquidity risks remain.'
                  : selectedLeg?.exposure === 'USD' || selectedLeg?.exposure === 'EUR'
                    ? 'Pegged exposure, not a bank deposit. Depeg, issuer and liquidity risks remain.'
                    : 'This currency can move against your home currency. Issuer and liquidity risks remain.'}
              </p>
              <p className="text-xs">{selectedToken ? displayToken(selectedToken) : ''} · not funded</p>
            </div>
          </InspectorSheet>
        </>
      ) : (
        <p className="text-[13px] text-gray-500 dark:text-slate-400">
          Set your own allocation in Shield. No wallet needed to explore.
        </p>
      )}

      {/* No gold counterfactual here: it measured "20% in gold", not this
          plan's legs (most plans hold no gold), and it repeated the risk
          step's line. A number must describe the thing it sits under. */}
    </div>
  );
}
