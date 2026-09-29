/**
 * stamps — circular seals a user presses onto a move. Every stamp is a
 * curated, dated, cited FACT resolved from the two symbols alone:
 * scheduled events (constants/scheduled-events.ts), the corridor
 * depreciation dataset, its risk-event trail, and token provenance.
 * Never a prediction, never a direction, never a number from the caller.
 *
 * An unknown symbol or a same-fiat pair yields [] — the same honesty
 * rule as corridorFor: absence, not padding.
 */
import { canonicalPairSymbol } from './pair-card';
import {
  corridorSideFor,
  currencyRiskAsOfLabel,
  moneyNameFor,
  pairWhatIfFor,
  type CorridorSide,
} from './corridor-context';
import { SCHEDULED_EVENTS, type ScheduledEvent } from '@/constants/scheduled-events';
import { provenanceFor } from '@diversifi/shared/src/constants/token-provenance';

export type StampKind = 'coming' | 'drift' | 'staples' | 'past' | 'watch' | 'control';

export interface Stamp {
  id: string;
  kind: StampKind;
  glyph: string;
  /** The seal's centre value — a date, a signed %, a count, a year. */
  value: string;
  /** One line of the fact. */
  line: string;
  /** Named source — rides the seal's rim text. */
  source: string;
  /** "Mon YYYY" or "Mon D, YYYY" — the fact's own date, never blank. */
  dateLabel: string;
  /** Which side of the pair the fact is about — colours the seal. */
  side: 'from' | 'to';
  /** Coming stamps cite a public url; other kinds resolve to the pair page. */
  url?: string;
}

const TRAY_MAX = 8;
const PRESS_MAX = 3;
const LINE_MAX = 44;
const HORIZON = '5yr' as const;

/** Per-kind tray caps — one crowded calendar mustn't evict the other
 *  fact families. resolveStamps ignores these: a shared link keeps any
 *  id that was ever valid for the pair. */
const KIND_MAX: Record<StampKind, number> = {
  coming: 2,
  drift: 2,
  staples: 1,
  past: 1,
  watch: 1,
  control: 1,
};

const CURATED_SOURCE = 'Curated currency-risk data';
const PROVENANCE_SOURCE = 'Token provenance';

// ── Date labels ──────────────────────────────────────────────────────

