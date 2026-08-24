/**
 * PlanPreviewCard — read-only allocation preview for onboarding phase 3.
 * Currency-localized: shows amounts in the visitor's own currency (same
 * language as the phase-2 counterfactual) via the currencyPrefix prop.
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

  return (
    <div
      className={`rounded-2xl border-2 p-4 text-left ${className}`}
      style={{
        borderColor: `${archetype.accent}40`,
        background: `linear-gradient(135deg, ${archetype.surface.start}12 0%, ${archetype.surface.mid}18 100%)`,
      }}
    >
      <p className="text-sm font-black text-gray-900 dark:text-white mb-0.5">
        {preview.archetypeName}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Shield {preview.shieldPercent}% of{' '}
        <strong className="text-gray-700 dark:text-gray-200">
          {currencyPrefix}{preview.savingsAmount.toLocaleString()}
        </strong>
      </p>

      <div className="space-y-2 mb-3">
        {preview.slices.length > 0 ? (
          preview.slices.map((slice) => (
            <div key={slice.token} className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 w-16 font-bold text-gray-900 dark:text-white truncate">
                <TokenIcon symbol={slice.token} size={12} />
                {slice.token}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${slice.percent}%`,
                    background: archetype.accent,
                  }}
                />
              </div>
              <span className="w-8 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                {slice.percent}%
              </span>
              <span
                className="w-20 text-right font-bold tabular-nums"
                style={{ color: archetype.accent }}
              >
                {currencyPrefix}{slice.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You&apos;ll set your own token targets after connecting your wallet.
          </p>
        )}
      </div>

      {preview.preservedValue != null && preview.preservedValue > 0 && (
        <p className="text-[11px] text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
          Followed gold over 5 years:{' '}
          <strong className="text-gray-900 dark:text-white">
            {currencyPrefix}{preview.preservedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </strong>{' '}
          preserved.
        </p>
      )}
    </div>
  );
}
