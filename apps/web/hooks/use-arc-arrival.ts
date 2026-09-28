/**
 * useArcArrival — the Arc → Arbitrum funding path as one state machine.
 *
 *   ready ─start→ switching → signing ─burn→ delivering ─Circle mints→ arrived
 *                                  │                │
 *                               (cancel →ready)   stuck (attested, not
 *                                                  forwarded) → finishManually
 *
 * - Arc USDC balance: one plain JSON-RPC read per address (no ethers).
 * - Quote: Circle's live fee for a forwarded, Standard burn (Arc can't source
 *   Fast). No quote → no burn; we never guess a maxFee.
 * - The burn tx hash is persisted before anything else, so a reload resumes
 *   the delivery watch instead of losing track of money in transit.
 * - ethers + cctp-service load only when the user acts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWalletContext } from "@/components/wallet/WalletProvider";
import { haptics } from "@/lib/haptics";
import { isBrowserOffline } from "./use-online-status";
import {
  ARC_ARRIVAL_MIN_USDC,
  arcArrivalRoute,
  checkDelivery,
  fromSubunits,
  loadArrival,
  maxFeeFor,
  maxSendable,
  readNativeBalance,
  readUsdcBalance,
  saveArrival,
  toSubunits,
  type ArcArrivalRecord,
  type ArcArrivalRoute,
  type FeeEntry,
} from "@/lib/arc-arrival";

export type ArcArrivalPhase =
  | "idle"
  | "switching"
  | "signing"
  | "delivering"
  | "stuck"
  | "slow"
  | "finishing"
  | "arrived"
  | "error";

const POLL_FAST_MS = 4_000;
const POLL_SLOW_MS = 10_000;
const FAST_WINDOW_MS = 2 * 60_000;
/** Attested but Circle hasn't forwarded for this long → offer manual finish. */
const STUCK_AFTER_MS = 5 * 60_000;
/** Stop auto-polling after this; the user can check again. */
const GIVE_UP_MS = 30 * 60_000;

function isRejection(err: unknown): boolean {
  const e = err as { code?: unknown; message?: string } | null;
  if (e?.code === 4001 || e?.code === "ACTION_REJECTED") return true;
  return /user (rejected|denied)|rejected the request|cancell?ed/i.test(e?.message ?? "");
}

function humanError(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (/insufficient funds|exceeds balance/i.test(msg)) {
    return "Not enough USDC on Arc to cover the amount plus gas. Try a smaller amount.";
  }
  if (/fee quote/i.test(msg)) {
    return "Circle's delivery fee isn't available right now, so nothing was sent. Try again in a minute.";
  }
  if (/provider unavailable|no wallet/i.test(msg)) {
    return "Your wallet didn't respond. Reopen it and try again — nothing was sent.";
  }
  return "Something went wrong before the transfer was sent. Nothing left your wallet — try again.";
}

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

async function ensureChain(chainId: number): Promise<Eip1193> {
  const [{ getWalletProvider }, { getAddChainParameter, toHexChainId }] = await Promise.all([
    import("@diversifi/shared/src/modules/wallet/core/provider-registry"),
    import("@diversifi/shared/src/modules/wallet/core/chains"),
  ]);
  const provider = (await getWalletProvider()) as unknown as Eip1193 | null;
  if (!provider) throw new Error("Wallet provider unavailable");
  const current = Number.parseInt(String(await provider.request({ method: "eth_chainId" })), 16);
  if (current === chainId) return provider;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId(chainId) }],
    });
  } catch (err) {
    if (isRejection(err)) throw err;
    await provider.request({ method: "wallet_addEthereumChain", params: [getAddChainParameter(chainId)] });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId(chainId) }],
    });
  }
  return provider;
}

async function signerOn(chainId: number) {
  const provider = await ensureChain(chainId);
  const { ethers } = await import("ethers");
  // 'any' — the wallet just switched networks; don't pin a stale one.
  return new ethers.providers.Web3Provider(provider as never, "any").getSigner();
}

export interface ArcArrival {
  /** Null when the path is off (flag, MiniPay, walletless). */
  route: ArcArrivalRoute | null;
  /** Arc USDC in subunits; null until read. */
  balance: bigint | null;
  /** Worth offering: enough USDC on Arc, or a transfer in flight/just landed. */
  offered: boolean;
  phase: ArcArrivalPhase;
  error: string | null;
  record: ArcArrivalRecord | null;
  feeEntry: FeeEntry | null;
  quoteState: "idle" | "loading" | "ready" | "unavailable";
  /** Max fee for a given amount (subunits). */
  feeFor: (amount: bigint) => bigint | null;
  maxAmount: bigint | null;
  /** True when the arrived wallet has no ETH on Arbitrum for the next swap. */
  destinationGasMissing: boolean | null;
  prepare: () => void;
  start: (amount: string) => Promise<void>;
  checkAgain: () => void;
  finishManually: () => Promise<void>;
  dismiss: () => void;
}

