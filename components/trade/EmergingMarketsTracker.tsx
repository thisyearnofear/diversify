/**
 * Emerging Markets Tracker
 * Displays real emerging market stock prices with educational context
 * Allows users to track and learn about real companies before trading fictional ones
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  EMERGING_MARKET_STOCKS, 
  REAL_EMERGING_MARKET_STOCKS,
  FICTIONAL_EMERGING_MARKET_COMPANIES,
  REGION_METADATA,
  getAssetBySymbol,
  type MarketAsset,
} from "../../config/emerging-markets";
import { useEmergingMarketsPrices } from "../../hooks/use-emerging-markets-prices";

interface StockPriceCardProps {
  symbol: string;
  price: {
    price: number;
    currency: string;
    usdEquivalent: number;
    change24h: number | null;
    changePercent24h: number | null;
    lastUpdated: number;
    source: string;
  } | undefined;
  isLoading: boolean;
  onSelect?: (symbol: string) => void;
  isSelected?: boolean;
}

const StockPriceCard: React.FC<StockPriceCardProps> = ({
  symbol,
  price,
  isLoading,
  onSelect,
  isSelected,
}) => {
  const stock = getAssetBySymbol(symbol);
  if (!stock) return null;

  const regionMeta = REGION_METADATA[stock.region];
  const isPositive = price && price.changePercent24h ? price.changePercent24h >= 0 : null;

  return (
    <motion.div
      layout
      onClick={() => onSelect?.(symbol)}
      className={`
        relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
        ${isSelected 
          ? `border-${stock.region === 'africa' ? 'green' : stock.region === 'latam' ? 'blue' : 'orange'}-500 shadow-lg` 
          : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
        }
        bg-gradient-to-br ${regionMeta.darkBgGradient} bg-opacity-50
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Region indicator */}
      <div className={`absolute top-2 right-2 text-xs`}>
        <span className="opacity-50">{regionMeta.icon}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{stock.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate">{stock.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stock.market} • {symbol}
          </p>
        </div>
      </div>

      {/* Price */}
      <div className="space-y-1">
        {isLoading || !price ? (
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">
                {price.currency} {price.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              {price.changePercent24h !== null && (
                <span className={`text-xs font-medium ${
                  isPositive ? 'text-green-500' : 'text-red-500'
                }`}>
                  {isPositive ? '+' : ''}{price.changePercent24h.toFixed(2)}%
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              ≈ ${price.usdEquivalent.toLocaleString(undefined, { maximumFractionDigits: 4 })} USD
            </p>
          </>
        )}
      </div>

      {/* Description */}
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {stock.description}
      </p>

      {/* Real ticker badge - only for real stocks */}
      {'realTicker' in stock && (
        <div className="mt-3 flex items-center gap-1">
          <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">
            📈 {stock.realTicker}
          </span>
          {price && (
            <span className="text-[10px] text-gray-400">
              via {price.source}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

interface RegionTabsProps {
  activeRegion: "all" | "africa" | "latam" | "asia";
  onRegionChange: (region: "all" | "africa" | "latam" | "asia") => void;
}

const RegionTabs: React.FC<RegionTabsProps> = ({ activeRegion, onRegionChange }) => {
  const regions = [
    { key: "all", label: "All Markets", icon: "🌍" },
    { key: "africa", label: "Africa", icon: "🌍" },
    { key: "latam", label: "Latin America", icon: "🌎" },
    { key: "asia", label: "Asia Pacific", icon: "🌏" },
  ] as const;

  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
      {regions.map((region) => (
        <button
          key={region.key}
          onClick={() => onRegionChange(region.key)}
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all
            ${activeRegion === region.key
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          <span>{region.icon}</span>
          {region.label}
        </button>
      ))}
    </div>
  );
};

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

  // Filter stocks by region
  const filteredStocks = REAL_EMERGING_MARKET_STOCKS.filter(
    stock => activeRegion === "all" || stock.region === activeRegion
  );

  // Get fictional companies for the same region
  const fictionalCompanies = FICTIONAL_EMERGING_MARKET_COMPANIES.filter(
    company => activeRegion === "all" || company.region === activeRegion
  );

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
            Emerging Markets Tracker
          </h2>
          <p className="text-sm text-gray-500">
            Track real stocks from Africa, Latin America, and Asia
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

      {/* Region Tabs */}
      <RegionTabs activeRegion={activeRegion} onRegionChange={setActiveRegion} />

      {/* Real Stocks Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Real Companies • Track & Learn
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStocks.map((stock) => (
            <StockPriceCard
              key={stock.symbol}
              symbol={stock.symbol}
              price={prices[stock.symbol]}
              isLoading={isLoading}
              onSelect={onSelectStock}
              isSelected={selectedStock === stock.symbol}
            />
          ))}
        </div>
      </div>

      {/* Fictional Companies CTA */}
      {showFictionalCTA && fictionalCompanies.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Practice Trading • Fictional Companies
            </h3>
            <span className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              Tradeable on Celo Sepolia
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fictionalCompanies.map((company) => (
              <motion.div
                key={company.symbol}
                className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{company.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">{company.name}</h4>
                    <p className="text-xs text-gray-500">{company.market}</p>
                    <p className="text-[10px] text-gray-400 mt-1 italic">
                      Inspired by: {company.inspiration}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{company.symbol}</span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>How it works:</strong> Track real emerging market stocks above to learn about the companies. 
              When you're ready to practice trading, switch to the fictional companies that mirror these regions 
              on the Celo Sepolia testnet.
            </p>
          </div>
        </div>
      )}

      {/* Data attribution */}
      <div className="text-center text-[10px] text-gray-400">
        Price data provided by Yahoo Finance, Alpha Vantage, and Finnhub • 
        Updates every 15 minutes
      </div>
    </div>
  );
};

export default EmergingMarketsTracker;
