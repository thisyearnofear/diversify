/**
 * GuardianJournalSheet — the "Guardian journal" inspector body: the
 * latest suggestion, the proof-event timeline, and the loop-run summary
 * when a preview or run just landed.
 */

import React from "react";
import {
  GuardianJournalTab,
  type GuardianProofEvent,
} from "./GuardianJournalTab";
import { LoopResultSummary } from "./LoopResultSummary";
import type {
  GuardianLoopResult,
  GuardianSessionInfo,
} from "@/hooks/use-session-key";

export function GuardianJournalSheet({
  sessionInfo,
  events,
  anchorByTxHash,
  hasValidPermission,
  isLowOnFunds,
  isRunningLoop,
  loopResult,
  onNavigateToFund,
  onPreview,
}: {
  sessionInfo: GuardianSessionInfo | null;
  events: GuardianProofEvent[];
  anchorByTxHash: Map<string, unknown>;
  hasValidPermission: boolean;
  isLowOnFunds: boolean;
  isRunningLoop: boolean;
  loopResult: GuardianLoopResult | null;
  onNavigateToFund?: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="space-y-4">
      {sessionInfo?.latestRecommendation && (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-blue-100 dark:border-blue-900/50">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              Latest suggestion
            </h5>
            <span className="text-[11px] text-gray-400">
              {new Date(sessionInfo.latestRecommendation.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {sessionInfo.latestRecommendation.action || "HOLD"}
            {sessionInfo.latestRecommendation.targetToken
              ? ` -> ${sessionInfo.latestRecommendation.targetToken}`
              : ""}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {sessionInfo.latestRecommendation.oneLiner || sessionInfo.latestRecommendation.reasoning}
          </p>
          {sessionInfo.latestRecommendation.researchEvidence?.bundle && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                Confidence {(sessionInfo.latestRecommendation.researchEvidence.bundle.confidence * 100).toFixed(0)}%
              </span>
              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-full">
                Freshness {(sessionInfo.latestRecommendation.researchEvidence.bundle.freshnessScore * 100).toFixed(0)}%
              </span>
              <span className="px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 rounded-full">
                Agreement {(sessionInfo.latestRecommendation.researchEvidence.bundle.agreementScore * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      )}

      <GuardianJournalTab
        events={events}
        anchorByTxHash={anchorByTxHash as never}
        hasValidPermission={hasValidPermission}
        isLowOnFunds={isLowOnFunds}
        isRunningLoop={isRunningLoop}
        onNavigateToFund={onNavigateToFund}
        onPreview={onPreview}
      />

      {loopResult && <LoopResultSummary loopResult={loopResult} />}
    </div>
  );
}
