/**
 * GuardianWDKStatus — lifecycle-aware Auto-Saver summary card.
 *
 * When Guardian isn't set up yet, this is an informational primer (no
 * buttons): the user is told what Auto-Saver does so the box delivers
 * value even at rest. Once Guardian is set up, the card surfaces what's
 * being watched and the most recent advice timestamp pulled from the
 * vault session. Actions (preview / run now) live on the parent card so
 * we don't duplicate buttons here.
 */

import React from "react";
import { useMobile } from "@/hooks/use-mobile";

interface GuardianWDKStatusProps {
  /** Whether the user has an active Guardian permission. */
  isGuardianActive: boolean;
  /** Assets the Guardian will protect (e.g. ["USDC", "EURC"]). */
  watchedAssets?: string[];
  /** Networks the Guardian operates on (e.g. ["Celo", "Arbitrum"]). */
  watchedNetworks?: string[];
  /** Latest advice surfaced by the Advisor, if any. */
  latestAdvice?: {
    oneLiner?: string;
    capturedAt?: string;
  } | null;
  /** Vault-enforced limit guarding the embedded token treasury. */
  hasTokenVault?: boolean;
  /**
   * Stablecoin balance Auto-Saver can see on the connected chain. When this
   * is below the minimum required, the active card surfaces a "Waiting for
   * funds" chip so the user understands why no moves have happened.
   */
  walletStableBalanceUSD?: number;
  /** Threshold below which we treat the wallet as "empty enough to wait". */
  minRequiredFundsUSD?: number;
}

function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  return `${Math.round(diffSec / 86400)} day ago`;
}

const GuardianWDKStatus: React.FC<GuardianWDKStatusProps> = ({
  isGuardianActive,
  watchedAssets = ["USDC", "EURC"],
  watchedNetworks = ["Celo", "Arbitrum"],
  latestAdvice,
  hasTokenVault = false,
  walletStableBalanceUSD,
  minRequiredFundsUSD = 5,
}) => {
  const isMobile = useMobile();
  const isWaitingForFunds =
    isGuardianActive &&
    typeof walletStableBalanceUSD === "number" &&
    walletStableBalanceUSD < minRequiredFundsUSD;

  // ── Inactive state ── short primer; no buttons, no opaque pings.
  if (!isGuardianActive) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0" aria-hidden="true">🛡️</span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-black text-gray-900 dark:text-gray-100">
              Auto-Saver — your savings co-pilot
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Once set up, Auto-Saver watches {watchedAssets.slice(0, 2).join(" and ")} on
              {" "}{watchedNetworks.slice(0, 2).join(" and ")} and rebalances when it
              spots a better option — always within the daily limit you set.
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
              You stay in control. You can pause it any time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Active state ── status + watched assets + latest advice.
  const adviceRelative = relativeTime(latestAdvice?.capturedAt);
  const adviceLine = latestAdvice?.oneLiner;

  return (
    <div className="bg-green-50/60 dark:bg-green-900/20 rounded-xl p-3 space-y-2 border border-green-100 dark:border-green-800/50">
      {/* Status row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm flex-shrink-0" aria-hidden="true">🛡️</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-gray-900 dark:text-gray-100">
              Auto-Saver
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              Watching {watchedAssets.join(" + ")} on{" "}
              {watchedNetworks.length > 2
                ? `${watchedNetworks.length} networks`
                : watchedNetworks.join(" and ")}
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1 flex-shrink-0">
          {isWaitingForFunds ? (
            <>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400">Waiting for funds</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Protecting</span>
            </>
          )}
        </span>
      </div>

      {isWaitingForFunds && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/60 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
          Auto-Saver is on, but your wallet is empty. It'll start working when you deposit
          stablecoins. No errors, no fees while it waits.
        </div>
      )}

      {/* Latest advice or fallback */}
      <div className="border-t border-green-200/70 dark:border-green-800/70 pt-2">
        {adviceLine ? (
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">
              Latest suggestion {adviceRelative ? `· ${adviceRelative}` : ""}
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
              {adviceLine}
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No moves needed right now — your portfolio looks healthy.
          </p>
        )}
      </div>

      {hasTokenVault && !isMobile && (
        <div className="flex items-center gap-1.5 pt-1 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
          <span aria-hidden="true">🔒</span>
          <span>Token Vault enabled</span>
        </div>
      )}
    </div>
  );
};

export default GuardianWDKStatus;
