import React from "react";
import { useNavigation } from "@/context/app/NavigationContext";
import { useWalletContext } from "../wallet/WalletProvider";
import { useFxNetting, type FxSettlement } from "../../hooks/use-fx-netting";
import { trackFunnelEvent } from "@/lib/analytics";
import { getCachedWalletAuth } from "@/lib/wallet-auth";
import { buildLiveRateProvider } from "@diversifi/shared/src/services/fx-netting/rate-adapter";
import RiveNetPair from "../shared/RiveNetPair";
import { codeCoinTint } from "../shared/palette";

/**
 * FxNettingRail — counterparty matching as a settlement rail inside the
 * pair inspector. The ticket stays the object; this is the route the pair
 * can take when the corridor has nettable flow.
 *
 * Three phases, one job per phase (docs/design-language.md):
 *   1. INTENT — state "I need to sell X for Y".
 *   2. MATCH REVIEW — netting at mid-market: matched, saved, unmatched.
 *   3. SETTLE (when the caller is a net debtor) — send the obligation
 *      from your own wallet; the server verifies the transfer on-chain
 *      and advances both sides to settled.
 * Walletless visitors run the engine in observer mode: matching is real,
 * posting/settling needs a wallet — the copy says exactly that.
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

const formatMidRate = (rate: number) =>
  rate.toLocaleString(undefined, {
    maximumSignificantDigits: rate >= 100 ? 5 : 4,
  });

/** Common corridor presets — one tap instead of two fields. */
const CORRIDOR_PRESETS: Array<{ sell: string; buy: string; label: string }> = [
  { sell: "BBD", buy: "JMD", label: "BBD → JMD" },
  { sell: "TTD", buy: "JMD", label: "TTD → JMD" },
  { sell: "JMD", buy: "BBD", label: "JMD → BBD" },
  { sell: "NGN", buy: "GHS", label: "NGN → GHS" },
  { sell: "KES", buy: "NGN", label: "KES → NGN" },
];

interface FxNettingRailProps {
  /** Corridor prefill — the inspected pair's fiat legs when they exist. */
  initialSell?: string;
  initialBuy?: string;
  /** Quiet lead-in line, e.g. how this rail relates to the pair. */
  leadIn?: string;
}

