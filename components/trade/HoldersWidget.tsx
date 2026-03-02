import React from "react";
import { TokenHolderData } from "../../hooks/use-token-holders";

interface HoldersWidgetProps {
  holderData: TokenHolderData | null;
  isLoading: boolean;
  explorerUrl: string;
}

function formatBalance(weiString: string, decimals = 18): string {
  const raw = parseFloat(weiString) / Math.pow(10, decimals);
  if (raw >= 1_000_000_000) return `${(raw / 1_000_000_000).toFixed(2)}B`;
  if (raw >= 1_000_000) return `${(raw / 1_000_000).toFixed(2)}M`;
  if (raw >= 1_000) return `${(raw / 1_000).toFixed(2)}K`;
  return raw.toFixed(2);
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const BAR_COLORS = [
  "bg-blue-600",
  "bg-blue-500",
  "bg-blue-400",
  "bg-blue-300",
  "bg-blue-600/80",
  "bg-blue-500/80",
  "bg-blue-400/80",
  "bg-blue-300/80",
  "bg-blue-600/60",
  "bg-blue-500/60",
];

export default function HoldersWidget({
  holderData,
  isLoading,
  explorerUrl,
}: HoldersWidgetProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!holderData) return null;

  const { holdersCount, topHolders } = holderData;
  const top10Total = topHolders.reduce((sum, h) => sum + h.percentage, 0);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Holders
        </h3>
        <div className="bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
            👥 {holdersCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className="mb-3">
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {topHolders.map((holder, i) => (
            <div
              key={holder.address}
              className={`${BAR_COLORS[i]} transition-all`}
              style={{ width: `${holder.percentage}%` }}
              title={`#${i + 1} — ${holder.percentage.toFixed(2)}%`}
            />
          ))}
        </div>
        <p className="text-[9px] font-bold text-gray-400 mt-1">
          Top 10 hold {top10Total.toFixed(2)}%
        </p>
      </div>

      {/* Holders Table */}
      <div className="space-y-0.5">
        {topHolders.map((holder, i) => (
          <div
            key={holder.address}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] ${
              i === 0
                ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-800/30"
                : i % 2 === 1
                  ? "bg-gray-50 dark:bg-gray-800/30"
                  : ""
            }`}
          >
            <span
              className={`font-bold w-4 text-right ${
                i === 0
                  ? "text-amber-500"
                  : "text-gray-400"
              }`}
            >
              #{i + 1}
            </span>
            <a
              href={`${explorerUrl}/address/${holder.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[9px] text-gray-500 hover:text-blue-600 transition"
            >
              {truncateAddress(holder.address)}
            </a>
            <span className="ml-auto font-bold text-gray-700 dark:text-gray-300">
              {formatBalance(holder.value)}
            </span>
            <span className="font-bold text-blue-600 dark:text-blue-400 w-12 text-right">
              {holder.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
