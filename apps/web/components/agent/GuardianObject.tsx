/**
 * GuardianObject — the Guardian tab's one object: the mark, a state
 * headline, a budget sentence, and the latest decision line. No card
 * chrome (InstrumentShell owns the surface), no ring (Shield owns it),
 * no projected savings (never rendered as realized money).
 */

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { press, springPress } from "@/lib/motion-tokens";
import { GuardianMascot } from "../shared/GuardianMascot";
import StatusBadge from "../shared/StatusBadge";
import {
  deriveProtectionLifecycleState,
  PROTECTION_STATE_LABELS,
} from "@diversifi/shared/src/types/guardian-protection";
import {
  GUARDIAN_AUTONOMOUS_COPY,
  GUARDIAN_USER_COPY,
  type GuardianTierState,
} from "@diversifi/shared/src/services/vault/guardian-tier-state";
import type { GuardianSessionInfo } from "@/hooks/use-session-key";
import type { GuardianProofEvent } from "./GuardianJournalTab";
import { LiveLine } from "../shared/LiveLine";
import { useCountUp } from "@/hooks/use-count-up";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";
import { formatUsd } from "@/lib/money-format";
import type { LiveBeatText } from "@/lib/live-lines";
import { timeAgo } from "@/lib/format-duration";

const MOOD_BY_STATE: Record<GuardianTierState, "neutral" | "happy" | "thinking" | "protective"> = {
  idle: "neutral",
  authorized: "neutral",
  funded: "happy",
  monitoring: "protective",
};

/** The budget sentence — the remaining figure tweens from its previous
 *  value when the ledger moves (reduced motion lands instantly). */
