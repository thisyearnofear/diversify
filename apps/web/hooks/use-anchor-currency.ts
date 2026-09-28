import { useCallback, useEffect, useMemo, useState } from "react";
import type { Exposure } from "@diversifi/shared/src/config/exposures";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { readPaymentCycleDraft } from "@/hooks/use-payment-cycle";
import {
  fallbackUsdRate,
  resolveAnchorCurrency,
  type AnchorFx,
} from "@/lib/anchor-currency";

/**
 * Live USD→anchor rate from /api/exchange-rates; the fallback table only
 * when the live call fails, labelled as such. Null while loading or when no
 * rate exists at all.
 */
export function useAnchorFx(currency: Exposure): AnchorFx | null {
  const [fx, setFx] = useState<AnchorFx | null>(() =>
    currency === "USD" ? { rate: 1, source: "identity" } : null,
  );
  useEffect(() => {
    if (currency === "USD") {
      setFx({ rate: 1, source: "identity" });
      return;
    }
    let cancelled = false;
    setFx(null);
    const applyFallback = () => {
      const rate = fallbackUsdRate(currency);
      if (!cancelled) setFx(rate ? { rate, source: "fallback" } : null);
    };
    fetch(`/api/exchange-rates?from=USD&to=${currency}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { rate?: number; date?: string } | null) => {
        if (cancelled) return;
        if (body && typeof body.rate === "number" && body.rate > 0) {
          setFx({ rate: body.rate, source: "live", date: body.date ?? "" });
        } else {
          applyFallback();
        }
      })
      .catch(applyFallback);
    return () => {
      cancelled = true;
    };
  }, [currency]);
  return fx;
}

export function useAnchorCurrency(portfolio?: Pick<MultichainPortfolio, "chains"> | null) {
  const { config, updateConfig } = useProtectionProfile();
  const [cycleLocalCurrency] = useState(() => readPaymentCycleDraft().localCurrency);
  const holdings = useMemo(
    () =>
      (portfolio?.chains ?? []).flatMap((chain) =>
        (chain.balances ?? []).map((b) => ({ symbol: b.symbol, value: b.value })),
      ),
    [portfolio],
  );
  const choice = useMemo(
    () =>
      resolveAnchorCurrency({
        saved: config.anchorCurrency,
        cycleLocalCurrency,
        holdings,
      }),
    [config.anchorCurrency, cycleLocalCurrency, holdings],
  );
  const setAnchorCurrency = useCallback(
    (currency: Exposure | null) => updateConfig("anchorCurrency", currency),
    [updateConfig],
  );
  return { anchorCurrency: choice.currency, source: choice.source, setAnchorCurrency };
}
