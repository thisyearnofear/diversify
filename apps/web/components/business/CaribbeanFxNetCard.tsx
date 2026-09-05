import React from "react";
import { motion } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { useFxNetting, type FxSettlement } from "../../hooks/use-fx-netting";
import { trackFunnelEvent } from "@/lib/analytics";

/**
 * CaribbeanFxNetCard — the FX Corridor card for the Future Caribbean track.
 * Three phases, one job per phase (docs/design-language.md):
 *   1. INTENT — state "I need to sell X for Y".
 *   2. MATCH REVIEW — netting at mid-market: matched, saved, unmatched, anchor.
 *   3. SETTLE (when the caller is a net debtor) — send the cUSD obligation
 *      from your own wallet; the server verifies the transfer on-chain and
 *      advances both sides to settled.
 * Walletless visitors run the engine in observer mode: matching is real,
 * posting/settling needs a wallet — the copy says exactly that.
 * Honest fallback when no counterparty pool is hosted yet.
 */

/**
 * Curated ISO-4217 codes for the intent form's datalist + soft validation.
 * CARICOM set first (the track's corridor), then the Africa/major codes the
 * engine demonstrably matches. Unknown codes fall through the server's rate
 * adapter at a silent 1:1 — which would fabricate a rate — so the form
 * blocks anything not on this list rather than matching on a fake rate.
 */
const KNOWN_CURRENCIES = [
  // CARICOM / Caribbean rail
  "JMD", "BBD", "TTD", "HTG", "XCD", "BSD", "BZD", "GYD", "SRD", "DOP", "CUP",
  // Africa rail (the same engine nets these — chain-agnostic by design)
  "NGN", "GHS", "KES", "XOF", "XAF", "ZAR", "EGP", "MAD", "TZS", "UGX", "RWF",
  // APAC rail
  "INR", "PHP", "IDR", "VND", "PKR", "BDT",
  // Benchmarks
  "USD", "EUR", "GBP", "CAD", "CHF", "JPY", "CNY",
];

function isKnownCurrency(code: string): boolean {
  return KNOWN_CURRENCIES.includes(code.toUpperCase());
}

/** Common corridor presets — one tap instead of two dropdowns. */
const CORRIDOR_PRESETS: Array<{ sell: string; buy: string; label: string }> = [
  { sell: "BBD", buy: "JMD", label: "BBD → JMD" },
  { sell: "TTD", buy: "JMD", label: "TTD → JMD" },
  { sell: "JMD", buy: "BBD", label: "JMD → BBD" },
  { sell: "NGN", buy: "GHS", label: "NGN → GHS" },
  { sell: "KES", buy: "NGN", label: "KES → NGN" },
];
export function CaribbeanFxNetCard() {
  const { address, signMessage } = useWalletContext();
  const {
    data, isLoading, error, match,
    settlements, refreshSettlements, settle, isSettling, settleError,
  } = useFxNetting(address ?? null, signMessage);

  const [sellCurrency, setSellCurrency] = React.useState("JMD");
  const [sellAmount, setSellAmount] = React.useState("");
  const [buyCurrency, setBuyCurrency] = React.useState("BBD");
  const [matched, setMatched] = React.useState(false);

  React.useEffect(() => {
    void refreshSettlements();
  }, [refreshSettlements]);

  const sellAmountNum = sellAmount ? Number(sellAmount) : 0;
  const currenciesValid =
    isKnownCurrency(sellCurrency) &&
    isKnownCurrency(buyCurrency) &&
    sellCurrency.toUpperCase() !== buyCurrency.toUpperCase();
  const canMatch = sellAmountNum > 0 && currenciesValid;

  /** Settlements where the connected wallet is the net debtor (worklist). */
  const myDebts: FxSettlement[] = (settlements ?? []).filter(
    (s) =>
      s.status === 'pending' &&
      s.fromParticipant.toLowerCase() === (address ?? '').toLowerCase(),
  );
  /** Settlements owed TO the caller, settled ones included (receipts). */
  const myReceipts: FxSettlement[] = (settlements ?? []).filter(
    (s) => s.toParticipant.toLowerCase() === (address ?? '').toLowerCase(),
  );

  const handleSubmit = () => {
    if (!canMatch) return;
    setMatched(true);
    void match({ sellCurrency, sellAmount: sellAmountNum, buyCurrency }, []);
  };

  const handleSettle = (s: FxSettlement) => {
    trackFunnelEvent('fx_netting_settle_requested');
    void settle(s);
  };

  const currencyInputClass =
    "mt-1 w-full min-h-11 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border text-sm font-bold text-teal-900 dark:text-teal-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/60";

  const currencyField = (
    side: "sell" | "buy",
    value: string,
    onChange: (v: string) => void,
  ) => {
    const known = isKnownCurrency(value);
    return (
      <label className="flex-1 min-w-0">
        <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
          {side === "sell" ? "You have" : "You want"}
        </span>
        <input
          type="text"
          list="fx-currency-codes"
          maxLength={3}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={side === "sell" ? "Currency you have" : "Currency you want"}
          className={`${currencyInputClass} ${
            value && !known
              ? "border-amber-400 dark:border-amber-600"
              : "border-teal-200 dark:border-teal-800"
          }`}
        />
      </label>
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-gradient-to-br from-teal-50/60 to-cyan-50/60 dark:from-teal-950/20 dark:to-cyan-950/20 p-5"
      data-testid="caribbean-fx-net-card"
    >
      <datalist id="fx-currency-codes">
        {KNOWN_CURRENCIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
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
            {currencyField("sell", sellCurrency, setSellCurrency)}
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
            {currencyField("buy", buyCurrency, setBuyCurrency)}
          </div>

          {(sellCurrency && !isKnownCurrency(sellCurrency)) ||
          (buyCurrency && !isKnownCurrency(buyCurrency)) ? (
            <p
              className="mt-2 text-[11px] text-amber-700 dark:text-amber-300"
              role="status"
            >
              Unsupported currency code — pick a 3-letter ISO code from the list.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {CORRIDOR_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSellCurrency(p.sell);
                  setBuyCurrency(p.buy);
                }}
                className="min-h-11 px-3 py-1.5 -my-1 rounded-full border border-teal-200 dark:border-teal-800 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100/60 dark:hover:bg-teal-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                {p.label}
              </button>
            ))}
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
          {!address && (
            <div
              className="mb-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-white/70 dark:bg-gray-900/60 p-3"
              data-testid="fx-observer-banner"
            >
              <p className="text-xs text-teal-800 dark:text-teal-200 leading-relaxed">
                <span className="font-black">You&apos;re previewing the live matching engine.</span>{" "}
                Your intent runs against the real pool and the real mid-market,
                but posting it for future counterparties and settling need a
                connected wallet.
              </p>
            </div>
          )}
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

              {data && data.matches.length === 0 && !isLoading && (
                <div className="mt-4 rounded-xl border border-teal-100 dark:border-teal-900 bg-white/50 dark:bg-gray-900/40 p-3">
                  <p className="text-xs text-teal-800 dark:text-teal-200 leading-relaxed">
                    No counterparty in the pool needs{' '}
                    <span className="font-black">
                      {sellCurrency} ↔ {buyCurrency}
                    </span>{' '}
                    yet — the engine only matches opposing flows at the live
                    mid-market; it never invents one.
                  </p>
                  {address ? (
                    <p className="mt-1.5 text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                      Your intent stays open for the next matching cycle — the
                      first counterparty who posts the opposing leg gets matched
                      automatically, and you settle the net from your wallet.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                      Connect a wallet to post your intent into the pool so the
                      next counterparty — tomorrow, next week — matches against
                      it.
                    </p>
                  )}
                </div>
              )}

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
              ) : null}

              <footer className="mt-4 text-[10px] text-teal-700/70 dark:text-teal-300/70 leading-snug">
                {data && data.rateSourceNote
                  ? `Mid-market via ${data.rateSourceNote}.`
                  : "Matching against the live mid-market."}{" "}
                {typeof data?.poolSize === 'number' && data.poolSize > 0
                  ? `Matched against ${data.poolSize} open intent${data.poolSize === 1 ? '' : 's'} in the pool. `
                  : data && !isLoading
                    ? 'The live pool is empty — your intent joined as a preview run. '
                    : ''}
                Real matches anchor on-chain to the region-canonical ledger.
              </footer>

              <SettlementSection
                myDebts={myDebts}
                myReceipts={myReceipts}
                isSettling={isSettling}
                settleError={settleError}
                onSettle={handleSettle}
              />
            </>
          )}
        </div>
      )}
    </motion.section>
  );
}

