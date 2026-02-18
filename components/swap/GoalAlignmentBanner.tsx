/**
 * GoalAlignmentBanner — shows the user's active protection goal and personalisation status.
 *
 * Extracted from SwapTab. Single responsibility: display the active goal badge inline
 * so the user knows which mode is driving swap pre-fills and recommendations.
 *
 * Only renders when:
 *   - profile is complete
 *   - userGoal is set and not 'exploring'
 *   - no AI recommendation is currently overriding the space
 */
import React from 'react';
import type { UserGoal, RiskTolerance, TimeHorizon } from '../../hooks/use-protection-profile';

interface GoalAlignmentBannerProps {
  userGoal: UserGoal | null | undefined;
  riskTolerance: RiskTolerance | null | undefined;
  timeHorizon: TimeHorizon | null | undefined;
  profileComplete: boolean;
  /** Hide when an AI recommendation is taking the same slot */
  suppressedByAI?: boolean;
}

const GOAL_META: Record<
  Exclude<UserGoal, 'exploring'>,
  { emoji: string; label: string }
> = {
  inflation_protection:        { emoji: '🛡️', label: 'Hedge Inflation' },
  geographic_diversification:  { emoji: '🌍', label: 'Diversify Regions' },
  rwa_access:                  { emoji: '🥇', label: 'Access RWA' },
};

export default function GoalAlignmentBanner({
  userGoal,
  riskTolerance,
  timeHorizon,
  profileComplete,
  suppressedByAI = false,
}: GoalAlignmentBannerProps) {
  if (!profileComplete || !userGoal || userGoal === 'exploring' || suppressedByAI) {
    return null;
  }

  const meta = GOAL_META[userGoal as Exclude<UserGoal, 'exploring'>];
  if (!meta) return null;

  return (
    <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
      <span className="text-base">{meta.emoji}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
          {meta.label} mode
        </span>
        {riskTolerance && (
          <span className="ml-2 text-[10px] text-blue-400 dark:text-blue-500">
            • {riskTolerance} risk • {timeHorizon || 'flexible'}
          </span>
        )}
      </div>
      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black shrink-0">
        ✓ Personalised
      </span>
    </div>
  );
}
