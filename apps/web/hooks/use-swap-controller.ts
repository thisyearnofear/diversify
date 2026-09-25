import { useState, useEffect, useCallback, useContext, useMemo, useRef } from "react";
import { useSwap } from "./use-swap";
import { useExpectedAmountOut } from "./use-expected-amount-out";
import { useSharedMultichainBalances } from "../context/app/PortfolioContext";
import { useInflationData } from "./use-inflation-data";
import { useStreakRewards } from "./use-streak-rewards";
import { NETWORKS, NETWORK_TOKENS } from "../config";
// Deep leaf imports — NOT the barrel — keeps the swap + cross-chain-tokens stacks out of first-load.
import { isTokenAvailableOnChain, getTokensForChain } from "@diversifi/shared/src/utils/cross-chain-tokens";
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import { SwapErrorHandler } from "@diversifi/shared/src/services/swap/error-handler";
import { SwapOrchestratorService } from "@diversifi/shared/src/services/swap/swap-orchestrator.service";
import { isMentoToken } from "@diversifi/shared/src/services/swap/mento-sdk.service";
import type { SwapErrorClass } from "@diversifi/shared/src/services/swap/strategies/base-swap.strategy";
import { trackFunnelEvent } from "@/lib/analytics";
import { DemoModeContext } from "@/context/app/DemoModeContext";

// Hub the aggregator can't beat on Celo: USDm is the broker's routing
// token, so a failed X -> Y often decomposes into X -> USDm -> Y.
const HUB_TOKEN = "USDm";

// The explored pair survives tab remounts and reloads within the
// session — walletless browsing carries into the connected state.
// Prefill/setTokens always win over the stored pair.
const PAIR_STORAGE_KEY = "diversifi.exchange.pair";

// Funnel outcome mapping — errorClass values 1:1 to funnel outcomes.
type SwapOutcome =
  | "success"
  | "no_route"
  | "cancelled"
  | "onchain_failed"
  | "session"
  | "no_gas"
  | "error";

function mapErrorClassToOutcome(cls: SwapErrorClass | null | undefined): SwapOutcome {
  switch (cls) {
    case "cancelled": return "cancelled";
    case "onchain-failed": return "onchain_failed";
    case "no-route": return "no_route";
    case "session": return "session";
    case "no-gas": return "no_gas";
    default: return "error";
  }
}

// Coarse only — never the raw amount.
function usdBucket(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  if (amount < 1) return "<1";
  if (amount < 10) return "1-10";
  if (amount < 100) return "10-100";
  return "100+";
}

interface Token {
  symbol: string;
  name: string;
  region: string;
}

/** Read the session-stored pair, canonicalizing to the list's spelling.
 *  Returns null when the stored symbols aren't both available — an
 *  invalid stored pair is ignored, never half-applied. */
function readStoredPair(
  list: Token[],
): { fromToken: string; toToken: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PAIR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      fromToken?: unknown;
      toToken?: unknown;
    };
    const match = (sym: unknown) =>
      typeof sym === "string"
        ? list.find((t) => t.symbol.toUpperCase() === sym.toUpperCase())
            ?.symbol
        : undefined;
    const fromToken = match(parsed?.fromToken);
    const toToken = match(parsed?.toToken);
    if (!fromToken || !toToken || fromToken === toToken) return null;
    return { fromToken, toToken };
  } catch {
    return null;
  }
}

interface UseSwapControllerParams {
  address?: string | null;
  chainId?: number | null;
  availableTokens: Token[];
  enableCrossChain?: boolean;
  preferredFromRegion?: string;
  preferredToRegion?: string;
}

