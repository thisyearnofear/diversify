/**
 * useFxNetting — CARICOM FX matching hook for the Protect/enterprise-fx surface.
 *
 * Follows the use-best-yield.ts pattern: fetches server-side (the API route
 * handles live rate fetching + matching + ledger anchoring), returns typed
 * results. Deep leaf import for fetchWithTimeout keeps the ethers/AI stack
 * out of first-load.
 *
 * The hook is intentionally read-only for matching (POST /api/fx-netting/match
 * with a set of intents). Intent creation (POST /api/fx-netting/intent) is
 * wallet-authenticated and handled separately by the component.
 */

import { useCallback, useState } from 'react';
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

const FX_NETTING_TIMEOUT_MS = 10_000;

export interface FxNettingMatch {
  matchId: string;
  matchedAmount: number;
  rate: number;
  savingsBps: number;
  notionalUsd: number;
  intentA: { participantId: string; sellCurrency: string; buyCurrency: string };
  intentB: { participantId: string; sellCurrency: string; buyCurrency: string };
}

export interface FxNettingResult {
  matches: FxNettingMatch[];
  totalMatchedUsd: number;
  totalSavingsUsd: number;
  unmatchedCount: number;
  rateSourceNote: string;
  rateDate: string | null;
  /** Size of the open pool the server matched against (hosted pool). */
  poolSize?: number;
}

export interface FxNettingInput {
  sellCurrency: string;
  sellAmount: number;
  buyCurrency: string;
}

/** Build a minimal intent payload for the match API (participantId is added server-side). */
function toIntentPayload(input: FxNettingInput, participantId: string) {
  return {
    intentId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participantId,
    sellCurrency: input.sellCurrency.toUpperCase(),
    sellAmount: input.sellAmount,
    buyCurrency: input.buyCurrency.toUpperCase(),
    buyAmountMin: null,
    deadline: 0,
    remainingSell: input.sellAmount,
    status: 'open' as const,
    createdAt: Date.now(),
  };
}

export function useFxNetting(userAddress: string | null) {
  const [data, setData] = useState<FxNettingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  const match = useCallback(
    async (myIntent: FxNettingInput, counterpartyIntents: FxNettingInput[]) => {
      if (!userAddress) {
        setError('Connect your wallet to match FX intents');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // Build the intent pool: the user's intent + any counterparties.
        // In a production system, the server would maintain the intent pool;
        // for the prototype, the client sends the full set.
        const intents = [
          toIntentPayload(myIntent, userAddress),
          ...counterpartyIntents.map((c, i) =>
            toIntentPayload(c, `0x_counterparty_${i}`),
          ),
        ];

        const res = await fetchWithTimeout(
          `${apiBase}/api/fx-netting/match`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intents }),
          },
          FX_NETTING_TIMEOUT_MS,
        );
        if (!res.ok) throw new Error(`fx-netting ${res.status}`);
        const json = await res.json();
        setData({
          matches: json.matches ?? [],
          totalMatchedUsd: json.totalMatchedUsd ?? 0,
          totalSavingsUsd: json.totalSavingsUsd ?? 0,
          unmatchedCount: json.unmatchedIntents?.length ?? 0,
          rateSourceNote: json.rateSourceNote ?? '',
          rateDate: json.rateDate ?? null,
          poolSize: json.poolSize,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to match FX intents');
      } finally {
        setIsLoading(false);
      }
    },
    [userAddress, apiBase],
  );

  return { data, isLoading, error, match };
}
