import React, { useState } from "react";
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
  isLoading?: boolean;
}

const MAX_VISIBLE_ITEMS = 5;

const ImpactIcon: React.FC<{ impact?: "positive" | "negative" | "neutral" }> = ({ impact }) => (
  <div className={`p-1.5 rounded-lg ${
    impact === "positive"
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
      : impact === "negative"
        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
        : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
  }`}>
    {impact === "positive" ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ) : impact === "negative" ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )}
  </div>
);

const TypeIcon: React.FC<{ type: "news" | "alert" }> = ({ type }) => (
  <div className="p-1.5 rounded-lg bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
    {type === "alert" ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    )}
  </div>
);

const Chevron: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

function SkeletonItem() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 shadow-sm animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        </div>
      </div>
    </div>
  );
}

const TradeIntelligence: React.FC<TradeIntelligenceProps> = ({
  items,
  selectedAsset,
  isAdvanced = false,
  isLoading = false,
}) => {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  // Filter: asset-specific items + general market items (no impactAsset)
  const relevantItems = items.filter(
    (item) => !item.impactAsset || item.impactAsset === selectedAsset
  );

  const displayItems = showAll ? relevantItems : relevantItems.slice(0, MAX_VISIBLE_ITEMS);
  const hasMore = relevantItems.length > MAX_VISIBLE_ITEMS;

  if (!isLoading && relevantItems.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Market Intelligence
        </h3>
        <div className="flex items-center gap-2">
          {isAdvanced && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-1 bg-blue-600 dark:bg-blue-500 px-1.5 py-0.5 rounded shadow-sm"
            >
              <span className="w-1 h-1 rounded-full bg-white"></span>
              <span className="text-[9px] font-black text-white uppercase tracking-tighter">SN50 Active</span>
            </motion.div>
          )}
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-blue-100 dark:border-blue-800">
            {isAdvanced ? "SN50 Predictive" : "Live Pulse"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : (
          displayItems.map((item) => {
            const isExpanded = expandedItems[item.id];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !isExpanded }))}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 shadow-sm relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer"
              >
                {item.id.startsWith("synth-") && (
                  <div className="absolute top-0 right-0 flex items-center">
                    {item.id.includes("guardian") && (
                      <div className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 uppercase tracking-widest shadow-sm">
                        Guardian
                      </div>
                    )}
                    <div className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-widest shadow-sm">
                      Synth
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.type === "impact" ? (
                      <ImpactIcon impact={item.impact} />
                    ) : (
                      <TypeIcon type={item.type} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
                          {item.timestamp}
                        </span>
                        <Chevron expanded={!!isExpanded} />
                      </div>
                    </div>
                    <p className={`text-xs text-gray-500 dark:text-gray-400 leading-relaxed transition-all font-medium ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {item.description}
                    </p>

                    {isAdvanced && item.impact && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${item.impact === "positive"
                              ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30"
                              : "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30"
                            }`}>
                            {item.impact} Impact
                          </span>
                          {item.impactAsset && (
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">
                              Target: {item.impactAsset}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {hasMore && !isLoading && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          className="w-full text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-1.5 transition-colors uppercase tracking-wider"
        >
          {showAll ? `Show less` : `Show ${relevantItems.length - MAX_VISIBLE_ITEMS} more`}
        </button>
      )}

      <div className="pt-1 flex justify-center">
        <a
          href="https://docs.synthdata.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-gray-400 hover:text-blue-500 transition-colors uppercase tracking-[0.2em] flex items-center gap-1"
        >
          Risk Intelligence
          <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default TradeIntelligence;
