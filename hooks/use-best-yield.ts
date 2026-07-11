import { useCallback, useEffect, useState } from 'react';

export interface BestYieldRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  impact?: string;
  impactAsset?: string;
  metadata?: {
    source?: string; // 'vaults.fyi' | 'gmx' | undefined (free/LI.FI)
    apy?: number;
    risk?: string;
    tvl?: number;
    network?: string;
    venue?: string;
    [k: string]: unknown;
  };
}

export interface BestYieldResult {
  recommendations: BestYieldRecommendation[];
  tier: 'free' | 'saver' | 'committed';
  tierLabel: string;
  paidUnlocked: boolean;
}

/**
 * Personalized best-yield recommendations (vaults.fyi + GMX + free LI.FI),
 * fetched server-side. The paid-insight tier is resolved on the server from the
 * address's real on-chain balance — the client sends only the address, so it
 * can't inflate engagement to unlock paid calls. The returned `tier`/`tierLabel`
 * tell the UI what the user has unlocked.
 */
export function useBestYield(userAddress: string | null) {
  const [data, setData] = useState<BestYieldResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  const load = useCallback(async () => {
    if (!userAddress) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/agent/best-yield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress }),
      });
      if (!res.ok) throw new Error(`best-yield ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load yields');
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refresh: load };
}
