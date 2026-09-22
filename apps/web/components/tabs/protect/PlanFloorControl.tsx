/**
 * PlanFloorControl — the dollar-floor dial. Risk tolerance shifts weight
 * between the plan's dollar legs and its identity legs; the ring, score,
 * learn mix and Guardian all read the same adjusted legs (one truth).
 *
 * A control, not a CTA — reuses the Home segmented track (the selection
 * grammar learned once, applied everywhere); the selected option tints
 * with the archetype accent.
 */

import React from "react";
import {
  floorPercent,
  type PlanLeg,
  type RiskTolerance,
} from "@/components/protection-cards/plan-preview";

const OPTIONS: RiskTolerance[] = ["Conservative", "Balanced", "Aggressive"];

const LABELS: Record<RiskTolerance, string> = {
  Conservative: "More reserve",
  Balanced: "Balanced",
  Aggressive: "More exposure",
};

interface Props {
  /** Current tolerance; null behaves as Balanced. */
  value: RiskTolerance | null;
  /** The risk-adjusted legs the ring is showing — the caption reads their floor. */
  legs: PlanLeg[];
  savedLegs: PlanLeg[];
  isPreviewing: boolean;
  onApply?: () => void;
  onCancel: () => void;
  accent?: string;
  onChange: (risk: RiskTolerance) => void;
}

export function PlanFloorControl({
  value,
  legs,
  savedLegs,
  isPreviewing,
  onApply,
  onCancel,
  accent,
  onChange,
}: Props) {
  const selected = value ?? "Balanced";
  const groupRef = React.useRef<HTMLDivElement>(null);
  const restoreFocus = React.useRef(false);
  React.useEffect(() => {
    if (isPreviewing || !restoreFocus.current) return;
    restoreFocus.current = false;
    groupRef.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus();
  }, [isPreviewing, selected]);
  const floor = floorPercent(legs);
  const savedFloor = floorPercent(savedLegs);
  const caption = isPreviewing
    ? `Dollar reserve ${savedFloor}% → ${floor}%`
    : `Dollar reserve · ${floor}% — dollar-pegged, not risk-free`;

  const focusOption = (index: number) => {
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [index]?.focus();
  };
  const choose = (index: number) => {
    onChange(OPTIONS[index]);
    focusOption(index);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = OPTIONS.indexOf(selected);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      choose((index + 1) % OPTIONS.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      choose((index + OPTIONS.length - 1) % OPTIONS.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      choose(0);
    } else if (e.key === "End") {
      e.preventDefault();
      choose(OPTIONS.length - 1);
    }
  };

  return (
    <div data-testid="plan-floor-control">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Plan balance"
        className="grid grid-cols-3 gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-1"
        onKeyDown={onKeyDown}
      >
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(opt)}
              className={`min-h-[44px] px-2 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                isSelected
                  ? `bg-white dark:bg-gray-900 shadow-sm ${accent ? "" : "text-gray-900 dark:text-white"}`
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              style={isSelected && accent ? { color: accent } : undefined}
            >
              {LABELS[opt]}
            </button>
          );
        })}
      </div>
      <p
        data-testid="balance-consequence"
        aria-live="polite"
        className="mt-2 text-xs text-gray-600 dark:text-gray-300"
      >
        {caption}
      </p>
      {isPreviewing && (
        <div className="mt-2 space-y-1.5">
          {onApply ? (
            <button
              type="button"
              onClick={() => {
                restoreFocus.current = true;
                onApply();
              }}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Use this balance
            </button>
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Sample preview only — nothing will be saved.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              restoreFocus.current = true;
              onCancel();
            }}
            className="min-h-[44px] w-full text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded-xl"
          >
            Keep current balance
          </button>
        </div>
      )}
    </div>
  );
}

export default PlanFloorControl;
