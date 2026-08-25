/**
 * ProtectionJourney — connects the user's chosen philosophy to their
 * Guardian execution and offers a clear next action.
 *
 * This is the "remind the user how they are doing" moment. It appears
 * when a user has meaningful progress (has chosen a philosophy + has
 * at least some portfolio data + their Guardian is active). It shows:
 *
 * 1. Their philosophy name and what protection means to them
 * 2. Their Guardian's current state
 * 3. One actionable next step (or a celebration if they're all set)
 *
 * This replaces the generic Strategy Alignment Bar with something
 * that names the user's actual philosophy and connects it to what
 * the Guardian is doing on their behalf.
 */
import React from "react";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import { useGuardianTierSnapshot } from "@/components/agent/AgentTierStatus";
import { deriveProtectionLifecycleState, PROTECTION_STATE_LABELS } from "@diversifi/shared/src/types/guardian-protection";
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";

interface ProtectionJourneyProps {
  financialStrategy: string | null;
  strategyAlignmentScore: number;
  strategyAlignmentFeedback: string[];
  hasChosenPlan: boolean;
  onNavigateToProtection?: () => void;
  onNavigateToExchange?: () => void;
}

export function ProtectionJourney({
  financialStrategy,
  strategyAlignmentScore,
  strategyAlignmentFeedback,
  hasChosenPlan,
  onNavigateToProtection,
  onNavigateToExchange,
}: ProtectionJourneyProps) {
  // Move hooks above the early return to comply with React rules of hooks.
  const { guardianState, isActive } = useGuardianTierSnapshot();

  if (!financialStrategy) return null;

  const archetype = ARCHETYPES[strategyToArchetype(financialStrategy) ?? 'custom'];

  const lifecycleState = deriveProtectionLifecycleState(guardianState);
  const stateLabel = PROTECTION_STATE_LABELS[lifecycleState];
  const isMonitoring = guardianState === 'monitoring';

  // Single actionable next step — the most important thing they can
  // do right now given their current state.
  let action: {
    label: string;
    onClick: () => void;
    variant: 'primary' | 'secondary';
  } | null = null;

  if (!hasChosenPlan) {
    action = {
      label: "Choose your protection philosophy",
      onClick: onNavigateToProtection ? onNavigateToProtection : () => {},
      variant: 'primary',
    };
  } else if (!isMonitoring) {
    // Guardian is set up but not yet monitoring — fund it or enable it.
    // isActive (guardianState === 'monitoring') is false in this branch,
    // so the label is always "Enable Guardian protection". Use the actual
    // state to pick between the two sub-states (authorized → "Enable",
    // funded  → "Fund").
    const needsFunding = guardianState === 'funded';
    action = {
      label: needsFunding
        ? "Fund your Guardian to start protection"
        : "Enable Guardian protection",
      onClick: onNavigateToExchange ? onNavigateToExchange : () => {},
      variant: 'primary',
    };
  } else if (strategyAlignmentScore < 80) {
    // Guardian is monitoring but plan isn't aligned — rebalance.
    action = {
      label: "Rebalance to improve alignment",
      onClick: onNavigateToProtection ? onNavigateToProtection : () => {},
      variant: 'primary',
    };
  }

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `${archetype.accent}33`,
        background: `linear-gradient(135deg, ${archetype.accent}08 0%, ${archetype.accent}12 100%)`,
      }}
      role="status"
      aria-label={`Protection journey: ${archetype.name}`}
    >
      {/* Header — philosophy name + Guardian state */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 dark:text-white">
            {archetype.name}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {archetype.philosophy}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{
              background: `${archetype.accent}18`,
              color: archetype.accent,
            }}
          >
            {stateLabel}
          </span>
          {isMonitoring && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              ● Active
            </span>
          )}
        </div>
      </div>

      {/* Progress bar — alignment score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">
            Plan alignment
          </span>
          <span
            className="text-sm font-black"
            style={{ color: archetype.accent }}
          >
            {strategyAlignmentScore}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(strategyAlignmentScore, 100)}%`,
              background: archetype.accent,
            }}
          />
        </div>
        {strategyAlignmentFeedback.length > 0 && (
          <p className="text-[10px] mt-1.5 leading-snug text-gray-600 dark:text-gray-400">
            {strategyAlignmentFeedback[0]}
          </p>
        )}
      </div>

      {/* Action or celebration */}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="w-full py-2.5 rounded-xl text-xs font-bold transition-colors text-white"
          style={{ background: archetype.accent }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          {action.label}
        </button>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            🛡️ Your Guardian is protecting your {archetype.name.toLowerCase()} plan
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            Your portfolio is {strategyAlignmentScore}% aligned — no action needed.
          </p>
        </div>
      )}
    </div>
  );
}
