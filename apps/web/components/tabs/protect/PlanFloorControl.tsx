/**
 * PlanFloorControl — the dollar-floor dial. Risk tolerance shifts weight
 * between the plan's dollar legs and its identity legs; the ring, score,
 * learn mix and Guardian all read the same adjusted legs (one truth).
 *
 * A control, not a CTA — same selection grammar as ProfileWizard's risk
 * step, quiet styling, selected option tinted with the archetype accent.
 */

import React from "react";
import {
  floorPercent,
  type PlanLeg,
  type RiskTolerance,
} from "@/components/protection-cards/plan-preview";

const OPTIONS: RiskTolerance[] = ["Conservative", "Balanced", "Aggressive"];

interface Props {
  /** Current tolerance; null behaves as Balanced. */
  value: RiskTolerance | null;
  /** The risk-adjusted legs the ring is showing — the caption reads their floor. */
  legs: PlanLeg[];
  accent?: string;
  onChange: (risk: RiskTolerance) => void;
}

export function PlanFloorControl({ value, legs, accent, onChange }: Props) {
  const selected = value ?? "Balanced";
  return (
    <div data-testid="plan-floor-control">
      <div role="radiogroup" aria-label="Dollar floor" className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt)}
              className={`min-h-[44px] px-2 py-2 border-2 rounded-xl text-center transition-colors ${
                isSelected
                  ? "bg-gray-50 dark:bg-white/5"
                  : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
              }`}
              style={isSelected ? { borderColor: accent ?? "#2563eb" } : undefined}
            >
              <span className="text-[11px] font-bold leading-tight text-gray-700 dark:text-gray-300">
                {opt}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        Dollar floor · {floorPercent(legs)}%
      </p>
    </div>
  );
}

export default PlanFloorControl;
