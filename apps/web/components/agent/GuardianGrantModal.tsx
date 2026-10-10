/**
 * GuardianGrantModal — the autonomy opt-in ("Let Guardian act for you").
 *
 * The ONE place a user lets Guardian move money without a per-move
 * signature. Says so plainly BEFORE any wallet prompt, and names both
 * signatures that follow: MetaMask's on-chain cap (ERC-7715) and the
 * Guardian permission re-signed at the same limit. The limit is not
 * re-picked here — it is the daily limit already signed, stated read-only.
 */

import React from "react";
import Scrim from "../shared/Scrim";
import RiveProtectionSeal from "../shared/RiveProtectionSeal";
import { useHoldToCommit } from "@/hooks/use-hold-to-commit";

export const GuardianGrantModal: React.FC<{
  /** The signed daily limit — the cap MetaMask will enforce. */
  dailyLimit: number;
  onCancel: () => void;
  onContinue: () => void;
}> = ({ dailyLimit, onCancel, onContinue }) => {
  // The seal is the commitment device: sustained intent, not a tap.
  // Releasing early drains the arc and signs nothing; a full hold fires
  // onContinue inside the pointer's activation window so MetaMask can open.
  const hold = useHoldToCommit({ onCommit: onContinue });
  return (
    <>
      {/* Scrim is a sibling, not a child: nested, its fixed z-[49] would
          paint above the panel (z-auto) and swallow its clicks. */}
      <Scrim intensity="default" onClick={onCancel} />
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center"
        onClick={onCancel}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guardian-grant-title"
        className="bg-white dark:bg-gray-900 rounded-t-[32px] w-full max-w-md p-8 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <h3 id="guardian-grant-title" className="text-xl font-black text-gray-900 dark:text-gray-100">
            Let Guardian act for you
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Guardian will be able to move up to{" "}
            <strong className="text-gray-900 dark:text-gray-100">${dailyLimit} a day</strong>{" "}
            without asking each time. MetaMask enforces that cap on-chain. Keys never leave your device.
          </p>
        </div>

        <div className="space-y-2 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            You&apos;ll sign twice
          </p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5" aria-hidden="true">•</span>
              <span>In MetaMask: a spending cap of <strong>${dailyLimit}</strong> of your dollar tokens per day, on this network.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5" aria-hidden="true">•</span>
              <span>Then: your Guardian permission at the same limit, now allowed to act on its own.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5" aria-hidden="true">•</span>
              <span>Pause Guardian here, or revoke the cap in your wallet, at any time.</span>
            </li>
          </ul>
          <p className="text-2xs text-gray-400 dark:text-gray-500">
            To change the amount, pause Guardian and set a new daily limit first.
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={onCancel}
            className="flex-1 text-sm font-bold text-gray-500 py-4"
          >
            Cancel
          </button>
          <button
            type="button"
            {...hold.bind}
            aria-describedby="guardian-grant-hold-hint"
            className="flex-1 flex items-center justify-center gap-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-3 min-h-tap select-none touch-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <span aria-hidden="true" className="inline-flex shrink-0">
              <RiveProtectionSeal size={40} color="#a855f7" armed={false} holdProgress={hold.progress} />
            </span>
            <span className="text-sm font-black">
              {hold.holding ? "Keep holding…" : "Hold to let Guardian act"}
            </span>
          </button>
        </div>
        <p id="guardian-grant-hold-hint" className="text-2xs text-gray-400 dark:text-gray-500 text-center">
          Press and hold the seal — release early and nothing is signed.
        </p>
      </div>
      </div>
    </>
  );
};
