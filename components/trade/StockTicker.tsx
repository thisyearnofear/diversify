import React from "react";
import { motion } from "framer-motion";
import {
  StaggerContainer,
  staggerItemVariants,
} from "../../hooks/use-animation";
import { getTokenDesign } from "../../constants/tokens";

interface StockTickerProps {
  stocks: readonly string[];
  selected: string;
  onSelect: (stock: string) => void;
  liveRates: Record<string, string | null>;
  stockBalances: Record<string, string>;
}

/**
 * StockTicker Component
 *
 * Modular ticker selection for the Robinhood trade page.
 * Implements ENHANCEMENT FIRST and MODULAR principles.
 */
export const StockTicker: React.FC<StockTickerProps> = ({
  stocks,
  selected,
  onSelect,
  liveRates,
  stockBalances,
}) => {
  return (
    <StaggerContainer className="flex gap-2 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
      {stocks.map((s) => {
        const d = getTokenDesign(s);
        const isSelected = s === selected;
        const rate = liveRates[s];
        const bal = stockBalances[s as keyof typeof stockBalances];

        return (
          <motion.button
            key={s}
            variants={staggerItemVariants}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96, opacity: 0.9 }}
            onClick={() => onSelect(s)}
            className={`snap-start shrink-0 w-[6.5rem] sm:w-auto relative rounded-xl p-3 text-left transition-all border overflow-hidden ${
              isSelected
                ? "border-blue-600 bg-white dark:bg-gray-900 shadow-md ring-1 ring-blue-600/20"
                : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-900"
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${d.gradient}`}
            />
            <div className="text-xl mb-1 mt-1">{d.icon}</div>
            <div className="font-bold text-sm tracking-tight">{s}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate mb-1 font-medium">
              {d.name}
            </div>
            {rate && (
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                {rate}/ETH
              </div>
            )}
            {parseFloat(bal) > 0 && (
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 font-bold bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded inline-block">
                {parseFloat(bal).toFixed(1)}
              </div>
            )}
          </motion.button>
        );
      })}
    </StaggerContainer>
  );
};

export default StockTicker;
