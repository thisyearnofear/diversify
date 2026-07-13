/**
 * useMacroSignals — Wraps `useProofFeed` to surface global macro
 * signals (Firecrawl-monitored central bank pages, yield trackers,
 * depeg monitors) as `IntelligenceItem[]` for the TradeIntelligence
 * pill on the FX Corridor section.
 *
 * Design constraints (per the density-first pass):
 *   1. Reuse the existing proof feed — no new global fetch. The proof
 *      feed's sessionStorage cache and 5-min TTL cover the macro-signal
 *      cadence (signals arrive on the order of hours, not seconds).
 *   2. Strip `impactAsset` to `undefined` so signals are universal —
 *      an African SME importing from Asia cares about a Fed rate cut
 *      in cUSD, not in their local corridor token. Universal signals
 *      bypass the TradeIntelligence `selectedAsset` filter and always
 *      surface the latest fresh signal.
 *   3. Local-only dismiss semantics. The pill's own useState tracks
 *      dismiss; on the next refetch the signal returns. We don't anchor
 *      dismissals to the ledger (one notification dismissal doesn't
 *      deserve on-chain cost).
 *
 * Mapping (ledger `action` → IntelligenceItem fields):
 *   - RATE_HIKE / DEPEG_RISK → { type: 'alert',  impact: 'negative' }
 *   - RATE_CUT                → { type: 'alert',  impact: 'positive' }
 *   - YIELD_CHANGE            → { type: 'impact', impact: 'positive' }
 *   - INFLATION_SHIFT / other → { type: 'news',   impact: 'neutral'  }
 *
 * The webhook stores `reasoning` as `${oneLiner}. Source: ${url}`, so
 * the title is extracted by splitting on '. Source:' (with a fallback
 * to a humanised signal type if the split misses).
 */

import { useMemo } from "react";
import { useProofFeed } from "./use-proof-feed";
import type { IntelligenceItem } from "@/components/enterprise-fx/TradeIntelligence";

/** Prefix the firecrawl-webhook uses when anchoring a macro signal to
 *  the 0G RecommendationLedger (see `pages/api/agent/firecrawl-webhook.ts`). */
const MACRO_SIGNAL_PREFIX = "MACRO_SIGNAL:";

export interface UseMacroSignalsResult {
  /** Signals ready to pass as `items` to TradeIntelligence. */
  macroSignals: IntelligenceItem[];
  /** True while the upstream proof feed is fetching for the first time. */
  isLoading: boolean;
  /** True when the upstream feed is in degraded (cached) mode. */
  isStale: boolean;
}

function humaniseSignalType(signalType: string): string {
  return signalType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapSignalType(signalType: string): {
  type: IntelligenceItem["type"];
  impact: IntelligenceItem["impact"];
} {
  switch (signalType) {
    case "RATE_HIKE":
    case "DEPEG_RISK":
      return { type: "alert", impact: "negative" };
    case "RATE_CUT":
      return { type: "alert", impact: "positive" };
    case "YIELD_CHANGE":
      return { type: "impact", impact: "positive" };
    case "INFLATION_SHIFT":
    case "none":
    default:
      return { type: "news", impact: "neutral" };
  }
}

function extractTitle(reasoning: string, fallback: string): string {
  // The webhook embeds `<oneLiner>. Source: <url>` in the ledger's
  // reasoning field. Split to recover the human-readable oneLiner.
  // Only treat the split as authoritative when the delimiter is
  // actually present — otherwise the whole reasoning string would
  // be returned as the title (which leaks URLs and the trailing
  // metadata into the pill).
  if (reasoning.includes(". Source:")) {
    const candidate = reasoning.split(". Source:")[0]?.trim();
    if (candidate && candidate.length > 0) return candidate;
  }
  return fallback;
}

export function useMacroSignals(): UseMacroSignalsResult {
  const { data, isLoading, isStale } = useProofFeed();

  const macroSignals = useMemo<IntelligenceItem[]>(() => {
    const recent = data?.recent ?? [];
    return recent
      .filter((rec) => rec.action.startsWith(MACRO_SIGNAL_PREFIX))
      .map((rec): IntelligenceItem => {
        const signalType = rec.action.slice(MACRO_SIGNAL_PREFIX.length) || "UNKNOWN";
        const { type, impact } = mapSignalType(signalType);

        return {
          id: rec.id.toString(),
          type,
          title: extractTitle(rec.reasoning, humaniseSignalType(signalType)),
          description: rec.reasoning,
          impact,
          // Universal: strip the asset filter so the signal surfaces for
          // every corridor audience. The user wants to know "should I
          // settle now" — the destination-currency move matters more
          // than the local corridor token.
          impactAsset: undefined,
          // Display-only string. Not used for any math — `emittedAt` is
          // the source of truth for the 48h freshness check.
          timestamp: "Live",
          // Ledger timestamps are unix seconds; convert to ISO for the
          // TradeIntelligence `maxAgeMs` filter.
          emittedAt: new Date(rec.timestamp * 1000).toISOString(),
        };
      });
  }, [data]);

  return { macroSignals, isLoading, isStale };
}