/**
 * Settlement phase — the caller's net obligations (debtor worklist) and
 * incoming receipts. One job: "you owe X → send it from your wallet".
 * Hidden entirely when there's nothing to show (no fake states).
 */
function SettlementSection({
  myDebts,
  myReceipts,
  isSettling,
  settleError,
  onSettle,
}: {
  myDebts: FxSettlement[];
  myReceipts: FxSettlement[];
  isSettling: boolean;
  settleError: string | null;
  onSettle: (s: FxSettlement) => void;
}) {
  if (myDebts.length === 0 && myReceipts.length === 0) return null;

  return (
    <div className="mt-4 space-y-2" data-testid="fx-settlement-section">
      {myDebts.map((s) => (
        <div
          key={s.settlementId}
          className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3"
        >
          <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
            You owe {s.netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
            {s.settlementCurrency} to {s.toParticipant.slice(0, 6)}…{s.toParticipant.slice(-4)}
          </p>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
            Sent from your wallet on Celo — the transfer is verified on-chain
            before the match is marked settled.
          </p>
          <button
            type="button"
            onClick={() => onSettle(s)}
            disabled={isSettling}
            className="mt-2 min-h-11 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {isSettling ? "Sending…" : `Send ${s.netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${s.settlementCurrency}`}
          </button>
        </div>
      ))}
      {settleError && (
        <p className="text-[11px] text-red-500" data-testid="fx-settle-error">{settleError}</p>
      )}
      {myReceipts.map((s) => (
        <div
          key={s.settlementId}
          className="rounded-xl border border-teal-100 dark:border-teal-900 bg-white/50 dark:bg-gray-900/40 p-3 text-xs text-teal-800 dark:text-teal-200"
        >
          {s.status === 'settled' ? (
            <>
              Received {s.netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
              {s.settlementCurrency} from {s.fromParticipant.slice(0, 6)}…{s.fromParticipant.slice(-4)} —{" "}
              {s.txHash ? (
                <a
                  href={`https://celoscan.io/tx/${s.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold"
                >
                  verified on-chain
                </a>
              ) : (
                'settled'
              )}
            </>
          ) : (
            <>
              Awaiting {s.netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
              {s.settlementCurrency} from {s.fromParticipant.slice(0, 6)}…{s.fromParticipant.slice(-4)} —
              they send it from their wallet.
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default CaribbeanFxNetCard;