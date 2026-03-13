import React from "react";
import { motion } from "framer-motion";

interface RiskMetricsProps {
  liquidationRisk?: number;
  impliedVolatility?: number;
  realizedVol?: number;
  forecastVol?: number;
  sentiment?: number;
  asset?: string;
}

const RiskMetrics: React.FC<RiskMetricsProps> = ({
  liquidationRisk,
  impliedVolatility,
  realizedVol,
  forecastVol,
  sentiment,
  asset = "BTC",
}) => {
  const getRiskLevel = (value: number, thresholds: { low: number; high: number }) => {
    if (value <= thresholds.low) return "low";
    if (value <= thresholds.high) return "medium";
    return "high";
  };

  const getRiskColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low":
        return "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20";
      case "medium":
        return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20";
      case "high":
        return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20";
    }
  };

  const getVolTrend = () => {
    if (!realizedVol || !forecastVol) return null;
    const diff = ((forecastVol - realizedVol) / realizedVol) * 100;
    if (diff > 10) return { label: "Rising", color: "text-red-500", icon: "↑" };
    if (diff < -10) return { label: "Falling", color: "text-emerald-500", icon: "↓" };
    return { label: "Stable", color: "text-gray-500", icon: "→" };
  };

  const volTrend = getVolTrend();
  const liqLevel = liquidationRisk ? getRiskLevel(liquidationRisk, { low: 30, high: 70 }) : null;
  const ivLevel = impliedVolatility ? getRiskLevel(impliedVolatility, { low: 25, high: 50 }) : null;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          Risk Intelligence
        </h3>
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          {asset}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Liquidation Risk */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Liquidation Risk
            </span>
            {liqLevel && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getRiskColor(liqLevel)}`}>
                {liqLevel}
              </span>
            )}
          </div>
          <div className="flex items-end gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {liquidationRisk !== undefined ? `${Math.round(liquidationRisk)}%` : "--"}
            </span>
            <span className="text-[10px] text-gray-400 mb-1">probability</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                liqLevel === "low"
                  ? "bg-emerald-500"
                  : liqLevel === "medium"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${liquidationRisk || 0}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Implied Volatility */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Implied Vol
            </span>
            {ivLevel && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getRiskColor(ivLevel)}`}>
                {ivLevel}
              </span>
            )}
          </div>
          <div className="flex items-end gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {impliedVolatility !== undefined ? `${Math.round(impliedVolatility)}%` : "--"}
            </span>
            <span className="text-[10px] text-gray-400 mb-1">annualized</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                ivLevel === "low"
                  ? "bg-emerald-500"
                  : ivLevel === "medium"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(impliedVolatility || 0, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Volatility Comparison */}
      {realizedVol !== undefined && forecastVol !== undefined && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-500 dark:text-gray-400">
              <span className="font-medium">Realized:</span> {Math.round(realizedVol * 100)}%
            </span>
            {volTrend && (
              <div className={`flex items-center gap-1 ${volTrend.color}`}>
                <span>{volTrend.icon}</span>
                <span className="font-medium">{volTrend.label}</span>
                <span className="text-gray-400">
                  Forecast: {Math.round(forecastVol * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diversification Insight */}
      {sentiment !== undefined && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            <span className="font-medium">Market sentiment:</span>{" "}
            <span className={
              sentiment > 60 ? "text-emerald-600 dark:text-emerald-400" :
              sentiment < 40 ? "text-red-600 dark:text-red-400" :
              "text-gray-600 dark:text-gray-300"
            }>
              {sentiment > 60 ? "Risk-on" : sentiment < 40 ? "Risk-off" : "Neutral"}
            </span>
            {" "}• Consider{" "}
            {sentiment < 40 ? "defensive assets" : "diversification"}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskMetrics;
