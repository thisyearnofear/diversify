import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface InflationInsightRowProps {
  fromToken: string;
  toToken: string;
  inflationDifference: number;
  fromInflationRate?: number;
  toInflationRate?: number;
  onAskAI?: () => void;
}

/**
 * One-line inflation differentiator under the quote row.
 * "Inflation exposure: 12.4% → 3.1%" with a tiny animated meter
 * and an "Ask AI" affordance. Replaces the old SwapAIInsight banner +
 * InflationBenefitCard + per-token info cards.
 */
const InflationInsightRow: React.FC<InflationInsightRowProps> = ({
  fromToken,
  toToken,
  inflationDifference,
  fromInflationRate,
  toInflationRate,
  onAskAI,
}) => {
  const reducedMotion = useReducedMotion();

  if (!fromToken || !toToken || inflationDifference <= 0) return null;

  const fromRate = fromInflationRate ?? 0;
  const toRate = toInflationRate ?? 0;
  // Clamp meter widths
  const fromPct = Math.min(fromRate / 20, 1) * 100;
  const toPct = Math.min(toRate / 20, 1) * 100;

  return (
    <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
      {/* Mini animated meter */}
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-gray-400 w-6">{fromToken}</span>
          <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { width: 0 }}
              animate={{ width: `${fromPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-red-400"
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-gray-400 w-6">{toToken}</span>
          <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { width: 0 }}
              animate={{ width: `${toPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              className="h-full rounded-full bg-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* One-line summary */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Inflation exposure{" "}
          <span className="font-bold text-red-600 dark:text-red-400">
            {fromRate > 0 ? `${fromRate.toFixed(1)}%` : "—"}
          </span>
          {" → "}
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {toRate > 0 ? `${toRate.toFixed(1)}%` : "—"}
          </span>
        </p>
      </div>

      {/* Ask AI affordance */}
      {onAskAI && (
        <button
          type="button"
          onClick={onAskAI}
          className="shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
        >
          Ask AI
        </button>
      )}
    </div>
  );
};

export default InflationInsightRow;
