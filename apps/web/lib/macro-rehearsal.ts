/**
 * macro-rehearsal — the one definition of "this webhook event is a drill".
 *
 * `scripts/send-test-macro-signal.ts` drives the real Firecrawl entry point
 * with a self-labelled payload: `metadata.rehearsal: true` plus the marker
 * host `rehearsal.local`. Either marker is authoritative — a rehearsal must
 * exercise the whole path (model analysis, chain anchor, reasoning echo,
 * feed join) without ever producing news, queued intents, or memory writes.
 *
 * The action constant is the reader-facing contract: records anchored by a
 * rehearsal carry `MACRO_SIGNAL:REHEARSAL` so beats, pills and health checks
 * filter by action instead of guessing from text. The label constant is
 * stamped into the echo server-side — it never depends on the model
 * remembering to keep the rehearsal label in its oneLiner.
 */

/** Marker host the rehearsal script sends as its source URL. */
export const REHEARSAL_SOURCE_HOST = 'rehearsal.local';

/** Ledger action a rehearsal anchors under — distinct from every real
 *  signal type so readers filter by action, not by text. */
export const REHEARSAL_SIGNAL_ACTION = 'MACRO_SIGNAL:REHEARSAL';

/** The readable label forced into the echo by the server — an honest
 *  warning wherever the line is ever displayed. */
export const REHEARSAL_LABEL = '[Rehearsal — not a market event]';

/** Hostname of a URL, '' when it does not parse. */
function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** True when the webhook payload is a rehearsal — declared metadata or
 *  the marker source URL. */
export function isRehearsalPayload(
  data: { url?: string; metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  if (!data) return false;
  if (data.metadata?.rehearsal === true) return true;
  return hostOf(data.url) === REHEARSAL_SOURCE_HOST;
}
