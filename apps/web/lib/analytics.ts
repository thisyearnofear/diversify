/**
 * First-party funnel tracking. Fire-and-forget, privacy-lean:
 * anonymous per-browser session id, allowlisted events (see
 * models/FunnelEvent.ts), coarse string props only, Do Not Track
 * respected. Never throws, never blocks rendering.
 */

const SESSION_KEY = 'diversifi-anon-session';

function sessionId(): string | null {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function trackFunnelEvent(event: string, props?: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  if (navigator.doNotTrack === '1') return;
  const id = sessionId();
  if (!id) return;

  const body = JSON.stringify({ sessionId: id, event, props });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/event', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics must never break the app.
  }
}
