import { useState } from "react";
import { motion } from "framer-motion";

export type StockCategory = "fictional" | "real" | "emerging";

interface Stock {
  symbol: string;
  name: string;
  icon: string;
  category: StockCategory;
  market?: string;
  isTestnet?: boolean;
}

interface StockCategoriesProps {
  stocks: Stock[];
  selected: string;
  onSelect: (symbol: string) => void;
  liveRates: Record<string, string | null>;
  stockBalances: Record<string, string>;
  isAdvanced?: boolean;
}

export default function StockCategories({
  stocks,
  selected,
  onSelect,
  liveRates,
  stockBalances,
  isAdvanced = false,
}: StockCategoriesProps) {
  const [activeCategory, setActiveCategory] = useState<StockCategory | "all">("all");
  const [isExpanded, setIsExpanded] = useState(false);

  const categories = [
    { id: "all" as const, label: "All", icon: "📊" },
    { id: "fictional" as const, label: "Fictional", icon: "🎭" },
    { id: "real" as const, label: "Real Assets", icon: "💎" },
    { id: "emerging" as const, label: "Emerging Markets", icon: "🌍" },
  ];

  const filteredStocks = activeCategory === "all" 
    ? stocks 
    : stocks.filter(s => s.category === activeCategory);

  const displayStocks = isAdvanced || isExpanded 
    ? filteredStocks 
    : filteredStocks.slice(0, 4);

  const hasMore = filteredStocks.length > 4 && !isExpanded && !isAdvanced;

  return (
    <div className="space-y-3">
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              activeCategory === cat.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Stock Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {displayStocks.map((stock) => {
          const isSelected = selected === stock.symbol;
          const rate = liveRates[stock.symbol];
          const balance = parseFloat(stockBalances[stock.symbol] || "0");
          const hasBalance = balance > 0;

          return (
            <motion.button
              key={stock.symbol}
              onClick={() => onSelect(stock.symbol)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative p-3 rounded-xl border-2 transition text-left ${
                isSelected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {hasBalance && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
              
              <div className="text-2xl mb-1">{stock.icon}</div>
              
              <div className="font-bold text-sm mb-0.5">{stock.symbol}</div>
              
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate mb-1">
                {stock.name}
              </div>

              {stock.market && (
                <div className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                  {stock.market}
                </div>
              )}

              {rate && (
                <div className="text-[10px] font-bold text-gray-900 dark:text-white mt-1">
                  {rate}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Show More Button */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
        >
          Show {filteredStocks.length - 4} More →
        </button>
      )}
    </div>
  );
}
