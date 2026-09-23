/**
 * corridor-context — token pair → the two currencies and their relationship.
 *
 * Pure lookups over CURRENCY_RISK_DATA plus derived cross-rates. Every line
 * is computed from the curated dataset — never fabricated. A pair with no
 * fiat meaning (ETH→CELO) returns null and renders nothing: absence is
 * honest, not padded.
 */
import {
  CURRENCY_BY_CODE,
  type CurrencyRiskEntry,
} from '@/constants/currency-risk';

/** Token symbol → ISO fiat code it mirrors. Crypto assets and UBI tokens
 *  have no fiat mirror — absent on purpose. */
const TOKEN_TO_FIAT: Record<string, string> = {
  // USD mirrors
  cUSD: 'USD', USDm: 'USD', USDC: 'USD', USDT: 'USD', USDY: 'USD', SYRUPUSDC: 'USD',
  // EUR mirrors
  cEUR: 'EUR', EURm: 'EUR',
  // Mento regional stablecoins
  BRLm: 'BRL', cREAL: 'BRL',
  KESm: 'KES', cKES: 'KES',
  COPm: 'COP',
  PHPm: 'PHP',
  GHSm: 'GHS',
  NGNm: 'NGN',
  ZARm: 'ZAR',
  GBPm: 'GBP',
  XOFm: 'XOF',
  CADm: 'CAD',
  AUDm: 'AUD',
  CHFm: 'CHF',
  JPYm: 'JPY',
  // Gold-backed
  PAXG: 'XAU',
};

export interface CorridorSide {
  token: string;
  code: string;
  flag: string;
  /** Country name for currencies, 'Gold' for XAU. */
  name: string;
  /** Dataset entry — null for XAU and codes with no curated data. */
  entry: CurrencyRiskEntry | null;
}

const XAU_SIDE_FIELDS = { code: 'XAU', flag: '🥇', name: 'Gold', entry: null } as const;

/** The currency a token mirrors, or null when the token has no fiat meaning. */
export function corridorSideFor(token: string | null | undefined): CorridorSide | null {
  if (!token) return null;
  const code = TOKEN_TO_FIAT[token];
  if (!code) return null;
  if (code === 'XAU') return { token, ...XAU_SIDE_FIELDS };
  const entry = CURRENCY_BY_CODE[code] ?? null;
  if (!entry) return null; // fiat code we don't cover (XOF, JPY…) — honest absence
  return { token, code, flag: entry.flag, name: entry.countryName, entry };
}

/** 5yr cross-performance of a vs b via the shared USD anchor, in points.
 *  Negative → a weakened against b. */
function crossDepreciation(a: CurrencyRiskEntry, b: CurrencyRiskEntry): number {
  return ((1 + a.depreciation.vsUSD['5yr'] / 100) / (1 + b.depreciation.vsUSD['5yr'] / 100) - 1) * 100;
}

function pct(n: number): string {
  return `~${Math.abs(Math.round(n))}%`;
}

export interface Corridor {
  from: CorridorSide;
  to: CorridorSide;
  /** The one-line relationship for the ticket. */
  line: string;
  /** Which side lost ground over 5y and by how much — feeds the pair
   *  stage's beam tilt. `points` is the absolute unrounded percent lost;
   *  null when the pair roughly held level or has no measurable spread. */
  drift: { weaker: 'from' | 'to'; points: number } | null;
}

/**
 * The corridor between two selected tokens — one honest line about the
 * relationship, or null when the pair carries no fiat meaning.
 *
 * Copy rules:
 *  - both sides have data → cross-rate ("NGN lost ~57% to KES in 5
 *    years"); near-zero spread → "roughly held level"
 *  - one side is gold → that side's vs-gold track
 *  - same fiat on both sides (cUSD→USDC) → null, nothing to say
 */
export function corridorFor(fromToken: string | null, toToken: string | null): Corridor | null {
  const from = corridorSideFor(fromToken);
  const to = corridorSideFor(toToken);
  if (!from || !to || from.code === to.code) return null;

  const pairLabel = `${from.flag} ${from.code} ⇄ ${to.flag} ${to.code}`;

  if (from.entry && to.entry) {
    const cross = crossDepreciation(from.entry, to.entry);
    if (Math.abs(cross) < 5) {
      return { from, to, line: `${pairLabel} — roughly held level for 5 years`, drift: null };
    }
    const [weaker, stronger] = cross < 0 ? [from, to] : [to, from];
    return {
      from,
      to,
      line: `${pairLabel} — ${weaker.code} lost ${pct(cross)} to ${stronger.code} in 5 years`,
      drift: { weaker: cross < 0 ? 'from' : 'to', points: Math.abs(cross) },
    };
  }

  // One side is gold (the only entry-less side that can appear).
  if (from.entry && to.code === 'XAU') {
    return {
      from, to,
      line: `${pairLabel} — ${from.code} lost ${pct(from.entry.depreciation.vsXAU['5yr'])} to gold in 5 years`,
      drift: { weaker: 'from', points: Math.abs(from.entry.depreciation.vsXAU['5yr']) },
    };
  }
  if (to.entry && from.code === 'XAU') {
    return {
      from, to,
      line: `${pairLabel} — ${to.code} lost ${pct(to.entry.depreciation.vsXAU['5yr'])} to gold in 5 years`,
      drift: { weaker: 'to', points: Math.abs(to.entry.depreciation.vsXAU['5yr']) },
    };
  }
  return null;
}

