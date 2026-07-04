/**
 * ActivityFeed - Inline activity feed for tier cards
 *
 * Extracted from AgentTierStatus to reduce the monolith's re-render surface.
 * Self-contained: only needs the activities list and optional navigation callback.
 */

import React from "react";
import { motion } from "framer-motion";
import type { AgentActivity } from "../../hooks/agent-types";
import { NETWORKS } from "../../config";

export const ActivityFeed: React.FC<{
  activities: AgentActivity[];
  onNavigateToSwap?: () => void;
  hasWallet?: boolean;
}> = ({ activities, onNavigateToSwap, hasWallet }) => {
  if (activities.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center py-2">
          <p className="text-xs text-gray-400 mb-2">No recent activity</p>
          {hasWallet ? (
            <button
              onClick={onNavigateToSwap}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Make your first swap →
            </button>
          ) : (
            <p className="text-xs text-gray-500">Connect wallet to start</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
      {activities.map((activity) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
              activity.status === "success"
                ? "bg-green-500"
                : activity.status === "pending"
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-tight">
              {activity.description}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">
                {new Date(activity.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {activity.details?.txHash && (
                <a
                  href={`${NETWORKS.CELO_MAINNET.explorerUrl}/tx/${activity.details.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  >
                    View tx →
                  </a>
              )}
            </div>
            {activity.details?.researchEvidence?.bundle && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  {Math.round(activity.details.researchEvidence.bundle.confidence * 100)}% confidence
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {Math.round(activity.details.researchEvidence.bundle.freshnessScore * 100)}% freshness
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                  {activity.details.researchEvidence.bundle.sourceCount} sources
                </span>
              </div>
            )}
            {activity.details?.researchEvidence?.summary && (
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                {activity.details.researchEvidence.summary}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};
