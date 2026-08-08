import { useCallback, useEffect, useState } from 'react';
// Deep leaf import — NOT the barrel — keeps the timeout helper available
// without dragging the AI/swap/ethers stack into first-load.
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

// Bound best-yield lookups server-side; lift here too so the spinner can't
// freeze the Protect tab if the API is wedged.
const BEST_YIELD_TIMEOUT_MS = 8000;

export interface BestYieldRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  impact?: string;
  impactAsset?: string;
  /**
   * Top-level typed fields used by the focus / highlight surface and the
   * drawer's `open_yield_review` action. All optional: the producer
   * (`packages/shared/src/services/ai/yield-advisor.service.ts`) emits all
   * four for vaults.fyi and GMX rows and as many as it can for free
   * LI.FI rows. Consumers should `?? ''` fall back rather than treat
   * `undefined` as a typed string — this avoids the `as string` casts
   * the previous metadata-roundtrip required.
   */
  source?: 'vaults.fyi' | 'gmx' | 'free' | string;
  protocol?: string;
  /**
   * Display-friendly chain name (e.g. `"Arbitrum"`, `"Base"`). Wherever
   * possible the producer should emit the name rather than the numeric
   * chainId so the focus-key helper (`deriveYieldFocusKey` below) and the
   * drawer's `open_yield_review.chain` stay directly comparable without
   * an id→name lookup on the consumer side.
   */
  chain?: string;
  /**
   * Numeric chain identifier (EVM chainId). All three yield sources can
   * resolve this — keep it top-level so chain-aware UI (filter pills,
   * swap execution) and the drawer's typed action have it on hand
   * without another roundtrip.
   */
  chainId?: number;
  symbol?: string;
  /** Annualised yield (decimal percentage). */
  apy?: number;
  metadata?: {
    /** Backwards-compatible pass-through; consumers should prefer the top-level fields. */
    source?: string;
    apy?: number;
    risk?: string;
    tvl?: number;
    network?: string;
    venue?: string;
    [k: string]: unknown;
  };
}

/**
 * Pure helper — derives the focus key used by the drawer's
 * `open_yield_review` action and matched by `BestYieldCard` to highlight a
 * specific row. The key is `${chain}:${symbol}` so a single string
 * uniquely identifies an opportunity in the 4-row cap.
 *
 * IMPORTANT: this helper is a single source of truth for the focus-key
 * shape — both the drawer (`AIChat.tsx`) and the surface (`BestYieldCard.tsx`)
 * call it, so they cannot diverge. If you change the key shape, change it
 * here and update both sides together (the `BestYieldCard` already does).
 *
 * Edge cases:
 * - Missing chain AND missing symbol → `':'` — never seen in practice but
 *   won't throw.
 * - Two rows with the same `${chain}:${symbol}` collide by design. The
 *   unit test in `__tests__/deriveYieldFocusKey.test.ts` proves this; if
 *   upstream data ever surfaces true duplicates the right mitigation is to
 *   include `source` or `id` in the key, NOT to paper over the collision.
 */
export function deriveYieldFocusKey(rec: Pick<BestYieldRecommendation, 'chain' | 'symbol'>): string {
  return `${rec.chain ?? ''}:${rec.symbol ?? ''}`;
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
      const res = await fetchWithTimeout(
        `${apiBase}/api/agent/best-yield`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress }),
        },
        BEST_YIELD_TIMEOUT_MS,
      );
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
