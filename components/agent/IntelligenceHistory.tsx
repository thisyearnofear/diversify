import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IntelligenceService } from "@diversifi/shared";
import { useResearchAccount } from "../../hooks/use-research-account";

interface Insight {
  summary: string;
  tags: string[];
  actionItems: string[];
  timestamp: number;
}

export default function IntelligenceHistory() {
  const [history, setHistory] = useState<Insight[]>([]);
  const [view, setView] = useState<'research' | 'insights'>('research');
  const researchAccount = useResearchAccount();
  const researchPayments = researchAccount.researchPayments;

  useEffect(() => {
    const data = IntelligenceService.getVoiceInsightHistory();
    setHistory(data);
  }, []);

  if (history.length === 0 && researchPayments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="text-4xl opacity-20">📜</div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
          No intelligence history yet.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[200px]">
          Research receipts, spend history, and voice insights will appear here across sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
      <div className="sticky top-0 z-10 -mx-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur pb-2">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl border border-purple-100 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-900/20 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-purple-500">Arc balance</p>
            <p className="text-xs font-black text-purple-800 dark:text-purple-200">
              ${Number.parseFloat(researchAccount.arcWalletBalance || "0").toFixed(3)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-600">Spent today</p>
            <p className="text-xs font-black text-amber-800 dark:text-amber-200">
              ${researchAccount.spentToday.toFixed(3)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Bonus credits</p>
            <p className="text-xs font-black text-emerald-800 dark:text-emerald-200">
              ${researchAccount.bonusCredits.toFixed(3)}
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1">
          <button
            onClick={() => setView('research')}
            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-colors ${view === 'research' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            Research Ledger
          </button>
          <button
            onClick={() => setView('insights')}
            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-colors ${view === 'insights' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            Insights
          </button>
        </div>
      </div>

      <AnimatePresence>
        {view === 'research' && researchPayments.length === 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">No research payments yet.</p>
            <p className="mt-1 text-xs text-gray-400">Run or quote a premium Arc research bundle from chat.</p>
          </div>
        )}

        {view === 'research' && researchPayments.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="rounded-2xl p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {item.description}
                  </h4>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  ${(item.details?.cost || 0).toFixed(3)}
                </p>
                <p className="text-[10px] text-gray-400">USDC</p>
              </div>
            </div>

            {item.details?.query && (
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                {item.details.query}
              </p>
            )}

            {item.details?.sources && item.details.sources.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {item.details.sources.map((source) => (
                  <div key={`${item.id}-${source.label}`} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="truncate text-gray-500 dark:text-gray-400">{source.label}</span>
                    <span className={source.tier === 'paid' ? 'font-mono font-bold text-emerald-600 dark:text-emerald-400' : 'font-mono text-gray-400'}>
                      ${source.cost.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {item.details?.explorer && (
              <a
                href={item.details.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block truncate text-[10px] font-mono text-blue-500 hover:text-blue-600"
              >
                {item.details.txHash?.slice(0, 18)}...{item.details.txHash?.slice(-6)} ↗
              </a>
            )}
          </motion.div>
        ))}

        {view === 'insights' && history.map((item, idx) => (
          <motion.div
            key={item.timestamp}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow group"
          >
            {/* Timestamp Ribbon */}
            <div className="absolute top-0 right-0 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-tr-2xl rounded-bl-xl border-l border-b border-amber-200/50 dark:border-amber-700/30">
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tighter">
                {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                 <span className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-xs shadow-inner">
                   🪙
                 </span>
                 <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                   Session Insight
                 </h4>
              </div>

              <p className="text-sm font-bold leading-snug text-gray-800 dark:text-gray-100">
                {item.summary}
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <h5 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  🎯 Retrospective Action Items
                </h5>
                <ul className="grid grid-cols-1 gap-1.5">
                  {item.actionItems.map((ai, i) => (
                    <li key={i} className="text-[11px] flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <div className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                      <span className="line-clamp-1 group-hover:line-clamp-none transition-all">{ai}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
