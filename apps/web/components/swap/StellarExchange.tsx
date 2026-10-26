/**
 * Stellar testnet exchange object — XLM → Circle testnet USDC, one
 * InstrumentShell, one job per stage. Test funds only; every quote,
 * signature, and receipt goes through lib/stellar's adapter. Never
 * invoked unless NEXT_PUBLIC_STELLAR_TESTNET=true — the caller (the
 * ExchangeTab wrapper) owns that gate.
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import { StatusTier } from "../shared/StatusTier";
import { TokenIcon } from "../shared/TokenIcon";
import { controlMotion } from "@/lib/motion-tokens";
import { useDemoMode } from "@/context/app/DemoModeContext";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";
import { useStellarExchange } from "@/hooks/use-stellar-exchange";
import { stellarTestnetEnabled } from "@diversifi/shared/src/config/stellar";
import {
  STELLAR_TESTNET_USDC_ISSUER,
  assetsEqual,
  explorerTxUrl,
  formatAmountUnits,
  stellarTestnetUsdc,
} from "@diversifi/shared/src/types/stellar";
import { MONEY_MASK } from "@/lib/money-format";
import PairStage, { type PairReceipt } from "./PairStage";

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function xlm(units: string | undefined): string {
  if (!units) return "—";
  return formatAmountUnits(units, 7) ?? "—";
}

export default function StellarExchange({
  networkControl,
  onBusyChange,
}: {
  networkControl?: React.ReactNode;
  onBusyChange?: (busy: boolean) => void;
}) {
  const enabled = stellarTestnetEnabled();
  const { demoMode, disableDemoMode } = useDemoMode();
  const exchange = useStellarExchange(enabled && !demoMode.isActive);
  const { phase, account, amount, prepared, settlement, error, notice, busy, reviewExpired, canDiscardInvalidPending } = exchange;
  const reduced = useReducedMotion();
  const { hidden } = useBalanceVisibility();
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const signing = phase === "signing" || (busy && phase === "review");
  useEffect(() => {
    // Only an in-flight signature/submission locks the network switch —
    // durable pending recovery must not trap the selector.
    onBusyChange?.(signing);
    return () => onBusyChange?.(false);
  }, [signing, onBusyChange]);

  const usdcLine = useMemo(
    () => account?.balances.find((balance) => assetsEqual(balance.asset, stellarTestnetUsdc())),
    [account],
  );
  // Missing line = truly absent. Unauthorized/full are blockers, not setup.
  const missingLine = Boolean(account?.exists) && !usdcLine;
  const blockedLine = Boolean(usdcLine && !usdcLine.authorized);
  const nativeSpendable = account?.balances.find((balance) => balance.asset.kind === "native")?.spendableUnits;
  const isTrustlineReview = prepared?.kind === "trustline";
  const confirmed = settlement?.status === "confirmed" ? settlement : null;

  const stellarReceipt: PairReceipt | null = confirmed
    ? {
        fromToken: "XLM",
        toToken: "USDC",
        amountIn: formatAmountUnits(confirmed.amountInUnits, 7) ?? confirmed.amountInUnits,
        quotedOut: null,
        txHash: confirmed.txHash,
        settledAt: Date.parse(confirmed.confirmedAt),
        settlement: {
          family: "stellar",
          network: "stellar:testnet",
          actualOut: formatAmountUnits(confirmed.actualOutUnits, 7) ?? confirmed.actualOutUnits,
          feePaidXlm: formatAmountUnits(confirmed.feeChargedStroops, 7) ?? confirmed.feeChargedStroops,
          ledger: confirmed.ledger,
        },
      }
    : null;

  const primary = (() => {
    if (demoMode.isActive) {
      return { label: "Use test funds", onClick: () => disableDemoMode(), disabled: false };
    }
    // Unresolved chain state always outranks connect.
    if (phase === "pending") {
      return { label: "Check transaction", onClick: () => void exchange.checkSettlement(), disabled: busy };
    }
    if (phase === "receipt") return null;
    if (busy && (phase === "signing" || phase === "quoting")) {
      return { label: phase === "signing" ? "Awaiting Freighter approval" : "Quoting…", onClick: () => {}, disabled: true };
    }
    if (!account || phase === "connect") {
      return { label: "Connect Freighter", onClick: () => void exchange.connect(), disabled: busy };
    }
    if (phase === "review" && prepared) {
      if (reviewExpired) {
        return {
          label: "Refresh quote",
          onClick: () => {
            exchange.cancelReview();
            void (isTrustlineReview ? exchange.reviewTrustline() : exchange.review());
          },
          disabled: busy,
        };
      }
      return {
        label: isTrustlineReview ? "Sign USDC setup in Freighter" : "Sign exchange in Freighter",
        onClick: () => void exchange.signReviewed(),
        disabled: busy,
      };
    }
    if (account.issues.includes("account_unfunded") || blockedLine || account.issues.includes("trustline_full")) {
      return { label: "Refresh account", onClick: () => void exchange.refresh(), disabled: busy };
    }
    if (missingLine) {
      return { label: "Review USDC setup", onClick: () => void exchange.reviewTrustline(), disabled: busy };
    }
    return {
      label: "Review exchange",
      onClick: () => void exchange.review(),
      disabled: busy || !amount.trim(),
    };
  })();

  const object = (
    <div data-testid="stellar-exchange-object" className="w-full">
      {networkControl}
      <p className="mt-1 text-2xs text-ink-muted">Stellar testnet · Test funds only</p>

      {stellarReceipt ? (
        <PairStage
          fromToken="XLM"
          toToken="USDC"
          fromItems={[]}
          toItems={[]}
          onFromChange={() => {}}
          onToChange={() => {}}
          onSwitch={() => {}}
          onWake={() => {}}
          signals={null}
          ctaLabel=""
          receipt={stellarReceipt}
          onDismissReceipt={exchange.reset}
          onMoveMore={exchange.reset}
        />
      ) : (
        <>
          <div className="mt-3 flex items-center justify-center gap-3" aria-hidden>
            <TokenIcon symbol="XLM" size={32} />
            <span className="text-ink-muted">→</span>
            <TokenIcon symbol="USDC" size={32} />
          </div>

          {(phase === "signing" || phase === "pending") ? (
            <div className="mt-4 text-sm">
              <p className="text-ink tabular-nums">
                {prepared?.kind === "transaction"
                  ? `${xlm(prepared.quote.amountInUnits)} XLM → Circle testnet USDC`
                  : "Circle testnet USDC setup"}
              </p>
              <p className="text-2xs text-ink-muted">
                {phase === "signing" ? "Awaiting Freighter approval" : "Confirmation pending — check the transaction, never resubmit."}
              </p>
            </div>
          ) : phase === "review" && prepared ? (
            <div data-testid="stellar-review" className="mt-4 space-y-2 text-sm">
              {isTrustlineReview && prepared.kind === "trustline" ? (
                <>
                  <p className="text-ink">Enable Circle testnet USDC</p>
                  <p className="text-2xs text-ink-muted tabular-nums">
                    Extra reserve {xlm(prepared.reserveIncreaseStroops)} XLM — reserved, not spent. Max network fee {xlm(prepared.feeMaxStroops)} XLM.
                  </p>
                </>
              ) : prepared.kind === "transaction" ? (
                <>
                  <p className="text-ink tabular-nums">
                    {xlm(prepared.quote.amountInUnits)} XLM → <span className="text-ink-muted">Quoted receive</span> {formatAmountUnits(prepared.quote.expectedOutUnits, 7)} USDC
                  </p>
                  <p className="text-2xs text-ink-muted tabular-nums">
                    Minimum received {formatAmountUnits(prepared.quote.minimumOutUnits, 7)} USDC · max fee {xlm(prepared.quote.feeMaxStroops)} XLM
                  </p>
                  <p className="text-2xs text-ink-muted">
                    To {short(prepared.quote.account)} on Stellar testnet · Circle testnet USDC · quote expires {new Date(prepared.quote.expiresAt).toLocaleTimeString()}
                  </p>
                </>
              ) : null}
              <p className="text-2xs text-ink-muted">
                Expires {new Date(prepared.expiresAt).toLocaleTimeString()} ·{" "}
                <button type="button" className="link-handoff" onClick={() => setInspectorOpen(true)}>
                  Details
                </button>
              </p>
              <button
                type="button"
                data-testid="stellar-cancel"
                onClick={exchange.cancelReview}
                className="min-h-tap text-2xs text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : account ? (
            <div className="mt-4">
              <label htmlFor="stellar-amount" className="text-2xs font-semibold text-ink">
                You exchange (XLM)
              </label>
              <input
                id="stellar-amount"
                data-testid="stellar-amount"
                inputMode="decimal"
                value={amount}
                disabled={busy}
                onChange={(event) => exchange.setAmount(event.target.value)}
                placeholder="0.0000000"
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-lg tabular-nums text-ink"
              />
              <p className="mt-1 text-2xs text-ink-muted tabular-nums">
                {nativeSpendable === undefined
                  ? "Balance unavailable"
                  : <>Spendable {hidden ? MONEY_MASK : xlm(nativeSpendable)} XLM</>} · {short(account.account)}
              </p>
              {account.issues.includes("trustline_full") && (
                <p className="mt-1 text-2xs text-ink-muted">
                  Your USDC trustline limit is already reached — it cannot receive a new conversion.
                </p>
              )}
              {account.issues.includes("account_unfunded") && (
                <p className="mt-1 text-2xs text-ink-muted">
                  This account is unfunded. Fund it with test XLM, then refresh.{" "}
                  <a
                    href="https://laboratory.stellar.org/#account-creator?network=test"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Open the testnet account creator ↗
                  </a>
                </p>
              )}
              {account.issues.includes("trustline_unauthorized") && (
                <p className="mt-1 text-2xs text-ink-muted">
                  Your USDC trustline exists but the issuer has not authorized it — setup cannot be repeated here.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-2xs text-ink-muted">
              Connect Freighter on Stellar testnet to review a test-funds exchange.
            </p>
          )}
        </>
      )}

      {settlement && (settlement.status === "pending" || settlement.status === "unknown") && settlement.txHash && (
        <p className="mt-2 text-2xs text-ink-muted tabular-nums">
          Pending ·{" "}
          <a
            href={explorerTxUrl(settlement.txHash) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            View transaction ↗
          </a>
        </p>
      )}
      {notice && <p role="status" className="mt-2 text-2xs text-ink-muted">{notice}</p>}
      {error && (
        <p role="alert" className="mt-2 text-2xs text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}
      {canDiscardInvalidPending && (
        <button
          type="button"
          data-testid="stellar-clear-invalid"
          onClick={exchange.clearInvalidPending}
          className="mt-1 text-2xs text-ink-muted hover:text-ink"
        >
          Discard this pending record
        </button>
      )}
      {primary && phase !== "receipt" && (
        <motion.button
          type="button"
          data-testid="stellar-primary"
          onClick={primary.onClick}
          disabled={primary.disabled}
          {...controlMotion(reduced)}
          className="mt-3 w-full min-h-tap rounded-2xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {primary.label}
        </motion.button>
      )}
      {account && phase === "ready" && (
        <button
          type="button"
          data-testid="stellar-refresh"
          onClick={() => void exchange.refresh()}
          className="mt-1 w-full text-2xs text-ink-muted hover:text-ink"
        >
          Refresh
        </button>
      )}
    </div>
  );

  const inspector = (
    <InspectorSheet
      selectedId={inspectorOpen ? "stellar" : null}
      onClose={() => setInspectorOpen(false)}
      title={isTrustlineReview ? "USDC setup" : "Exchange review"}
    >
      <div className="space-y-1 text-2xs text-ink-muted">
        {prepared?.kind === "transaction" && (
          <>
            <p className="break-all">Account {prepared.quote.account}</p>
            <p className="break-all">Issuer {STELLAR_TESTNET_USDC_ISSUER}</p>
            <p>Network stellar:testnet · quoted {prepared.quote.observedAt}</p>
          </>
        )}
        {prepared?.kind === "trustline" && (
          <>
            <p className="break-all">Account {prepared.account}</p>
            <p className="break-all">Issuer {STELLAR_TESTNET_USDC_ISSUER}</p>
            <p className="tabular-nums">Limit {formatAmountUnits(prepared.limit, 7)} USDC</p>
            <p>Network stellar:testnet</p>
          </>
        )}
      </div>
    </InspectorSheet>
  );

  return (
    <InstrumentShell
      inspectorOpen={inspectorOpen}
      object={object}
      inspector={inspector}
      status={
        <StatusTier
          trust={<span className="text-2xs text-ink-muted">Testnet settlement · No mirrored reasoning evidence</span>}
        />
      }
    />
  );
}
