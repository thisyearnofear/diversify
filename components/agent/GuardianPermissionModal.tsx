/**
 * GuardianPermissionModal - Auto-Saver setup modal
 *
 * Extracted from AgentTierStatus. Lets the user pick their daily limit
 * BEFORE any signature. Shows on-chain awareness (chain + stable balance).
 */

import React from "react";

const MIN_AUTO_SAVER_FUNDS_USD = 5;
const ARBITRUM_CHAIN_ID = 42161;

export const GuardianPermissionModal: React.FC<{
  pendingDailyLimit: number;
  setPendingDailyLimit: (n: number) => void;
  DAILY_LIMIT_PRESETS: readonly number[];
  isChainSupported: boolean;
  isLowOnFunds: boolean;
  hasNonStableButNoStable: boolean;
  nonStableBalanceOnChain: number;
  currentChainName: string | null;
  stableBalanceTotal: number;
  portfolioLoading: boolean;
  isMiniPay?: boolean;
  onNavigateToFund?: () => void;
  switchToChain: (chainId: number) => void;
  onCancel: () => void;
  onApprove: () => void;
}> = ({
  pendingDailyLimit,
  setPendingDailyLimit,
  DAILY_LIMIT_PRESETS,
  isChainSupported,
  isLowOnFunds,
  hasNonStableButNoStable,
  nonStableBalanceOnChain,
  currentChainName,
  stableBalanceTotal,
  portfolioLoading,
  isMiniPay,
  onNavigateToFund,
  switchToChain,
  onCancel,
  onApprove,
}) => {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-t-[32px] w-full max-w-md p-8 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <span className="text-4xl">🛡️</span>
          <h3 className="text-xl font-black text-gray-900 dark:text-gray-100">
            Set up Auto-Saver
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pick how much Auto-Saver can move each day. You can change or pause it any time.
          </p>
        </div>

        {/* Onchain awareness: which chain + what Auto-Saver can see in
            the user's wallet. Sourced from useMultichainBalances so
            the figure matches the portfolio shown elsewhere. */}
        <div
          className={`rounded-2xl p-3 border text-xs space-y-1 ${
            !isChainSupported
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : isLowOnFunds
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-700 dark:text-gray-300">
              {currentChainName
                ? `Network · ${currentChainName}`
                : "Network · Not connected"}
            </span>
            {portfolioLoading ? (
              <span className="text-gray-400">Checking balance…</span>
            ) : isChainSupported ? (
              <span className="font-black text-gray-900 dark:text-gray-100">
                ${stableBalanceTotal.toFixed(2)} in stables
              </span>
            ) : null}
          </div>
          {!isChainSupported ? (
            <div className="space-y-2">
              <p className="text-red-700 dark:text-red-300">
                Switch to Celo or Arbitrum to set up Auto-Saver.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => switchToChain(42220)}
                  className="flex-1 text-[11px] font-bold text-red-700 dark:text-red-200 bg-white dark:bg-gray-900 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg py-1.5 transition-colors"
                >
                  Switch to Celo
                </button>
                <button
                  type="button"
                  onClick={() => switchToChain(ARBITRUM_CHAIN_ID)}
                  className="flex-1 text-[11px] font-bold text-red-700 dark:text-red-200 bg-white dark:bg-gray-900 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg py-1.5 transition-colors"
                >
                  Switch to Arbitrum
                </button>
              </div>
            </div>
          ) : isLowOnFunds ? (
            <div className="space-y-2">
              <p className="text-amber-700 dark:text-amber-300">
                {hasNonStableButNoStable
                  ? `You have $${nonStableBalanceOnChain.toFixed(0)} on ${currentChainName} but not in stables. Auto-Saver needs at least $${MIN_AUTO_SAVER_FUNDS_USD} in stables to act.`
                  : `Auto-Saver needs at least $${MIN_AUTO_SAVER_FUNDS_USD} in stables to act. You can still approve now and top up later — it'll just wait.`}
              </p>
              {isMiniPay ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 italic">
                  Tap "Add Cash" in your MiniPay wallet — fastest way to top up.
                </p>
              ) : onNavigateToFund ? (
                <div className="flex gap-2">
                  {hasNonStableButNoStable && (
                    <button
                      type="button"
                      onClick={() => {
                        onCancel();
                        onNavigateToFund();
                      }}
                      className="flex-1 text-[11px] font-bold text-amber-800 dark:text-amber-100 bg-white dark:bg-gray-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg py-1.5 transition-colors"
                    >
                      Convert to stables
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onCancel();
                      onNavigateToFund();
                    }}
                    className="flex-1 text-[11px] font-bold text-amber-800 dark:text-amber-100 bg-white dark:bg-gray-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg py-1.5 transition-colors"
                  >
                    Add funds
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              Auto-Saver only acts on funds it can see in your wallet on this chain.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Daily limit
            </span>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400">
              ${pendingDailyLimit} / day
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DAILY_LIMIT_PRESETS.map((amount) => {
              const selected = amount === pendingDailyLimit;
              // Dim (but don't disable) chips above the user's stable
              // balance so they understand the limit but can still pick
              // it if they plan to top up.
              const aboveBalance =
                isChainSupported &&
                !portfolioLoading &&
                stableBalanceTotal > 0 &&
                amount > stableBalanceTotal;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setPendingDailyLimit(amount)}
                  title={aboveBalance ? "More than what's in your wallet right now" : undefined}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                    selected
                      ? "bg-purple-600 border-purple-600 text-white"
                      : aboveBalance
                        ? "bg-white/40 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-purple-300"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-400"
                  }`}
                >
                  ${amount}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
            Start small. You can raise the limit later.
          </p>
        </div>

        <div className="space-y-2 bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800">
          <p className="text-[11px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">
            What you're approving
          </p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>Auto-Saver may swap up to <strong>${pendingDailyLimit}</strong> of your stables each day.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>Valid for <strong>7 days</strong>, then expires automatically.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>Only into approved stablecoins or gold (USDC, EURC, PAXG).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>If your wallet is empty when it runs, it just waits — no errors, no fees.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>You can pause it from this screen any time.</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 text-sm font-bold text-gray-500 py-4"
          >
            Cancel
          </button>
          <button
            onClick={onApprove}
            disabled={!isChainSupported}
            className="flex-1 text-sm font-black bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-2xl py-4 shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all active:scale-95"
          >
            {isChainSupported ? "Approve in wallet" : "Switch network first"}
          </button>
        </div>
      </div>
    </div>
  );
};
