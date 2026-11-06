/**
 * The Guardian's board — which nations' money deserves attention right
 * now, ranked by earned attention rather than a fixed deck. A carousel
 * is presentation; a queue the Guardian maintains is character.
 *
 * Candidates are scored on three honest signals, each carrying its
 * provenance ("why" line shown on the card):
 *   1. your plan's legs — your money leads, weighted by plan share;
 *   2. fresh anchored corridor signals — the Guardian literally noticed
 *      something, recency-weighted (≤24h > ≤72h > ≤7d, older = nothing);
 *   3. imminent curated events — a dated event approaching earns
 *      attention (≤30d > ≤60d, further out = nothing).
 *
 * Empty slate falls back to the default watch pair — the Guardian always
 * watches something, it just ranks by what exists, never invents.
 */
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { SCHEDULED_EVENTS } from '@/constants/scheduled-events';
import {
  corridorSideFor,
  corridorSignalForCurrency,
  type CorridorSignalRecord,
} from '@/lib/corridor-context';

export interface BoardEntry {
  code: string;
  /** Provenance — why the Guardian surfaced this money now. */
  why: string;
  /** Semiotic provenance — the short mark for the line. */
  glyph: string;
  score: number;
}

const DAY = 86_400_000;
const MAX_ENTRIES = 6;

export function boardPriorityFor(args: {
  legs: { token: string; percent: number }[];
  records: CorridorSignalRecord[] | null | undefined;
  nowMs?: number;
}): BoardEntry[] {
  const { legs, records, nowMs = Date.now() } = args;
  const candidates = new Map<
    string,
    { score: number; why: string; glyph: string }
  >();

  // 1. Plan legs — the user's own money leads, weighted by share.
  const sorted = [...legs].sort((a, b) => b.percent - a.percent);
  const primaryCode = sorted[0]
    ? corridorSideFor(sorted[0].token)?.code
    : undefined;
  for (const leg of legs) {
    const code = corridorSideFor(leg.token)?.code;
    if (!code || !CURRENCY_BY_CODE[code]) continue;
    const cur = candidates.get(code) ?? { score: 0, why: '', glyph: '' };
    cur.score += leg.percent;
    cur.why = code === primaryCode ? 'your largest holding' : 'in your plan';
    cur.glyph = '◉';
    candidates.set(code, cur);
  }

  // 2. Fresh anchored signals — a dated print the Guardian noticed.
  for (const code of Object.keys(CURRENCY_BY_CODE)) {
    const sig = corridorSignalForCurrency(records, code, nowMs);
    if (!sig) continue;
    const ageDays = Math.max(0, Math.floor((nowMs - sig.timestamp) / DAY));
    const w = ageDays <= 1 ? 35 : ageDays <= 3 ? 25 : ageDays <= 7 ? 12 : 0;
    if (w === 0) continue;
    const cur = candidates.get(code) ?? { score: 0, why: '', glyph: '' };
    cur.score += w;
    if (!cur.why) {
      cur.why = `signal ${ageDays === 0 ? 'today' : `${ageDays}d ago`}`;
      cur.glyph = '🏛';
    }
    candidates.set(code, cur);
  }

  // 3. Imminent dated events — approaching dates earn the watch.
  for (const ev of SCHEDULED_EVENTS) {
    const days = Math.ceil((Date.parse(ev.date) - nowMs) / DAY);
    if (days < 0 || days > 60) continue;
    const code = ev.fiat.toUpperCase();
    if (!CURRENCY_BY_CODE[code]) continue;
    const cur = candidates.get(code) ?? { score: 0, why: '', glyph: '' };
    cur.score += days <= 30 ? 18 : 8;
    if (!cur.why) {
      cur.why = `in ${days}d · ${ev.event}`;
      cur.glyph = ev.glyph;
    }
    candidates.set(code, cur);
  }

  const entries = [...candidates.entries()]
    .map(([code, v]) => ({
      code,
      why: v.why || 'watching',
      glyph: v.glyph || '◌',
      score: v.score,
    }))
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, MAX_ENTRIES);
  if (entries.length > 0) return entries;
  return [
    { code: 'NGN', why: 'watching', glyph: '◌', score: 0 },
    { code: 'KES', why: 'watching', glyph: '◌', score: 0 },
  ];
}
