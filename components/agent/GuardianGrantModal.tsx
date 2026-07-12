/**
 * GuardianGrantModal - ERC-7715 MetaMask grant confirmation modal
 *
 * Extracted from AgentTierStatus. Shows the user a summary of what
 * MetaMask will ask them to sign BEFORE the wallet popup fires.
 */

import React from "react";
import Scrim from "../shared/Scrim";
import { haptic } from "@/lib/haptics";

export const GuardianGrantModal: React.FC<{
  pendingDailyLimit: number;
  setPendingDailyLimit: (n: number) => void;
  DAILY_LIMIT_PRESETS: readonly number[];
  onCancel: () => void;
  onContinue: () => void;
}> = ({
  pendingDailyLimit,
  setPendingDailyLimit,
  DAILY_LIMIT_PRESETS,
  onCancel,
  onContinue,
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <Scrim intensity="default" onClick={onCancel} />
      <div
        className="bg-white dark:bg-gray-900 rounded-t-[32px] w-full max-w-md p-8 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <span className="text-4xl">🦊</span>
          <h3 className="text-xl font-black text-gray-900 dark:text-gray-100">
            Stronger protection via MetaMask
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your wallet will enforce the daily limit on-chain. Keys never leave your device.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Daily limit
            </span>
            <span className="text-sm font-black text-orange-600 dark:text-orange-400">
              ${pendingDailyLimit} / day
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DAILY_LIMIT_PRESETS.map((amount) => {
              const selected = amount === pendingDailyLimit;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setPendingDailyLimit(amount)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                    selected
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-orange-400"
                  }`}
                >
                  ${amount}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 border border-orange-100 dark:border-orange-800">
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">
            What MetaMask will ask you to sign
          </p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">•</span>
              <span>Allow Auto-Saver to spend up to <strong>${pendingDailyLimit}</strong> of your USDC per day on Arbitrum.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">•</span>
              <span>You can revoke this permission in your wallet at any time.</span>
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
            onClick={() => { haptic("medium"); onContinue(); }}
            className="flex-1 text-sm font-black bg-orange-600 hover:bg-orange-700 text-white rounded-2xl py-4 min-h-[44px] shadow-lg shadow-orange-200 dark:shadow-orange-900/30 transition-[color,transform] active:scale-95"
          >
            Continue to MetaMask
          </button>
        </div>
      </div>
    </div>
  );
};
