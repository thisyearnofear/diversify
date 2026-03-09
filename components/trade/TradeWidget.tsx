import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import RobinMascot from "./RobinMascot";
import { TokenDesign } from "../../constants/tokens";

interface TradeWidgetProps {
  selected: string;
  design: TokenDesign;
  mode: "buy" | "sell";
  setMode: (mode: "buy" | "sell") => void;
  inputAmount: string;
  setInputAmount: (val: string) => void;
  quote: string | null;
  priceImpact: number | null;
  isQuoting: boolean;
  isSwapping: boolean;
  hasBalance: boolean;
  ethBalance: string | null;
  stockBalance: string;
  handleMax: () => void;
  handleSwap: () => Promise<void>;
  txHash: string | null;
  error: string | null;
  slippagePercent: number;
  explorerUrl?: string;
}

/**
 * TradeWidget Component
 *
 * A specialized trading interface for Robinhood Chain Testnet.
 * Implements the core "Buy/Sell" functionality with a premium look.
 */
export const TradeWidget: React.FC<TradeWidgetProps> = ({
  selected,
  mode,
  setMode,
  inputAmount,
  setInputAmount,
  quote,
  priceImpact,
  isQuoting,
  isSwapping,
  hasBalance,
  ethBalance,
  stockBalance,
  handleMax,
  handleSwap,
  txHash,
  error,
  slippagePercent,
  explorerUrl,
}) => {
  const inputLabel = mode === "buy" ? "ETH" : selected;
  const outputLabel = mode === "buy" ? selected : "ETH";

  const minimumOutput = quote
    ? ((parseFloat(quote) * (100 - slippagePercent)) / 100).toFixed(6)
    : null;

  // Mascot action state
  const mascotAction = isSwapping
    ? mode === "buy"
      ? "buying"
      : "selling"
    : isQuoting
      ? "thinking"
      : txHash
        ? "happy"
        : "idle";

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
      {/* Background Mascot for personality */}
      <div className="absolute -top-4 -right-4 opacity-5 pointer-events-none grayscale">
        <RobinMascot action={mascotAction} className="scale-125" />
      </div>

      <div className="space-y-4 relative z-10">
        <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setMode("buy");
              setInputAmount("");
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              mode === "buy"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-white"
            }`}
          >
            Buy {selected}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setMode("sell");
              setInputAmount("");
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              mode === "sell"
                ? "bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-white"
            }`}
          >
            Sell {selected}
          </motion.button>
        </div>

        {/* Input Field */}
        <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              You pay
            </span>
            <button
              onClick={handleMax}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-bold uppercase"
            >
              Max
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="flex-1 bg-transparent text-xl font-bold outline-none placeholder-gray-300 dark:placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-gray-500 dark:text-gray-400 font-bold">
              {inputLabel}
            </span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">
            {mode === "buy"
              ? `Balance: ${ethBalance ? parseFloat(ethBalance).toFixed(4) : "—"} ETH`
              : `Balance: ${parseFloat(stockBalance).toFixed(2)} ${selected}`}
          </div>
        </div>

        {/* Arrow Spacer */}
        <div className="flex justify-center -my-1">
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 shadow-sm">
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-500 ${isQuoting ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>

        {/* Output Preview */}
        <div className="bg-gray-50/50 dark:bg-gray-800/20 rounded-xl p-3 border border-gray-100 dark:border-gray-700/30">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            You receive
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl font-bold">
              {isQuoting ? (
                <span className="inline-block w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
              ) : (
                quote || "0.0"
              )}
            </span>
            <span className="text-gray-500 dark:text-gray-400 font-bold">
              {outputLabel}
            </span>
          </div>
        </div>

        {/* Price Impact & Details */}
        <AnimatePresence>
          {quote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-50 dark:bg-gray-800/30 rounded-xl px-4 py-3 border border-gray-200/50 dark:border-gray-700/20 space-y-1.5 overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-gray-500 dark:text-gray-400">
                  Slippage tolerance
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {slippagePercent}%
                </span>
              </div>
              {priceImpact !== null && (
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-gray-500 dark:text-gray-400">
                    Price impact
                  </span>
                  <span
                    className={`${
                      priceImpact < 1
                        ? "text-green-600 dark:text-green-400"
                        : priceImpact < 5
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {priceImpact < 0.01 ? "<0.01" : priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}
              {minimumOutput && (
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-gray-500 dark:text-gray-400">
                    Minimum received
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {parseFloat(minimumOutput).toFixed(4)} {outputLabel}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swap Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSwap}
          disabled={!inputAmount || !quote || isSwapping || !hasBalance}
          className={`w-full py-4 rounded-xl font-bold text-base transition-all uppercase tracking-widest shadow-lg ${
            isSwapping
              ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait shadow-none"
              : !inputAmount || !quote || !hasBalance
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                : mode === "buy"
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                  : "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
          }`}
        >
          {isSwapping ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Swapping…
            </span>
          ) : !hasBalance ? (
            mode === "buy" ? (
              "Need ETH"
            ) : (
              `No ${selected}`
            )
          ) : (
            `${mode === "buy" ? "Buy" : "Sell"} ${selected}`
          )}
        </motion.button>

        {/* Feedback Messages */}
        <AnimatePresence mode="wait">
          {txHash && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-3 text-center space-y-1"
            >
              <p className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                ✅ Swap successful!
              </p>
              {explorerUrl && (
                <a
                  href={`${explorerUrl}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 dark:text-green-300 hover:underline font-bold"
                >
                  View on Explorer →
                </a>
              )}
            </motion.div>
          )}
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3 text-center"
            >
              <p className="text-red-700 dark:text-red-400 text-sm font-bold">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TradeWidget;
