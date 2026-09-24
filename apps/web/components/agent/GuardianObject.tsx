/**
 * GuardianObject — the Guardian tab's one object: the mark, a state
 * headline, a budget sentence, and the latest decision line. No card
 * chrome (InstrumentShell owns the surface), no ring (Shield owns it),
 * no projected savings (never rendered as realized money).
 */

import React from "react";
import { GuardianMascot } from "../shared/GuardianMascot";
import StatusBadge from "../shared/StatusBadge";
import {
  deriveProtectionLifecycleState,
  PROTECTION_STATE_LABELS,
} from "@diversifi/shared/src/types/guardian-protection";
import {
  GUARDIAN_USER_COPY,
  type GuardianTierState,
} from "@diversifi/shared/src/services/vault/guardian-tier-state";
import type { GuardianSessionInfo } from "@/hooks/use-session-key";
import type { GuardianProofEvent } from "./GuardianJournalTab";
import { timeAgo } from "@/lib/format-duration";

const MOOD_BY_STATE: Record<GuardianTierState, "neutral" | "happy" | "thinking" | "protective"> = {
  idle: "neutral",
  authorized: "thinking",
  funded: "happy",
  monitoring: "protective",
};

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
}) {
  const copy = GUARDIAN_USER_COPY[guardianState];
  const mood = isAnalyzing ? "thinking" : MOOD_BY_STATE[guardianState];
  const showBudget =
    hasValidPermission && sessionInfo != null && dailyLimit > 0;

  return (
    <div className="flex flex-col items-center text-center py-2">
      <GuardianMascot size={96} mood={mood} className="mb-3" />
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
        <button
          type="button"
          data-testid="guardian-budget"
          onClick={onOpenBounds}
          className="mt-2 min-h-[44px] text-sm font-semibold text-gray-700 dark:text-gray-200"
        >
          ${sessionInfo!.remainingTodayUSD.toFixed(2)} left of ${dailyLimit} today
        </button>
      )}

      {latestEvent ? (
        <button
          type="button"
          data-testid="guardian-latest"
          onClick={onOpenJournal}
          className="mt-1 min-h-[44px] text-xs text-gray-500 dark:text-gray-400"
        >
          {latestEvent.title} · {latestEvent.subtitle} · {timeAgo(latestEvent.timestamp)}
        </button>
      ) : latestCall ? (
        <button
          type="button"
          data-testid="guardian-latest"
          onClick={onOpenJournal}
          className="mt-1 min-h-[44px] text-xs text-gray-500 dark:text-gray-400"
        >
          Latest call: {latestCall}
        </button>
      ) : null}

      {ctaLabel && (
        <button
          type="button"
          onClick={onCta}
          className="mt-4 w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