export function useArcArrival({ onArrived }: { onArrived?: () => void } = {}): ArcArrival {
  const { address, isMiniPay } = useWalletContext();
  const route = useMemo(() => (address && !isMiniPay ? arcArrivalRoute() : null), [address, isMiniPay]);

  const [balance, setBalance] = useState<bigint | null>(null);
  const [record, setRecord] = useState<ArcArrivalRecord | null>(null);
  const [phase, setPhase] = useState<ArcArrivalPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [feeEntry, setFeeEntry] = useState<FeeEntry | null>(null);
  const [quoteState, setQuoteState] = useState<ArcArrival["quoteState"]>("idle");
  const [attestation, setAttestation] = useState<{ message: string; attestation: string } | null>(null);
  const [destinationGasMissing, setDestinationGasMissing] = useState<boolean | null>(null);
  const [pollNonce, setPollNonce] = useState(0);
  const inFlightRef = useRef(false);
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  // Restore an in-flight or just-arrived transfer for this wallet.
  useEffect(() => {
    if (!route || !address) {
      setRecord(null);
      setPhase("idle");
      return;
    }
    const saved = loadArrival(address);
    if (saved && saved.env === route.env) {
      setRecord(saved);
      setPhase(saved.forwardTxHash ? "arrived" : "delivering");
    } else {
      setRecord(null);
      setPhase("idle");
    }
  }, [route, address]);

  const refreshBalance = useCallback(async (signal?: AbortSignal) => {
    if (!route || !address) return;
    try {
      setBalance(await readUsdcBalance(route.sourceRpc, route.sourceUsdc, address, signal));
    } catch {
      // Silent: an unreadable Arc RPC just means no prompt — never a fake 0.
    }
  }, [route, address]);

  useEffect(() => {
    setBalance(null);
    if (!route || !address) return;
    const ctrl = new AbortController();
    void refreshBalance(ctrl.signal);
    return () => ctrl.abort();
  }, [route, address, refreshBalance]);

  const prepare = useCallback(() => {
    if (!route || quoteState === "loading" || quoteState === "ready") return;
    setQuoteState("loading");
    void (async () => {
      try {
        const cctp = await import("@diversifi/shared/src/services/cctp-service");
        const fees = await cctp.quoteFee(route.sourceKey, route.destinationKey, true);
        const entry = cctp.feeEntryFor(fees, cctp.finalityFor(route.sourceKey));
        setFeeEntry(entry);
        setQuoteState(entry ? "ready" : "unavailable");
      } catch {
        setQuoteState("unavailable");
      }
    })();
    void refreshBalance();
  }, [route, quoteState, refreshBalance]);

  const feeFor = useCallback(
    (amount: bigint) => (feeEntry ? maxFeeFor(amount, feeEntry, true) : null),
    [feeEntry],
  );

  const maxAmount = useMemo(() => {
    if (balance === null || !feeEntry) return null;
    // The fee scales (slightly) with the amount; size the max against the
    // fee on the whole balance so the max itself is always affordable.
    return maxSendable(balance, maxFeeFor(balance, feeEntry, true));
  }, [balance, feeEntry]);

  const persist = useCallback((next: ArcArrivalRecord | null) => {
    setRecord(next);
    if (address) saveArrival(address, next);
  }, [address]);

  const start = useCallback(async (amountInput: string) => {
    if (!route || !address || inFlightRef.current) return;
    const amount = toSubunits(amountInput);
    if (!amount || amount <= 0n) return;
    if (isBrowserOffline()) {
      setError("You're offline. Reconnect to move USDC — nothing was sent.");
      setPhase("error");
      return;
    }
    if (!feeEntry) {
      setError("Circle's delivery fee isn't available right now, so nothing was sent. Try again in a minute.");
      setPhase("error");
      return;
    }
    if (maxAmount !== null && amount > maxAmount) {
      setError("That's more than you can move after gas and Circle's fee. Use Max.");
      setPhase("error");
      return;
    }

    inFlightRef.current = true;
    setError(null);
    try {
      setPhase("switching");
      const signer = await signerOn(route.sourceChainId);
      setPhase("signing");
      const cctp = await import("@diversifi/shared/src/services/cctp-service");
      const burn = await cctp.burn({
        signer,
        sourceChain: route.sourceKey,
        destinationChain: route.destinationKey,
        recipient: address,
        amountUsdc: fromSubunits(amount),
        forward: true,
        fast: false,
        feeEntries: [feeEntry],
      });
      // Persist FIRST — from here on money is in transit.
      persist({ env: route.env, burnTxHash: burn.txHash, amount: amount.toString(), startedAt: Date.now() });
      setPhase("delivering");
      haptics.tap();
      // Best-effort: park the wallet on the destination so "Protect it" is
      // one tap. A declined switch changes nothing about the transfer.
      ensureChain(route.destinationChainId).catch(() => {});
      void refreshBalance();
    } catch (err) {
      if (isRejection(err)) {
        setPhase("idle"); // the user said no — no error, no buzz
      } else {
        console.warn("[ArcArrival] start failed:", err);
        setError(humanError(err));
        setPhase("error");
        haptics.error();
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [route, address, feeEntry, maxAmount, persist, refreshBalance]);

  // Delivery watch — polls Circle until the Forwarding Service mints.
  useEffect(() => {
    if (!route || !record || record.forwardTxHash) return;
    let cancelled = false;
    let timer: number | undefined;
    const ctrl = new AbortController();
    let attestedAt: number | null = null;

    const tick = async () => {
      if (cancelled) return;
      const age = Date.now() - record.startedAt;
      try {
        const status = await checkDelivery(route, record.burnTxHash, ctrl.signal);
        if (cancelled) return;
        if (status.state === "delivered") {
          const next = { ...record, forwardTxHash: status.forwardTxHash, arrivedAt: Date.now() };
          persist(next);
          setPhase("arrived");
          haptics.confirm();
          onArrivedRef.current?.();
          return;
        }
        if (status.state === "attested") {
          attestedAt ??= Date.now();
          setAttestation({ message: status.message, attestation: status.attestation });
          if (status.forwardFailed || Date.now() - attestedAt > STUCK_AFTER_MS) {
            setPhase("stuck");
            return;
          }
        }
      } catch {
        // Transient (network/Circle) — keep watching until the give-up window.
      }
      if (age > GIVE_UP_MS) {
        setPhase("slow");
        return;
      }
      timer = window.setTimeout(tick, age < FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      ctrl.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [route, record, persist, pollNonce]);

  // Once arrived: is there ETH on Arbitrum for the protective swap?
  useEffect(() => {
    if (!route || !address || phase !== "arrived") return;
    const ctrl = new AbortController();
    readNativeBalance(route.destinationRpc, address, ctrl.signal)
      .then((wei) => setDestinationGasMissing(wei === 0n))
      .catch(() => setDestinationGasMissing(null));
    return () => ctrl.abort();
  }, [route, address, phase]);

  const checkAgain = useCallback(() => {
    if (!record) return;
    persist({ ...record, startedAt: Date.now() }); // restart the watch window
    setPhase("delivering");
    setPollNonce((n) => n + 1);
  }, [record, persist]);

  const finishManually = useCallback(async () => {
    if (!route || !record || !attestation || inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setPhase("finishing");
    try {
      const signer = await signerOn(route.destinationChainId);
      const cctp = await import("@diversifi/shared/src/services/cctp-service");
      const txHash = await cctp.mint({
        signer,
        destinationChain: route.destinationKey,
        message: attestation.message,
        attestation: attestation.attestation,
      });
      persist({ ...record, forwardTxHash: txHash, arrivedAt: Date.now() });
      setPhase("arrived");
      haptics.confirm();
      onArrivedRef.current?.();
    } catch (err) {
      setPhase("stuck");
      if (!isRejection(err)) {
        setError("Couldn't finish on Arbitrum — this step needs a little ETH there for gas. Your USDC is still claimable.");
        haptics.error();
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [route, record, attestation, persist]);

  const dismiss = useCallback(() => {
    persist(null);
    setPhase("idle");
    setError(null);
    setAttestation(null);
    setDestinationGasMissing(null);
  }, [persist]);

  const offered = Boolean(
    route &&
      (record ||
        (balance !== null && balance >= BigInt(ARC_ARRIVAL_MIN_USDC * 1_000_000))),
  );

  return {
    route,
    balance,
    offered,
    phase,
    error,
    record,
    feeEntry,
    quoteState,
    feeFor,
    maxAmount,
    destinationGasMissing,
    prepare,
    start,
    checkAgain,
    finishManually,
    dismiss,
  };
}