export function FxNettingRail({ initialSell, initialBuy, leadIn }: FxNettingRailProps) {
  const { address, signMessage } = useWalletContext();
  const { navigateWithIntent } = useNavigation();
  const {
    data, isLoading, error, match,
    settlements, refreshSettlements, settle, isSettling, settleError,
    creditProfile, refreshCreditProfile,
  } = useFxNetting(address ?? null, signMessage);

  const [sellCurrency, setSellCurrency] = React.useState(initialSell ?? "JMD");
  const [sellAmount, setSellAmount] = React.useState("");
  const [buyCurrency, setBuyCurrency] = React.useState(initialBuy ?? "BBD");
  const [matched, setMatched] = React.useState(false);
  const [supportingView, setSupportingView] = React.useState<"need" | "details">(
    "need",
  );

  // Auth timing: settlements and the credit file are wallet-authed reads —
  // fetching them on mount would pop a signature request for what is, to
  // the user, a navigation click. Refresh silently when a session proof
  // is already cached; otherwise wait until the review phase (a deliberate
  // act — "Match my intent"), where the settlement worklist renders anyway.
  React.useEffect(() => {
    if (!address) return;
    if (matched || getCachedWalletAuth(address)) {
      void refreshSettlements();
      void refreshCreditProfile();
    }
  }, [matched, address, refreshSettlements, refreshCreditProfile]);

  const sellAmountNum = sellAmount ? Number(sellAmount) : 0;
  const currenciesValid =
    isKnownCurrency(sellCurrency) &&
    isKnownCurrency(buyCurrency) &&
    sellCurrency.toUpperCase() !== buyCurrency.toUpperCase();
  const canMatch = sellAmountNum > 0 && currenciesValid;

  // The number that convinces: the live mid-market rate for this corridor,
  // from the same USD table the matching engine settles at. Walletless —
  // the provider memoises one fetch per session. Uncovered codes and fetch
  // failures render nothing rather than a fabricated rate.
  const [midQuote, setMidQuote] = React.useState<{
    rate: number;
    date: string | null;
  } | null>(null);
  React.useEffect(() => {
    if (!currenciesValid) {
      setMidQuote(null);
      return;
    }
    let cancelled = false;
    void buildLiveRateProvider()
      .then((provider) => {
        if (cancelled) return;
        if (!provider.hasRate(sellCurrency) || !provider.hasRate(buyCurrency)) {
          setMidQuote(null);
          return;
        }
        const rate = provider.midRate(sellCurrency, buyCurrency);
        setMidQuote(
          Number.isFinite(rate) && rate > 0
            ? { rate, date: provider.date }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setMidQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sellCurrency, buyCurrency, currenciesValid]);

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
  /** True once any settlement the caller is party to has verified on-chain —
   *  drives the pair object's seal state (it is a state, not an event). */
  const me = (address ?? '').toLowerCase();
  const pairSealed = (settlements ?? []).some(
    (s) =>
      s.status === 'settled' &&
      (s.fromParticipant.toLowerCase() === me || s.toParticipant.toLowerCase() === me),
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
    "mt-1 w-full min-h-11 px-3 py-2 rounded-xl bg-surface border text-sm font-bold text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/60";

  const currencyField = (
    side: "sell" | "buy",
    value: string,
    onChange: (v: string) => void,
  ) => {
    const known = isKnownCurrency(value);
    return (
      <label className="min-w-0">
        <span className="text-sm font-semibold text-ink">
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
              : "border-line"
          }`}
        />
      </label>
    );
  };

  const editYourNeed = () => {
    setMatched(false);
    setSupportingView("need");
  };

  return (
    <div data-testid="fx-netting-rail" className="mt-4 border-t border-line pt-4">
      <datalist id="fx-currency-codes">
        {KNOWN_CURRENCIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="mb-3">
        <h4 className="text-xl font-bold text-ink">Match a currency need</h4>
        <p className="text-sm text-ink-muted mt-1 leading-relaxed">
          {leadIn ?? "Find someone exchanging in the opposite direction."}
        </p>
      </div>

      <div
        role="group"
        aria-label="Matching views"
        className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1"
      >
        {(["need", "details"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={supportingView === v}
            onClick={() => setSupportingView(v)}
            className={`min-h-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 ${
              supportingView === v
                ? "bg-teal-600 text-white shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {v === "need" ? "Your need" : "Details"}
          </button>
        ))}
      </div>

      {supportingView === "details" ? (
        <div data-testid="fx-details">
          <p className="text-sm font-semibold text-ink">Try another pair</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {CORRIDOR_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSellCurrency(p.sell);
                  setBuyCurrency(p.buy);
                  setMatched(false);
                  setSupportingView("need");
                }}
                className="min-h-11 px-3 py-1.5 -my-1 rounded-full border border-line text-2xs font-bold text-ink hover:bg-surface-sunken transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSellCurrency(initialSell ?? "JMD");
              setBuyCurrency(initialBuy ?? "BBD");
              setSellAmount("");
              setMatched(false);
              setSupportingView("need");
            }}
            className="mt-3 min-h-11 px-3 py-2 rounded-xl text-xs font-bold text-ink hover:bg-surface-sunken transition-colors"
          >
            Reset your need
          </button>

          <p className="mt-3 text-xs text-ink-muted leading-snug">
            Weighing a future payment instead?{" "}
            <button
              type="button"
              onClick={() => navigateWithIntent("protect", { source: "exchange", lens: "cycle" })}
              className="font-semibold underline underline-offset-2 hover:text-ink"
            >
              See what FX timing costs across a whole cycle →
            </button>
          </p>

          {matched && !isLoading && !error && data && (
            <dl className="mt-4 space-y-2 text-sm" data-testid="fx-metrics">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Matched value</dt>
                <dd className="font-bold text-ink tabular-nums">
                  ${data.totalMatchedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Estimated avoided costs</dt>
                <dd className="font-bold text-ink tabular-nums">
                  ~${data.totalSavingsUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Matches</dt>
                <dd className="font-bold text-ink tabular-nums">{data.matches.length}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Unmatched needs</dt>
                <dd className="font-bold text-ink tabular-nums">{data.unmatchedCount}</dd>
              </div>
            </dl>
          )}

          {matched && !isLoading && !error && data?.matches.length ? (
            <ul className="mt-4 space-y-2">
              {data.matches.map((m) => {
                const guardianLeg =
                  m.intentA.participantId.toLowerCase().startsWith('guardian-liquidity-') ||
                  m.intentB.participantId.toLowerCase().startsWith('guardian-liquidity-');
                return (
                  <li
                    key={m.matchId}
                    className="rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed text-ink"
                  >
                    <span className="font-black">{m.intentA.sellCurrency}</span> →{" "}
                    <span className="font-black">{m.intentB.sellCurrency}</span> ·{" "}
                    <span className="font-bold tabular-nums">{m.matchedAmount.toLocaleString()}</span>{" "}
                    matched at <span className="font-mono">{m.rate.toFixed(4)}</span>
                    {guardianLeg && (
                      <span
                        className="mt-1 block text-3xs font-bold text-ink-muted"
                        data-testid={`fx-guardian-match-${m.matchId}`}
                      >
                        Filled by Guardian standing liquidity — the pool’s
                        always-on mid-market quote.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {matched && !isLoading && !error && data?.bootstrapNote && (
            <p
              className="mt-3 text-xs text-ink-muted leading-snug"
              data-testid="fx-bootstrap-note"
            >
              {data.bootstrapNote}
            </p>
          )}

          {matched && !isLoading && !error && data && (
            <footer className="mt-4 text-xs text-ink-muted leading-snug">
              {data.rateSourceNote
                ? `Mid-market via ${data.rateSourceNote}.`
                : "Matching against the live mid-market."}{" "}
              {typeof data.poolSize === 'number' && data.poolSize > 0
                ? `Matched against ${data.poolSize} open intent${data.poolSize === 1 ? '' : 's'} in the pool. `
                : !isLoading
                  ? 'No open intents in the pool this run. '
                  : ''}
              Real matches anchor on-chain to the region-canonical ledger.
            </footer>
          )}

          {/* Settlement-native credit file — the MSME credit layer's user surface.
              Walletless visitors have no file (null → hidden); a thin file is
              rendered as the honest data it is, never dressed up. */}
          {creditProfile && !creditProfile.synthetic && (
            <CreditFileSection profile={creditProfile} />
          )}
        </div>
      ) : !matched ? (
        <div data-testid="fx-phase-intent">
          <div className="grid grid-cols-2 gap-3">
            {currencyField("sell", sellCurrency, setSellCurrency)}
            {currencyField("buy", buyCurrency, setBuyCurrency)}
          </div>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-ink">Amount</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              placeholder="e.g. 500000"
              aria-label="Amount to convert"
              className="mt-1 w-full min-h-11 px-3 py-2 rounded-xl bg-surface border border-line text-lg font-bold text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/60"
            />
          </label>

          {(sellCurrency && !isKnownCurrency(sellCurrency)) ||
          (buyCurrency && !isKnownCurrency(buyCurrency)) ? (
            <p
              className="mt-2 text-2xs text-amber-700 dark:text-amber-300"
              role="status"
            >
              Unsupported currency code — pick a 3-letter ISO code from the list.
            </p>
          ) : null}

          {midQuote && (
            <p
              className="mt-3 text-sm text-ink-muted tabular-nums"
              data-testid="fx-mid-rate"
            >
              Mid-market · 1 {sellCurrency.toUpperCase()} ={" "}
              {formatMidRate(midQuote.rate)} {buyCurrency.toUpperCase()}
              {midQuote.date ? ` · Rates as of ${midQuote.date}` : ""}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canMatch || isLoading}
            className="mt-4 w-full min-h-11 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {isLoading ? "Matching…" : "Find a match"}
          </button>
        </div>
      ) : (
        <div data-testid="fx-phase-review">
          {!address && (
            <p
              className="mb-3 text-sm text-ink-muted leading-relaxed"
              data-testid="fx-observer-banner"
            >
              Live preview · nothing posted. Connect a wallet to post your
              intent or settle a match.
            </p>
          )}
          {isLoading ? (
            <p className="text-sm text-ink-muted" role="status">
              Looking for an opposing currency need…
            </p>
          ) : error ? (
            <div>
              <p className="text-sm font-bold text-ink">Matching is unavailable</p>
              <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                We couldn’t check the matching pool. Edit your need and try
                again.
              </p>
              <button
                type="button"
                onClick={editYourNeed}
                className="mt-2 min-h-tap text-sm font-bold text-teal-700 dark:text-teal-300 underline underline-offset-2"
              >
                Edit your need
              </button>
            </div>
          ) : data ? (
            <>
              {data.rateDate && (
                <p className="text-xs text-ink-muted tabular-nums">
                  Rates as of {data.rateDate}
                </p>
              )}
              {data.matches.length > 0 ? (
                <>
                  <p className="text-3xl font-black text-ink tabular-nums">
                    ${data.totalMatchedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                    matched
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {data.matches.length}{" "}
                    {data.matches.length === 1 ? "match" : "matches"} at
                    mid-market
                  </p>
                  {/* The match artefact: coins link when the pool matched, seal
                      when a leg settles on-chain. State-driven (§5) — the object
                      replays only if this subtree remounts. */}
                  <div className="mt-3" data-testid="fx-net-pair">
                    <RiveNetPair
                      size={170}
                      leftColor={codeCoinTint(sellCurrency)}
                      rightColor={codeCoinTint(buyCurrency)}
                      settled={pairSealed}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-ink">No match yet</p>
                  <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                    {sellCurrency} → {buyCurrency} has no opposing match in
                    this check.
                  </p>
                  {address && (
                    <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                      Your intent remains open for a future opposing match.
                    </p>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={editYourNeed}
                className="mt-3 min-h-tap text-sm font-bold text-ink-muted hover:text-ink underline underline-offset-2 transition-colors"
              >
                Edit your need
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-muted" role="status">
              Waiting for matching results…
            </p>
          )}

          <SettlementSection
            myDebts={myDebts}
            myReceipts={myReceipts}
            isSettling={isSettling}
            settleError={settleError}
            onSettle={handleSettle}
          />
        </div>
      )}
    </div>
  );
}

/**
 * CreditFileSection — the caller's settlement-native credit profile.
 * One job: "your settled trades are building your credit file." The thin-file
 * state is the honest headline, not a failure state.
 */
function CreditFileSection({
  profile,
}: {
  profile: {
    score: number | null;
    fileStrength: 'none' | 'thin' | 'emerging' | 'established';
    settledVolumeUsd: number;
    settlementsCompleted: number;
    counterparties: number;
    summary: string;
    lendingReadiness: string;
  };
}) {
  const strengthLabel =
    profile.fileStrength === 'established'
      ? 'Established file'
      : profile.fileStrength === 'emerging'
        ? 'Emerging file'
        : profile.fileStrength === 'thin'
          ? 'Thin file'
          : 'No file yet';
  return (
    <div
      className="mt-4 rounded-xl border border-line bg-surface p-3"
      data-testid="fx-credit-file"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wider text-ink-muted">
          Your credit file
        </p>
        <p className="text-sm font-black text-ink" data-testid="fx-credit-score">
          {profile.score !== null ? profile.score : strengthLabel}
        </p>
      </div>
      <p className="text-sm text-ink mt-1" data-testid="fx-credit-summary">
        {profile.settlementsCompleted >= 3
          ? `${profile.settlementsCompleted} verified settlements · $${Math.round(profile.settledVolumeUsd).toLocaleString()} · ${profile.counterparties} counterpart${profile.counterparties === 1 ? 'y' : 'ies'} · every settled trade builds this file.`
          : profile.settlementsCompleted > 0
            ? `${profile.settlementsCompleted} verified settlement${profile.settlementsCompleted === 1 ? '' : 's'} so far — your next settled trade strengthens this file.`
            : 'No verified settlements yet — your first settled trade starts this file. Like a sou-sou, the circle remembers who honours their hand; coordination today underwrites working capital tomorrow.'}
      </p>
      <p className="text-xs text-ink-muted mt-0.5">
        {profile.lendingReadiness}
      </p>
    </div>
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
          className="rounded-xl border border-line bg-surface p-3"
        >
          <p className="text-sm font-bold text-ink">
            You owe {s.netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
            {s.settlementCurrency} to {s.toParticipant.slice(0, 6)}…{s.toParticipant.slice(-4)}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            Sent from your wallet on Celo — the transfer is verified on-chain
            before the match is marked settled.
          </p>
          <button
            type="button"
            onClick={() => onSettle(s)}
            disabled={isSettling}
            className="mt-2 min-h-11 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {isSettling ? "Sending…" : `Send ${s.netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${s.settlementCurrency}`}
          </button>
        </div>
      ))}
      {settleError && (
        <p className="text-2xs text-red-500" data-testid="fx-settle-error">{settleError}</p>
      )}
      {myReceipts.map((s) => (
        <div
          key={s.settlementId}
          className="rounded-xl border border-line bg-surface p-3 text-sm text-ink"
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

export default FxNettingRail;