/**
 * What an amount of the token buys in its home economy — the goods
 * anchor ("6 bags of rice"), not a dollar figure. The token is pegged
 * to the fiat it mirrors, so token units price the staple directly.
 * Only currencies with a curated staple answer (NGN/GHS rice, KES
 * maize flour) — null elsewhere; absence is honest.
 */
export function goodsEquivalentFor(
  symbol: string | null | undefined,
  amount: number,
): string | null {
  const anchor = corridorSideFor(symbol)?.entry?.goodsAnchor;
  if (!anchor || !Number.isFinite(amount) || amount <= 0) return null;
  const count = amount / anchor.price;
  if (count < 0.1) return null;
  const n =
    count >= 10
      ? Math.round(count).toLocaleString('en-US')
      : (Math.round(count * 10) / 10).toString();
  return `${n} ${anchor.unit}`;
}

// ── Fresh dated beats ────────────────────────────────────────────────
//
// The Firecrawl monitors spend credits only when a watched page CHANGES;
// the webhook then anchors an AI-extracted MACRO_SIGNAL:* record to the
// on-chain RecommendationLedger. The ticket reads those anchored records
// through the shared proof feed (sessionStorage-cached, one fetch per
// page) — so a corridor beat that reacts to the world costs zero
// additional Firecrawl credits.

/** A dated macro beat — supersedes a side's standing watch cadence
 *  while fresh. The calendar produced a real event. */
export interface CorridorSignal {
  /** "Sep 18" */
  dateLabel: string;
  /** The extracted one-liner, source URL stripped, length-capped. */
  text: string;
}

/** Minimal structural shape of a ledger record — decoupled from the
 *  proof-feed response type so the selector stays pure. `reasoning` is
 *  optional on purpose: the chain stores only `reasoningHash`, and the
 *  readable text arrives only when an off-chain echo exists. */
export interface CorridorSignalRecord {
  action: string;
  targetToken: string;
  reasoning?: string;
  /** Unix seconds. */
  timestamp: number;
}

const MACRO_SIGNAL_PREFIX = 'MACRO_SIGNAL:';
/** A beat stays "fresh" for two weeks — recent development, not flash. */
export const SIGNAL_FRESH_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_BEAT_LEN = 110;

function extractOneLiner(reasoning: string): string | null {
  // The webhook stores `${oneLiner}. Source: ${url}` — split to recover
  // the line without leaking the URL into the ticket. Records written
  // without the marker still get a trailing URL stripped defensively.
  const text = (
    reasoning.includes('. Source:')
      ? reasoning.split('. Source:')[0]
      : reasoning.replace(/\s*https?:\/\/\S+\s*$/, '')
  ).trim();
  if (!text) return null;
  return text.length > MAX_BEAT_LEN
    ? `${text.slice(0, MAX_BEAT_LEN - 1).trimEnd()}…`
    : text;
}

function dateLabelFor(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The freshest dated macro signal for each side of a pair, matched by
 * fiat code (a Fed signal anchored as cUSD is about the dollar — it
 * belongs to USDC/USDm/USDT pairs too). Newest-first; a same-fiat pair
 * can take two different events of its shared currency. Returns null
 * sides when nothing fresh exists — the standing watch cadence covers.
 */
export function corridorSignalsFor(
  records: CorridorSignalRecord[] | null | undefined,
  fromToken: string | null | undefined,
  toToken: string | null | undefined,
  nowMs: number = Date.now(),
): { from: CorridorSignal | null; to: CorridorSignal | null } {
  const fromCode = corridorSideFor(fromToken)?.code;
  const toCode = corridorSideFor(toToken)?.code;
  const out: { from: CorridorSignal | null; to: CorridorSignal | null } = {
    from: null,
    to: null,
  };
  if (!fromCode && !toCode) return out;

  const sorted = [...(records ?? [])].sort((a, b) => b.timestamp - a.timestamp);
  for (const rec of sorted) {
    if (!rec.action.startsWith(MACRO_SIGNAL_PREFIX)) continue;
    const age = nowMs - rec.timestamp * 1000;
    if (age < 0 || age > SIGNAL_FRESH_MS) continue;
    const code = corridorSideFor(rec.targetToken)?.code;
    if (!code) continue;
    // Hash-only records (no off-chain echo) carry no renderable text —
    // skip them rather than crash or fabricate a beat.
    if (typeof rec.reasoning !== 'string') continue;
    const text = extractOneLiner(rec.reasoning);
    if (!text) continue;
    const signal = { dateLabel: dateLabelFor(rec.timestamp), text };
    if (!out.from && code === fromCode) out.from = signal;
    else if (!out.to && code === toCode) out.to = signal;
    if (out.from && out.to) break;
  }
  return out;
}
