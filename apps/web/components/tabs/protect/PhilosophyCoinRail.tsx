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
import type { PlanLeg } from "@/components/protection-cards/plan-preview";
import { STRATEGIES } from "@/constants/strategies";
import { displayToken } from "@/lib/plan-legs";

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
        alive={false}
        labelMode="full"
      />
    </motion.div>
  );
}

/** "Name — starting mix", blur-swapped on change (the GuardianPlanSwitcher pattern). */
export function FocusedPlanLine({
  strategyId,
  legs,
  detailsCue = false,
}: {
  strategyId: string | null;
  /** The resolved legs the ring is previewing — the line's only numbers. */
  legs?: PlanLeg[];
  /** Shows the second-tap verb beneath a previewed coin. Callers pass it
   *  only while the details sheet is closed, so the cue disappears once
   *  the user has used it. */
  detailsCue?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const strategy = useMemo(
    () => STRATEGIES.find((s) => s.id === strategyId) ?? null,
    [strategyId],
  );
  const mixLine = useMemo(() => {
    if (!legs || legs.length === 0) return null;
    const top = [...legs].sort((a, b) => b.percent - a.percent).slice(0, 2);
    const head = top
      .map((leg) => `${leg.label ?? displayToken(leg.token)} ${leg.percent}%`)
      .join(" · ");
    const more = legs.length > 2 ? ` · +${legs.length - 2} more` : "";
    return `${strategyId === "custom" ? "Your mix" : "Starting mix"} · ${head}${more}`;
  }, [legs, strategyId]);
  return (
    <div className="text-center min-h-[22px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={strategyId ?? "none"}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="text-sm font-bold text-gray-900 dark:text-white"
          data-testid="focused-plan-line"
        >
          {strategy ? (
            <>
              <span className="block text-xl sm:text-2xl text-ink">
                {strategy.name}
              </span>
              <span className="block text-sm font-medium text-ink-muted whitespace-normal">
                {mixLine ?? strategy.tagline}
              </span>
              {detailsCue && (
                <span
                  data-testid="philosophy-details-cue"
                  className="block pt-1 text-xs font-semibold text-action"
                >
                  Tap again for details
                </span>
              )}
            </>
          ) : (
            /* Nothing selected. This block used to render a `PHILOSOPHY`
               uppercase kicker to name the row's job. It was redundant
               chrome: the ring's hole already says "Choose a philosophy",
               the caption under it says "Tap a philosophy coin to preview
               its plan", and the rail carries `aria-label="Protection
               philosophies"`. Three labels for one act. The empty state
               now renders nothing here, which also tightens the stage. */
            null
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
