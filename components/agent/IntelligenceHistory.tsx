import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IntelligenceService } from "@diversifi/shared";

interface Insight {
  summary: string;
  tags: string[];
  actionItems: string[];
  timestamp: number;
}

export default function IntelligenceHistory() {
  const [history, setHistory] = useState<Insight[]>([]);

  useEffect(() => {
    const data = IntelligenceService.getVoiceInsightHistory();
    setHistory(data);
  }, []);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="text-4xl opacity-20">📜</div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
          No intelligence history yet.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[200px]">
          Your voice insights and summaries will appear here across sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
      <AnimatePresence>
        {history.map((item, idx) => (
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
