/**
 * GuardianJournalTab - Activity timeline with 0G anchor chips
 *
 * Extracted from AgentTierStatus. Renders the journal tab of the
 * expanded Guardian panel — a vertical timeline of proof events
 * with 0G anchoring status chips.
 */

import React from "react";

export type GuardianProofEvent = {
  id: string;
  source: "vault" | "wdk";
  title: string;
  subtitle: string;
  timestamp: number;
  status: string;
  explorerUrl?: string;
  txHash?: string;
  error?: string;
};

type AnchorInfo = {
  status: string;
  id?: number;
  explorerUrl?: string;
  error?: string;
};

export const GuardianJournalTab: React.FC<{
  events: GuardianProofEvent[];
  anchorByTxHash: Map<string, AnchorInfo>;
  hasValidPermission: boolean;
  isLowOnFunds: boolean;
  isRunningLoop: boolean;
  onNavigateToFund?: () => void;
  onPreview: () => void;
}> = ({
  events,
  anchorByTxHash,
  hasValidPermission,
  isLowOnFunds,
  isRunningLoop,
  onNavigateToFund,
  onPreview,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Activity</h4>
        <span className="text-xs text-gray-400 italic">Newest first</span>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {events.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 px-6 space-y-3">
            <span className="text-3xl block">{hasValidPermission && isLowOnFunds ? "💸" : "🛡️"}</span>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
              {!hasValidPermission
                ? "Nothing to show yet"
                : isLowOnFunds
                  ? "Auto-Saver is waiting for funds before its first move."
                  : "Auto-Saver is watching. No moves yet."}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
              {!hasValidPermission
                ? "Set up Auto-Saver to start tracking automatic moves and on-chain receipts."
                : isLowOnFunds
                  ? "Top up with at least $5 in stables. Auto-Saver will use the next chance it sees."
                  : "Once it makes its first move, every action will appear here with a verifiable receipt."}
            </p>
            {hasValidPermission && (
              isLowOnFunds && onNavigateToFund ? (
                <button
                  type="button"
                  onClick={onNavigateToFund}
                  className="mt-2 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-200 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 transition-colors"
                >
                  Add funds
                </button>
              ) : !isLowOnFunds ? (
                <button
                  type="button"
                  onClick={onPreview}
                  disabled={isRunningLoop}
                  className="mt-2 text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRunningLoop ? "Previewing…" : "Preview next move"}
                </button>
              ) : null
            )}
          </div>
        ) : (
          events.map((event, index) => {
            const anchor = event.txHash
              ? anchorByTxHash.get(event.txHash.toLowerCase())
              : undefined;
            return (
              <div key={event.id} className="relative pl-6 pb-2 border-l-2 border-purple-100 dark:border-purple-800/50">
                <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-gray-900 border-2 ${index === 0 ? 'border-green-500' : 'border-purple-500'} z-10`}>
                  {index === 0 && <span className="absolute inset-0 rounded-full animate-ping bg-green-400 opacity-40"></span>}
                </div>
                <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border ${index === 0 ? 'border-green-100 dark:border-green-900/50 ring-1 ring-green-50 dark:ring-green-900/20' : 'border-gray-100 dark:border-gray-700'} hover:shadow-md transition-shadow relative overflow-hidden`}>
                  <div className="absolute top-3 right-3 opacity-20 text-xl grayscale pointer-events-none">
                    {event.source === "wdk" ? "🌌" : "🛡️"}
                  </div>

                  <div className="flex justify-between items-start mb-1 pr-8">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {event.title}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {anchor && anchor.status === 'anchored' && (
                    <a
                      href={anchor.explorerUrl ?? event.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="anchor-chip"
                      className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-full"
                      title={anchor.id && anchor.id > 0 ? `0G RecommendationLedger #${anchor.id}` : 'Anchored on 0G (awaiting event index)'}
                    >
                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                      {anchor.id && anchor.id > 0 ? `0G #${anchor.id}` : '0G anchored'}
                    </a>
                  )}
                  {anchor && anchor.status === 'pending' && (
                    <span
                      data-testid="anchor-chip-pending"
                      className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/60 px-1.5 py-0.5 rounded-full"
                    >
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                      0G pending
                    </span>
                  )}
                  {anchor && anchor.status === 'failed' && (
                    <span
                      className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/60 px-1.5 py-0.5 rounded-full"
                      title={anchor.error ?? '0G anchor failed'}
                    >
                      <span className="w-1 h-1 rounded-full bg-red-500" />
                      0G failed
                    </span>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {event.subtitle}
                  </p>
                  {event.error && (
                    <p className="mt-2 text-xs text-red-500">
                      {event.error}
                    </p>
                  )}
                  {(event.explorerUrl || event.status) && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {event.explorerUrl ? (
                        <a
                          href={event.explorerUrl}
                          target="_blank"
                          className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800 transition-colors whitespace-nowrap"
                        >
                          View Evidence
                        </a>
                      ) : (
                        <span className="text-xs font-bold text-gray-400">
                          No explorer receipt
                        </span>
                      )}
                      <span className={`text-[11px] uppercase font-bold px-1.5 py-0.5 rounded italic flex items-center gap-1 ${
                        event.status === "confirmed"
                          ? "text-green-500 bg-green-50 dark:bg-green-900/20"
                          : event.status === "failed"
                            ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                            : "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${
                          event.status === "confirmed"
                            ? "bg-green-500 animate-pulse"
                            : event.status === "failed"
                              ? "bg-red-500"
                              : "bg-amber-500"
                        }`} />
                        {event.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
