/**
 * useCorridorSignals — fresh dated macro beats for the corridor line.
 *
 * Reads the shared proof feed (`useProofFeed` — sessionStorage cache +
 * 5-min TTL, one fetch per page when a ProofFeedProvider is present).
 * Zero Firecrawl cost: credits are spent only when a watched page
 * changes and fires the webhook; the ticket just reads the anchored
 * MACRO_SIGNAL:* ledger records this feed already returns.
 *
 * A fresh signal supersedes that side's standing `watch` cadence in the
 * corridor beat rotation — the calendar produced a real event. When the
 * feed is empty, stale, has nothing within the freshness window, or a
 * record carries only its on-chain reasoning hash (no off-chain echo),
 * both sides return null and the cadences carry the rotation.
 */
import { useMemo } from 'react';
import { useProofFeed } from './use-proof-feed';
import {
  corridorSignalsFor,
  type CorridorSignal,
} from '@/lib/corridor-context';

export interface CorridorSignals {
  from: CorridorSignal | null;
  to: CorridorSignal | null;
}

export function useCorridorSignals(
  fromToken: string,
  toToken: string,
): CorridorSignals {
  const { data } = useProofFeed();
  return useMemo(
    () => corridorSignalsFor(data?.recent, fromToken, toToken),
    [data, fromToken, toToken],
  );
}
