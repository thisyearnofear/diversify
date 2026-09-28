/**
 * PhilosophyCoinRail — the Shield picker/compare coin rail.
 *
 * The LensCoinSelector control users learned in onboarding (and that
 * GuardianPlanSwitcher reuses), `scrollable` so all eight archetypes fit
 * a phone viewport. Enters with a short slide-up; reduced motion shows
 * it instantly. `FocusedPlanLine` is the blur-swapped "Name — tagline"
 * line that rides beneath the rail (same grammar as the switcher).
 */

import React, { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LensCoinSelector } from "@/components/onboarding/LensCoinSelector";
import { philosophyLenses } from "@/components/protection-cards/philosophy-lenses";
import { STRATEGIES } from "@/constants/strategies";

const LENSES = philosophyLenses();

export function PhilosophyCoinRail({
  selected,
  onSelect,
  onTapPoint,
}: {
  /** Focused (not yet committed) strategy id — falls back to the current
   *  plan so the rail always has a checked coin. */
  selected: string | null;
  onSelect: (id: string) => void;
  /** Reports the tapped coin's centre to the ambient layer (optional). */
  onTapPoint?: (clientX: number, clientY: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      data-testid="philosophy-coin-rail"
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <LensCoinSelector
        ariaLabel="Protection philosophies"
        lenses={LENSES}
        selected={selected}
        onSelect={onSelect}
        scrollable
        onTapPoint={onTapPoint}
      />
    </motion.div>
  );
}

/** "Name — tagline", blur-swapped on change (the GuardianPlanSwitcher pattern). */
export function FocusedPlanLine({ strategyId }: { strategyId: string | null }) {
  const reducedMotion = useReducedMotion();
  const strategy = useMemo(
    () => STRATEGIES.find((s) => s.id === strategyId) ?? null,
    [strategyId],
  );
  return (
    <div className="text-center min-h-[22px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={strategyId ?? "none"}
          initial={reducedMotion ? false : { opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={reducedMotion ? undefined : { opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.18 }}
          className="text-sm font-bold text-gray-900 dark:text-white"
          data-testid="focused-plan-line"
        >
          {strategy ? (
            <>
              {strategy.name}
              <span className="font-medium text-gray-500 dark:text-gray-400">
                {" "}— {strategy.tagline}
              </span>
            </>
          ) : (
            <span className="font-medium text-gray-500 dark:text-gray-400">
              Choose a protection philosophy
            </span>
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
