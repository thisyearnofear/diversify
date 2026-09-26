/**
 * use-rwa-market — live figures for Shield's tokenized-asset sleeve.
 * Fetched only while the sleeve is open; any failure leaves every figure
 * null (the row renders without a number, never a stale default).
 */
import { useEffect, useState } from 'react';
import {
  EMPTY_RWA_MARKET,
  type RwaMarket,
} from '@diversifi/shared/src/services/rwa-market-service';
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

export function useRwaMarket(enabled: boolean): { market: RwaMarket; loading: boolean } {
  const [market, setMarket] = useState<RwaMarket>(EMPTY_RWA_MARKET);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    let cancelled = false;
    setLoading(true);
    fetchWithTimeout('/api/agent/rwa-market', {}, 15_000)
      .then(async (res) => (res.ok ? ((await res.json()) as { market?: RwaMarket }) : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.market) setMarket({ ...EMPTY_RWA_MARKET, ...data.market });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, loaded]);

  return { market, loading };
}
