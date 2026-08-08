/**
 * GuardianProofTab - Proof chain display
 *
 * Extracted from AgentTierStatus. Renders the proof tab of the
 * expanded Guardian panel — shows the 3-step proof chain
 * (Advisor → Permission → Auto-Saver) or an empty-state primer.
 */

import React from "react";

export const GuardianProofTab: React.FC<{
  hasLatestRecommendation: boolean;
  latestRecommendationOneLiner?: string;
  dailyLimit: number;
  permissionExpiry: string | null;
  recentExecutionsCount: number;
  hasValidPermission: boolean;
}> = ({
  hasLatestRecommendation,
  latestRecommendationOneLiner,
  dailyLimit,
  permissionExpiry,
  recentExecutionsCount,
  hasValidPermission,
}) => {
  if (hasLatestRecommendation) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-2xl border border-blue-100 dark:border-purple-900 p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
            Proof chain
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-bold text-blue-700 dark:text-blue-300">1. Advisor:</span>{" "}
              <span className="text-gray-700 dark:text-gray-300">
                {latestRecommendationOneLiner || "Produced a rebalance recommendation"}
              </span>
            </div>
            <div>
              <span className="font-bold text-amber-700 dark:text-amber-300">2. Permission:</span>{" "}
              <span className="text-gray-700 dark:text-gray-300">
                ${dailyLimit}/day, {permissionExpiry || "active session"}
              </span>
            </div>
            <div>
              <span className="font-bold text-purple-700 dark:text-purple-300">3. Auto-Saver:</span>{" "}
              <span className="text-gray-700 dark:text-gray-300">
                {recentExecutionsCount > 0
                  ? `${recentExecutionsCount} move${recentExecutionsCount === 1 ? '' : 's'} on record`
                  : "Waiting for the right moment"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty-state primer — explains the proof chain BEFORE any
  // data exists, so the user understands what will appear here
  // and why it matters. Each row is rendered as a dimmed
  // skeleton so the structure is visible at a glance.
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <div className="text-center space-y-1.5">
          <span className="text-3xl block">🔗</span>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
            {hasValidPermission
              ? "Nothing to prove yet"
              : "How Auto-Saver proves its work"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            Every move Auto-Saver makes is backed by a chain of three steps. Once your first
            recommendation lands, this view will fill in.
          </p>
        </div>
        <ol className="space-y-2 text-xs">
          <li className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
            <span className="font-black text-blue-500">1.</span>
            <div className="flex-1">
              <div className="font-bold text-blue-700 dark:text-blue-300">Advisor</div>
              <div className="text-gray-500 dark:text-gray-400">
                What signal triggered a suggestion (e.g., inflation rising, depeg risk).
              </div>
            </div>
          </li>
          <li className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
            <span className="font-black text-amber-500">2.</span>
            <div className="flex-1">
              <div className="font-bold text-amber-700 dark:text-amber-300">Permission</div>
              <div className="text-gray-500 dark:text-gray-400">
                The limit you signed (e.g., ${dailyLimit}/day, 7-day window).
              </div>
            </div>
          </li>
          <li className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
            <span className="font-black text-purple-500">3.</span>
            <div className="flex-1">
              <div className="font-bold text-purple-700 dark:text-purple-300">Auto-Saver</div>
              <div className="text-gray-500 dark:text-gray-400">
                The actual on-chain transaction, with a receipt anyone can verify.
              </div>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
};
