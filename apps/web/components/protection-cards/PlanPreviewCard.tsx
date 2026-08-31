/**
 * PlanPreviewCard — compact read-only allocation preview for the
 * onboarding phase-3 stage. Currency-localized: amounts use the
 * visitor's own currency (same language as the phase-2 counterfactual).
 *
 * Density rules for this surface: the visitor needs the *flavor* of the
 * plan, not a settlement ledger — so no per-token amounts (they just
 * recite percent × shield), no per-token bars, and no archetype name
 * (the strip card above already names it). What remains: one shield
 * line, a row of allocation chips, and the single gold-counterfactual
 * stat that carries the plan's meaning.
 */
import React from 'react';
import type { PlanPreview } from './plan-preview';
import { ARCHETYPES } from './tokens';
import { TokenIcon } from '../shared/TokenIcon';

export interface PlanPreviewCardProps {
  preview: PlanPreview;
  className?: string;
  /** Currency prefix for the amounts (e.g. "$", "NGN ", "KES "). Defaults to USD. */
  currencyPrefix?: string;
}

export function PlanPreviewCard({ preview, className = '', currencyPrefix = '$' }: PlanPreviewCardProps) {
  const archetype = ARCHETYPES[preview.archetypeId];
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  // Top-N aggregation: this moment needs the *flavor* of the plan, not
  // the ledger. Six chips wrap into an unreadable stack and the 10%
  // tail carries no decision value — show the leading four, name the
  // count of the rest. (The full split is one tap away, in-app.)
  const MAX_CHIPS = 4;
  const visible = preview.slices.slice(0, MAX_CHIPS);
  const hiddenCount = preview.slices.length - visible.length;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-left bg-white dark:bg-slate-900 shadow-sm ${className}`}
      style={{ borderColor: `${archetype.accent}59` }}
    >
      {preview.slices.length > 0 ? (
        <>
          <p className="text-[13px] text-gray-700 dark:text-slate-200 mb-1.5">
            Shield <strong className="text-gray-900 dark:text-white">{preview.shieldPercent}%</strong> of{' '}
            <strong className="text-gray-900 dark:text-white">
              {currencyPrefix}{fmt(preview.savingsAmount)}
            </strong>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {visible.map((slice) => (
              <span
                key={slice.token}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/[0.08]"
                style={{ borderColor: `${archetype.accent}4d` }}
              >
                <TokenIcon symbol={slice.token} size={16} />
                {slice.token}
                <span className="tabular-nums" style={{ color: archetype.accent }}>
                  {slice.percent}%
                </span>
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 text-sm font-bold text-gray-500 dark:text-slate-400">
                +{hiddenCount} more
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-[13px] text-gray-500 dark:text-slate-400">
          You&apos;ll set your own token targets after connecting your wallet.
        </p>
      )}

      {preview.preservedValue != null && preview.preservedValue > 0 && (
        <p className="text-[13px] text-gray-700 dark:text-slate-200 border-t border-gray-200 dark:border-white/15 mt-2 pt-2">
          Followed gold over 5 years:{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {currencyPrefix}{fmt(preview.preservedValue)}
          </strong>{' '}
          preserved.
        </p>
      )}
    </div>
  );
}
