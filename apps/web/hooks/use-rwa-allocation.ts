/**
 * use-rwa-allocation — Shield's RWA vault sleeve data hook.
 *
 * Free path is instant and local: `computeHeuristicAllocation` runs in the
 * browser (pure function over the static IXS catalog — no network, no keys,
 * no wallet). SERV Reasoning is the opt-in enhancement: when `servOn`, the
 * hook calls /api/agent/rwa-allocation and re-weights the sleeve when the
 * server answers. Every failure keeps the heuristic and sets
 * `degradedReason` — the free path can never regress.
 */
import { useEffect, useMemo, useState } from 'react';
import { computeHeuristicAllocation } from '@diversifi/shared/src/services/serv/rwa-allocator';
import type {
  AllocationProfile,
  RwaAllocationResult,
  ServReceipt,
  VaultAllocation,
} from '@diversifi/shared/src/services/serv/rwa-allocator';
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

export interface UseRwaAllocation {
  allocations: VaultAllocation[];
  source: 'heuristic' | 'serv';
  summary: string;
  /** SERV call in flight — the heuristic stays visible underneath. */
  loading: boolean;
  /** Why SERV didn't enhance (serv_not_configured, serv_timeout, …). */
  degradedReason?: string;
  receipt?: ServReceipt;
}

const HEURISTIC_SUMMARY =
  'Heuristic allocation across the IXS licensed RWA catalog — deterministic, no external call.';

// Client-side budget exceeds the server's own SERV timeout so the honest
// degraded response reaches us instead of a client abort.
const REQUEST_TIMEOUT_MS = 25_000;

export function useRwaAllocation(
  profile: AllocationProfile,
  servOn: boolean,
): UseRwaAllocation {
  const profileKey = JSON.stringify(profile);
  const heuristic = useMemo(
    () => computeHeuristicAllocation(JSON.parse(profileKey)),
    [profileKey],
  );

  const [enhanced, setEnhanced] = useState<RwaAllocationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!servOn) return;
    let cancelled = false;
    setLoading(true);
    setFailed(null);
    fetchWithTimeout(
      '/api/agent/rwa-allocation?serv=1',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: profileKey,
      },
      REQUEST_TIMEOUT_MS,
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`rwa_allocation_http_${res.status}`);
        return (await res.json()) as RwaAllocationResult;
      })
      .then((data) => {
        if (cancelled || !Array.isArray(data.allocations) || !data.allocations.length) return;
        setEnhanced(data);
      })
      .catch(() => {
        if (!cancelled) setFailed('serv_request_failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [servOn, profileKey]);

  // The heuristic is always the floor — it renders while SERV reasons and
  // remains the answer whenever SERV can't.
  if (servOn && !loading && enhanced) {
    return {
      allocations: enhanced.allocations,
      source: enhanced.source,
      summary: enhanced.summary,
      loading: false,
      degradedReason: enhanced.degradedReason,
      receipt: enhanced.receipt,
    };
  }
  return {
    allocations: heuristic,
    source: 'heuristic',
    summary: HEURISTIC_SUMMARY,
    loading: servOn && loading,
    degradedReason: servOn && !loading ? failed ?? undefined : undefined,
  };
}
