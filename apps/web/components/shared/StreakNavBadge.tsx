/**
 * StreakNavBadge — compact retention signal for nav chrome.
 *
 * Replaces the full-bleed GuardianStreakWidget card that sat above Home's
 * object (violating §5 rail #5). Same data (daysActive, canClaim,
 * progress), quiet presentation: a pill in the header + a footer chip in
 * the desktop rail. 0px when there is nothing to show (no skeleton).
 *
 * Motion: one-time scale settle, no ambient bob/glow. Reduced-motion: static.
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useStreakRewards } from "@/hooks/use-streak-rewards";

interface Props {
  variant?: "header" | "rail";
  className?: string;
  onClaim?: () => void;
}

export function StreakNavBadge({ variant = "header", className = "", onClaim }: Props) {
  const reducedMotion = useReducedMotion();
  let streak: ReturnType<typeof useStreakRewards>["streak"] = null;
  let canClaim = false;
  let isLoading = false;
  try {
    const ctx = useStreakRewards();
    streak = ctx.streak;
    canClaim = ctx.canClaim;
    isLoading = ctx.isLoading;
  } catch {
    // Outside StreakRewardsProvider (e.g. isolated header/rail tests) — render nothing.
    return null;
  }

  const daysActive = streak?.daysActive ?? 0;
  const progressPercent = (daysActive % 7) * 14.2857;
  const daysUntilReward = 7 - (daysActive % 7);

  // Keep nav clean for newcomers: same gate as the former card.
  if (isLoading) return null;
  if (daysActive === 0 && !canClaim) return null;

  const label = canClaim
    ? "Claim ready"
    : daysUntilReward === 7
      ? `${daysActive}d`
      : `${daysActive}d · ${daysUntilReward}d to reward`;

  const pill = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-bold tabular-nums ${
        canClaim
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-white/10"
      } ${variant === "header" ? "px-2.5 py-1 min-h-[28px]" : "px-2 py-1.5 min-h-[32px]"}`}
      aria-label={`Streak ${daysActive} days, ${canClaim ? "reward ready" : `${daysUntilReward} days to reward`}`}
    >
      <span aria-hidden="true" className="text-[11px] leading-none">{canClaim ? "🎁" : "🔥"}</span>
      <span>{variant === "header" && canClaim ? "Claim" : `${daysActive}`}</span>
      <span className="hidden sm:inline opacity-70 text-[11px]">{canClaim ? "" : daysUntilReward === 7 ? "days" : `· ${daysUntilReward}d`}</span>
      {!canClaim && (
        <span className="ml-0.5 hidden sm:inline-flex h-1 w-8 rounded-full overflow-hidden bg-black/10 dark:bg-white/20" aria-hidden="true">
          <motion.span
            className="h-full bg-current opacity-30"
            initial={reducedMotion ? false : { width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );

  if (variant === "rail") {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`} data-testid="streak-nav-badge-rail">
        <motion.div
          initial={reducedMotion ? false : { scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col items-center gap-1"
        >
          {pill}
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Streak</span>
        </motion.div>
      </div>
    );
  }

  // header — interactive only when a claim is ready (otherwise pure signal)
  if (canClaim && onClaim) {
    return (
      <button
        type="button"
        onClick={onClaim}
        className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded-full ${className}`}
        data-testid="streak-nav-badge"
        aria-label="Claim daily streak reward"
      >
        {pill}
      </button>
    );
  }

  return (
    <span data-testid="streak-nav-badge" className={className}>
      {pill}
    </span>
  );
}
