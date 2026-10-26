/**
 * UI orchestration for the Stellar testnet exchange. All validation and
 * settlement live in `lib/stellar/adapter.ts` — this hook owns phases,
 * cancellation guards, and reload recovery. The wallet SESSION (which account
 * is connected) lives in `lib/stellar/session` so it survives surface
 * switches; this hook owns only the exchange flow. The adapter (and its SDK)
 * are dynamically imported so no Stellar code enters the EVM bundle.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { stellarTestnetEnabled } from "@diversifi/shared/src/config/stellar";
import {
  assetsEqual,
  stellarTestnetUsdc,
  type PreparedStellarAction,
  type StellarAccountState,
  type StellarFailure,
  type StellarSettlement,
} from "@diversifi/shared/src/types/stellar";
import type { StellarTestnetAdapter } from "@/lib/stellar/adapter";
import { clearPendingStellar, readPendingStellar, type PendingStellarAction } from "@/lib/stellar/pending";
import {
  connectStellarSession,
  disconnectStellarSession,
  dropStellarAccount,
  getStellarAdapter,
  refreshStellarSession,
} from "@/lib/stellar/session";
import { useStellarSession } from "@/hooks/use-stellar-session";

export type StellarExchangePhase =
  | "connect"
  | "ready"
  | "quoting"
  | "review"
  | "signing"
  | "pending"
  | "receipt";

/** The account a prepared action belongs to — pending records key to it. */
function preparedAccountOf(prepared: PreparedStellarAction): string {
  return prepared.kind === "transaction" ? prepared.quote.account : prepared.account;
}

