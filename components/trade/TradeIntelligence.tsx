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
        {isAdvanced && (
          <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-blue-100 dark:border-blue-800">
            Live Pulse
          </span>
        )}
      </div>

      <div className="space-y-2">
        {relevantItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 shadow-sm relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
          >
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
                  <div className="mt-2 flex items-center gap-2">
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
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TradeIntelligence;
