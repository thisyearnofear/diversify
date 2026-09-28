/**
 * GuardianPlanSwitcher — change the Protection plan Guardian follows.
 *
 * Opened from Limits & controls ("Change plan"). It only switches the plan
 * on the user's Guardian profile; it never signs a permission. The single
 * daily-limit grant lives on the Guardian object (GuardianPermissionModal),
 * so there is exactly one place a user authorizes anything.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { strategyAccent } from "../shared/palette";
import { STRATEGIES as CANONICAL_STRATEGIES } from "@/hooks/useFinancialStrategies";
import { resolvePlan } from "@/components/protection-cards/plan-preview";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useAnchorCurrency } from "@/hooks/use-anchor-currency";
import { LensCoinSelector } from "../onboarding/LensCoinSelector";
import { displayToken } from "@/lib/plan-legs";

// Canonical plans (same ids/names as StrategyContext). `custom` joins once
// the user has saved one on the Shield ring.
const ALL_PLANS = CANONICAL_STRATEGIES.map((s) => ({
  id: s.id,
  name: s.name,
  icon: s.icon,
  tagline: s.tagline,
}));

export function GuardianPlanSwitcher({
  currentPlan,
  onUpdatePlan,
  onComplete,
  onCancel,
}: {
  currentPlan?: string;
  /** Persist the plan on the Guardian profile. Return false or throw to surface an error. */
  onUpdatePlan: (plan: string) => Promise<boolean>;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string>(currentPlan || "global");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();
  const { config: profileConfig } = useProtectionProfile();
  const { anchorCurrency } = useAnchorCurrency();
  const customPlan = profileConfig.customPlan ?? null;
  const PLANS = useMemo(
    () => ALL_PLANS.filter((p) => p.id !== "custom" || customPlan),
    [customPlan],
  );

  useEffect(() => {
    const id = setTimeout(() => headingRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const plan = PLANS.find((p) => p.id === selected) ?? PLANS[0];
  // Same risk-adjusted legs the Shield ring draws.
  const legs = useMemo(
    () => resolvePlan({ strategy: plan.id, customPlan, riskTolerance: profileConfig.riskTolerance, anchorCurrency }).legs,
    [plan, customPlan, profileConfig.riskTolerance, anchorCurrency],
  );

  const save = async () => {
    setError(null);
    setLoading(true);
    try {
      const ok = await onUpdatePlan(selected);
      if (!ok) {
        setError("Could not update your plan. Please try again.");
        return;
      }
      onComplete();
    } catch (e: unknown) {
      setError((e as Error)?.message || "Could not update your plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guardian-plan-switcher-title"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 min-h-tap min-w-tap flex items-center justify-center text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <h2
          id="guardian-plan-switcher-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-bold text-gray-900 dark:text-white outline-none"
        >
          Change plan
        </h2>
        <span className="min-w-tap" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <p className="text-sm text-center text-gray-500 dark:text-gray-400">
          It steers what Guardian proposes. Nothing moves now.
        </p>

        <LensCoinSelector
          ariaLabel="Protection plans"
          lenses={PLANS.map((p) => ({
            id: p.id,
            label: p.name,
            glyph: p.icon,
            accent: strategyAccent(p.id),
          }))}
          selected={selected}
          onSelect={setSelected}
        />

        <div className="text-center min-h-[22px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={selected}
              initial={reducedMotion ? false : { opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={reducedMotion ? undefined : { opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.18 }}
              className="text-sm font-bold text-gray-900 dark:text-white"
            >
              {plan.name}
              <span className="font-medium text-gray-500 dark:text-gray-400"> — {plan.tagline}</span>
            </motion.p>
          </AnimatePresence>
        </div>

        {legs.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
            {legs.map((a) => (
              <div key={a.token} className="flex items-center gap-2 text-xs">
                <span className="w-14 font-bold text-gray-900 dark:text-white truncate">{a.label ?? displayToken(a.token)}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${a.percent}%`, background: strategyAccent(plan.id) }}
                  />
                </div>
                <span className="w-8 text-right text-gray-500 dark:text-gray-400 tabular-nums">{a.percent}%</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}
      </div>

      <div
        className="p-4 border-t border-gray-200 dark:border-gray-700"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        <button
          type="button"
          onClick={save}
          disabled={loading || selected === currentPlan}
          className="w-full py-4 min-h-[56px] bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Saving…" : "Use this plan"}
        </button>
      </div>
    </div>
  );
}

export default GuardianPlanSwitcher;
