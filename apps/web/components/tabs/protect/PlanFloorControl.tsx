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

const LABELS: Record<RiskTolerance, string> = {
  Conservative: "More reserve",
  Balanced: "Balanced",
  Aggressive: "More exposure",
};

const FRAMING: Record<string, string> = {
  africapitalism: "Balance Kenyan-shilling and euro exposure against a dollar reserve.",
  buen_vivir: "Balance Brazilian-real and Colombian-peso exposure against a dollar reserve.",
  pan_caribbean: "Balance gold and euro exposure against dollar-pegged reserves.",
  confucian: "Balance the dollar reserve against USDY exposure.",
  gotong_royong: "Balance Philippine-peso and USDY exposure against a dollar reserve.",
  islamic: "Balance gold exposure against non-yielding dollar-pegged reserves.",
  global: "Balance the currency mix against a dollar reserve.",
};

interface Props {
  /** Current tolerance; null behaves as Balanced. */
  value: RiskTolerance | null;
  /** The risk-adjusted legs the ring is showing — the caption reads their floor. */
  legs: PlanLeg[];
  savedLegs: PlanLeg[];
  isPreviewing: boolean;
  philosophy: string | null;
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
  philosophy,
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
    ? `Dollar reserve ${savedFloor}% → ${floor}% · other exposure ${100 - savedFloor}% → ${100 - floor}%`
    : `Dollar reserve · ${floor}%`;

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
      <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">
        {FRAMING[philosophy ?? ""] ??
          "Explore the balance between dollar reserves and the other plan assets."}
      </p>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Plan balance"
        className="grid grid-cols-3 gap-2"
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
              className={`min-h-[44px] px-2 py-2 border-2 rounded-xl text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                isSelected
                  ? "bg-gray-50 dark:bg-white/5"
                  : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
              }`}
              style={isSelected ? { borderColor: accent ?? "#2563eb" } : undefined}
            >
              <span className="text-[11px] font-bold leading-tight text-gray-700 dark:text-gray-300">
                {LABELS[opt]}
              </span>
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
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        Dollar-pegged is not risk-free.{" "}
        {isPreviewing
          ? "Unsaved targets; your holdings have not moved."
          : "Explore without changing your saved plan."}
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
