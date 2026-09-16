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
      return { from, to, line: `${pairLabel} — roughly held level for 5 years` };
    }
    const [weaker, stronger] = cross < 0 ? [from, to] : [to, from];
    return {
      from,
      to,
      line: `${pairLabel} — ${weaker.code} lost ${pct(cross)} to ${stronger.code} in 5 years`,
    };
  }

  // One side is gold (the only entry-less side that can appear).
  if (from.entry && to.code === 'XAU') {
    return {
      from, to,
      line: `${pairLabel} — ${from.code} lost ${pct(from.entry.depreciation.vsXAU['5yr'])} to gold in 5 years`,
    };
  }
  if (to.entry && from.code === 'XAU') {
    return {
      from, to,
      line: `${pairLabel} — ${to.code} lost ${pct(to.entry.depreciation.vsXAU['5yr'])} to gold in 5 years`,
    };
  }
  return null;
}