export function useSwapController({
  address,
  chainId,
  availableTokens,
  enableCrossChain = false,
  preferredFromRegion,
  preferredToRegion,
}: UseSwapControllerParams) {
  // 1. Initial State Setup
  const defaultFromToken = useMemo(() => {
    return preferredFromRegion
      ? availableTokens.find((token) => token.region === preferredFromRegion)
        ?.symbol ||
      availableTokens.find((token) => token.symbol.toUpperCase() === "USDT")
        ?.symbol ||
      availableTokens[0]?.symbol ||
      ""
      : availableTokens.find((token) => token.symbol.toUpperCase() === "USDT")
        ?.symbol ||
      availableTokens[0]?.symbol ||
      "";
  }, [preferredFromRegion, availableTokens]);

  const defaultToToken = useMemo(() => {
    const candidate = (preferredToRegion
      ? availableTokens.find((token) => token.region === preferredToRegion)
        ?.symbol
      : undefined) ||
      availableTokens.find((token) => token.symbol.toUpperCase() === "EURm")
        ?.symbol ||
      availableTokens[1]?.symbol ||
      "";
    // A destination equal to the source dead-ends the ticket (and its
    // provenance story) — fall back to USDm, then any other token.
    if (candidate === defaultFromToken) {
      return (
        availableTokens.find(
          (token) => token.symbol === "USDm" && token.symbol !== candidate
        )?.symbol ||
        availableTokens.find((token) => token.symbol !== candidate)?.symbol ||
        candidate
      );
    }
    return candidate;
  }, [preferredToRegion, availableTokens, defaultFromToken]);

  // Restore the session-stored pair when both symbols are still in the
  // list (canonical spelling); region defaults otherwise.
  const [fromToken, setFromToken] = useState<string>(
    () => readStoredPair(availableTokens)?.fromToken ?? defaultFromToken,
  );
  const [toToken, setToToken] = useState<string>(
    () => readStoredPair(availableTokens)?.toToken ?? defaultToToken,
  );
  // Empty by default — any amount forces the ticket (SwapInterface's
  // forcedTicket), so a prefilled "10" would hide the pair stage from
  // every visitor.
  const [amount, setAmount] = useState<string>("");
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  // The wallet chain the ticket may follow: only chains the swap
  // orchestrator can actually execute on. Unsupported chains (e.g.
  // Ethereum mainnet) leave the ticket on its supported default so
  // execution can request a wallet network switch instead of sending
  // Celo token addresses to a foreign route.
  const supportedChainId =
    chainId != null && ChainDetectionService.isSupported(chainId)
      ? chainId
      : null;

  // The chain `availableTokens` describes from the ticket's perspective.
  // getChainAssets() serves a chain's own list when NETWORK_TOKENS has
  // one (incl. non-swap chains like Robinhood) and the Celo list
  // otherwise — so a connected wallet on an unknown chain maps to Celo.
  const listChainId =
    chainId != null
      ? (NETWORK_TOKENS[chainId] ? chainId : NETWORKS.CELO_MAINNET.chainId)
      : null;

  const [fromChainId, setFromChainId] = useState<number>(
    supportedChainId ?? NETWORKS.CELO_MAINNET.chainId,
  );
  const [toChainId, setToChainId] = useState<number>(
    supportedChainId ?? NETWORKS.CELO_MAINNET.chainId,
  );

  const [status, setStatus] = useState<
    "idle" | "approving" | "swapping" | "completed" | "error"
  >("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localErrorClass, setLocalErrorClass] = useState<SwapErrorClass | null>(null);
  const [localTxHash, setLocalTxHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  // Recovery state: after a failed X -> Y on Celo we can offer the
  // two-leg route X -> USDm -> Y. pendingViaFinal remembers Y while leg 1
  // is in flight; leg2Hint flags the just-advanced ticket.
  const [pendingViaFinal, setPendingViaFinal] = useState<string | null>(null);
  const [leg2Hint, setLeg2Hint] = useState<string | null>(null);
  const [signatureCount, setSignatureCount] = useState<number | null>(null);

  // Funnel: one swap_outcome per attempt (leg-1 of a via-hub route counts
  // as its own attempt). Soft demo read — outside the provider there's no
  // demo state, so nothing is gated.
  const demoActive = useContext(DemoModeContext)?.demoMode?.isActive === true;
  const attemptSeqRef = useRef(0);
  const reportedAttemptRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Late restore: if the token list wasn't ready at init, apply the
  // stored pair once it is — but only while the pair still sits on the
  // defaults, so a prefill or explicit setTokens always wins. Declared
  // BEFORE the persist effect, which waits for this to settle: otherwise
  // the first render would overwrite the stored pair with the defaults
  // before an async token list arrived to restore it.
  const pairRestoreDoneRef = useRef(false);
  // Set only by explicit choices (the exported setters, the switch) —
  // never by the internal sync effects — so "a caller already picked a
  // pair" doesn't depend on defaults that themselves follow the list.
  const pairTouchedRef = useRef(false);
  // The pair a restore just queued — the sync effect runs in the same
  // pass with pre-restore state and must reconcile against this instead.
  const restoredPairRef = useRef<{ fromToken: string; toToken: string } | null>(null);
  const setFromTokenByUser = useCallback((t: string) => {
    pairTouchedRef.current = true;
    setFromToken(t);
  }, []);
  const setToTokenByUser = useCallback((t: string) => {
    pairTouchedRef.current = true;
    setToToken(t);
  }, []);
  useEffect(() => {
    if (pairRestoreDoneRef.current) return;
    let hasStored = false;
    try {
      hasStored = Boolean(sessionStorage.getItem(PAIR_STORAGE_KEY));
    } catch {}
    if (!hasStored) {
      pairRestoreDoneRef.current = true;
      return;
    }
    if (availableTokens.length === 0) return; // wait for the list
    pairRestoreDoneRef.current = true;
    const stored = readStoredPair(availableTokens);
    if (!stored || pairTouchedRef.current) return;
    restoredPairRef.current = stored;
    setFromToken(stored.fromToken);
    setToToken(stored.toToken);
  }, [availableTokens]);

  // Persist the pair on every change — once the restore has settled.
  useEffect(() => {
    if (!pairRestoreDoneRef.current || !fromToken || !toToken) return;
    try {
      sessionStorage.setItem(
        PAIR_STORAGE_KEY,
        JSON.stringify({ fromToken, toToken }),
      );
    } catch {
      // sessionStorage unavailable — the pair just doesn't persist
    }
  }, [fromToken, toToken, availableTokens]);

  // 2. Specialized Hooks
  const { tokenMap: tokenBalances, refresh: refreshBalances } =
    useSharedMultichainBalances(address || "");
  const {
    swap: performSwap,
    error: swapError,
    errorClass: swapErrorClass,
    txHash: swapTxHash,
    step: swapStep,
    reset: resetSwap,
  } = useSwap();
  const { expectedOutput, provider: quoteProvider, noRoute: quoteNoRoute, isLoading: isExpectedOutputLoading, quotedAt, refreshQuote } =
    useExpectedAmountOut({ fromToken, toToken, amount });
  const {
    getInflationRateForStablecoin,
    getRegionForStablecoin,
    dataSource: inflationDataSource,
  } = useInflationData();
  const { recordSwap } = useStreakRewards();

  // One funnel event per attempt — later emits for the same attempt
  // (delegated return + step-sync) dedupe on the attempt counter.
  const emitSwapOutcome = useCallback(
    (outcome: SwapOutcome) => {
      if (demoActive) return;
      if (reportedAttemptRef.current === attemptSeqRef.current) return;
      reportedAttemptRef.current = attemptSeqRef.current;
      trackFunnelEvent("swap_outcome", {
        outcome,
        provider: quoteProvider ?? "unknown",
        chainId: String(fromChainId),
        from: fromToken,
        to: toToken,
        usdBucket: usdBucket(parseFloat(amount)),
      });
    },
    [demoActive, quoteProvider, fromChainId, fromToken, toToken, amount],
  );

  // 3. Derived Token Lists
  const availableFromTokens = useMemo(() => {
    if (!enableCrossChain) return availableTokens;
    if (fromChainId === listChainId) return availableTokens;
    return getTokensForChain(fromChainId).map((token) => ({
      symbol: token.symbol,
      name: token.name,
      region: token.region,
    }));
  }, [enableCrossChain, fromChainId, listChainId, availableTokens]);

  const availableToTokens = useMemo(() => {
    if (!enableCrossChain) return availableTokens;
    if (toChainId === listChainId) return availableTokens;
    return getTokensForChain(toChainId).map((token) => ({
      symbol: token.symbol,
      name: token.name,
      region: token.region,
    }));
  }, [enableCrossChain, toChainId, listChainId, availableTokens]);

  // 4. Effects & Synchronization

  // Wallet Chain synchronization. An unsupported wallet chain (e.g.
  // Ethereum mainnet) must NOT be adopted into the ticket: the token
  // lists fall back to Celo assets for unknown chains, so a ticket on
  // chain 1 would send Celo token addresses to an Ethereum route.
  // Keeping the ticket on its supported chain lets useSwap request a
  // wallet network switch at execution time instead.
  useEffect(() => {
    if (supportedChainId == null) return;
    if (!enableCrossChain || fromChainId === toChainId) {
      setFromChainId(supportedChainId);
      setToChainId(supportedChainId);
    }
  }, [supportedChainId, enableCrossChain, fromChainId, toChainId]);

  // Search/Filter synchronization
  useEffect(() => {
    const targetFromTokens = enableCrossChain
      ? availableFromTokens
      : availableTokens;
    const targetToTokens = enableCrossChain
      ? availableToTokens
      : availableTokens;
    // Symbols arrive in several casings (config "BRLm", plan-leg "cREAL",
    // uppercased "BRLM" from imperative prefills) — match case-insensitively
    // and heal state to the list's canonical spelling rather than discarding
    // the user's selection.
    const matchSymbol = (list: Token[], symbol: string) =>
      list.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase())
        ?.symbol;

    const pending = restoredPairRef.current;
    if (pending && pending.fromToken === fromToken && pending.toToken === toToken) {
      restoredPairRef.current = null; // state caught up with the restore
    }
    const curFrom = restoredPairRef.current?.fromToken ?? fromToken;
    const curTo = restoredPairRef.current?.toToken ?? toToken;

    const canonicalFrom = matchSymbol(targetFromTokens, curFrom);
    const effectiveFrom =
      canonicalFrom ?? (targetFromTokens.length > 0 ? targetFromTokens[0].symbol : undefined);
    if (effectiveFrom && effectiveFrom !== curFrom) {
      setFromToken(effectiveFrom);
    }

    const canonicalTo = matchSymbol(targetToTokens, curTo);
    if (canonicalTo) {
      if (canonicalTo !== curTo) setToToken(canonicalTo);
    } else if (targetToTokens.length > 0) {
      // Compare against the effective from-token, not the stale state value:
      // when both resets land in the same pass, picking ≠ the old fromToken
      // could select the exact token the from side just reset to.
      const differentToken = targetToTokens.find(
        (t) => t.symbol !== effectiveFrom,
      );
      setToToken(differentToken?.symbol || targetToTokens[0].symbol);
    }
  }, [
    availableTokens,
    availableFromTokens,
    availableToTokens,
    enableCrossChain,
    fromToken,
    toToken,
  ]);

  // Cross-chain token availability synchronization. Registry gating only
  // applies to bridge routes — on a same-chain route the local list is the
  // authority and natives like CELO (absent from CROSS_CHAIN_TOKENS) are
  // valid Mento swaps.
  useEffect(() => {
    if (!enableCrossChain) return;
    if (!ChainDetectionService.isCrossChain(fromChainId, toChainId)) return;
    const fromAvailable = isTokenAvailableOnChain(fromToken, fromChainId);
    const effectiveFrom = fromAvailable
      ? fromToken
      : (availableFromTokens.find((t) => t.symbol !== toToken) ??
          availableFromTokens[0])?.symbol;
    if (!fromAvailable && effectiveFrom) setFromToken(effectiveFrom);
    if (!isTokenAvailableOnChain(toToken, toChainId)) {
      const first =
        availableToTokens.find((t) => t.symbol !== effectiveFrom) ??
        availableToTokens[0];
      if (first) setToToken(first.symbol);
    }
  }, [
    enableCrossChain,
    fromChainId,
    toChainId,
    availableFromTokens,
    availableToTokens,
    fromToken,
    toToken,
  ]);

  // 5. Actions
  const handleSwitchTokens = useCallback(() => {
    pairTouchedRef.current = true;
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  }, [fromToken, toToken]);

  const refreshWithRetries = useCallback(
    async (retries = 3, delay = 2000) => {
      for (let i = 0; i < retries; i++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
          await refreshBalances();
          break;
        } catch {
          // Ignore transient refresh errors — next retry will try again
        }
      }
    },
    [refreshBalances],
  );

  const executeSwap = useCallback(
    async (
      onSwapProp?: (
        from: string,
        to: string,
        amount: string,
        fromChainId: number,
        toChainId: number,
        fromInflation: number,
        toInflation: number,
        recipientAddress?: string,
        phoneNumber?: string,
      ) => Promise<unknown>,
      contractCall?: {
        toContractAddress: string;
        toContractCallData: string;
        toContractGasLimit: string;
      }
    ) => {
      if (
        !fromToken ||
        !toToken ||
        !amount ||
        Number.parseFloat(amount) <= 0 ||
        fromToken === toToken
      )
        return;
      if (!address) {
        setLocalError("Please connect your wallet first");
        return;
      }

      setIsLoading(true);
      setLocalError(null);
      setLocalErrorClass(null);
      setLocalTxHash(null);
      setStatus("approving");
      attemptSeqRef.current += 1;

      try {
        if (onSwapProp) {
          const fromInflation = fromToken ? getInflationRateForStablecoin(fromToken) : 0;
          const toInflation = toToken ? getInflationRateForStablecoin(toToken) : 0;

          const result = (await onSwapProp(
            fromToken,
            toToken,
            amount,
            fromChainId,
            toChainId,
            fromInflation,
            toInflation,
            recipientAddress || undefined,
            phoneNumber || undefined,
          )) as
            | {
                success?: boolean;
                error?: string;
                errorClass?: SwapErrorClass | null;
                swapTxHash?: string;
              }
            | undefined;
          if (result?.swapTxHash) setLocalTxHash(result.swapTxHash);
          if (result && result.success === false) {
            // Delegated failure that returned instead of throwing — without
            // this check the ticket would report success on a dead route.
            emitSwapOutcome(mapErrorClassToOutcome(result.errorClass));
            if (result.errorClass === "cancelled") {
              setStatus("idle");
            } else {
              setLocalError(result.error ?? "Swap failed");
              setLocalErrorClass(result.errorClass ?? "error");
              setStatus("error");
            }
          } else {
            emitSwapOutcome("success");
            setStatus("completed");
            refreshWithRetries();
          }
        } else {
          const res = await performSwap({
            fromToken,
            toToken,
            amount,
            fromChainId: enableCrossChain ? fromChainId : undefined,
            toChainId: enableCrossChain ? toChainId : undefined,
            slippageTolerance,
            recipientAddress: recipientAddress || undefined,
            phoneNumber: phoneNumber || undefined,
            contractCall,
          });
          // A cancellation produces no error state in the hook — reset the
          // ticket quietly rather than stranding it on "approving".
          if (res && !res.success && res.errorClass === "cancelled") {
            emitSwapOutcome("cancelled");
            setStatus("idle");
          }
          // Note: Hook state will be handled via useEffect tracking swapStep
        }
      } catch (err) {
        const anyErr = err as { errorClass?: SwapErrorClass };
        emitSwapOutcome(mapErrorClassToOutcome(anyErr?.errorClass));
        setLocalError(SwapErrorHandler.handle(err, "swap tokens"));
        setLocalErrorClass(anyErr?.errorClass ?? "error");
        setStatus("error");
      } finally {
        setIsLoading(false);
      }
    },
    [
      fromToken,
      toToken,
      amount,
      fromChainId,
      toChainId,
      address,
      enableCrossChain,
      slippageTolerance,
      performSwap,
      refreshWithRetries,
      getInflationRateForStablecoin,
      recipientAddress,
      phoneNumber,
      emitSwapOutcome,
    ],
  );

  // Which provider would execute this pair — the top-ranked strategy,
  // computed synchronously so the ticket can say "via Mento" before any
  // quote resolves. Null when nothing can route it.
  const routeProvider = useMemo(() => {
    if (!fromToken || !toToken || fromToken === toToken) return null;
    // A resolved quote's provider is authoritative — the sync check below
    // is the pre-quote hint only.
    if (expectedOutput && quoteProvider) return quoteProvider;
    if (!address) return null;
    return SwapOrchestratorService.getRouteProvider({
      fromToken,
      toToken,
      amount: amount || "1",
      fromChainId,
      toChainId,
      userAddress: address,
    });
  }, [address, expectedOutput, quoteProvider, fromToken, toToken, amount, fromChainId, toChainId]);

  // Signature disclosure — once a quote exists, count the wallet
  // confirmations the chosen route will ask for (swaps + approvals).
  // Null means "couldn't determine" — the UI stays silent rather than
  // guess. Recomputed when the quote refreshes.
  const signatureReqRef = useRef(0);
  useEffect(() => {
    if (!address || !expectedOutput || !Number.isFinite(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0) {
      setSignatureCount(null);
      return;
    }
    const req = ++signatureReqRef.current;
    SwapOrchestratorService.estimateConfirmations({
      fromToken,
      toToken,
      amount,
      fromChainId,
      toChainId,
      userAddress: address,
    }).then((count) => {
      if (signatureReqRef.current === req) setSignatureCount(count);
    }).catch(() => {
      if (signatureReqRef.current === req) setSignatureCount(null);
    });
  }, [address, expectedOutput, fromToken, toToken, amount, fromChainId, toChainId]);

  // Recovery offer: a failed Celo pair that isn't USDm-involving can often
  // decompose through USDm, the Mento hub. Offered only for failure classes
  // where a different route could succeed — never after a cancellation.
  // Since the SDK routes Mento↔Mento itself, the offer only makes sense
  // when exactly one side is a Mento asset — the non-Mento side hops
  // through USDm to reach the Mento destination.
  const viaHub = useMemo(() => {
    const errorWarrantsRetry =
      status === "error" &&
      (localErrorClass === "onchain-failed" || localErrorClass === "no-route");
    if (!errorWarrantsRetry && !quoteNoRoute) return null;
    if (!ChainDetectionService.isCelo(fromChainId) || fromChainId !== toChainId) return null;
    if (fromToken === HUB_TOKEN || toToken === HUB_TOKEN) return null;
    if (isMentoToken(fromChainId, fromToken) === isMentoToken(fromChainId, toToken)) return null;
    return HUB_TOKEN;
  }, [status, localErrorClass, quoteNoRoute, fromChainId, toChainId, fromToken, toToken]);

  // Dismiss a completed swap: a plain setStatus("idle") would bounce —
  // the sync effect below re-maps the hook's still-"completed" step —
  // so the underlying hook must be reset too.
  const acknowledgeCompletion = useCallback(() => {
    resetSwap();
    setStatus("idle");
    setLocalError(null);
    setLocalErrorClass(null);
  }, [resetSwap]);

  const applyViaHub = useCallback(() => {
    if (!viaHub) return;
    // Leg 1: X -> USDm. The original destination is remembered so a
    // completed leg advances the ticket to USDm -> Y automatically.
    setPendingViaFinal(toToken);
    setToToken(viaHub);
    setStatus("idle");
    setLocalError(null);
    setLocalErrorClass(null);
    setLeg2Hint(null);
  }, [viaHub, toToken]);

  // Sync hook status to local status
  useEffect(() => {
    if (swapStep === "completed" && status !== "completed") {
      emitSwapOutcome("success");
      setStatus("completed");
      refreshWithRetries();

      // Leg-2 advance: leg 1 was X -> USDm; reload the ticket USDm -> Y.
      if (pendingViaFinal && toToken === HUB_TOKEN) {
        setFromToken(HUB_TOKEN);
        setToToken(pendingViaFinal);
        setLeg2Hint(`Final step — swap ${HUB_TOKEN} to ${pendingViaFinal} to finish the route`);
        setPendingViaFinal(null);
      }

      // Record streak activity for qualifying saves
      const amountNum = parseFloat(amount);
      if (amountNum >= 1) {
        // $1 minimum for streak
        recordSwap(amountNum);
      }

      // Track today's swap progress (for UI display)
      if (typeof window !== 'undefined' && amountNum > 0) {
        const todayKey = `diversifi_today_swaps_${Date.now().toString().slice(0, 8)}`;
        const currentTotal = parseFloat(localStorage.getItem(todayKey) || '0');
        localStorage.setItem(todayKey, (currentTotal + amountNum).toString());
      }
    } else if (swapStep === "swapping" && status === "approving") {
      // onSwapSubmitted fires before confirmation — advance the ticket to
      // the in-flight state even when a provider (LiFi) never confirms an
      // approval first.
      setStatus("swapping");
    } else if (swapError) {
      emitSwapOutcome(mapErrorClassToOutcome(swapErrorClass));
      setLocalError(swapError);
      setLocalErrorClass(swapErrorClass ?? "error");
      setStatus("error");
    }
    if (swapTxHash && status !== "completed") setLocalTxHash(swapTxHash);
  }, [swapStep, swapError, swapErrorClass, swapTxHash, refreshWithRetries, status, amount, recordSwap, pendingViaFinal, toToken, emitSwapOutcome]);

  // 6. Inflation Data Processing
  const {
    fromTokenInflationRate,
    toTokenInflationRate,
    fromTokenRegion,
    toTokenRegion,
    inflationDifference,
    hasInflationBenefit,
  } = useMemo(() => {
    const fRate = fromToken ? getInflationRateForStablecoin(fromToken) : 0;
    const tRate = toToken ? getInflationRateForStablecoin(toToken) : 0;
    const fReg = fromToken ? getRegionForStablecoin(fromToken) : "";
    const tReg = toToken ? getRegionForStablecoin(toToken) : "";
    const diff = fRate - tRate;
    return {
      fromTokenInflationRate: fRate,
      toTokenInflationRate: tRate,
      fromTokenRegion: fReg,
      toTokenRegion: tReg,
      inflationDifference: diff,
      hasInflationBenefit: diff > 0,
    };
  }, [
    fromToken,
    toToken,
    getInflationRateForStablecoin,
    getRegionForStablecoin,
  ]);

  return {
    // state
    fromToken,
    setFromToken: setFromTokenByUser,
    toToken,
    setToToken: setToTokenByUser,
    amount,
    setAmount,
    slippageTolerance,
    setSlippageTolerance,
    recipientAddress,
    setRecipientAddress,
    phoneNumber,
    setPhoneNumber,
    fromChainId,
    setFromChainId,
    toChainId,
    setToChainId,
    status,
    localError,
    localErrorClass,
    localTxHash,
    isLoading,
    mounted,

    // route context
    routeProvider,
    quoteNoRoute,
    signatureCount,
    viaHub,
    applyViaHub,
    leg2Hint,
    acknowledgeCompletion,

    // items
    availableFromTokens,
    availableToTokens,
    tokenBalances,
    expectedOutput,
    isExpectedOutputLoading,
    quotedAt,
    refreshQuote,
    inflationDataSource,

    // inflation derived
    fromTokenInflationRate,
    toTokenInflationRate,
    fromTokenRegion,
    toTokenRegion,
    inflationDifference,
    hasInflationBenefit,

    // actions
    handleSwitchTokens,
    executeSwap,
    refreshBalances,
  };
}
