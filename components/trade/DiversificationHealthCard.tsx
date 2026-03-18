import React from "react";
import { motion } from "framer-motion";
import type { PortfolioAnalysis, RebalancingOpportunity } from "@diversifi/shared";

interface DiversificationHealthCardProps {
  analysis: PortfolioAnalysis | null;
  isLoading?: boolean;
  onTakeAction?: (opportunity: RebalancingOpportunity) => void;
  className?: string;
}

const getScoreColors = (score: number) => {
  if (score >= 80) return {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  };
  if (score >= 60) return {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };
  if (score >= 40) return {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };
  return {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
};

const getRegionIcon = (region: string): string => {
  const icons: Record<string, string> = {
    USA: "🇺🇸",
    Europe: "🇪🇺",
    Asia: "🌏",
    Africa: "🌍",
    LatAm: "🌎",
    Global: "🌐",
    Commodities: "🥇",
  };
  return icons[region] || "📊";
};

const getActionIcon = (type: string): React.ReactNode => {
  switch (type) {
    case "hedge":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "diversify":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case "yield":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
};

export const DiversificationHealthCard: React.FC<DiversificationHealthCardProps> = ({
  analysis,
  isLoading = false,
  onTakeAction,
  className = "",
}) => {
  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 ${className}`}>
        <div className="text-center py-6">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Analyze Your Portfolio
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Connect your wallet to see personalized diversification recommendations.
          </p>
        </div>
      </div>
    );
  }

  const colors = getScoreColors(analysis.diversificationScore);
  const hasHoldings = analysis.totalValue > 0;

  // Generate recommended actions based on analysis
  const recommendedActions = analysis.rebalancingOpportunities.slice(0, 3);

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
            Diversification Health
          </h3>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors.badge}`}>
          {analysis.diversificationRating}
        </span>
      </div>

      {/* Score Display */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <span className={`text-4xl font-bold ${colors.text}`}>
            {analysis.diversificationScore}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">/100</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {analysis.tokenCount} assets • {analysis.regionCount} regions
          </div>
          {analysis.totalValue > 0 && (
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              ${analysis.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colors.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${analysis.diversificationScore}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* Portfolio Gaps */}
      {hasHoldings && analysis.missingRegions.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Missing Exposure
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingRegions.map((region) => (
              <span
                key={region}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              >
                <span>{getRegionIcon(region)}</span>
                {region}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Exposure Summary */}
      {hasHoldings && analysis.regionalExposure.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Current Allocation
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.regionalExposure.map((exposure) => (
              <span
                key={exposure.region}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                  exposure.percentage > 50
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                    : exposure.percentage > 30
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                }`}
              >
                <span>{getRegionIcon(exposure.region)}</span>
                {exposure.region} {exposure.percentage.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {hasHoldings && recommendedActions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Recommended Actions
          </div>
          {recommendedActions.map((opp, idx) => (
            <motion.button
              key={`${opp.fromToken}-${opp.toToken}-${idx}`}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onTakeAction?.(opp)}
              className={`w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 text-left transition-all hover:shadow-sm ${
                opp.priority === "HIGH" ? "ring-2 ring-red-500/20" : ""
              }`}
            >
              <span className={`flex-shrink-0 p-2 rounded-lg ${
                opp.priority === "HIGH"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                  : opp.priority === "MEDIUM"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500"
              }`}>
                {getActionIcon(opp.toRegion === "Global" || opp.toRegion === "Commodities" ? "hedge" : "diversify")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {opp.fromToken} → {opp.toToken}
                  </span>
                  {opp.annualSavings > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Save ${opp.annualSavings.toFixed(0)}/yr
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  Move ~${opp.suggestedAmount.toFixed(0)} to reduce inflation exposure by {opp.inflationDelta.toFixed(1)}%
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          ))}
        </div>
      )}

      {/* Empty State for No Holdings */}
      {!hasHoldings && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add assets to your portfolio to see personalized recommendations.
          </p>
        </div>
      )}

      {/* Tips */}
      {analysis.diversificationTips.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <span>💡</span>
            <span>{analysis.diversificationTips[0]}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiversificationHealthCard;
