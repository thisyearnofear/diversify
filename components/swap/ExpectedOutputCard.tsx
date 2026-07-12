import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "../shared/AnimatedNumber";

interface ExpectedOutputCardProps {
  expectedOutput: string | null;
  amount: string;
  fromToken: string;
  toToken: string;
  fromChainName?: string;
  toChainName?: string;
  slippageTolerance?: number;
  isCrossChain?: boolean;
  mounted: boolean;
}

/**
 * Compact live quote row — replaces the old "Review This Route" receipt.
 * Shows one line: "1 USDm ≈ 129.4 KESm · slippage 0.5%"
 * Expandable for full details. Shimmer while fetching.
 */
const ExpectedOutputCard: React.FC<ExpectedOutputCardProps> = ({
  expectedOutput,
  amount,
  fromToken,
  toToken,
  fromChainName,
  toChainName,
  slippageTolerance,
  isCrossChain = false,
  mounted,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const reducedMotion = useReducedMotion();

  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const parsedOutput = expectedOutput ? Number.parseFloat(expectedOutput) : 0;
  const hasOutput = mounted && parsedOutput > 0;
  const isFetching = mounted && hasValidAmount && !hasOutput;

  const rate = hasValidAmount && hasOutput ? parsedOutput / parsedAmount : 0;

  // Don't render anything until we have a valid amount
  if (!mounted || !hasValidAmount) return null;

  return (
    <div className="mt-1">
      {/* Compact quote row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Shimmer while fetching */}
          {isFetching ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ) : hasOutput ? (
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="font-semibold text-gray-600 dark:text-gray-300">
                1 {fromToken} ≈
              </span>
              <AnimatedNumber
                value={rate}
                decimals={rate < 1 ? 6 : rate < 100 ? 4 : 2}
                className="font-bold text-gray-900 dark:text-gray-100"
                duration={reducedMotion ? 0.3 : 0.8}
              />
              <span className="font-semibold text-gray-600 dark:text-gray-300">
                {toToken}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Waiting for quote…</span>
          )}

          {hasOutput && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              · {typeof slippageTolerance === "number" ? `${slippageTolerance}%` : "Auto"}
              {isCrossChain && " · bridge"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasOutput && (
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {parsedOutput < 1 ? parsedOutput.toFixed(6) : parsedOutput.toFixed(4)} {toToken}
            </span>
          )}
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-3.5 h-3.5 text-gray-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {expanded && hasOutput && (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <dl className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">You send</dt>
                  <dd className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    {parsedAmount.toFixed(4)} {fromToken}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">You receive</dt>
                  <dd className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    {parsedOutput.toFixed(4)} {toToken}
                  </dd>
                </div>
                {fromChainName && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">From</dt>
                    <dd className="text-xs font-bold text-gray-900 dark:text-gray-100">{fromChainName}</dd>
                  </div>
                )}
                {toChainName && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">To</dt>
                    <dd className="text-xs font-bold text-gray-900 dark:text-gray-100">{toChainName}</dd>
                  </div>
                )}
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExpectedOutputCard;
