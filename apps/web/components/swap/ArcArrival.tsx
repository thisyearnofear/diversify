/**
 * Arc arrival — Exchange's funding path for USDC held on Arc.
 *
 * Two pieces, one state (useArcArrival, owned by ExchangeTab):
 * - ArcArrivalPrompt: one quiet line in the status tier's transition slot.
 *   It only exists when there is real USDC on Arc or a transfer in flight.
 * - ArcArrivalBody: the inspector (L2). Amount → Circle's live fee → one
 *   CTA; then the three steps of the trip; then the arrival with both
 *   explorer links and the hand-off into a protective swap.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TokenIcon } from "../shared/TokenIcon";
import { springPop, reveal } from "@/lib/motion-tokens";
import { haptics } from "@/lib/haptics";
import { explorerTxUrl } from "@/lib/explorer-url";
import { formatUsd, fromSubunits, toSubunits } from "@/lib/arc-arrival";
import type { ArcArrival, ArcArrivalPhase } from "@/hooks/use-arc-arrival";

const PROMPT_CLASS =
  "min-h-11 px-3 py-1.5 -my-1.5 rounded-full text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60";

const IN_FLIGHT: ArcArrivalPhase[] = ["switching", "signing", "delivering", "stuck", "slow", "finishing"];

export function ArcArrivalPrompt({ arrival, onOpen }: { arrival: ArcArrival; onOpen: () => void }) {
  const reducedMotion = useReducedMotion();
  if (!arrival.offered) return null;
  const moving = arrival.record ? BigInt(arrival.record.amount) : null;

  let label: React.ReactNode;
  if (arrival.phase === "arrived" && moving !== null) {
    label = <>✓ {formatUsd(moving)} arrived on Arbitrum — protect it →</>;
  } else if (moving !== null && IN_FLIGHT.includes(arrival.phase)) {
    label = (
      <span className="inline-flex items-center gap-2">
        <motion.span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"
          animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1] }}
          transition={reducedMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        Moving {formatUsd(moving)} from Arc →
      </span>
    );
  } else if (arrival.balance !== null) {
    label = <>{formatUsd(arrival.balance)} USDC on Arc — bring it here →</>;
  } else {
    return null;
  }

  return (
    <button
      type="button"
      data-testid="arc-arrival-prompt"
      onClick={() => {
        haptics.tap();
        arrival.prepare();
        onOpen();
      }}
      className={PROMPT_CLASS}
    >
      {label}
    </button>
  );
}

function RouteLine() {
  return (
    <div className="flex items-center gap-2" aria-label="From Arc to Arbitrum">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
        <TokenIcon symbol="USDC" size={24} /> Arc
      </span>
      <span aria-hidden="true" className="flex-1 h-px bg-gray-300 dark:bg-white/20" />
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
        Arbitrum <TokenIcon symbol="USDC" size={24} />
      </span>
    </div>
  );
}

type StepState = "done" | "active" | "waiting";

function Step({ label, state, detail }: { label: string; state: StepState; detail?: React.ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <li className="flex items-start gap-3" aria-current={state === "active" ? "step" : undefined}>
      <span
        className={`mt-0.5 flex w-5 h-5 shrink-0 items-center justify-center rounded-full text-3xs font-black ${
          state === "done"
            ? "bg-emerald-500 text-white"
            : state === "active"
              ? "border-2 border-blue-500"
              : "border border-gray-300 dark:border-gray-600"
        }`}
      >
        {state === "done" && (
          <motion.span
            initial={reducedMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : springPop}
          >
            ✓
          </motion.span>
        )}
      </span>
      <div className="min-w-0">
        <p className={`text-sm ${state === "waiting" ? "text-ink-subtle" : "font-semibold text-ink"}`}>{label}</p>
        {detail && <p className="text-xs text-ink-muted">{detail}</p>}
      </div>
    </li>
  );
}

function TxLink({ chainId, hash, label }: { chainId: number; hash: string; label: string }) {
  return (
    <a
      href={explorerTxUrl(chainId, hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-tap items-center text-xs font-semibold text-blue-600 dark:text-blue-400"
    >
      {label} ↗
    </a>
  );
}

export function ArcArrivalBody({
  arrival,
  onProtect,
  onDone,
}: {
  arrival: ArcArrival;
  /** Hand the arrived amount to the ticket as a protective swap. */
  onProtect?: (amount: string) => void;
  onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [amount, setAmount] = useState("");
  const { route, phase, record, balance, quoteState, maxAmount } = arrival;

  useEffect(() => {
    arrival.prepare();
    // Quote once per open; prepare() is idempotent while loading/ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = useMemo(() => toSubunits(amount), [amount]);
  const fee = parsed ? arrival.feeFor(parsed) : null;
  const tooMuch = parsed !== null && maxAmount !== null && parsed > maxAmount;
  const canStart =
    parsed !== null && parsed > 0n && !tooMuch && quoteState === "ready" && phase !== "switching" && phase !== "signing";

  if (!route) return null;

  // ── Arrived ────────────────────────────────────────────────────────
  if (phase === "arrived" && record) {
    const moved = BigInt(record.amount);
    return (
      <div className="space-y-4" data-testid="arc-arrival-arrived">
        <motion.div
          initial={reducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : springPop}
          className="flex items-center gap-3"
        >
          <TokenIcon symbol="USDC" size={40} />
          <div>
            <p className="text-lg font-black text-ink tabular-nums">{formatUsd(moved)} USDC</p>
            <p className="text-xs text-ink-muted">arrived on Arbitrum — in your own wallet</p>
          </div>
        </motion.div>
        <div className="flex gap-4">
          <TxLink chainId={route.sourceChainId} hash={record.burnTxHash} label="Arc" />
          {record.forwardTxHash && (
            <TxLink chainId={route.destinationChainId} hash={record.forwardTxHash} label="Arbitrum" />
          )}
        </div>
        {onProtect && route.env === "mainnet" ? (
          <>
            <button
              type="button"
              onClick={() => onProtect(fromSubunits(moved))}
              className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white transition-colors"
            >
              Protect it — move into gold (PAXG)
            </button>
            {arrival.destinationGasMissing && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Swapping on Arbitrum needs a little ETH for gas, and this wallet has none there yet.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-ink-muted">Testnet run — nothing to swap into on Arbitrum Sepolia.</p>
        )}
        <button
          type="button"
          onClick={onDone}
          className="min-h-tap w-full text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Done
        </button>
      </div>
    );
  }

  // ── In flight ─────────────────────────────────────────────────────
  if (IN_FLIGHT.includes(phase) && (record || phase === "switching" || phase === "signing")) {
    const signed = Boolean(record);
    const steps: StepState[] = signed
      ? ["done", phase === "finishing" ? "done" : "active", phase === "finishing" ? "active" : "waiting"]
      : ["active", "waiting", "waiting"];
    return (
      <div className="space-y-4" data-testid="arc-arrival-in-flight">
        <RouteLine />
        <ol className="space-y-3">
          <Step
            label="Sign on Arc"
            state={steps[0]}
            detail={
              !signed
                ? phase === "switching"
                  ? "Switching your wallet to Arc…"
                  : "Approve, then confirm the transfer in your wallet."
                : record && <TxLink chainId={route.sourceChainId} hash={record.burnTxHash} label="Burned on Arc" />
            }
          />
          <Step
            label="Circle delivers it"
            state={steps[1]}
            detail={
              phase === "stuck"
                ? "Circle confirmed the transfer but hasn't delivered it yet."
                : phase === "slow"
                  ? "Taking longer than usual — Circle hasn't confirmed yet."
                  : signed
                    ? "Usually under a minute from Arc."
                    : undefined
            }
          />
          <Step label="Arrives on Arbitrum" state={steps[2]} />
        </ol>
        {arrival.error && (
          <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
            {arrival.error}
          </p>
        )}
        {phase === "stuck" && (
          <button
            type="button"
            onClick={() => void arrival.finishManually()}
            className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white transition-colors"
          >
            Finish on Arbitrum
          </button>
        )}
        {phase === "slow" && (
          <button
            type="button"
            onClick={arrival.checkAgain}
            className="min-h-tap w-full rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-ink transition-colors"
          >
            Check again
          </button>
        )}
        {signed && (
          <p className="text-2xs text-ink-subtle">
            You can close this — the transfer continues, and we&apos;ll pick it up when you&apos;re back.
          </p>
        )}
      </div>
    );
  }

  // ── Ready (amount → fee → one CTA) ────────────────────────────────
  return (
    <div className="space-y-4" data-testid="arc-arrival-ready">
      <RouteLine />
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="arc-arrival-amount" className="text-xs font-semibold text-ink-muted">
            Amount (USDC)
          </label>
          {balance !== null && (
            <span className="text-2xs text-ink-subtle tabular-nums">On Arc: {formatUsd(balance)}</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-sunken px-3">
          <input
            id="arc-arrival-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            className="min-h-tap flex-1 bg-transparent text-lg font-bold text-ink tabular-nums outline-none"
          />
          {maxAmount !== null && maxAmount > 0n && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setAmount(fromSubunits(maxAmount));
              }}
              className="min-h-tap px-2 text-xs font-black text-blue-600 dark:text-blue-400"
            >
              Max
            </button>
          )}
        </div>
      </div>

      <motion.p
        key={quoteState}
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : reveal}
        className="text-xs text-ink-muted"
        aria-live="polite"
      >
        {quoteState === "loading" || quoteState === "idle"
          ? "Checking Circle's delivery fee…"
          : quoteState === "unavailable"
            ? "Circle's delivery fee isn't available right now — try again shortly."
            : tooMuch
              ? "That's more than you can move after gas and Circle's fee."
              : parsed && fee !== null
                ? `Circle delivers it for up to ${formatUsd(fee)} · you receive at least ${formatUsd(parsed)} on Arbitrum.`
                : "Circle delivers it to your wallet on Arbitrum — no ETH needed to receive."}
      </motion.p>

      {arrival.error && (
        <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
          {arrival.error}
        </p>
      )}

      <button
        type="button"
        disabled={!canStart}
        onClick={() => {
          haptics.tap();
          void arrival.start(amount);
        }}
        className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-sm font-bold text-white transition-colors"
      >
        Bring to Arbitrum
      </button>

      <p className="text-2xs text-ink-subtle">
        Native USDC over Circle CCTP — burned on Arc, minted to your own wallet on Arbitrum. No bridge pool, no custody.
      </p>
    </div>
  );
}
