/**
 * ClaimCelebration — post-claim success overlay.
 *
 * Calm coin-mint celebration (no confetti). Auto-closes after 6s.
 * The parent card handles the claim and passes results in.
 */

import React, { useEffect } from 'react';
import { NETWORKS } from "../../config";
import { Coin } from '../shared/FloatingCoins';
import Scrim from '../shared/Scrim';

interface ClaimCelebrationProps {
  amount: string;
  txHash?: string;
  streakDays: number;
  onClose: () => void;
  /** Called when user taps "Protect your G$" — navigates to the swap tab. */
  onProtect?: () => void;
}

export default function ClaimCelebration({ amount, txHash, streakDays, onClose, onProtect }: ClaimCelebrationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <Scrim intensity="default" onClick={onClose} />
      <div
        className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-8 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-500 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6 relative z-10">
          <div className="flex justify-center mb-3">
            <div className="animate-in zoom-in duration-500 coin-float">
              <Coin size={80} symbol="G$" color="#10b981" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
            Claim Successful
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your G$ is on its way to your wallet
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl text-center border border-emerald-100 dark:border-emerald-800">
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest mb-1">
              Received
            </div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
              {amount}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl text-center border border-blue-100 dark:border-blue-800">
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest mb-1">
              Streak
            </div>
            <div className="text-xl font-black text-blue-700 dark:text-blue-300">
              {streakDays} {streakDays === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>

        {txHash ? (
          <a
            href={`${NETWORKS.CELO_MAINNET.explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-700"
          >
            🔗 View on Celoscan
          </a>
        ) : (
          <div className="mb-4 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl text-center text-xs text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
            Tokens should appear in your wallet shortly.
          </div>
        )}

        {onProtect && (
          <button
            onClick={() => {
              onProtect();
              onClose();
            }}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-colors shadow-lg shadow-indigo-600/20 mb-2"
          >
            🛡️ Protect your G$ from inflation →
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
