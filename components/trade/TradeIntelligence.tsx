import React from "react";
import { motion } from "framer-motion";

export interface IntelligenceItem {
  id: string;
  type: "news" | "impact" | "alert";
  title: string;
  description: string;
  impact?: "positive" | "negative" | "neutral";
  impactAsset?: string;
  timestamp: string;
}

interface TradeIntelligenceProps {
  items: IntelligenceItem[];
  selectedAsset: string;
  isAdvanced?: boolean;
}

const TradeIntelligence: React.FC<TradeIntelligenceProps> = ({
  items,
  selectedAsset,
  isAdvanced = false,
}) => {
  // Filter items relevant to the selected asset or general market
  const relevantItems = items.filter(
    (item) => !item.impactAsset || item.impactAsset === selectedAsset
  );

  if (relevantItems.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Market Intelligence
        </h3>
        <div className="flex items-center gap-2">
          {isAdvanced && (
            <div className="flex items-center gap-1 bg-blue-600 dark:bg-blue-500 px-1.5 py-0.5 rounded shadow-sm animate-pulse">
              <span className="w-1 h-1 rounded-full bg-white"></span>
              <span className="text-[7px] font-black text-white uppercase tracking-tighter">SN50 Active</span>
            </div>
          )}
          <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-blue-100 dark:border-blue-800">
            {isAdvanced ? "SN50 Predictive" : "Live Pulse"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {relevantItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 shadow-sm relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
          >
            {item.id.startsWith("synth-") && (
              <div className="absolute top-0 right-0">
                <div className="bg-blue-600 text-white text-[7px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-widest shadow-sm">
                  Synth
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {item.type === "impact" ? (
                  <div className={`p-1.5 rounded-lg ${
                    item.impact === "positive" 
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" 
                      : item.impact === "negative"
                      ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  }`}>
                    {item.impact === "positive" ? "📈" : item.impact === "negative" ? "📉" : "📊"}
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {item.type === "alert" ? "⚠️" : "📰"}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {item.title}
                  </h4>
                  <span className="text-[9px] font-medium text-gray-400 whitespace-nowrap">
                    {item.timestamp}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all font-medium">
                  {item.description}
                </p>

                {isAdvanced && item.impact && (
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        item.impact === "positive"
                          ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30"
                          : "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30"
                      }`}>
                        {item.impact} Impact
                      </span>
                      {item.impactAsset && (
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                          Target: {item.impactAsset}
                        </span>
                      )}
                    </div>
                    {item.id.startsWith("synth-") && (
                      <div className="text-[8px] font-bold text-blue-500 flex items-center gap-1 group/link">
                        <span>Details</span>
                        <svg className="w-2 h-2 group-hover/link:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="pt-1 flex justify-center">
        <a 
          href="https://synthdata.co" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[8px] font-bold text-gray-400 hover:text-blue-500 transition-colors uppercase tracking-[0.2em] flex items-center gap-1"
        >
          Intelligence by <span className="text-blue-500 dark:text-blue-400">SynthData.co</span>
          <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default TradeIntelligence;
