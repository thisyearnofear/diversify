/**
 * fetchLedgerRecords — server-side read of the shared proof feed for the
 * shareable cards' beat line. Edge-safe (fetch only), 1.5s budget, and
 * never throws: any failure returns null and the card simply renders
 * without a beat — absence is honest.
 */
import type { CorridorSignalRecord } from '@/lib/corridor-context';

const TIMEOUT_MS = 1500;

export async function fetchLedgerRecords(
  origin: string,
): Promise<CorridorSignalRecord[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/api/agent/zero-g-ledger`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json?.recent)) return null;
    return (json.recent as Record<string, unknown>[]).map((r) => ({
      action: String(r.action ?? ''),
      targetToken: String(r.targetToken ?? ''),
      reasoning: typeof r.reasoning === 'string' ? r.reasoning : undefined,
      timestamp: typeof r.timestamp === 'number' ? r.timestamp : 0,
    }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