function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function dayYear(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function monthYear(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function daysUntil(iso: string, now: Date): number {
  return Math.ceil((Date.parse(iso) - now.getTime()) / 86_400_000);
}

// ── Text discipline ──────────────────────────────────────────────────

/** Cap a line at a word boundary — and never slice through a number. */
function shorten(text: string, max = LINE_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  let cut = t.lastIndexOf(' ', max);
  // Back off while the cut would land inside a number (digit both sides).
  while (cut > 0 && /\d/.test(t[cut - 1]) && /\d/.test(t[cut + 1])) {
    cut = t.lastIndexOf(' ', cut - 1);
  }
  if (cut <= 0) cut = max;
  return `${t.slice(0, cut).trimEnd()}…`;
}

/** Signed percent with a real minus — honest in both directions. */
function signedPct(n: number): string {
  return `${n < 0 ? '−' : '+'}${Math.abs(Math.round(n))}%`;
}

// ── Kind builders ────────────────────────────────────────────────────

function comingStamp(
  e: ScheduledEvent,
  side: 'from' | 'to',
  now: Date,
  held = false,
): Stamp {
  const days = daysUntil(e.date, now);
  return {
    id: `coming-${e.id}`,
    kind: 'coming',
    glyph: e.glyph,
    value: shortDay(e.date),
    line: held
      ? `held ${dayYear(e.date)}`
      : `${e.event} · in ${days} day${days === 1 ? '' : 's'}`,
    source: e.source,
    dateLabel: monthYear(e.asOf),
    side,
    url: e.url,
  };
}

function driftStamps(from: CorridorSide): Stamp[] {
  const entry = from.entry;
  if (!entry) return [];
  const name = moneyNameFor(from.code);
  const out: Stamp[] = [];
  const usd = entry.depreciation.vsUSD[HORIZON];
  const xau = entry.depreciation.vsXAU[HORIZON];
  if (typeof usd === 'number' && usd !== 0) {
    out.push({
      id: 'drift-usd-5yr',
      kind: 'drift',
      glyph: '⚖',
      value: signedPct(usd),
      line: `${name} vs dollar · 5 yrs`,
      source: CURATED_SOURCE,
      dateLabel: currencyRiskAsOfLabel(),
      side: 'from',
    });
  }
  if (typeof xau === 'number' && xau !== 0) {
    out.push({
      id: 'drift-xau-5yr',
      kind: 'drift',
      glyph: '⚖',
      value: signedPct(xau),
      line: `${name} vs gold · 5 yrs`,
      source: CURATED_SOURCE,
      dateLabel: currencyRiskAsOfLabel(),
      side: 'from',
    });
  }
  return out;
}

function staplesStamp(from: string, to: string): Stamp | null {
  const whatIf = pairWhatIfFor(from, to, HORIZON);
  const goods = whatIf?.goods;
  if (!whatIf || !goods) return null;
  if (typeof goods.today !== 'number' || typeof goods.moved !== 'number') {
    return null;
  }
  return {
    id: 'staples',
    kind: 'staples',
    glyph: '🍚',
    value: `${goods.today} → ${goods.moved}`,
    line: shorten(
      `${goods.unit}, if moved to ${whatIf.toName} in ${whatIf.startYear}`,
    ),
    source: CURATED_SOURCE,
    dateLabel: currencyRiskAsOfLabel(),
    side: 'from', // the goods anchor always prices in the from currency
  };
}

function pastStamps(from: CorridorSide, to: CorridorSide): Stamp[] {
  const events = ([['from', from], ['to', to]] as const)
    .flatMap(([side, s]) =>
      (s.entry?.riskEvents ?? []).map((ev) => ({ side, code: s.code, ev })),
    )
    .sort((a, b) => b.ev.year - a.ev.year)
    .slice(0, 2);
  return events.map(({ side, code, ev }) => {
    // Event name alone when the impact would blow the budget — a
    // shortened trail reads "Rate-cut test", never a clipped number.
    const full = `${ev.event} — ${ev.impact}`;
    return {
      id: `past-${code}-${ev.year}`,
      kind: 'past',
      glyph: '📜',
      value: String(ev.year),
      line: full.length <= LINE_MAX ? full : shorten(ev.event),
      source: CURATED_SOURCE,
      dateLabel: ev.asOf ? monthYear(ev.asOf) : currencyRiskAsOfLabel(),
      side: side as 'from' | 'to',
    };
  });
}

/** "About 6× a year" → "6×/yr"; cadences that don't carry a count keep
 *  their words. */
function shortCadence(cadence: string): string {
  const times = cadence.match(/(\d+)\s*×/);
  if (times) return `${times[1]}×/yr`;
  if (/quarterly/i.test(cadence)) return '4×/yr';
  if (/monthly/i.test(cadence)) return '12×/yr';
  if (/two months/i.test(cadence)) return '6×/yr';
  return shorten(cadence, 12);
}

function watchStamp(symbol: string, side: 'from' | 'to'): Stamp | null {
  const p = provenanceFor(symbol);
  if (!p?.watch) return null;
  return {
    id: `watch-${symbol}`,
    kind: 'watch',
    glyph: '👁',
    value: shortCadence(p.watch.cadence),
    line: shorten(p.watch.event),
    source: p.sources[0]?.label ?? PROVENANCE_SOURCE,
    dateLabel: monthYear(p.asOf),
    side,
  };
}

function controlStamp(symbol: string): Stamp | null {
  const p = provenanceFor(symbol);
  if (!p?.keys) return null;
  return {
    id: `control-${symbol}`,
    kind: 'control',
    glyph: '⚿',
    value: symbol,
    line: shorten(p.keys),
    source: p.sources[0]?.label ?? PROVENANCE_SOURCE,
    dateLabel: monthYear(p.asOf),
    side: 'to',
  };
}

// ── The tray ─────────────────────────────────────────────────────────

function buildStamps(
  from: string,
  to: string,
  now: Date,
  includeHeldComing: boolean,
): Stamp[] {
  const fromSide = corridorSideFor(from);
  const toSide = corridorSideFor(to);
  if (!fromSide || !toSide || fromSide.code === toSide.code) return [];

  const out: Stamp[] = [];

  // coming — scheduled, sourced dates for either side's fiat. Held
  // events are only materialised for shared links (resolveStamps);
  // the tray carries what's still ahead.
  const events = SCHEDULED_EVENTS.filter((e) =>
    e.fiat === fromSide.code || e.fiat === toSide.code,
  ).sort((a, b) => a.date.localeCompare(b.date));
  for (const e of events) {
    const held = daysUntil(e.date, now) < 0;
    if (held && !includeHeldComing) continue;
    out.push(comingStamp(e, e.fiat === fromSide.code ? 'from' : 'to', now, held));
  }

  out.push(...driftStamps(fromSide));

  const staples = staplesStamp(from, to);
  if (staples) out.push(staples);

  out.push(...pastStamps(fromSide, toSide));

  for (const [symbol, side] of [
    [from, 'from'],
    [to, 'to'],
  ] as const) {
    const w = watchStamp(symbol, side);
    if (w) out.push(w);
  }

  const control = controlStamp(to);
  if (control) out.push(control);

  // Every stamp must carry a named source and a date — drop any that
  // couldn't rather than ship an uncited fact.
  return out.filter((s) => s.source.trim() !== '' && s.dateLabel.trim() !== '');
}

/** Tray-only caps. Coming picks the nearest from-side event, then the
 *  nearest to-side event; a side with nothing scheduled cedes its slot
 *  to the next nearest overall. Other kinds take their first N in
 *  builder order (past is already most-recent-first; watch prefers the
 *  from-side token). */
function capTray(stamps: Stamp[]): Stamp[] {
  const coming = stamps.filter((s) => s.kind === 'coming');
  const picked = new Set<string>();
  for (const s of [
    coming.find((c) => c.side === 'from'),
    coming.find((c) => c.side === 'to'),
  ]) {
    if (s) picked.add(s.id);
  }
  for (const s of coming) {
    if (picked.size >= KIND_MAX.coming) break;
    picked.add(s.id);
  }
  const counts = new Map<StampKind, number>();
  return stamps.filter((s) => {
    if (s.kind === 'coming') return picked.has(s.id);
    const n = (counts.get(s.kind) ?? 0) + 1;
    counts.set(s.kind, n);
    return n <= KIND_MAX[s.kind];
  });
}

/** The tray — every fact this pair can stamp, ordered, capped, max 8. */
export function stampsForPair(from: string, to: string, now: Date = new Date()): Stamp[] {
  const f = canonicalPairSymbol(from);
  const t = canonicalPairSymbol(to);
  if (!f || !t) return [];
  return capTray(buildStamps(f, t, now, false)).slice(0, TRAY_MAX);
}

/**
 * Resolve a shared postcard's stamp ids against the same builder —
 * expired "coming" stamps still render as "held …" for old links.
 * Foreign ids drop silently; order is the caller's; max 3.
 */
export function resolveStamps(
  from: string,
  to: string,
  ids: string[],
  now: Date = new Date(),
): Stamp[] {
  const f = canonicalPairSymbol(from);
  const t = canonicalPairSymbol(to);
  if (!f || !t) return [];
  const known = new Map(buildStamps(f, t, now, true).map((s) => [s.id, s]));
  const out: Stamp[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (out.length >= PRESS_MAX) break;
    if (seen.has(id)) continue;
    seen.add(id);
    const stamp = known.get(id);
    if (stamp) out.push(stamp);
  }
  return out;
}

export { TRAY_MAX as STAMP_TRAY_MAX, PRESS_MAX as STAMP_PRESS_MAX };
