import React from "react";
import { TokenHolder, TokenHolderData } from "../../hooks/use-token-holders";

interface HoldersWidgetProps {
  holderData: TokenHolderData | null;
  isLoading: boolean;
  selectedStock: string;
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
  "bg-green-500",
  "bg-green-400",
  "bg-green-600",
  "bg-green-300",
  "bg-green-500/80",
  "bg-green-400/80",
  "bg-green-600/70",
  "bg-green-300/80",
  "bg-green-500/60",
  "bg-green-400/60",
];

export default function HoldersWidget({
  holderData,
  isLoading,
  selectedStock,
  explorerUrl,
}: HoldersWidgetProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!holderData) return null;

  const { holdersCount, topHolders } = holderData;
  const top10Total = topHolders.reduce((sum, h) => sum + h.percentage, 0);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
          Holders
        </h3>
        <div className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
          <span className="text-[10px] font-black text-green-600">
            👥 {holdersCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className="mb-4">
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {topHolders.map((holder, i) => (
            <div
              key={holder.address}
              className={`${BAR_COLORS[i]} transition-all`}
              style={{ width: `${holder.percentage}%` }}
              title={`#${i + 1} — ${holder.percentage.toFixed(2)}%`}
            />
          ))}
        </div>
        <p className="text-[10px] font-black text-gray-400 mt-1.5">
          Top 10 hold {top10Total.toFixed(2)}%
        </p>
      </div>

      {/* Holders Table */}
      <div className="space-y-0.5">
        {topHolders.map((holder, i) => (
          <div
            key={holder.address}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] ${
              i === 0
                ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30"
                : i % 2 === 1
                  ? "bg-gray-50 dark:bg-gray-800/30"
                  : ""
            }`}
          >
            <span
              className={`font-black w-5 text-right ${
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
              className="font-mono text-[10px] text-gray-500 hover:text-green-500 transition"
            >
              {truncateAddress(holder.address)}
            </a>
            <span className="ml-auto font-black text-gray-700 dark:text-gray-300">
              {formatBalance(holder.value)} {selectedStock}
            </span>
            <span className="font-black text-green-500 w-14 text-right">
              {holder.percentage.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