function BudgetButton({
  remaining,
  limit,
  onOpenBounds,
}: {
  remaining: number;
  limit: number;
  onOpenBounds: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { hidden, formatMoney } = useBalanceVisibility();
  const formatted = useCountUp(remaining, { format: formatUsd, initialValue: remaining });
  return (
    <motion.button
      type="button"
      data-testid="guardian-budget"
      onClick={onOpenBounds}
      whileTap={reducedMotion ? undefined : press}
      transition={springPress}
      className="mt-2 min-h-tap text-sm font-semibold text-gray-700 dark:text-gray-200"
    >
      {hidden ? formatMoney(remaining) : <motion.span>{formatted}</motion.span>} left of {formatMoney(limit)} today
    </motion.button>
  );
}

/** The limit drawn as a fence: one post per tenth of today's limit. Spent
 *  posts fade; the posts left stand. A row beneath the mark — never a
 *  ring (Shield owns the ring). The sentence stays the readable layer. */
export const FENCE_POSTS = 10;

export function BudgetFence({ remaining, limit }: { remaining: number; limit: number }) {
  const reducedMotion = useReducedMotion();
  const standing =
    limit > 0 ? Math.max(0, Math.min(FENCE_POSTS, Math.round((remaining / limit) * FENCE_POSTS))) : 0;
  return (
    <div
      data-testid="guardian-fence"
      data-standing={standing}
      aria-hidden="true"
      className="relative -mt-1 mb-2 flex items-end justify-center gap-1.5"
    >
      <span className="absolute inset-x-0 bottom-1 h-px bg-blue-600/25 dark:bg-blue-400/25" />
      {Array.from({ length: FENCE_POSTS }, (_, i) => (
        <motion.span
          key={i}
          className="relative block w-1 origin-bottom rounded-t-full bg-blue-600 dark:bg-blue-400"
          style={{ height: i % 2 ? 10 : 13 }}
          initial={false}
          animate={{ opacity: i < standing ? 1 : 0.18, scaleY: i < standing ? 1 : 0.55 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 260, damping: 24, delay: i * 0.02 }
          }
        />
      ))}
    </div>
  );
}

export function GuardianObject({
  guardianState,
  isAnalyzing,
  sessionInfo,
  hasValidPermission,
  dailyLimit,
  latestEvent,
  latestCall,
  ctaLabel,
  onCta,
  onOpenJournal,
  onOpenBounds,
  isAutonomous = false,
  liveBeats,
  liveAlive,
  attention = false,
  proposalPending = false,
}: {
  guardianState: GuardianTierState;
  isAnalyzing: boolean;
  sessionInfo: GuardianSessionInfo | null;
  hasValidPermission: boolean;
  dailyLimit: number;
  latestEvent: GuardianProofEvent | null;
  latestCall: string | null;
  ctaLabel: string | null;
  onCta?: () => void;
  onOpenJournal: () => void;
  onOpenBounds: () => void;
  /** GUARDIAN-tier permission — Guardian may act without a per-move signature. */
  isAutonomous?: boolean;
  /** The rotating live line under the latest decision — omitted entirely
   *  when no beat resolves (empty/null → 0px, honest absence). */
  liveBeats?: LiveBeatText[] | null;
  /** False while any Guardian sheet is open — the line stills. */
  liveAlive?: boolean;
  /** Pointer attention only while the connected instrument is at rest. */
  attention?: boolean;
  /** A real proposal is waiting for the user's signature. */
  proposalPending?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [acted, setActed] = useState(false);
  const copy =
    guardianState === "monitoring" && isAutonomous
      ? GUARDIAN_AUTONOMOUS_COPY
      : GUARDIAN_USER_COPY[guardianState];
  const mood = isAnalyzing
    ? "thinking"
    : proposalPending
      ? "alert"
      : MOOD_BY_STATE[guardianState];
  const showBudget =
    hasValidPermission && sessionInfo != null && dailyLimit > 0;

  return (
    <div
      className="instrument-composition text-center py-2"
      onPointerDownCapture={() => setActed(true)}
      onFocusCapture={() => setActed(true)}
    >
      <div className="instrument-artifact flex justify-center">
        <GuardianMascot size={96} mood={mood} gaze={attention && !acted && !isAnalyzing ? "pointer" : "off"} className="mb-3" />
      </div>
      {showBudget && (
        <BudgetFence remaining={sessionInfo!.remainingTodayUSD} limit={dailyLimit} />
      )}
      <div className="instrument-reading flex flex-col items-center">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
          {copy.headline}
        </h2>
        <StatusBadge
          label={
            PROTECTION_STATE_LABELS[
              deriveProtectionLifecycleState(guardianState)
            ]
          }
          tone={
            guardianState === "monitoring"
              ? "ready"
              : guardianState === "authorized"
                ? "info"
                : "warning"
          }
          compact
        />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-[300px] leading-relaxed">
        {copy.description}
      </p>

      {showBudget && (
        <BudgetButton
          remaining={sessionInfo!.remainingTodayUSD}
          limit={dailyLimit}
          onOpenBounds={onOpenBounds}
        />
      )}

      {latestEvent ? (
        <motion.button
          type="button"
          data-testid="guardian-latest"
          onClick={onOpenJournal}
          whileTap={reducedMotion ? undefined : press}
          transition={springPress}
          className="mt-1 min-h-tap text-xs text-gray-500 dark:text-gray-400"
        >
          {latestEvent.title} · {latestEvent.subtitle} · {timeAgo(latestEvent.timestamp)}
        </motion.button>
      ) : latestCall ? (
        <motion.button
          type="button"
          data-testid="guardian-latest"
          onClick={onOpenJournal}
          whileTap={reducedMotion ? undefined : press}
          transition={springPress}
          className="mt-1 min-h-tap text-xs text-gray-500 dark:text-gray-400"
        >
          Latest call: {latestCall}
        </motion.button>
      ) : null}

      <LiveLine
        testId="guardian-live-line"
        beats={(liveBeats ?? []).map((b) => ({ key: b.key, content: b.text }))}
        alive={liveAlive ?? false}
        className="mt-1 block text-2xs text-gray-500 dark:text-gray-400"
      />

      {ctaLabel && (
        <button
          type="button"
          onClick={onCta}
          className="mt-4 w-full min-h-tap rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
        >
          {ctaLabel}
        </button>
      )}
      </div>
    </div>
  );
}
