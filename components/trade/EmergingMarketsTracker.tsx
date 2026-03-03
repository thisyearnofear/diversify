/**
 * Emerging Markets Tracker (Mobile-Optimized)
 * Displays real emerging market stock prices with quick access and compact cards
 * ENHANCEMENT FIRST: Mobile-optimized version with progressive disclosure
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  REAL_EMERGING_MARKET_STOCKS,
  FICTIONAL_EMERGING_MARKET_COMPANIES,
  REGION_METADATA,
  getAssetBySymbol,
  type EmergingMarketStock,
} from "../../config/emerging-markets";
import { useEmergingMarketsPrices } from "../../hooks/use-emerging-markets-prices";
import { useWatchlist } from "../../hooks/use-watchlist";

// ============================================
// Mobile-Optimized Stock Card (Compact)
// ============================================
interface CompactStockCardProps {
  symbol: string;
  price: {
    price: number;
    currency: string;
    usdEquivalent: number;
    changePercent24h: number | null;
  } | undefined;
  isLoading: boolean;
  onToggleWatchlist: (symbol: string) => void;
  isWatched: boolean;
}

const CompactStockCard: React.FC<CompactStockCardProps> = ({
  symbol,
  price,
  isLoading,
  onToggleWatchlist,
  isWatched,
}) => {
  const stock = getAssetBySymbol(symbol) as EmergingMarketStock | undefined;
  if (!stock) return null;

  const isPositive = price?.changePercent24h ? price.changePercent24h >= 0 : null;

  return (
    <motion.div
      layout
      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"
      whileTap={{ scale: 0.98 }}
    >
      {/* Left: Icon + Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xl">{stock.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm truncate">{symbol}</span>
            <span className="text-[10px] text-gray-400">{stock.market}</span>
          </div>
          <p className="text-[10px] text-gray-500 truncate">{stock.name}</p>
        </div>
      </div>

      {/* Right: Price + Star */}
      <div className="flex items-center gap-3">
        {isLoading || !price ? (
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <div className="text-right">
            <div className="font-bold text-sm">
              ${price.usdEquivalent.toFixed(price.usdEquivalent < 1 ? 4 : 2)}
            </div>
            {price.changePercent24h !== null && (
              <div className={`text-[10px] font-medium ${
                isPositive ? 'text-green-500' : 'text-red-500'
              }`}>
                {isPositive ? '+' : ''}{price.changePercent24h.toFixed(1)}%
              </div>
            )}
          </div>
        )}
        
        {/* Watchlist Star */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist(symbol);
          }}
          className={`p-1.5 rounded-full transition ${
            isWatched 
              ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' 
              : 'text-gray-300 hover:text-gray-400'
          }`}
        >
          <svg className="w-4 h-4" fill={isWatched ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

// ============================================
// Quick Access Bar (Watchlist)
// ============================================
interface QuickAccessBarProps {
  watchlist: string[];
  prices: Record<string, { usdEquivalent: number; changePercent24h: number | null }>;
  onSelect: (symbol: string) => void;
  isLoading: boolean;
}

const QuickAccessBar: React.FC<QuickAccessBarProps> = ({ 
  watchlist, 
  prices, 
  onSelect,
  isLoading 
}) => {
  if (watchlist.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
          ⭐ Quick Access
        </h4>
        <span className="text-[10px] text-gray-400">{watchlist.length} starred</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {watchlist.map((symbol) => {
          const stock = getAssetBySymbol(symbol) as EmergingMarketStock | undefined;
          const price = prices[symbol];
          const isPositive = price?.changePercent24h ? price.changePercent24h >= 0 : null;
          
          return (
            <button
              key={symbol}
              onClick={() => onSelect(symbol)}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 min-w-[140px]"
            >
              <span className="text-lg">{stock?.icon}</span>
              <div className="text-left">
                <div className="font-bold text-sm">{symbol}</div>
                {isLoading || !price ? (
                  <div className="w-12 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  <div className={`text-[10px] font-medium ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${price.usdEquivalent.toFixed(price.usdEquivalent < 1 ? 4 : 2)}
                    {' '}
                    {isPositive ? '▲' : '▼'}
                    {Math.abs(price.changePercent24h || 0).toFixed(1)}%
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// Region Filter Tabs
// ============================================
interface RegionFilterProps {
  activeRegion: "all" | "africa" | "latam" | "asia";
  onRegionChange: (region: "all" | "africa" | "latam" | "asia") => void;
  counts: Record<string, number>;
}

const RegionFilter: React.FC<RegionFilterProps> = ({ activeRegion, onRegionChange, counts }) => {
  const regions = [
    { key: "all", label: "All", icon: "🌍", count: counts.all },
    { key: "africa", label: "Africa", icon: "🌍", count: counts.africa },
    { key: "latam", label: "LatAm", icon: "🌎", count: counts.latam },
    { key: "asia", label: "Asia", icon: "🌏", count: counts.asia },
  ] as const;

  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
      {regions.map((region) => (
        <button
          key={region.key}
          onClick={() => onRegionChange(region.key as any)}
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all
            ${activeRegion === region.key
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          <span>{region.icon}</span>
          <span>{region.label}</span>
          <span className="text-[10px] text-gray-400">({region.count})</span>
        </button>
      ))}
    </div>
  );
};

// ============================================
// Main Component
// ============================================
interface EmergingMarketsTrackerProps {
  onSelectStock?: (symbol: string) => void;
  selectedStock?: string | null;
  showFictionalCTA?: boolean;
}

export const EmergingMarketsTracker: React.FC<EmergingMarketsTrackerProps> = ({
  onSelectStock,
  selectedStock,
  showFictionalCTA = true,
}) => {
  const [activeRegion, setActiveRegion] = useState<"all" | "africa" | "latam" | "asia">("all");
  const { prices, isLoading, error, refresh } = useEmergingMarketsPrices();
  const { watchlist, toggleWatchlist, isInWatchlist } = useWatchlist();
  const [showAll, setShowAll] = useState(false);

  // Filter stocks by region
  const filteredStocks = useMemo(() => {
    return REAL_EMERGING_MARKET_STOCKS.filter(
      stock => activeRegion === "all" || stock.region === activeRegion
    );
  }, [activeRegion]);

  // Count by region
  const regionCounts = useMemo(() => ({
    all: REAL_EMERGING_MARKET_STOCKS.length,
    africa: REAL_EMERGING_MARKET_STOCKS.filter(s => s.region === 'africa').length,
    latam: REAL_EMERGING_MARKET_STOCKS.filter(s => s.region === 'latam').length,
    asia: REAL_EMERGING_MARKET_STOCKS.filter(s => s.region === 'asia').length,
  }), []);

  // Show watchlist first, then 3 stocks, then "Show All" button
  const displayStocks = useMemo(() => {
    const watched = filteredStocks.filter(s => watchlist.includes(s.symbol));
    const unwatched = filteredStocks.filter(s => !watchlist.includes(s.symbol));
    
    if (showAll) return [...watched, ...unwatched];
    return [...watched, ...unwatched.slice(0, 3)];
  }, [filteredStocks, watchlist, showAll]);

  const hasMore = filteredStocks.length > displayStocks.length;

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-2">Failed to load market data</p>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🌍</span>
            Emerging Markets
          </h2>
          <p className="text-xs text-gray-500">
            Track real stocks • Star favorites for quick access
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          title="Refresh prices"
        >
          <svg 
            className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Quick Access (Watchlist) - Compact horizontal scroll */}
      <QuickAccessBar 
        watchlist={watchlist} 
        prices={prices} 
        onSelect={onSelectStock || (() => {})}
        isLoading={isLoading}
      />

      {/* Region Filter */}
      <RegionFilter 
        activeRegion={activeRegion} 
        onRegionChange={setActiveRegion}
        counts={regionCounts}
      />

      {/* Stock List (Compact Cards) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            {activeRegion === 'all' ? 'All Stocks' : `${REGION_METADATA[activeRegion].label} Stocks`}
          </h3>
          <span className="text-[10px] text-gray-400">
            {displayStocks.length} of {filteredStocks.length}
          </span>
        </div>
        
        <div className="space-y-2">
          {displayStocks.map((stock) => (
            <CompactStockCard
              key={stock.symbol}
              symbol={stock.symbol}
              price={prices[stock.symbol]}
              isLoading={isLoading}
              onToggleWatchlist={toggleWatchlist}
              isWatched={isInWatchlist(stock.symbol)}
            />
          ))}
        </div>

        {/* Show All Button */}
        {hasMore && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full mt-3 py-3 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
          >
            Show All {filteredStocks.length} Stocks
          </button>
        )}
      </div>

      {/* Fictional Companies Preview */}
      {showFictionalCTA && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              🎮 Practice Trading
            </h3>
            <span className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              Fictional
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {FICTIONAL_EMERGING_MARKET_COMPANIES.slice(0, 3).map((company) => (
              <div
                key={company.symbol}
                className="p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 text-center"
              >
                <span className="text-xl">{company.icon}</span>
                <div className="text-xs font-bold mt-1">{company.symbol}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Tap "Trade Fictional" tab to practice with {FICTIONAL_EMERGING_MARKET_COMPANIES.length} companies
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 pt-2">
        Prices via Yahoo Finance, Alpha Vantage • Updated every 15 min
      </div>
    </div>
  );
};

export default EmergingMarketsTracker;
