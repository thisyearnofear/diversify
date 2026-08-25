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

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-left ${className}`}
      style={{
        borderColor: `${archetype.accent}40`,
        background: `linear-gradient(135deg, ${archetype.surface.start}12 0%, ${archetype.surface.mid}18 100%)`,
      }}
    >
      {preview.slices.length > 0 ? (
        <>
          <p className="text-xs text-gray-600 dark:text-slate-300 mb-1.5">
            Shield <strong className="text-gray-900 dark:text-white">{preview.shieldPercent}%</strong> of{' '}
            <strong className="text-gray-900 dark:text-white">
              {currencyPrefix}{fmt(preview.savingsAmount)}
            </strong>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {preview.slices.map((slice) => (
              <span
                key={slice.token}
                className="inline-flex items-center gap-1 rounded-full bg-gray-200/70 dark:bg-white/10 px-2 py-1 text-xs font-bold text-gray-800 dark:text-white"
              >
                <TokenIcon symbol={slice.token} size={12} />
                {slice.token}
                <span className="tabular-nums" style={{ color: archetype.accent }}>
                  {slice.percent}%
                </span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          You&apos;ll set your own token targets after connecting your wallet.
        </p>
      )}

      {preview.preservedValue != null && preview.preservedValue > 0 && (
        <p className="text-xs text-gray-600 dark:text-slate-300 border-t border-gray-200 dark:border-white/10 mt-2 pt-2">
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