export function useStellarExchange(enabled: boolean = stellarTestnetEnabled()): {
  phase: StellarExchangePhase;
  account: StellarAccountState | null;
  amount: string;
  prepared: PreparedStellarAction | null;
  settlement: StellarSettlement | null;
  error: StellarFailure | null;
  notice: string | null;
  busy: boolean;
  reviewExpired: boolean;
  canDiscardInvalidPending: boolean;
  setAmount(value: string): void;
  connect(): Promise<void>;
  refresh(): Promise<void>;
  review(): Promise<void>;
  reviewTrustline(): Promise<void>;
  signReviewed(): Promise<void>;
  checkSettlement(): Promise<void>;
  cancelReview(): void;
  clearInvalidPending(): void;
  reset(): void;
  disconnect(): void;
} {
  const [phase, setPhase] = useState<StellarExchangePhase>("connect");
  // The session store is the single owner of the connected account — every
  // surface (wallet button, mode panel, exchange) reads the same session.
  const session = useStellarSession();
  const account = session.account;
  const [amount, setAmountState] = useState("");
  const [prepared, setPrepared] = useState<PreparedStellarAction | null>(null);
  const [settlement, setSettlement] = useState<StellarSettlement | null>(null);
  const [error, setError] = useState<StellarFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewExpired, setReviewExpired] = useState(false);

  // Synchronous gates — never rely on renders for mutation safety.
  const busyRef = useRef(false);
  const phaseRef = useRef<StellarExchangePhase>("connect");
  const unresolvedRef = useRef(false);
  const setPhaseSync = useCallback((next: StellarExchangePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const setPreparedSync = useCallback((next: PreparedStellarAction | null) => {
    preparedRef.current = next;
    setPrepared(next);
  }, []);
  const [canDiscardInvalidPending, setCanDiscardInvalidPending] = useState(false);
  // Invalidates stale async results on amount edit, disconnect, unmount.
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const accountRef = useRef(account);
  accountRef.current = account;
  const amountRef = useRef(amount);
  amountRef.current = amount;
  const preparedRef = useRef(prepared);
  preparedRef.current = prepared;

  const invalidate = useCallback(() => {
    generationRef.current += 1;
    busyRef.current = false;
    setBusy(false);
  }, []);

  const live = useCallback((generation: number) =>
    mountedRef.current && enabledRef.current && generationRef.current === generation, []);

  const asError = useCallback((cause: unknown): StellarFailure => ({
    ok: false,
    code: "network_error",
    message: cause instanceof Error ? cause.message : "Something went wrong reading Stellar testnet.",
    retry: "lookup",
  }), []);

  const adapterOf = useCallback(async (): Promise<StellarTestnetAdapter | null> => {
    if (!enabled) return null;
    return getStellarAdapter();
  }, [enabled]);

  /** Single transition owner for recovery, Check status, and submit. */
  const applySettlement = useCallback((found: StellarSettlement) => {
    setSettlement(found);
    setCanDiscardInvalidPending(false);
    if (found.status === "confirmed") {
      unresolvedRef.current = false;
      setPhaseSync("receipt");
      void refreshRef.current?.(); // best-effort balance refresh; the receipt survives failures
      return;
    }
    if (found.status === "trustline_confirmed") {
      unresolvedRef.current = false;
      setPreparedSync(null);
      setSettlement(null);
      setPhaseSync(accountRef.current ? "ready" : "connect");
      setError(null);
      setNotice("USDC setup confirmed. Review your exchange next.");
      void refreshRef.current?.();
      return;
    }
    if (found.status === "failed") {
      unresolvedRef.current = false;
      setPreparedSync(null);
      setPhaseSync(accountRef.current ? "ready" : "connect");
      const code: StellarFailure["code"] =
        found.code === "expired_unseen"
          ? "quote_expired"
          : found.code === "tx_bad_seq" || found.code === "below_minimum"
            ? found.code
            : "settlement_rejected";
      setError({
        ok: false,
        code,
        message: found.code === "expired_unseen"
          ? "This transaction expired without being recorded. Review a new quote."
          : `Transaction failed: ${found.code}. Review a new quote.`,
        retry: "requote",
      });
      return;
    }
    unresolvedRef.current = true;
    setPhaseSync("pending");
  }, [setPhaseSync, setPreparedSync]);

  /**
   * Adopt a durable pending record into the flow — ONLY when it belongs to the
   * connected account. A stale record never surfaces as another account's
   * transaction; it survives in storage until its owner resolves it.
   */
  const adoptPending = useCallback((stored: PendingStellarAction | null): boolean => {
    if (!stored || preparedAccountOf(stored.prepared) !== accountRef.current?.account) return false;
    setPreparedSync(stored.prepared);
    unresolvedRef.current = true;
    setPhaseSync("pending");
    return true;
  }, [setPreparedSync, setPhaseSync]);

  const refresh = useCallback(async () => {
    const generation = generationRef.current;
    if (!accountRef.current || !live(generation)) return;
    try {
      const state = await refreshStellarSession();
      if (!live(generation)) return;
      if (!state.ok && phaseRef.current !== "receipt") setError(state);
    } catch (cause) {
      if (live(generation)) setError(asError(cause));
    }
  }, [live, asError]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // One timeout per reviewed proposal — invalidates an unsigned review only.
  useEffect(() => {
    if (!prepared || phase !== "review") {
      setReviewExpired(false);
      return;
    }
    const deadline = Math.min(
      Date.parse(prepared.expiresAt),
      prepared.kind === "transaction" ? Date.parse(prepared.quote.expiresAt) : Number.POSITIVE_INFINITY,
    );
    const delay = deadline - Date.now();
    if (delay <= 0) {
      setReviewExpired(true);
      return;
    }
    setReviewExpired(false);
    const timer = window.setTimeout(() => setReviewExpired(true), delay);
    return () => window.clearTimeout(timer);
  }, [prepared, phase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  // The flow follows the session: a session that appears adopts the connect
  // stage; a session that goes away (header logout, wallet revoked) drops the
  // flow with it. A flow operation that already dropped to "connect" in the
  // same batch (the sign-failure reconnect path) keeps its error message. The
  // durable pending record itself always survives in storage.
  const sessionAccountAddress = account?.account ?? null;
  const hadSessionAddressRef = useRef<string | null>(sessionAccountAddress);
  useEffect(() => {
    const previous = hadSessionAddressRef.current;
    hadSessionAddressRef.current = sessionAccountAddress;
    if (sessionAccountAddress) {
      if (phaseRef.current === "connect" && !unresolvedRef.current && !busyRef.current) {
        // A durable pending record owned by this account outranks "ready" —
        // leave the phase at connect so the recovery effect below (same
        // commit, next in order) adopts it and starts the lookup.
        const stored = readPendingStellar();
        if (!stored || preparedAccountOf(stored.prepared) !== sessionAccountAddress) {
          setPhaseSync("ready");
        }
      }
      return;
    }
    if (previous === null) return;
    invalidate();
    if (phaseRef.current === "connect" && !unresolvedRef.current) return;
    unresolvedRef.current = false;
    setCanDiscardInvalidPending(false);
    setPreparedSync(null);
    setSettlement(null);
    setError(null);
    setNotice(null);
    amountRef.current = "";
    setAmountState("");
    setPhaseSync("connect");
  }, [sessionAccountAddress, invalidate, setPhaseSync, setPreparedSync]);

  /**
   * Adopt an owned pending record and look it up — shared by the recovery
   * effect (mount / session-appears) and the post-connect path (where the
   * busy flag is still held, so the effect can't fire). Never signs or
   * resubmits; cryptographically invalid records surface as an error with an
   * explicit clear action — never rendered as verified. Returns the busy
   * release for the caller's invalidation path.
   */
  const startPendingRecovery = useCallback((stored: PendingStellarAction): (() => void) => {
    const generation = generationRef.current;
    // The recovery owns the busy flag it raises and must hand it back even
    // when it is abandoned mid-lookup (the account changed, the surface closed).
    let raisedBusy = true;
    const releaseBusy = () => {
      if (raisedBusy) {
        raisedBusy = false;
        busyRef.current = false;
        setBusy(false);
      }
    };
    setPreparedSync(stored.prepared);
    unresolvedRef.current = true;
    setPhaseSync("pending");
    busyRef.current = true;
    setBusy(true);
    void (async () => {
      try {
        const adapter = await adapterOf();
        if (!adapter || !live(generation)) return;
        const validated = await adapter.validatePrepared(stored.prepared);
        if (!live(generation)) return;
        if (!validated.ok) {
          // Only a structural/cryptographic mismatch at validate time makes
          // the record discardable — never chain-lookup or network failures.
          setError(validated);
          setCanDiscardInvalidPending(
            validated.code === "proposal_mismatch" || validated.code === "unexpected_operation",
          );
          return;
        }
        const found = await adapter.getSettlement(stored.prepared.transactionHash, validated.value);
        if (!live(generation)) return;
        if (found.ok) {
          applySettlement(found.value);
        } else {
          setError(found);
          // A chain record that contradicts the review can never resolve —
          // offer the same explicit discard as an invalid record.
          setCanDiscardInvalidPending(
            found.code === "proposal_mismatch" || found.code === "unexpected_operation",
          );
        }
      } catch (cause) {
        if (live(generation)) setError(asError(cause));
      } finally {
        if (live(generation)) releaseBusy();
      }
    })();
    return releaseBusy;
  }, [adapterOf, live, asError, applySettlement, setPhaseSync, setPreparedSync]);

  // Recovery on mount and whenever the owning account's session appears: a
  // persisted prepared action means look up, never sign or resubmit.
  useEffect(() => {
    if (!enabled) return;
    const pending = readPendingStellar();
    if (!pending) return;
    if (preparedAccountOf(pending.prepared) !== sessionAccountAddress) return;
    if (unresolvedRef.current || busyRef.current || phaseRef.current !== "connect") return;
    const releaseBusy = startPendingRecovery(pending);
    return () => {
      generationRef.current += 1;
      releaseBusy();
    };
  }, [enabled, sessionAccountAddress, startPendingRecovery]);

  // Disabling the hook revokes in-flight continuations.
  useEffect(() => {
    if (!enabled) invalidate();
  }, [enabled, invalidate]);

  const connect = useCallback(async () => {
    if (!enabledRef.current || busyRef.current || unresolvedRef.current || phaseRef.current !== "connect") return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const generation = generationRef.current;
    let connectedAccount: string | null = null;
    try {
      setPreparedSync(null);
      // Opens the wallet picker and publishes the account to the shared
      // session — the flow only owns the phase transition.
      const state = await connectStellarSession();
      if (!live(generation)) return;
      if (!state.ok) {
        setError(state);
        return;
      }
      connectedAccount = state.value.account;
    } catch (cause) {
      if (live(generation)) setError(asError(cause));
    } finally {
      if (live(generation)) {
        busyRef.current = false;
        setBusy(false);
      }
    }
    if (!connectedAccount || !live(generation)) return;
    // The session-follow effect can't run while busy — the transition is
    // decided here instead: an owned durable pending record is adopted and
    // looked up immediately, never left invisible beside a fresh exchange.
    const stored = readPendingStellar();
    if (stored && preparedAccountOf(stored.prepared) === connectedAccount) {
      startPendingRecovery(stored);
    } else {
      setPhaseSync("ready");
    }
  }, [live, asError, setPreparedSync, setPhaseSync, startPendingRecovery]);

  const setAmount = useCallback((value: string) => {
    if (!enabledRef.current || unresolvedRef.current) return; // pending/signing/receipt: input is immutable
    if (!["ready", "quoting", "review"].includes(phaseRef.current)) return;
    generationRef.current += 1;
    amountRef.current = value;
    setAmountState(value);
    setNotice(null);
    preparedRef.current = null;
    setPrepared(null);
    // Editing invalidates in-flight work AND releases the busy lock so a new
    // review can start; the stale completion still can't touch newer state.
    busyRef.current = false;
    setBusy(false);
    setPhaseSync("ready");
  }, [setPhaseSync]);

  const review = useCallback(async () => {
    if (!enabledRef.current || busyRef.current || unresolvedRef.current || phaseRef.current !== "ready") return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPhaseSync("quoting");
    const generation = generationRef.current;
    try {
      const adapter = await adapterOf();
      if (!live(generation)) return;
      const address = account?.account;
      if (!adapter || !address || !amountRef.current.trim()) {
        setPhaseSync("ready");
        return;
      }
      const quoted = await adapter.quote({
        kind: "path-payment-strict-send",
        account: address,
        destination: address,
        source: { network: "stellar:testnet", kind: "native", code: "XLM", decimals: 7 },
        destinationAsset: stellarTestnetUsdc(),
        amount: amountRef.current.trim(),
        requestId: `stellar-${generation}-${Date.now()}`,
        revision: 1,
      });
      if (!live(generation)) return;
      if (!quoted.ok) {
        setError(quoted);
        setPhaseSync("ready");
        return;
      }
      const next = await adapter.prepare(quoted.value);
      if (!live(generation)) return;
      if (!next.ok) {
        setError(next);
        setPhaseSync("ready");
        return;
      }
      setPreparedSync(next.value);
      setPhaseSync("review");
    } catch (cause) {
      if (live(generation)) {
        setError(asError(cause));
        setPhaseSync("ready");
      }
    } finally {
      if (live(generation)) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [adapterOf, account?.account, live, asError, setPhaseSync, setPreparedSync]);

  const reviewTrustline = useCallback(async () => {
    if (!enabledRef.current || busyRef.current || unresolvedRef.current || phaseRef.current !== "ready") return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPhaseSync("quoting");
    const generation = generationRef.current;
    try {
      const adapter = await adapterOf();
      if (!live(generation)) return;
      const address = account?.account;
      if (!adapter || !address) {
        setPhaseSync("ready");
        return;
      }
      const next = await adapter.prepareTrustline(address, `stellar-tl-${generation}-${Date.now()}`);
      if (!live(generation)) return;
      if (!next.ok) {
        setError(next);
        setPhaseSync("ready");
        return;
      }
      setPreparedSync(next.value);
      setPhaseSync("review");
    } catch (cause) {
      if (live(generation)) {
        setError(asError(cause));
        setPhaseSync("ready");
      }
    } finally {
      if (live(generation)) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [adapterOf, account?.account, live, asError, setPhaseSync, setPreparedSync]);

  const checkSettlement = useCallback(async () => {
    if (busyRef.current || phaseRef.current !== "pending") return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const generation = generationRef.current;
    const current = preparedRef.current;
    try {
      const adapter = await adapterOf();
      if (!adapter || !current || !live(generation)) return;
      const found = await adapter.getSettlement(current.transactionHash, current);
      if (!live(generation)) return;
      if (!found.ok) {
        setError(found);
        setCanDiscardInvalidPending(
          found.code === "proposal_mismatch" || found.code === "unexpected_operation",
        );
        return;
      }
      applySettlement(found.value);
    } catch (cause) {
      if (live(generation)) setError(asError(cause));
    } finally {
      if (live(generation)) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [adapterOf, live, asError, applySettlement]);

  const signReviewed = useCallback(async () => {
    if (!enabledRef.current || busyRef.current || unresolvedRef.current || phaseRef.current !== "review") return;
    const current = preparedRef.current;
    if (!current) return;
    if (Date.parse(current.expiresAt) <= Date.now()
      || (current.kind === "transaction" && Date.parse(current.quote.expiresAt) <= Date.now())) {
      setError({ ok: false, code: "quote_expired", message: "Quote expired — refresh it before signing.", retry: "requote" });
      setPhaseSync("ready");
      setPreparedSync(null);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPhaseSync("signing");
    const generation = generationRef.current;
    try {
      const adapter = await adapterOf();
      if (!adapter || !live(generation)) return;
      const signed = await adapter.sign(current);
      if (!live(generation)) return; // unmounted or cancelled — never submit.
      if (!signed.ok) {
        setError(signed);
        if (signed.code === "cancelled" || signed.code === "quote_expired" || signed.code === "quote_stale") {
          setPreparedSync(null);
          setPhaseSync("ready");
        } else if (signed.retry === "reconnect") {
          // The wallet session went stale (account changed, network moved).
          // Drop the account but keep the remembered session — the next load
          // may silently restore it.
          dropStellarAccount();
          setPreparedSync(null);
          setPhaseSync("connect");
        } else {
          setPhaseSync("review");
        }
        return;
      }
      const submitted = await adapter.submit(signed.value.signedXdr, current);
      if (!live(generation)) return;
      if (!submitted.ok) {
        setError(submitted);
        // A submission that never posted leaves nothing to look up. A stored
        // record is adopted only when it belongs to the connected account.
        if (!adoptPending(readPendingStellar())) {
          setPhaseSync("ready");
          setPreparedSync(null);
        }
        return;
      }
      applySettlement(submitted.value);
    } catch (cause) {
      if (live(generation)) {
        setError(asError(cause));
        if (!adoptPending(readPendingStellar())) {
          setPreparedSync(null);
          setPhaseSync("ready");
        }
      }
    } finally {
      if (live(generation)) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [adapterOf, live, asError, applySettlement, adoptPending, setPhaseSync, setPreparedSync]);

  const cancelReview = useCallback(() => {
    if (phaseRef.current !== "review" || unresolvedRef.current) return;
    invalidate();
    setPreparedSync(null);
    setPhaseSync("ready");
    setError(null);
  }, [invalidate, setPreparedSync, setPhaseSync]);

  const clearInvalidPending = useCallback(() => {
    if (!canDiscardInvalidPending) return;
    const stored = readPendingStellar();
    const current = preparedRef.current;
    if (!stored || !current || stored.prepared.transactionHash !== current.transactionHash) return;
    clearPendingStellar(current.transactionHash);
    invalidate();
    unresolvedRef.current = false;
    setCanDiscardInvalidPending(false);
    busyRef.current = false;
    setBusy(false);
    setPreparedSync(null);
    setSettlement(null);
    setError(null);
    setPhaseSync(accountRef.current ? "ready" : "connect");
  }, [canDiscardInvalidPending, setPreparedSync, setPhaseSync, invalidate]);

  const reset = useCallback(() => {
    if (unresolvedRef.current || busyRef.current || phaseRef.current === "signing") return;
    invalidate();
    setPreparedSync(null);
    setSettlement(null);
    setError(null);
    setNotice(null);
    amountRef.current = "";
    setAmountState("");
    setPhaseSync(account ? "ready" : "connect");
  }, [invalidate, account, setPreparedSync, setPhaseSync]);

  const disconnect = useCallback(() => {
    if (unresolvedRef.current || busyRef.current || phaseRef.current === "signing") return;
    invalidate();
    // Full logout: shared session torn down everywhere, remembered session
    // forgotten. Durable pending records are left untouched.
    disconnectStellarSession();
    setPreparedSync(null);
    setSettlement(null);
    setError(null);
    setNotice(null);
    amountRef.current = "";
    setAmountState("");
    setPhaseSync("connect");
  }, [invalidate, setPreparedSync, setPhaseSync]);

  return {
    phase,
    account,
    amount,
    prepared,
    settlement,
    error,
    notice,
    busy,
    reviewExpired,
    canDiscardInvalidPending,
    setAmount,
    connect,
    refresh,
    review,
    reviewTrustline,
    signReviewed,
    checkSettlement,
    cancelReview,
    clearInvalidPending,
    reset,
    disconnect,
  };
}
