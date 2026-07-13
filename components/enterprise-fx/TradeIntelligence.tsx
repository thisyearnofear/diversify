import React, { useState } from "react";
import { motion } from "framer-motion";

/**
 * TradeIntelligence — Smart-empty macro-signal pill.
 *
 * Why this design (replaces the previous 5-item feed + skeleton):
 * The audience here is SME importers, not day traders. They need to know
 * "should I settle now or wait 48h?" — a single number on a single line.
 * A 5-item feed and a 2-row skeleton both add visual weight to a section
 * (FX Corridor) that already has 3 other components. The "never feels
 * crowded" constraint says: render nothing 99% of the time, render one
 * dense pill the 1% of the time a fresh, asset-relevant signal exists.
 *
 * The component returns `null` (0px height) when:
 *   - no items are passed
 *   - no items match the selected asset (impactAsset filter)
 *   - all matching items are older than `maxAgeMs` (default 48h)
 *   - the user clicks the dismiss button
 *
 * The component renders a single dense pill when at least one fresh,
 * asset-relevant signal exists. The pill shows:
 *   - impact color dot (green/red/blue)
 *   - signal title
 *   - impactAsset chip (e.g. "GHS")
 *   - dismiss button
 */

export interface IntelligenceItem {
  id: string;
  type: "news" | "impact" | "alert";
  title: string;
  /**
   * Long-form description of the signal. The smart-empty pill only
   * shows the title (1 line) — this field is not rendered in the
   * current component. Kept for backward compat with the legacy
   * 5-item feed (and any external callers that build items with
   * a description). Safe to omit when constructing items for the
   * new pill; the field is intentionally not marked optional so
   * the type contract is explicit about "this field exists but is
   * not used here."
   *
   * @deprecated Use `title` for the 1-line pill. Description is
   * retained only for type compatibility with the legacy 5-item
   * feed and external callers.
   */
  description: string;
  impact?: "positive" | "negative" | "neutral";
  impactAsset?: string;
  /** Display string, e.g. "2h ago" (legacy format). Not used for freshness. */
  timestamp: string;
  /** ISO timestamp when the signal was emitted. Optional — when missing,
   *  the item is treated as fresh (existing-test compatibility). */
  emittedAt?: string;
}

interface TradeIntelligenceProps {
  items: IntelligenceItem[];
  selectedAsset: string;
  /** Max age in ms. Default 48h. Items older than this are dropped. */
  maxAgeMs?: number;
  /** Optional callback when the user dismisses the latest signal. */
  onDismiss?: () => void;
}

const DEFAULT_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

const TradeIntelligence: React.FC<TradeIntelligenceProps> = ({
  items,
  selectedAsset,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState(false);

  // Smart-empty: 1 line, only if a fresh, asset-relevant signal exists.
  // Returns null (0px height) otherwise.
  const relevant = items
    .filter((item) => {
      // Asset filter: items with no impactAsset are universal (all corridors);
      // items with an impactAsset must match the selected asset.
      if (item.impactAsset && item.impactAsset !== selectedAsset) return false;
      // Freshness filter: items with no emittedAt are treated as fresh
      // (legacy callers and tests don't set it). Items with emittedAt
      // older than maxAgeMs are dropped.
      if (item.emittedAt) {
        const age = Date.now() - new Date(item.emittedAt).getTime();
        if (Number.isNaN(age) || age > maxAgeMs) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Most recent first; items without emittedAt sort to the end so
      // items with a real timestamp take priority.
      const aTime = a.emittedAt ? new Date(a.emittedAt).getTime() : 0;
      const bTime = b.emittedAt ? new Date(b.emittedAt).getTime() : 0;
      return bTime - aTime;
    });

  const latest = relevant[0];
  if (dismissed || !latest) return null;

  const impactClass =
    latest.impact === "positive"
      ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-900/10"
      : latest.impact === "negative"
        ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-900/10"
        : "border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-900/10";

  const impactDot =
    latest.impact === "positive"
      ? "bg-emerald-500"
      : latest.impact === "negative"
        ? "bg-rose-500"
        : "bg-blue-500";

  const impactLabel =
    latest.impact === "positive"
      ? "Positive"
      : latest.impact === "negative"
        ? "Negative"
        : "Neutral";

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${impactClass} shadow-sm`}
      role="status"
      aria-live="polite"
      data-testid="trade-intelligence-pill"
    >
      <span
        className={`size-1.5 rounded-full ${impactDot} shrink-0 animate-pulse`}
        aria-label={impactLabel}
      />
      <span className="text-xs font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mr-1.5">
          Macro
        </span>
        {latest.title}
      </span>
      {latest.impactAsset && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline">
          {latest.impactAsset}
        </span>
      )}
      <button
        onClick={handleDismiss}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0 p-1 -mr-1 min-h-[28px] min-w-[28px] flex items-center justify-center"
        aria-label="Dismiss signal"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </motion.div>
  );
};

export default TradeIntelligence;
