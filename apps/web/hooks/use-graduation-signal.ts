/**
 * useGraduationSignal — fetches the retail→business graduation signal for
 * the connected wallet and exposes a dismiss callback.
 *
 * Pattern (mirrors `useProactiveAgent.useAlertCooldown`):
 *  - Uses CACHED wallet auth only — never prompts for a signature.
 *    The prompt-less mount is intentional: this hook runs as part of
 *    the home overview render, not a user-initiated action.
 *  - Address-keyed: refetches on mount + when address changes.
 *  - Cross-device persistent via GuardianState.graduationPromptDismissedAt
 *    on the server; localStorage not involved.
 *  - Skips fetch when no wallet is connected (no user, no signals).
 *  - On fetch failure, resolves to `dismissed: true` so the prompt
 *    stays 0px — a broken endpoint must NOT spam the user with
 *    retried-load spinners.
 *
 * The endpoint contract is documented at
 * `pages/api/agent/business/graduation-signals.ts`.
 */
import { useCallback, useEffect, useState } from "react";
import { getCachedWalletAuth } from "@/lib/wallet-auth";

const API_PATH = "/api/agent/business/graduation-signals";
// Per-mount request budget: errors must not cascade into infinite retries.
const MAX_ATTEMPTS_PER_MOUNT = 2;
// Don't refetch more than once per minute even on a noisy parent re-render.
const MIN_REFETCH_INTERVAL_MS = 60_000;

// Timeout must be >= the endpoint's own work (Transaction find + PurchaseCycle
// exists: each index lookup) — generous but bounded so a hung upstream can't
// hold the home view back indefinitely.
const FETCH_TIMEOUT_MS = 8000;

interface SignalsShape {
  cyclical: boolean;
  corridor: boolean;
  largerBalance: boolean;
  hasSavedCycle: boolean;
}

interface GraduationResponse {
  shouldShow: boolean;
  dismissed?: boolean;
  confidence: number;
  signals: SignalsShape;
  promptHeadline: string;
}

export interface UseGraduationSignalResult {
  data: GraduationResponse | null;
  isLoading: boolean;
  error: string | null;
  /** True when the user previously dismissed; the prompt should NOT render. */
  isDismissed: boolean;
  dismiss: () => Promise<void>;
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function useGraduationSignal(
  address: string | null | undefined,
): UseGraduationSignalResult {
  const [data, setData] = useState<GraduationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [lastFetchedAt, setLastFetchedAt] = useState(0);

  /**
   * Per-address attempt budget key. Reset the attempt + lastFetchedAt
   * counters whenever the address changes so the wallet-disconnect →
   * reconnect path gets a fresh fetch. Without this reset the gate in
   * the mount effect (attempt > 0 && attempt < MAX_ATTEMPTS_PER_MOUNT)
   * silently dropped every refetch after the first attempt on a
   * different wallet — the bug never fires in tests because no test
   * exercises the address-change path.
   */
  const [attemptBudgetKey, setAttemptBudgetKey] = useState(address ?? "");
  useEffect(() => {
    if (address && address !== attemptBudgetKey) {
      setAttempt(0);
      setLastFetchedAt(0);
      setAttemptBudgetKey(address);
    }
  }, [address, attemptBudgetKey]);

  const runFetch = useCallback(async () => {
    if (!address) {
      setData(null);
      setIsLoading(false);
      return;
    }
    if (attempt >= MAX_ATTEMPTS_PER_MOUNT) return;

    setIsLoading(true);
    setError(null);
    try {
      // Cached auth only — never prompt for a signature here. If no
      // cached proof exists, the endpoint will reject with 401 and
      // we treat the user as 'no signal data'.
      const proof = getCachedWalletAuth(address);
      const headers: Record<string, string> = proof
        ? {
            "X-Wallet-Auth-Message": encodeURIComponent(proof.message),
            "X-Wallet-Auth-Signature": proof.signature,
          }
        : {};

      const res = await fetchWithTimeout(
        API_PATH,
        { headers, credentials: "same-origin" },
        FETCH_TIMEOUT_MS,
      );
      if (!res.ok) {
        // 401 (no cached proof) is not an error — just means there's
        // no signal data for this session. Anything else is reported.
        if (res.status !== 401) {
          setError(`graduation-signals ${res.status}`);
        }
        setData(null);
        return;
      }
      const json = (await res.json()) as GraduationResponse;
      setData(json);
      setLastFetchedAt(Date.now());
    } catch (err) {
      // Network failure → resolve to no-data on this attempt; the
      // hook does not retry inline (the parent can re-call if it
      // wants). Logging once is enough.
      if (attempt === 0) setError(err instanceof Error ? err.message : "Fetch failed");
      setData(null);
    } finally {
      setIsLoading(false);
      setAttempt((a) => a + 1);
    }
  }, [address, attempt]);

  useEffect(() => {
    // Sticky refetch gate: don't spam the endpoint on every render.
    const now = Date.now();
    if (lastFetchedAt && now - lastFetchedAt < MIN_REFETCH_INTERVAL_MS) return;
    if (attempt > 0 && attempt < MAX_ATTEMPTS_PER_MOUNT) {
      // Already attempted — require an explicit trigger or address
      // change before retrying.
      return;
    }
    void runFetch();
    // We intentionally do not re-run on `attempt`/`lastFetchedAt`
    // updates — the fetch is triggered on address change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const dismiss = useCallback(async () => {
    if (!address) return;
    const proof = getCachedWalletAuth(address);
    if (!proof) {
      // No cached proof — record the dismissal locally (lost on tab
      // close) and stop representing data. Better-than-nothing fallback.
      setData((prev) =>
        prev ? { ...prev, shouldShow: false, dismissed: true } : prev,
      );
      return;
    }
    try {
      const res = await fetchWithTimeout(
        API_PATH,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wallet-Auth-Message": encodeURIComponent(proof.message),
            "X-Wallet-Auth-Signature": proof.signature,
          },
          body: JSON.stringify({ action: "dismiss" }),
        },
        FETCH_TIMEOUT_MS,
      );
      if (res.ok) {
        const json = (await res.json()) as GraduationResponse;
        setData({ ...json, dismissed: true });
      } else {
        // Even on POST failure, mark as dismissed locally so the
        // prompt doesn't reappear before the user reloads.
        setData((prev) =>
          prev ? { ...prev, shouldShow: false, dismissed: true } : prev,
        );
      }
    } catch {
      setData((prev) =>
        prev ? { ...prev, shouldShow: false, dismissed: true } : prev,
      );
    }
  }, [address]);

  // isDismissed reflects both server state (explicit `dismissed: true`
  // in the response) and an explicit `shouldShow: false` (defensive —
  // covers endpoints that omit the dismissed flag but say don't show).
  const isDismissed = Boolean(data?.dismissed) || (data?.shouldShow === false);

  return { data, isLoading, error, isDismissed, dismiss };
}
