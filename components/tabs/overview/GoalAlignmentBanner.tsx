import React from "react";

interface GoalAlignmentBannerProps {
  goal: string;
  riskTolerance: string | null;
  timeHorizon: string | null;
  goalScores: { hedge: number; diversify: number; rwa: number };
  onAction: () => void;
}

const GOAL_META: Record<
  string,
  { icon: string; label: string; description: string; nextAction: string; bg: string; border: string; badge: string }
> = {
  inflation_protection: {
    icon: "🛡️",
    label: "Hedge Inflation",
    description: "Reduce exposure to local currency devaluation",
    nextAction: "Swap into lower-inflation currencies",
    bg: "from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  geographic_diversification: {
    icon: "🌍",
    label: "Diversify Regions",
    description: "Spread your wealth across multiple economies",
    nextAction: "Add exposure to a new region",
    bg: "from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10",
    border: "border-purple-200 dark:border-purple-800",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  rwa_access: {
    icon: "🥇",
    label: "Access Real-World Assets",
    description: "Hold tokenized gold and yield-bearing assets",
    nextAction: "Bridge to Arbitrum for USDY or PAXG",
    bg: "from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

export function GoalAlignmentBanner({
  goal,
  riskTolerance,
  timeHorizon,
  goalScores,
  onAction,
}: GoalAlignmentBannerProps) {
  const score = Math.round(
    goal === "inflation_protection"
      ? goalScores.hedge
      : goal === "geographic_diversification"
        ? goalScores.diversify
        : goal === "rwa_access"
          ? goalScores.rwa
          : 0,
  );

  const meta = GOAL_META[goal];
  if (!meta) return null;

  return (
    <div className={`bg-gradient-to-br ${meta.bg} border ${meta.border} rounded-2xl p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.badge}`}>
              Your Goal
            </span>
            <span className="text-xs font-black text-gray-900 dark:text-white">{meta.label}</span>
            {riskTolerance && (
              <span className="text-xs text-gray-500">
                • {riskTolerance} risk{timeHorizon ? ` • ${timeHorizon}` : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{meta.description}</p>
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Goal Progress</span>
              <span className="text-xs font-black text-gray-700 dark:text-gray-300">{score}%</span>
            </div>
            <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-blue-500" : "bg-amber-500"}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onAction}
        className="mt-3 w-full py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-xs font-black uppercase tracking-widest text-gray-800 dark:text-gray-200 transition-colors flex items-center justify-center gap-2 shadow-md"
      >
        <span>{meta.nextAction}</span>
        <span>→</span>
      </button>
    </div>
  );
}
