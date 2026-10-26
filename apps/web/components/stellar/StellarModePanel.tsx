/**
 * StellarModePanel — what a surface renders while exchangeNetwork is
 * 'stellar:testnet'. The EVM object (portfolio ring, risk theater) stays
 * off-screen; this panel acknowledges the mode honestly — the real wallet
 * account and balances if connected, the hand-off to Exchange if not.
 * Never shows fabricated holdings.
 */

import React, { useCallback, useState } from "react";
import { useNavigationOptional } from "@/context/app/NavigationContext";
import { useAIConversationOptional } from "@/context/AIConversationContext";
import { useStellarSession } from "@/hooks/use-stellar-session";
import { formatAmountUnits } from "@diversifi/shared/src/types/stellar";
import { ASK_GUARDIAN_LABEL } from "@/constants/guardian-copy";
import { fundWithFriendbot } from "@/lib/stellar/friendbot";

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
  const conversation = useAIConversationOptional();
  const session = useStellarSession();
  const account = session.account;
  const copy = SURFACE_COPY[surface] ?? SURFACE_COPY.home;
  const [connecting, setConnecting] = useState(false);
  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await session.connect();
    } finally {
      setConnecting(false);
    }
  }, [session]);

  // A connected account with no XLM is one action away — friendbot funds
  // any testnet address; the user should never have to leave to find it.
  const nativeEmpty = Boolean(
    account && !account.balances.some((b) => b.asset.kind === "native" && b.balanceUnits !== "0"),
  );
  const [funding, setFunding] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const fund = useCallback(async () => {
    if (!account) return;
    setFunding("busy");
    const result = await fundWithFriendbot(account.account);
    setFunding(result.ok ? "done" : "failed");
  }, [account]);

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
          {nativeEmpty && (
            <p className="mt-2 text-2xs text-ink-muted">
              No test XLM yet.{" "}
              {funding === "done" ? (
                <span className="text-ink">Requested — it lands when the ledger closes.</span>
              ) : (
                <button
                  type="button"
                  data-testid="stellar-panel-friendbot"
                  onClick={() => void fund()}
                  disabled={funding === "busy"}
                  className="text-blue-600 font-semibold hover:underline dark:text-blue-400 disabled:opacity-50"
                >
                  {funding === "busy" ? "Requesting…" : funding === "failed" ? "Funding failed — retry" : "Get test XLM"}
                </button>
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">
          <button
            type="button"
            data-testid="stellar-panel-connect"
            onClick={() => void connect()}
            disabled={connecting}
            className="text-blue-600 font-semibold hover:underline dark:text-blue-400 disabled:opacity-50"
          >
            {connecting ? "Opening the wallet picker…" : "Connect a Stellar wallet"}
          </button>{" "}
          to see the account here.
        </p>
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
          onClick={() => conversation?.setDrawerOpen(true)}
          className="min-h-tap px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {ASK_GUARDIAN_LABEL} — walk me through Stellar
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
