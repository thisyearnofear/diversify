import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRiskAssessment, type RiskAssessment, type RiskLevel } from "../../hooks/use-risk-assessment";

interface PortfolioRiskWidgetProps {
  compact?: boolean;
  className?: string;
}

const getRiskColors = (level: RiskLevel) => {
  switch (level) {
    case "low":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        border: "border-emerald-200 dark:border-emerald-800",
        text: "text-emerald-700 dark:text-emerald-300",
        dot: "bg-emerald-500",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
      };
    case "medium":
      return {
        bg: "bg-amber-50 dark:bg-amber-900/20",
        border: "border-amber-200 dark:border-amber-800",
        text: "text-amber-700 dark:text-amber-300",
        dot: "bg-amber-500",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      };
    case "high":
      return {
        bg: "bg-orange-50 dark:bg-orange-900/20",
        border: "border-orange-200 dark:border-orange-800",
        text: "text-orange-700 dark:text-orange-300",
        dot: "bg-orange-500",
        badge: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      };
    case "critical":
      return {
        bg: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-200 dark:border-red-800",
        text: "text-red-700 dark:text-red-300",
        dot: "bg-red-500",
        badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      };
  }
};

const getActionIcon = (action?: string) => {
  switch (action) {
    case "increase_stablecoins":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "reduce_leverage":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      );
    case "diversify":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
  }
};

export const PortfolioRiskWidget: React.FC<PortfolioRiskWidgetProps> = ({
  compact = false,
  className = "",
}) => {
  const [horizon, setHorizon] = useState<"1h" | "24h">("24h");
  const { riskData, isLoading, error, refetch } = useRiskAssessment(horizon);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  if (error || !riskData) {
    return null;
  }

  const colors = getRiskColors(riskData.riskLevel);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <span className={`relative flex h-3 w-3`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dot} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${colors.dot}`} />
          </span>
          <span className={`text-sm font-semibold ${colors.text}`}>
            Risk: {riskData.riskLevel.charAt(0).toUpperCase() + riskData.riskLevel.slice(1)}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          Score: {Math.round(riskData.overallScore)}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dot} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors.dot}`} />
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
            Portfolio Risk
          </h3>
        </div>
        
        {/* Horizon Toggle */}
        <div className="flex bg-white dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setHorizon("1h")}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              horizon === "1h"
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            1H
          </button>
          <button
            onClick={() => setHorizon("24h")}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              horizon === "24h"
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            24H
          </button>
        </div>
      </div>

      {/* Risk Score */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className={`text-3xl font-bold ${colors.text}`}>
            {Math.round(riskData.overallScore)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">/100</span>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors.badge}`}>
          {riskData.riskLevel.toUpperCase()}
        </span>
      </div>

      {/* Risk Meter */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colors.dot}`}
          initial={{ width: 0 }}
          animate={{ width: `${riskData.overallScore}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Market Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Liquidation
          </div>
          <div className={`text-sm font-bold ${riskData.market.liquidationRisk > 60 ? "text-red-600" : "text-gray-900 dark:text-white"}`}>
            {Math.round(riskData.market.liquidationRisk)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Implied Vol
          </div>
          <div className={`text-sm font-bold ${riskData.market.impliedVolatility > 50 ? "text-amber-600" : "text-gray-900 dark:text-white"}`}>
            {Math.round(riskData.market.impliedVolatility)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Sentiment
          </div>
          <div className={`text-sm font-bold ${
            riskData.market.sentiment > 60 ? "text-emerald-600" :
            riskData.market.sentiment < 40 ? "text-red-600" : "text-gray-900 dark:text-white"
          }`}>
            {riskData.market.sentiment > 60 ? "Risk-on" : riskData.market.sentiment < 40 ? "Risk-off" : "Neutral"}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {riskData.recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Recommendations
          </div>
          {riskData.recommendations.slice(0, 2).map((rec, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700"
            >
              <span className={`mt-0.5 ${rec.priority === "high" ? "text-red-500" : rec.priority === "medium" ? "text-amber-500" : "text-gray-400"}`}>
                {getActionIcon(rec.action)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {rec.title}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2">
                  {rec.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          via SynthData Risk Engine
        </span>
        <button
          onClick={refetch}
          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default PortfolioRiskWidget;
