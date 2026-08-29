import React from "react";
import { motion } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { useFxNetting } from "../../hooks/use-fx-netting";

/**
 * CaribbeanFxNetCard — the FX Corridor card for the Future Caribbean track.
 * Two-phase, one job per phase (docs/design-language.md):
 *   1. INTENT — state "I need to sell X for Y".
 *   2. MATCH REVIEW — netting at mid-market: matched, saved, unmatched, anchor.
 * Honest fallback when no counterparty pool is hosted yet.
 */
export function CaribbeanFxNetCard() {
  const { address } = useWalletContext();
  const { data, isLoading, error, match } = useFxNetting(address ?? null);

  const [sellCurrency, setSellCurrency] = React.useState("JMD");
  const [sellAmount, setSellAmount] = React.useState("");
  const [buyCurrency, setBuyCurrency] = React.useState("BBD");
  const [matched, setMatched] = React.useState(false);

  const sellAmountNum = sellAmount ? Number(sellAmount) : 0;
  const canMatch = sellAmountNum > 0 && sellCurrency !== buyCurrency;

  const handleSubmit = () => {
    if (!canMatch) return;
    setMatched(true);
    void match({ sellCurrency, sellAmount: sellAmountNum, buyCurrency }, []);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-gradient-to-br from-teal-50/60 to-cyan-50/60 dark:from-teal-950/20 dark:to-cyan-950/20 p-5"
      data-testid="caribbean-fx-net-card"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
          <span aria-hidden="true">🌴</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-teal-900 dark:text-teal-100">
            Caribbean FX Netting
          </h3>
          <p className="text-xs text-teal-700 dark:text-teal-300 mt-0.5">
            Match a currency need directly with a counterparty — no USD bridge,
            no 7% bank corridor.
          </p>
        </div>
      </div>

      {!matched ? (
        <div data-testid="fx-phase-intent">
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                You have
              </span>
              <input
                type="text"
                value={sellCurrency}
                onChange={(e) => setSellCurrency(e.target.value.toUpperCase())}
                aria-label="Currency you have"
                className="mt-1 w-full min-h-11 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-800 text-sm font-bold text-teal-900 dark:text-teal-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/60"
              />
            </label>
            <label className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                Amount
              </span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="e.g. 500000"
                aria-label="Amount to convert"
                className="mt-1 w-full min-h-11 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-800 text-sm font-bold text-teal-900 dark:text-teal-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/60"
              />
            </label>
            <label className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                You want
              </span>
              <input
                type="text"
                value={buyCurrency}
                onChange={(e) => setBuyCurrency(e.target.value.toUpperCase())}
                aria-label="Currency you want"
                className="mt-1 w-full min-h-11 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-800 text-sm font-bold text-teal-900 dark:text-teal-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/60"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canMatch || isLoading}
              className="min-h-11 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {isLoading ? "Matching…" : "Match my intent"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSellCurrency("JMD");
                setBuyCurrency("BBD");
                setSellAmount("");
              }}
              className="min-h-11 px-3 py-2 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100/60 dark:hover:bg-teal-900/30 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div data-testid="fx-phase-review">
          {error ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">{error}</p>
              <button
                type="button"
                onClick={() => setMatched(false)}
                className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300 underline"
              >
                Edit my intent
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">Matched</div>
                  <div className="mt-1 text-lg font-black text-teal-900 dark:text-teal-100 tabular-nums">
                    {isLoading ? "…" : data ? `$${data.totalMatchedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "$0"}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Saved</div>
                  <div className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {isLoading ? "…" : data ? `~$${data.totalSavingsUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "~$0"}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">Matches</div>
                  <div className="mt-1 text-lg font-black text-teal-900 dark:text-teal-100 tabular-nums">
                    {isLoading ? "…" : data ? data.matches.length : 0}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">Unmatched</div>
                  <div className="mt-1 text-lg font-black text-teal-900 dark:text-teal-100 tabular-nums">
                    {isLoading ? "…" : data ? data.unmatchedCount : 0}
                  </div>
                </div>
              </div>

              {data?.matches.length ? (
                <ul className="mt-4 space-y-2">
                  {data.matches.map((m) => (
                    <li
                      key={m.matchId}
                      className="rounded-xl border border-teal-100 dark:border-teal-900 bg-white/50 dark:bg-gray-900/40 p-3 text-xs leading-relaxed text-teal-800 dark:text-teal-200"
                    >
                      <span className="font-black">{m.intentA.sellCurrency}</span> →{" "}
                      <span className="font-black">{m.intentB.sellCurrency}</span> ·{" "}
                      <span className="font-bold tabular-nums">{m.matchedAmount.toLocaleString()}</span>{" "}
                      matched at <span className="font-mono">{m.rate.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                !isLoading && (
                  <p className="mt-4 text-xs text-teal-700 dark:text-teal-300 leading-relaxed">
                    No counterparty matched your intent yet. Your intent stays open
                    for the next matching cycle — matching runs at the live
                    mid-market with no USD bridge.
                  </p>
                )
              )}

              <footer className="mt-4 text-[10px] text-teal-700/70 dark:text-teal-300/70 leading-snug">
                {data && data.rateSourceNote
                  ? `Mid-market via ${data.rateSourceNote}.`
                  : "Matching against the live mid-market."}{" "}
                {typeof data?.poolSize === 'number' && data.poolSize > 0
                  ? `Matched against ${data.poolSize} open intent${data.poolSize === 1 ? '' : 's'} in the pool. `
                  : ""}
                Every match is anchored on-chain to the region-canonical ledger.
              </footer>
            </>
          )}
        </div>
      )}
    </motion.section>
  );
}

export default CaribbeanFxNetCard;