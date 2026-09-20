/**
 * Pure attribution lookups for "why did this sleeve change?" displays.
 *
 * Deliberately reads ONLY user-scoped records — the per-user decisionLog
 * (declines) and rolling anchor history (executions). The TypeSafe Signal
 * Lens shadow reviews are keyed by source fingerprint and carry no wallet
 * address, so they can never appear here as a cause of a user decision;
 * any lens-derived line must be labeled as an advisory shadow review.
 *
 * Anchor records do not carry a target token, so token-matched attribution
 * only ever comes from decision-log entries; anchors surface as "the most
 * recent execution", never as "this slice moved".
 */

import type { GuardianSessionInfo } from '@/hooks/use-session-key';

export interface SleeveAttribution {
  kind: 'decline' | 'proposal';
  capturedAt: string;
  status: string;
  reason: string;
  source?: string;
  targetToken?: string;
  durationMs?: number;
}

type AttributionSource = Pick<
  NonNullable<GuardianSessionInfo>,
  'decisionLog' | 'latestAnchor' | 'latestAnchors' | 'latestRecommendation'
>;

function tokenMatches(candidate: string | undefined, token: string): boolean {
  return !!candidate && candidate.toLowerCase() === token.toLowerCase();
}

/**
 * Newest user-scoped record explaining activity for `token`. Returns null
 * when nothing is known — callers must omit the line, never zero-fill or
 * substitute an unrelated anchor.
 */
export function findTokenAttribution(
  info: AttributionSource | null | undefined,
  token: string,
): SleeveAttribution | null {
  if (!info || !token) return null;

  const decline = (info.decisionLog ?? [])
    .filter((entry) => tokenMatches(entry.targetToken, token))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  if (decline) {
    return {
      kind: 'decline',
      capturedAt: decline.capturedAt,
      status: decline.status,
      reason: decline.reason,
      source: decline.source,
      targetToken: decline.targetToken,
      durationMs: decline.durationMs,
    };
  }

  const pending = info.latestRecommendation;
  if (pending && tokenMatches(pending.targetToken, token)) {
    return {
      kind: 'proposal',
      capturedAt: pending.capturedAt,
      status: 'awaiting_review',
      reason: pending.oneLiner || pending.reasoning || '',
      source: pending.source,
      targetToken: pending.targetToken,
    };
  }

  return null;
}

/** Most recent execution anchor (token-agnostic), or null. */
export function newestExecutionAnchor(info: AttributionSource | null | undefined) {
  return info?.latestAnchors?.[0] ?? info?.latestAnchor ?? null;
}
