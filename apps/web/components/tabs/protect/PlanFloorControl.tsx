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
import { motion, useReducedMotion } from "framer-motion";
import { press, springPress } from "@/lib/motion-tokens";
import { haptics } from "@/lib/haptics";
import {
  floorPercent,
  isFloorLeg,
  legExposure,
  reserveLabel,
  type Exposure,
  type PlanLeg,
  type RiskTolerance,
} from "@/components/protection-cards/plan-preview";
import { exposureLabel } from '@diversifi/shared/src/config/exposures';

const OPTIONS: RiskTolerance[] = ["Conservative", "Balanced", "Aggressive"];

const LABELS: Record<RiskTolerance, string> = {
  Conservative: "More reserve",
  Balanced: "Balanced",
  Aggressive: "More exposure",
};

const VISIBLE_LABELS: Record<RiskTolerance, string> = {
  Conservative: "Reserve",
  Balanced: "Balanced",
  Aggressive: "Exposure",
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
  onInteraction?: () => void;
  /** Reserve exposure (the anchor when the plan holds it); defaults to USD. */
  floor?: Exposure;
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
  onInteraction,
  floor: floorExposure = "USD",
}: Props) {
  const reducedMotion = useReducedMotion();
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
  const floor = floorPercent(legs, floorExposure);
  const savedFloor = floorPercent(savedLegs, floorExposure);
  const reserve = reserveLabel(floorExposure);
  const caption = isPreviewing
    ? `${reserve} reserve ${savedFloor}% → ${floor}%`
    : `${reserve} reserve · ${floor}% — ${reserve.toLowerCase()}-pegged, not risk-free`;
  const changedExposure = legs
    .filter((leg) => !isFloorLeg(leg, floorExposure))
    .map((leg) => {
      const exposure = legExposure(leg);
      const from = savedLegs.find((savedLeg) => savedLeg.token === leg.token)?.percent ?? 0;
      return { exposure, leg, from, to: leg.percent };
    })
    .filter((change) => change.from !== change.to)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))[0];
  const exposureName = changedExposure?.exposure
    ? `${exposureLabel(changedExposure.exposure)}${changedExposure.leg.prefer === 'yield' ? ' yield' : ` · ${changedExposure.leg.region}`}`
    : changedExposure?.leg.label ?? changedExposure?.leg.token;
  const tradeOff = changedExposure
    ? `${exposureName} ${changedExposure.from}% → ${changedExposure.to}%. ${changedExposure.to < changedExposure.from ? 'Less' : 'More'} in this leg, ${floor > savedFloor ? 'more' : 'less'} in the liquid ${reserve.toLowerCase()} reserve.`
    : null;

  const focusOption = (index: number) => {
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [index]?.focus();
  };
  const choose = (index: number) => {
    onInteraction?.();
    if (OPTIONS[index] !== selected) haptics.tap();
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
            <motion.button
              key={opt}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={LABELS[opt]}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => {
                onInteraction?.();
                if (opt !== selected) haptics.tap();
                onChange(opt);
              }}
              onFocus={() => onInteraction?.()}
              whileTap={reducedMotion ? undefined : press}
              transition={springPress}
              className={`min-h-tap px-2 whitespace-nowrap rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                isSelected
                  ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              style={isSelected && accent ? { boxShadow: `inset 0 0 0 1.5px ${accent}` } : undefined}
            >
              {VISIBLE_LABELS[opt]}
            </motion.button>
          );
        })}
      </div>
      <p
        data-testid="balance-consequence"
        aria-live="polite"
        className="mt-2 text-sm text-gray-600 dark:text-gray-300"
      >
        {caption}
      </p>
      {isPreviewing && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-ink-muted" data-testid="balance-trade-off">
            {tradeOff ?? 'This changes allocation targets, not holdings.'}
          </p>
          {onApply ? (
            <button
              type="button"
              onClick={() => {
                restoreFocus.current = true;
                onApply();
              }}
              className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Use this balance
            </button>
          ) : (
            <p className="text-2xs text-gray-500 dark:text-gray-400">
              Sample preview only — nothing will be saved.
            </p>
          )}
          <motion.button
            type="button"
            onClick={() => {
              restoreFocus.current = true;
              onCancel();
            }}
            whileTap={reducedMotion ? undefined : press}
            transition={springPress}
            className="min-h-tap w-full text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded-xl"
          >
            Keep current balance
          </motion.button>
        </div>
      )}
    </div>
  );
}

export default PlanFloorControl;
