/**
 * StellarModePanel — what a surface renders while exchangeNetwork is
 * 'stellar:testnet'. The EVM object (portfolio ring, risk theater) stays
 * off-screen; this panel acknowledges the mode honestly — the real Freighter
 * account and balances if connected, the hand-off to Exchange if not.
 * Never shows fabricated holdings.
 */

import React from "react";
import { useNavigationOptional } from "@/context/app/NavigationContext";
import { formatAmountUnits } from "@diversifi/shared/src/types/stellar";

const SURFACE_COPY: Record<string, { title: string; body: string }> = {
  home: {
    title: "On Stellar testnet",
    body: "Your wallet portfolio stays on wallet networks — conversions on Stellar happen in Exchange.",
  },
  shield: {
    title: "On Stellar testnet",
    body: "Guardian strategies run on wallet networks — there is nothing to protect on Stellar testnet yet.",
  },
};

function shortAccount(account: string): string {
  return account.length > 12 ? `${account.slice(0, 6)}…${account.slice(-4)}` : account;
}

export function StellarModePanel({ surface }: { surface: "home" | "shield" }) {
  const navigation = useNavigationOptional();
  const account = navigation?.stellarAccount ?? null;
  const copy = SURFACE_COPY[surface] ?? SURFACE_COPY.home;

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
        <span className="text-2xl text-orange-600 dark:text-orange-400">✦</span>
      </div>
      <p className="text-2xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
        Stellar · testnet
      </p>
      <h2 className="mt-1 text-lg font-black tracking-tight text-ink">{copy.title}</h2>
      {account ? (
        <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-surface px-4 py-3 text-left">
          <p className="font-mono text-xs text-ink-muted">{shortAccount(account.account)}</p>
          <ul className="mt-2 space-y-1">
            {account.balances.map((b) => (
              <li key={b.asset.code} className="flex justify-between text-sm text-ink">
                <span className="font-semibold">{b.asset.code}</span>
                <span className="font-mono">
                  {formatAmountUnits(b.balanceUnits, b.asset.decimals) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">Connect Freighter in Exchange to see the account here.</p>
      )}
      <p className="mt-4 text-sm text-ink-muted">{copy.body}</p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => navigation?.setActiveTab("exchange")}
          className="min-h-tap rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Open Exchange
        </button>
        <button
          type="button"
          onClick={() => navigation?.setExchangeNetwork("evm")}
          className="min-h-tap px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Back to wallet networks
        </button>
      </div>
    </div>
  );
}

export default StellarModePanel;
