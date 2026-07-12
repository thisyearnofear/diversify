import React from "react";
import { motion } from "framer-motion";

interface AssetChip {
  symbol: string;
  name: string;
  badge?: string;
}

const ROBINHOOD_ASSETS: AssetChip[] = [
  { symbol: "USDG", name: "Robinhood USDG", badge: "Stable" },
  { symbol: "SGOV", name: "Short Treasury ETF", badge: "Safe Yield" },
  { symbol: "SPY", name: "S&P 500 ETF", badge: "Hedge" },
  { symbol: "QQQ", name: "Nasdaq-100 ETF", badge: "Growth" },
  { symbol: "AAPL", name: "Apple", badge: "Stock" },
  { symbol: "TSLA", name: "Tesla", badge: "Stock" },
];

interface RobinhoodRwaCardProps {
  onLearnMore?: () => void;
}

export default function RobinhoodRwaCard({ onLearnMore }: RobinhoodRwaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl bg-gradient-to-br from-green-700 to-emerald-900 p-4 text-white shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">
            Robinhood Chain RWA
          </div>
          <h3 className="mt-1 text-lg font-black leading-tight">
            Tokenized stocks & insured USDG
          </h3>
          <p className="mt-1 text-sm text-emerald-50/90">
            Diversify into S&P 500, Treasuries, and USDG — all on an Arbitrum L2.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl backdrop-blur-sm">
          🏛️
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ROBINHOOD_ASSETS.map((asset) => (
          <div
            key={asset.symbol}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold backdrop-blur-sm"
          >
            <span>{asset.symbol}</span>
            {asset.badge && (
              <span className="text-[10px] font-medium text-emerald-200">
                {asset.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {onLearnMore && (
        <button
          onClick={onLearnMore}
          className="mt-4 w-full rounded-xl bg-white/10 py-2 text-sm font-bold text-white transition hover:bg-white/20"
        >
          Explore Robinhood RWA →
        </button>
      )}
    </motion.div>
  );
}
