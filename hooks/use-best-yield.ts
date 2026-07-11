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
 * fetched server-side so the paid call + engagement tier gate apply. Pass the
 * user's engagement so the paid layer can unlock; omitting it stays free-tier.
 */
export function useBestYield(
  userAddress: string | null,
  engagement: { savedUsd?: number; streakDays?: number } = {},
) {
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
        body: JSON.stringify({ userAddress, savedUsd: engagement.savedUsd, streakDays: engagement.streakDays }),
      });
      if (!res.ok) throw new Error(`best-yield ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load yields');
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, engagement.savedUsd, engagement.streakDays, apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refresh: load };
}
