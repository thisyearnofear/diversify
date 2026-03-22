import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SwapTab from "./SwapTab";
import TradeTab from "./TradeTab";
import type { Region } from "@/hooks/use-user-region";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";

interface ExchangeTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
}

type ExchangeMode = "swap" | "trade";

const STORAGE_KEY = "exchangeMode";

export default function ExchangeTab({
  userRegion,
  inflationData,
  refreshBalances,
  refreshChainId,
  isBalancesLoading,
}: ExchangeTabProps) {
  // DRY: Single source of truth for persisted mode — restore from localStorage on mount
  const [mode, setMode] = useState<ExchangeMode>(() => {
    if (typeof window === "undefined") return "swap";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "trade" ? "trade" : "swap";
  });

  // Persist mode selection across sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return (
    <div className="space-y-4">
      {/* Segment Control — single source of truth for Swap vs Trade */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button
          onClick={() => setMode("swap")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
            mode === "swap"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Swap
          </span>
          <span className="block text-[10px] font-medium opacity-60 mt-0.5">Stablecoins</span>
        </button>
        <button
          onClick={() => setMode("trade")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
            mode === "trade"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Trade
          </span>
          <span className="block text-[10px] font-medium opacity-60 mt-0.5">Stocks & Commodities</span>
        </button>
      </div>

      {/* Mode Content */}
      <AnimatePresence mode="wait">
        {mode === "swap" ? (
          <motion.div
            key="swap"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <SwapTab
              userRegion={userRegion}
              inflationData={inflationData}
              refreshBalances={refreshBalances}
              refreshChainId={refreshChainId}
              isBalancesLoading={isBalancesLoading}
            />
          </motion.div>
        ) : (
          <motion.div
            key="trade"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            <TradeTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}